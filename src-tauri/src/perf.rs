//! Keeps Luma out of the game's way. Luma and its web views run below normal priority, on the efficient
//! cores where the machine has them, with the lowest memory and graphics priority, so when the processor,
//! the memory or the graphics card is busy the game is served first; the thread that reads the game's network
//! traffic is put back at the level of the game's own threads, so no packet waits for a meter. Nothing here
//! touches the game or its memory; it only sets how the operating system schedules Luma's own processes.
//!
//! It also keeps a short log (`performance.log` in the data folder, a line every ten seconds) of what Luma and
//! its web views cost and of the worst moments inside Luma, so a stutter can be traced to a cause instead of
//! guessed at.
use std::sync::atomic::{AtomicU64, Ordering};

/// Worst case or sum since the last log line; the log zeroes them.
pub static WORKER_US: AtomicU64 = AtomicU64::new(0);
pub static STATE_US: AtomicU64 = AtomicU64::new(0);
pub static LOCK_WAIT_US: AtomicU64 = AtomicU64::new(0);
pub static SENT: AtomicU64 = AtomicU64::new(0);
pub static SENT_BYTES: AtomicU64 = AtomicU64::new(0);
pub static SAVES: AtomicU64 = AtomicU64::new(0);
pub static SAVE_MS: AtomicU64 = AtomicU64::new(0);
pub static RESIZES: AtomicU64 = AtomicU64::new(0);

/// Remembers the worst value (microseconds, milliseconds) seen since the last log line.
pub fn worst(counter: &AtomicU64, value: u64) {
    counter.fetch_max(value, Ordering::Relaxed);
}

pub fn add(counter: &AtomicU64, value: u64) {
    counter.fetch_add(value, Ordering::Relaxed);
}

/// Everything Luma starts after this (its web views included) inherits the lowered priority. Set the
/// environment variable `LUMA_NORMAL_PRIORITY` to leave it alone.
#[cfg(windows)]
pub fn lower_process_priority() {
    use windows_sys::Win32::System::Threading::{GetCurrentProcess, SetPriorityClass, BELOW_NORMAL_PRIORITY_CLASS};
    if std::env::var_os("LUMA_NORMAL_PRIORITY").is_some() {
        return;
    }
    unsafe {
        let process = GetCurrentProcess();
        SetPriorityClass(process, BELOW_NORMAL_PRIORITY_CLASS);
        quiet(process);
    }
}

/// What Windows is told about a process that can always wait: run on the efficient cores at a low clock
/// (EcoQoS), keep its memory pages the first to be reclaimed, and give its graphics work the lower queue.
#[cfg(windows)]
unsafe fn quiet(process: windows_sys::Win32::Foundation::HANDLE) {
    use windows_sys::Win32::System::Threading::{
        ProcessMemoryPriority, ProcessPowerThrottling, SetProcessInformation, MEMORY_PRIORITY_INFORMATION, MEMORY_PRIORITY_LOW,
        PROCESS_POWER_THROTTLING_CURRENT_VERSION, PROCESS_POWER_THROTTLING_EXECUTION_SPEED, PROCESS_POWER_THROTTLING_STATE,
    };
    let eco = PROCESS_POWER_THROTTLING_STATE {
        Version: PROCESS_POWER_THROTTLING_CURRENT_VERSION,
        ControlMask: PROCESS_POWER_THROTTLING_EXECUTION_SPEED,
        StateMask: PROCESS_POWER_THROTTLING_EXECUTION_SPEED,
    };
    SetProcessInformation(process, ProcessPowerThrottling, std::ptr::addr_of!(eco).cast(), size_of::<PROCESS_POWER_THROTTLING_STATE>() as u32);
    let memory = MEMORY_PRIORITY_INFORMATION { MemoryPriority: MEMORY_PRIORITY_LOW };
    SetProcessInformation(process, ProcessMemoryPriority, std::ptr::addr_of!(memory).cast(), size_of::<MEMORY_PRIORITY_INFORMATION>() as u32);
    graphics_below_normal(process);
}

/// `D3DKMTSetProcessSchedulingPriorityClass(process, BELOW_NORMAL)`: when the game and a web view both have
/// work for the graphics card, the game's goes first. Looked up by name, so a Windows without it just skips.
#[cfg(windows)]
unsafe fn graphics_below_normal(process: windows_sys::Win32::Foundation::HANDLE) {
    use windows_sys::Win32::System::LibraryLoader::{GetProcAddress, LoadLibraryA};
    const BELOW_NORMAL: i32 = 1;
    let library = LoadLibraryA(c"gdi32.dll".as_ptr().cast());
    if library.is_null() {
        return;
    }
    if let Some(function) = GetProcAddress(library, c"D3DKMTSetProcessSchedulingPriorityClass".as_ptr().cast()) {
        let set: unsafe extern "system" fn(windows_sys::Win32::Foundation::HANDLE, i32) -> i32 = std::mem::transmute(function);
        set(process, BELOW_NORMAL);
    }
}

/// The thread that reads the network: as urgent as the game's own threads inside Luma's lowered class, and
/// kept off the efficient cores' low clock so a burst of packets is read at once.
#[cfg(windows)]
pub fn raise_this_thread() {
    use windows_sys::Win32::System::Threading::{
        GetCurrentThread, SetThreadInformation, SetThreadPriority, ThreadPowerThrottling, THREAD_POWER_THROTTLING_CURRENT_VERSION,
        THREAD_POWER_THROTTLING_EXECUTION_SPEED, THREAD_POWER_THROTTLING_STATE, THREAD_PRIORITY_HIGHEST,
    };
    unsafe {
        let thread = GetCurrentThread();
        SetThreadPriority(thread, THREAD_PRIORITY_HIGHEST);
        let full_speed = THREAD_POWER_THROTTLING_STATE {
            Version: THREAD_POWER_THROTTLING_CURRENT_VERSION,
            ControlMask: THREAD_POWER_THROTTLING_EXECUTION_SPEED,
            StateMask: 0,
        };
        SetThreadInformation(thread, ThreadPowerThrottling, std::ptr::addr_of!(full_speed).cast(), size_of::<THREAD_POWER_THROTTLING_STATE>() as u32);
    }
}

/// A thread of housekeeping (building the state for the windows) that can always wait.
#[cfg(windows)]
pub fn lower_this_thread() {
    use windows_sys::Win32::System::Threading::{GetCurrentThread, SetThreadPriority, THREAD_PRIORITY_BELOW_NORMAL};
    unsafe {
        SetThreadPriority(GetCurrentThread(), THREAD_PRIORITY_BELOW_NORMAL);
    }
}

/// A thread that does a long job in the background (saving history): the lowest processor, disk and memory
/// priority for as long as it lives, so its work is only done in the gaps nobody else wants.
#[cfg(windows)]
pub fn background_this_thread() {
    use windows_sys::Win32::System::Threading::{GetCurrentThread, SetThreadPriority, THREAD_MODE_BACKGROUND_BEGIN};
    unsafe {
        SetThreadPriority(GetCurrentThread(), THREAD_MODE_BACKGROUND_BEGIN);
    }
}

/// Every ten seconds: gives Luma's new web-view processes the same treatment as Luma, and writes one line to
/// the log. The thread is itself in the background and does a few milliseconds of work each time.
#[cfg(windows)]
pub fn watch(log: std::path::PathBuf) {
    let _ = std::thread::Builder::new().name("luma-perf".into()).spawn(move || {
        background_this_thread();
        let mut watcher = windows_watch::Watcher::new(log);
        loop {
            std::thread::sleep(std::time::Duration::from_secs(10));
            watcher.round();
        }
    });
}

#[cfg(windows)]
mod windows_watch {
    use super::*;
    use std::collections::{HashMap, HashSet};
    use std::path::PathBuf;
    use std::time::Instant;
    use windows_sys::Win32::Foundation::{CloseHandle, FILETIME, HANDLE};
    use windows_sys::Win32::System::Diagnostics::ToolHelp::{CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W, TH32CS_SNAPPROCESS};
    use windows_sys::Win32::System::ProcessStatus::{K32GetProcessMemoryInfo, PROCESS_MEMORY_COUNTERS};
    use windows_sys::Win32::System::SystemInformation::GetLocalTime;
    use windows_sys::Win32::System::Threading::{GetProcessTimes, OpenProcess, SetPriorityClass, BELOW_NORMAL_PRIORITY_CLASS, PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_SET_INFORMATION};

    pub struct Watcher {
        log: PathBuf,
        quieted: HashSet<u32>,
        cpu: HashMap<u32, u64>,
        last: Instant,
    }

    impl Watcher {
        pub fn new(log: PathBuf) -> Self {
            Self { log, quieted: HashSet::new(), cpu: HashMap::new(), last: Instant::now() }
        }

        /// The process ids of Luma and everything it started (the web views' own helpers included).
        fn family() -> Vec<u32> {
            let mut parents = Vec::new();
            unsafe {
                let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
                if snapshot.is_null() || snapshot as isize == -1 {
                    return Vec::new();
                }
                let mut entry = PROCESSENTRY32W { dwSize: size_of::<PROCESSENTRY32W>() as u32, ..Default::default() };
                let mut more = Process32FirstW(snapshot, &mut entry) != 0;
                while more {
                    parents.push((entry.th32ProcessID, entry.th32ParentProcessID));
                    more = Process32NextW(snapshot, &mut entry) != 0;
                }
                CloseHandle(snapshot);
            }
            let me = std::process::id();
            let mut family = vec![me];
            let mut index = 0;
            while index < family.len() {
                let parent = family[index];
                for (pid, owner) in &parents {
                    if *owner == parent && *pid != parent && !family.contains(pid) {
                        family.push(*pid);
                    }
                }
                index += 1;
            }
            family
        }

        pub fn round(&mut self) {
            let family = Self::family();
            let me = std::process::id();
            let (mut mine, mut theirs, mut memory) = (0u64, 0u64, 0usize);
            let mut alive = HashSet::new();
            for pid in &family {
                let handle: HANDLE = unsafe { OpenProcess(PROCESS_SET_INFORMATION | PROCESS_QUERY_LIMITED_INFORMATION, 0, *pid) };
                if handle.is_null() {
                    continue;
                }
                alive.insert(*pid);
                unsafe {
                    if *pid != me && self.quieted.insert(*pid) && std::env::var_os("LUMA_NORMAL_PRIORITY").is_none() {
                        SetPriorityClass(handle, BELOW_NORMAL_PRIORITY_CLASS);
                        quiet(handle);
                    }
                    let zero = FILETIME { dwLowDateTime: 0, dwHighDateTime: 0 };
                    let (mut created, mut exited, mut kernel, mut user) = (zero, zero, zero, zero);
                    if GetProcessTimes(handle, &mut created, &mut exited, &mut kernel, &mut user) != 0 {
                        let ticks = |time: FILETIME| (u64::from(time.dwHighDateTime) << 32) | u64::from(time.dwLowDateTime);
                        let total = ticks(kernel) + ticks(user);
                        let spent = total.saturating_sub(self.cpu.insert(*pid, total).unwrap_or(0));
                        if *pid == me { mine += spent } else { theirs += spent }
                    }
                    let mut counters = PROCESS_MEMORY_COUNTERS { cb: size_of::<PROCESS_MEMORY_COUNTERS>() as u32, ..Default::default() };
                    if K32GetProcessMemoryInfo(handle, &mut counters, counters.cb) != 0 {
                        memory += counters.WorkingSetSize;
                    }
                    CloseHandle(handle);
                }
            }
            self.quieted.retain(|pid| alive.contains(pid));
            self.cpu.retain(|pid, _| alive.contains(pid));
            let seconds = self.last.elapsed().as_secs_f64().max(0.001);
            self.last = Instant::now();
            let percent = |ticks: u64| ticks as f64 / 1e7 / seconds * 100.0;
            let time = unsafe {
                let mut now = std::mem::zeroed();
                GetLocalTime(&mut now);
                format!("{:02}:{:02}:{:02}", now.wHour, now.wMinute, now.wSecond)
            };
            let take = |counter: &AtomicU64| counter.swap(0, Ordering::Relaxed);
            let line = format!(
                "{time}  Luma {:.1}% · web views {:.1}% of one core · {} processes, {} MB · loop worst {:.1} ms · state worst {:.1} ms · engine wait worst {:.1} ms · sent {} ({} KB) · history saves {} (worst {} ms) · window resizes {}\n",
                percent(mine), percent(theirs), alive.len(), memory >> 20,
                take(&WORKER_US) as f64 / 1000.0, take(&STATE_US) as f64 / 1000.0, take(&LOCK_WAIT_US) as f64 / 1000.0,
                take(&SENT), take(&SENT_BYTES) >> 10, take(&SAVES), take(&SAVE_MS), take(&RESIZES),
            );
            // The file is kept small: past half a megabyte the old lines are set aside as one file and replaced.
            if std::fs::metadata(&self.log).is_ok_and(|meta| meta.len() > 512 * 1024) {
                let _ = std::fs::rename(&self.log, self.log.with_extension("old.log"));
            }
            if let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open(&self.log) {
                let _ = std::io::Write::write_all(&mut file, line.as_bytes());
            }
        }
    }
}

#[cfg(not(windows))]
pub fn lower_process_priority() {}
#[cfg(not(windows))]
pub fn raise_this_thread() {}
#[cfg(not(windows))]
pub fn lower_this_thread() {}
#[cfg(not(windows))]
pub fn background_this_thread() {}
#[cfg(not(windows))]
pub fn watch(_log: std::path::PathBuf) {}

#[cfg(all(test, windows))]
mod tests {
    #[test]
    fn a_round_of_the_watcher_writes_one_line_about_luma_and_its_helpers() {
        let directory = std::env::temp_dir().join(format!("luma-perf-{}", std::process::id()));
        std::fs::create_dir_all(&directory).unwrap();
        let log = directory.join("performance.log");
        let mut watcher = super::windows_watch::Watcher::new(log.clone());
        super::worst(&super::STATE_US, 1500);
        super::add(&super::SENT, 3);
        watcher.round();
        let text = std::fs::read_to_string(&log).unwrap();
        assert_eq!(text.lines().count(), 1, "{text}");
        assert!(text.contains("Luma ") && text.contains("state worst 1.5 ms") && text.contains("sent 3 ("), "{text}");
        assert!(text.contains(" MB"), "{text}");
        // The counters start over after each line.
        watcher.round();
        assert!(std::fs::read_to_string(&log).unwrap().lines().nth(1).unwrap().contains("sent 0 ("));
        let _ = std::fs::remove_dir_all(&directory);
    }
}

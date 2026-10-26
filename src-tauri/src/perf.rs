//! Keeps Luma out of the game's way. It runs a little below normal priority, so when every core is busy the
//! game is served first, and the thread that reads the game's network traffic is put back at the level of
//! the game's own threads, so no packet waits for a meter. Nothing here touches the game or its memory; it
//! only sets how the operating system schedules Luma's own threads.

/// Everything Luma starts after this (its web views included) inherits the lowered priority. Set the
/// environment variable `LUMA_NORMAL_PRIORITY` to leave it alone.
#[cfg(windows)]
pub fn lower_process_priority() {
    use windows_sys::Win32::System::Threading::{GetCurrentProcess, SetPriorityClass, BELOW_NORMAL_PRIORITY_CLASS};
    if std::env::var_os("LUMA_NORMAL_PRIORITY").is_some() {
        return;
    }
    unsafe {
        SetPriorityClass(GetCurrentProcess(), BELOW_NORMAL_PRIORITY_CLASS);
    }
}

/// The thread that reads the network: as urgent as the game's own threads inside Luma's lowered class.
#[cfg(windows)]
pub fn raise_this_thread() {
    use windows_sys::Win32::System::Threading::{GetCurrentThread, SetThreadPriority, THREAD_PRIORITY_HIGHEST};
    unsafe {
        SetThreadPriority(GetCurrentThread(), THREAD_PRIORITY_HIGHEST);
    }
}

/// A thread of housekeeping (building the state for the windows, saving history) that can always wait.
#[cfg(windows)]
pub fn lower_this_thread() {
    use windows_sys::Win32::System::Threading::{GetCurrentThread, SetThreadPriority, THREAD_PRIORITY_BELOW_NORMAL};
    unsafe {
        SetThreadPriority(GetCurrentThread(), THREAD_PRIORITY_BELOW_NORMAL);
    }
}

#[cfg(not(windows))]
pub fn lower_process_priority() {}
#[cfg(not(windows))]
pub fn raise_this_thread() {}
#[cfg(not(windows))]
pub fn lower_this_thread() {}

//! Configurable Windows RegisterHotKey bindings. No keyboard hook, polling of
//! keystrokes, or game input injection is used. Callbacks must return promptly.

use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
use std::sync::{mpsc, Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::Duration;

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "kebab-case")]
pub enum Action {
    ToggleVisibility,
    ToggleLock,
    TogglePause,
    Reset,
    Settings,
    CopySummary,
    ToggleFullscreen,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct Binding {
    pub action: Action,
    pub shortcut: String,
    pub enabled: bool,
}

pub fn default_bindings() -> Vec<Binding> {
    [
        (Action::ToggleVisibility, "F7"),
        (Action::ToggleLock, "F8"),
        (Action::TogglePause, "F9"),
        (Action::Reset, "F10"),
        (Action::Settings, "F11"),
        (Action::CopySummary, "F6"),
        (Action::ToggleFullscreen, "F5"),
    ]
    .into_iter()
    .map(|(action, key)| Binding {
        action,
        shortcut: format!("Ctrl+Alt+Shift+{key}"),
        enabled: true,
    })
    .collect()
}

#[derive(Clone, Debug, Serialize)]
pub struct HotkeyState {
    pub supported: bool,
    pub enabled: bool,
    pub bindings: Vec<Binding>,
    pub errors: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
struct Parsed {
    binding: Binding,
    modifiers: u32,
    key: u32,
}

/// At least two modifiers prevent an accidental bare game-key registration.
/// Windows-key shortcuts and F12 are reserved by Windows and are rejected.
pub fn normalize_bindings(bindings: Vec<Binding>) -> Result<Vec<Binding>, String> {
    Ok(parse_bindings(bindings)?
        .into_iter()
        .map(|parsed| parsed.binding)
        .collect())
}

fn parse_bindings(bindings: Vec<Binding>) -> Result<Vec<Parsed>, String> {
    if bindings.len() > 7 {
        return Err("At most seven global hotkeys are supported".into());
    }
    let mut actions = BTreeSet::new();
    let mut keys = BTreeSet::new();
    let mut output = Vec::with_capacity(bindings.len());
    for mut binding in bindings {
        if !actions.insert(binding.action) || binding.shortcut.len() > 48 {
            return Err("Duplicate action or oversized global shortcut".into());
        }
        if !binding.enabled && binding.shortcut.trim().is_empty() {
            output.push(Parsed {
                binding,
                modifiers: 0,
                key: 0,
            });
            continue;
        }
        let parts: Vec<_> = binding.shortcut.split('+').map(str::trim).collect();
        if !(3..=4).contains(&parts.len()) {
            return Err("Use two or three modifiers plus a key, such as Ctrl+Alt+F7".into());
        }
        let mut modifiers = 0;
        for modifier in &parts[..parts.len() - 1] {
            let flag = match modifier.to_ascii_lowercase().as_str() {
                "ctrl" | "control" => 2,
                "alt" => 1,
                "shift" => 4,
                _ => return Err("Only Ctrl, Alt and Shift modifiers are supported".into()),
            };
            if modifiers & flag != 0 {
                return Err("A shortcut cannot repeat a modifier".into());
            }
            modifiers |= flag;
        }
        let upper = parts.last().unwrap().to_ascii_uppercase();
        let key =
            if let Some(function) = upper.strip_prefix('F').and_then(|n| n.parse::<u32>().ok()) {
                if !(1..=24).contains(&function) || function == 12 {
                    return Err("Use F1–F24 except F12, which Windows reserves".into());
                }
                0x70 + function - 1
            } else if upper.len() == 1 && upper.as_bytes()[0].is_ascii_alphanumeric() {
                u32::from(upper.as_bytes()[0])
            } else {
                match upper.as_str() {
                    "UP" => 0x26,
                    "DOWN" => 0x28,
                    "LEFT" => 0x25,
                    "RIGHT" => 0x27,
                    "HOME" => 0x24,
                    "END" => 0x23,
                    "PAGEUP" => 0x21,
                    "PAGEDOWN" => 0x22,
                    "INSERT" => 0x2d,
                    _ => return Err("Unsupported shortcut key".into()),
                }
            };
        if binding.enabled && !keys.insert((modifiers, key)) {
            return Err("Two actions cannot use the same enabled shortcut".into());
        }
        let mut canonical = Vec::new();
        if modifiers & 2 != 0 {
            canonical.push("Ctrl");
        }
        if modifiers & 1 != 0 {
            canonical.push("Alt");
        }
        if modifiers & 4 != 0 {
            canonical.push("Shift");
        }
        canonical.push(&upper);
        binding.shortcut = canonical.join("+");
        output.push(Parsed {
            binding,
            modifiers,
            key,
        });
    }
    Ok(output)
}

trait Registrar {
    fn register(&mut self, id: i32, key: &Parsed) -> bool;
    fn unregister(&mut self, id: i32);
}

// Rebindings are transactional: an OS conflict restores all old bindings. If
// restoration itself fails, only successfully restored bindings remain active.
fn replace<R: Registrar>(
    registrar: &mut R,
    installed: &mut Vec<Parsed>,
    next: Vec<Parsed>,
) -> Result<(), Vec<String>> {
    for index in 0..installed.len() {
        registrar.unregister(index as i32 + 1);
    }
    let mut added = Vec::new();
    for (index, key) in next.iter().enumerate() {
        if !key.binding.enabled {
            continue;
        }
        let id = index as i32 + 1;
        if !registrar.register(id, key) {
            for id in added {
                registrar.unregister(id);
            }
            let mut errors = vec![format!(
                "{} is unavailable; another application may use it",
                key.binding.shortcut
            )];
            for (old_index, previous) in installed.iter_mut().enumerate() {
                if previous.binding.enabled && !registrar.register(old_index as i32 + 1, previous) {
                    errors.push(format!("Could not restore {}", previous.binding.shortcut));
                    previous.binding.enabled = false;
                }
            }
            return Err(errors);
        }
        added.push(id);
    }
    *installed = next;
    Ok(())
}

type Callback = Arc<dyn Fn(Action) + Send + Sync + 'static>;
enum Command {
    Update(Vec<Parsed>, mpsc::SyncSender<Result<HotkeyState, String>>),
    Stop,
}

pub struct HotkeyService {
    commands: mpsc::SyncSender<Command>,
    state: Arc<Mutex<HotkeyState>>,
    updating: Mutex<()>,
    worker: Option<JoinHandle<()>>,
}

impl HotkeyService {
    pub fn start(bindings: Vec<Binding>, callback: Callback) -> Result<Self, String> {
        let parsed = parse_bindings(bindings)?;
        let state = Arc::new(Mutex::new(HotkeyState {
            supported: cfg!(windows),
            enabled: false,
            bindings: Vec::new(),
            errors: Vec::new(),
        }));
        let worker_state = state.clone();
        let (commands, receive) = mpsc::sync_channel(8);
        let (ready_send, ready_receive) = mpsc::sync_channel(1);
        let worker = thread::Builder::new()
            .name("luma-global-hotkeys".into())
            .spawn(move || run(parsed, callback, receive, worker_state, ready_send))
            .map_err(|_| "Could not start global hotkeys")?;
        if ready_receive.recv_timeout(Duration::from_secs(2)).is_err() {
            let _ = commands.send(Command::Stop);
            let _ = worker.join();
            return Err("Global hotkey initialization timed out".into());
        }
        Ok(Self {
            commands,
            state,
            updating: Mutex::new(()),
            worker: Some(worker),
        })
    }
    pub fn state(&self) -> HotkeyState {
        self.state.lock().unwrap_or_else(|e| e.into_inner()).clone()
    }
    pub fn update(&self, bindings: Vec<Binding>) -> Result<HotkeyState, String> {
        let parsed = parse_bindings(bindings)?;
        let _updating = self
            .updating
            .lock()
            .map_err(|_| "Hotkey update unavailable")?;
        let (send, receive) = mpsc::sync_channel(1);
        self.commands
            .try_send(Command::Update(parsed, send))
            .map_err(|_| "Global hotkey worker unavailable")?;
        receive
            .recv_timeout(Duration::from_secs(2))
            .map_err(|_| "Global hotkey update timed out")?
    }
    pub fn stop(&mut self) {
        if let Some(worker) = self.worker.take() {
            let _ = self.commands.send(Command::Stop);
            let _ = worker.join();
        }
    }
}
impl Drop for HotkeyService {
    fn drop(&mut self) {
        self.stop();
    }
}

#[cfg(windows)]
fn run(
    initial: Vec<Parsed>,
    callback: Callback,
    receive: mpsc::Receiver<Command>,
    state: Arc<Mutex<HotkeyState>>,
    ready: mpsc::SyncSender<()>,
) {
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
        RegisterHotKey, UnregisterHotKey, MOD_NOREPEAT,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{PeekMessageW, MSG, PM_REMOVE, WM_HOTKEY};
    struct WindowsRegistrar;
    impl Registrar for WindowsRegistrar {
        fn register(&mut self, id: i32, key: &Parsed) -> bool {
            unsafe {
                RegisterHotKey(
                    std::ptr::null_mut(),
                    id,
                    key.modifiers | MOD_NOREPEAT,
                    key.key,
                ) != 0
            }
        }
        fn unregister(&mut self, id: i32) {
            unsafe {
                UnregisterHotKey(std::ptr::null_mut(), id);
            }
        }
    }
    let mut registrar = WindowsRegistrar;
    let mut installed = Vec::new();
    let errors = replace(&mut registrar, &mut installed, initial)
        .err()
        .unwrap_or_default();
    *state.lock().unwrap_or_else(|e| e.into_inner()) = HotkeyState {
        supported: true,
        enabled: installed.iter().any(|v| v.binding.enabled),
        bindings: installed.iter().map(|v| v.binding.clone()).collect(),
        errors,
    };
    let _ = ready.send(());
    'running: loop {
        while let Ok(command) = receive.try_recv() {
            match command {
                Command::Stop => break 'running,
                Command::Update(next, answer) => {
                    // Discard key notifications queued for the previous action
                    // mapping before assigning new registrations to those IDs.
                    let mut stale = MSG::default();
                    while unsafe {
                        PeekMessageW(
                            &mut stale,
                            std::ptr::null_mut(),
                            WM_HOTKEY,
                            WM_HOTKEY,
                            PM_REMOVE,
                        )
                    } != 0
                    {}
                    let result = replace(&mut registrar, &mut installed, next);
                    let next_state = HotkeyState {
                        supported: true,
                        enabled: installed.iter().any(|v| v.binding.enabled),
                        bindings: installed.iter().map(|v| v.binding.clone()).collect(),
                        errors: result.as_ref().err().cloned().unwrap_or_default(),
                    };
                    *state.lock().unwrap_or_else(|e| e.into_inner()) = next_state.clone();
                    let _ = answer.send(
                        result
                            .map(|_| next_state)
                            .map_err(|errors| errors.join("; ")),
                    );
                }
            }
        }
        let mut message = MSG::default();
        while unsafe { PeekMessageW(&mut message, std::ptr::null_mut(), 0, 0, PM_REMOVE) } != 0 {
            if message.message == WM_HOTKEY {
                let index = message.wParam.checked_sub(1);
                if let Some(binding) = index
                    .and_then(|index| installed.get(index))
                    .filter(|key| key.binding.enabled)
                {
                    let modifiers = (message.lParam as usize & 0xf) as u32;
                    let key = ((message.lParam as usize >> 16) & 0xffff) as u32;
                    if modifiers == binding.modifiers && key == binding.key {
                        callback(binding.binding.action);
                    }
                }
            }
        }
        thread::sleep(Duration::from_millis(15));
    }
    for index in 0..installed.len() {
        registrar.unregister(index as i32 + 1);
    }
    let mut state = state.lock().unwrap_or_else(|e| e.into_inner());
    state.enabled = false;
    state
        .bindings
        .iter_mut()
        .for_each(|binding| binding.enabled = false);
}

#[cfg(not(windows))]
fn run(
    initial: Vec<Parsed>,
    _callback: Callback,
    receive: mpsc::Receiver<Command>,
    state: Arc<Mutex<HotkeyState>>,
    ready: mpsc::SyncSender<()>,
) {
    let mut snapshot = HotkeyState {
        supported: false,
        enabled: false,
        bindings: initial
            .into_iter()
            .map(|mut key| {
                key.binding.enabled = false;
                key.binding
            })
            .collect(),
        errors: vec!["Global hotkeys currently require Windows".into()],
    };
    *state.lock().unwrap_or_else(|e| e.into_inner()) = snapshot.clone();
    let _ = ready.send(());
    while let Ok(command) = receive.recv() {
        match command {
            Command::Stop => break,
            Command::Update(next, answer) => {
                snapshot.bindings = next
                    .into_iter()
                    .map(|mut key| {
                        key.binding.enabled = false;
                        key.binding
                    })
                    .collect();
                *state.lock().unwrap_or_else(|e| e.into_inner()) = snapshot.clone();
                let _ = answer.send(Err(snapshot.errors[0].clone()));
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn binding(action: Action, shortcut: &str) -> Binding {
        Binding {
            action,
            shortcut: shortcut.into(),
            enabled: true,
        }
    }
    #[test]
    fn shortcuts_are_bounded_unambiguous_and_avoid_reserved_game_keys() {
        assert_eq!(
            normalize_bindings(vec![binding(Action::Reset, " shift + control + f9 ")]).unwrap()[0]
                .shortcut,
            "Ctrl+Shift+F9"
        );
        for invalid in [
            "Ctrl+X",
            "X",
            "Ctrl+Alt+F12",
            "Win+Alt+F7",
            "Ctrl+Ctrl+F8",
            "Ctrl+Alt+Escape",
            "Ctrl+Alt+F25",
            "Ctrl+Alt+F0",
        ] {
            assert!(
                normalize_bindings(vec![binding(Action::Reset, invalid)]).is_err(),
                "{invalid}"
            );
        }
        assert!(normalize_bindings(vec![
            binding(Action::Reset, "Ctrl+Alt+F7"),
            binding(Action::Settings, "Alt+Ctrl+F7")
        ])
        .is_err());
        assert!(normalize_bindings(vec![
            binding(Action::Reset, "Ctrl+Alt+F7"),
            binding(Action::Reset, "Ctrl+Alt+F8")
        ])
        .is_err());
        assert_eq!(normalize_bindings(default_bindings()).unwrap().len(), 7);
    }
    #[derive(Default)]
    struct Fake {
        active: std::collections::BTreeMap<i32, u32>,
        blocked: BTreeSet<u32>,
    }
    impl Registrar for Fake {
        fn register(&mut self, id: i32, key: &Parsed) -> bool {
            if self.blocked.contains(&key.key) {
                false
            } else {
                self.active.insert(id, key.key);
                true
            }
        }
        fn unregister(&mut self, id: i32) {
            self.active.remove(&id);
        }
    }
    #[test]
    fn os_conflict_restores_previous_registration_and_returns_honest_errors() {
        let old = parse_bindings(vec![binding(Action::ToggleLock, "Ctrl+Alt+F8")]).unwrap();
        let mut registrar = Fake::default();
        let mut installed = Vec::new();
        replace(&mut registrar, &mut installed, old.clone()).unwrap();
        registrar.blocked.insert(0x79);
        assert!(replace(
            &mut registrar,
            &mut installed,
            parse_bindings(vec![
                binding(Action::Settings, "Ctrl+Alt+F9"),
                binding(Action::Reset, "Ctrl+Alt+F10")
            ])
            .unwrap()
        )
        .is_err());
        assert_eq!(installed, old);
        assert_eq!(registrar.active.len(), 1);
        assert_eq!(registrar.active[&1], 0x77);
        registrar.blocked.insert(0x77);
        let error = replace(
            &mut registrar,
            &mut installed,
            parse_bindings(vec![binding(Action::Reset, "Ctrl+Alt+F10")]).unwrap(),
        )
        .unwrap_err();
        assert_eq!(error.len(), 2);
        assert!(!installed[0].binding.enabled);
        assert!(registrar.active.is_empty());
    }
    #[test]
    fn disabling_all_bindings_releases_every_registration() {
        let mut registrar = Fake::default();
        let mut installed = Vec::new();
        replace(
            &mut registrar,
            &mut installed,
            parse_bindings(default_bindings()).unwrap(),
        )
        .unwrap();
        assert_eq!(registrar.active.len(), 7);
        let disabled = default_bindings()
            .into_iter()
            .map(|mut value| {
                value.enabled = false;
                value
            })
            .collect();
        replace(
            &mut registrar,
            &mut installed,
            parse_bindings(disabled).unwrap(),
        )
        .unwrap();
        assert!(registrar.active.is_empty());
        assert!(installed.iter().all(|key| !key.binding.enabled));
    }
    #[cfg(windows)]
    #[test]
    fn native_worker_initializes_reconfigures_and_stops_without_reserved_keys() {
        let mut service = HotkeyService::start(Vec::new(), Arc::new(|_| {})).unwrap();
        assert!(service.state().supported);
        assert!(!service.state().enabled);
        assert!(service.update(Vec::new()).unwrap().errors.is_empty());
        service.stop();
        assert!(!service.state().enabled);
        assert!(service.update(Vec::new()).is_err());
    }
}

//! Detachable panels: PvP, health with the boss frenzy, and the Hidden Cube each get a small
//! always-on-top window of their own, opened and closed one by one from the tools menu.
//!
//! A panel window only reads. It asks the same commands as the meter, never saves a preference,
//! and the only thing that is stored for it is where it was left. That is kept in `overlays.json`
//! so a panel comes back where it was, clamped onto a screen that still exists.
use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeMap,
    fs,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::{Duration, Instant},
};
use tauri::{
    AppHandle, Manager, PhysicalPosition, PhysicalSize, State, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder, Window, WindowEvent,
};

pub const PANELS: [&str; 7] = ["pvp", "vitals", "cube", "party", "tickets", "tracker", "cooldowns"];
const LABEL_PREFIX: &str = "overlay-";
const MIN_EDGE: u32 = 120;
const MAX_EDGE: u32 = 1600;
const MAX_FILE: u64 = 64 * 1024;
const WRITE_DELAY: Duration = Duration::from_millis(1000);

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Frame {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct Entry {
    pub frame: Option<Frame>,
    pub open: bool,
}

/// The panel a window label belongs to, if it is one of ours.
pub fn panel_of(label: &str) -> Option<&'static str> {
    let name = label.strip_prefix(LABEL_PREFIX)?;
    PANELS.iter().copied().find(|panel| *panel == name)
}

pub fn valid(panel: &str) -> Option<&'static str> {
    PANELS.iter().copied().find(|known| *known == panel)
}

pub fn label(panel: &str) -> String {
    format!("{LABEL_PREFIX}{panel}")
}

/// Logical size a panel opens at when nothing was stored for it.
pub fn default_size(panel: &str) -> (u32, u32) {
    match panel {
        "pvp" => (290, 270),
        "vitals" => (290, 210),
        "party" => (270, 230),
        "tickets" => (250, 250),
        "tracker" => (270, 260),
        "cooldowns" => (270, 230),
        _ => (270, 170),
    }
}

fn sane(frame: Frame) -> bool {
    // A minimised window reports a position far off every screen; never remember that.
    frame.x > -10_000
        && frame.y > -10_000
        && frame.x < 100_000
        && frame.y < 100_000
        && frame.width >= 16
        && frame.height >= 16
}

/// Put a remembered frame back on a screen: a sane size, and its title strip reachable by at least
/// 60 x 20 pixels on some screen, otherwise at the first screen's corner.
pub fn clamp(frame: Frame, screens: &[Frame]) -> Frame {
    let mut frame = Frame {
        width: frame.width.clamp(MIN_EDGE, MAX_EDGE),
        height: frame.height.clamp(MIN_EDGE / 2, MAX_EDGE),
        ..frame
    };
    let reachable = screens.iter().any(|screen| {
        let left = frame.x.max(screen.x);
        let right = (frame.x + frame.width as i32).min(screen.x + screen.width as i32);
        let top = frame.y.max(screen.y);
        let bottom = (frame.y + 28).min(screen.y + screen.height as i32);
        right - left >= 60 && bottom - top >= 20
    });
    if !reachable {
        let origin = screens.first().map_or((0, 0), |screen| (screen.x, screen.y));
        frame.x = origin.0 + 40;
        frame.y = origin.1 + 40;
    }
    frame
}

pub struct Store {
    path: PathBuf,
    entries: Mutex<BTreeMap<String, Entry>>,
    dirty_since: Mutex<Option<Instant>>,
    /// Set when the meter itself is closing, so the panels that close with it stay "open" for the
    /// next start.
    pub quitting: AtomicBool,
}

impl Store {
    pub fn load(directory: &Path) -> Self {
        let path = directory.join("overlays.json");
        let entries = fs::metadata(&path)
            .ok()
            .filter(|meta| meta.len() <= MAX_FILE)
            .and_then(|_| fs::read(&path).ok())
            .and_then(|bytes| serde_json::from_slice::<BTreeMap<String, Entry>>(&bytes).ok())
            .map(|stored| {
                stored
                    .into_iter()
                    .filter(|(panel, _)| valid(panel).is_some())
                    .map(|(panel, mut entry)| {
                        entry.frame = entry.frame.filter(|frame| sane(*frame));
                        (panel, entry)
                    })
                    .collect()
            })
            .unwrap_or_default();
        Self {
            path,
            entries: Mutex::new(entries),
            dirty_since: Mutex::new(None),
            quitting: AtomicBool::new(false),
        }
    }

    fn touch(&self) {
        if let Ok(mut since) = self.dirty_since.lock() {
            since.get_or_insert_with(Instant::now);
        }
    }

    pub fn entry(&self, panel: &str) -> Entry {
        self.entries
            .lock()
            .ok()
            .and_then(|entries| entries.get(panel).copied())
            .unwrap_or_default()
    }

    pub fn open_panels(&self) -> Vec<&'static str> {
        PANELS
            .iter()
            .copied()
            .filter(|panel| self.entry(panel).open)
            .collect()
    }

    pub fn set_open(&self, panel: &str, open: bool) {
        if let Ok(mut entries) = self.entries.lock() {
            let entry = entries.entry(panel.to_string()).or_default();
            if entry.open != open {
                entry.open = open;
                drop(entries);
                self.touch();
            }
        }
    }

    pub fn remember(&self, panel: &str, frame: Frame) {
        if !sane(frame) {
            return;
        }
        if let Ok(mut entries) = self.entries.lock() {
            let entry = entries.entry(panel.to_string()).or_default();
            if entry.frame != Some(frame) {
                entry.frame = Some(frame);
                drop(entries);
                self.touch();
            }
        }
    }

    /// Write the file when something changed: at once when forced, otherwise a second after the
    /// first change so dragging a panel does not write on every pixel.
    pub fn flush(&self, force: bool) {
        let due = self
            .dirty_since
            .lock()
            .ok()
            .and_then(|since| *since)
            .is_some_and(|since| force || since.elapsed() >= WRITE_DELAY);
        if !due {
            return;
        }
        let Ok(bytes) = self
            .entries
            .lock()
            .map_err(|_| ())
            .and_then(|entries| serde_json::to_vec(&*entries).map_err(|_| ()))
        else {
            return;
        };
        let temporary = self.path.with_extension("json.new");
        let written = self
            .path
            .parent()
            .is_some_and(|directory| fs::create_dir_all(directory).is_ok())
            && fs::write(&temporary, bytes).is_ok()
            && fs::rename(&temporary, &self.path).is_ok();
        if written {
            if let Ok(mut since) = self.dirty_since.lock() {
                *since = None;
            }
        }
    }
}

fn frame_of(window: &WebviewWindow) -> Option<Frame> {
    let position = window.outer_position().ok()?;
    let size = window.outer_size().ok()?;
    let frame = Frame {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
    };
    sane(frame).then_some(frame)
}

fn screens(app: &AppHandle) -> Vec<Frame> {
    app.available_monitors()
        .unwrap_or_default()
        .iter()
        .map(|monitor| Frame {
            x: monitor.position().x,
            y: monitor.position().y,
            width: monitor.size().width,
            height: monitor.size().height,
        })
        .collect()
}

/// A first place for a panel: to the right of the meter, one step lower for each panel before it.
fn beside_meter(app: &AppHandle, panel: &str) -> Option<Frame> {
    let main = app.get_webview_window("main").and_then(|window| frame_of(&window))?;
    let index = PANELS.iter().position(|known| *known == panel).unwrap_or(0) as i32;
    Some(Frame {
        x: main.x + main.width as i32 + 8,
        y: main.y + index * 36,
        width: 0,
        height: 0,
    })
}

pub fn open(app: &AppHandle, store: &Store, panel: &'static str) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(&label(panel)) {
        window.show().map_err(|error| error.to_string())?;
        store.set_open(panel, true);
        return Ok(());
    }
    let (width, height) = default_size(panel);
    let window = WebviewWindowBuilder::new(
        app,
        label(panel),
        WebviewUrl::App(format!("overlay.html?panel={panel}").into()),
    )
    .title(format!("Luma {panel}"))
    .inner_size(f64::from(width), f64::from(height))
    .min_inner_size(f64::from(MIN_EDGE), f64::from(MIN_EDGE / 2))
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .shadow(false)
    .resizable(true)
    .focused(false)
    .visible(false)
    .build()
    .map_err(|error| error.to_string())?;
    let screens = screens(app);
    let remembered = store.entry(panel).frame.map(|frame| clamp(frame, &screens));
    if let Some(frame) = remembered {
        let _ = window.set_size(PhysicalSize::new(frame.width, frame.height));
        let _ = window.set_position(PhysicalPosition::new(frame.x, frame.y));
    } else if let Some(place) = beside_meter(app, panel) {
        // Only the position is chosen; the size is the default one.
        let place = clamp(Frame { width: MIN_EDGE, height: MIN_EDGE, ..place }, &screens);
        let _ = window.set_position(PhysicalPosition::new(place.x, place.y));
    }
    window.show().map_err(|error| error.to_string())?;
    store.set_open(panel, true);
    Ok(())
}

pub fn close(app: &AppHandle, store: &Store, panel: &'static str) {
    if let Some(window) = app.get_webview_window(&label(panel)) {
        if let Some(frame) = frame_of(&window) {
            store.remember(panel, frame);
        }
        store.set_open(panel, false);
        store.flush(true);
        let _ = window.close();
    } else {
        store.set_open(panel, false);
        store.flush(true);
    }
}

fn open_now(app: &AppHandle) -> Vec<String> {
    PANELS
        .iter()
        .filter(|panel| app.get_webview_window(&label(panel)).is_some())
        .map(|panel| (*panel).to_string())
        .collect()
}

/// Bring back the panels that were open when the meter was last closed.
pub fn restore(app: &AppHandle) {
    let app = app.clone();
    std::thread::spawn(move || {
        // The meter window first; a panel opened beside it needs its place.
        std::thread::sleep(Duration::from_millis(900));
        let Some(store) = app.try_state::<Arc<Store>>() else {
            return;
        };
        for panel in store.open_panels() {
            let _ = open(&app, &store, panel);
        }
    });
}

/// The meter is closing: remember where everything is and take the panels down with it.
pub fn shutdown(app: &AppHandle) {
    if let Some(store) = app.try_state::<Arc<Store>>() {
        store.quitting.store(true, Ordering::Relaxed);
        for panel in PANELS {
            if let Some(window) = app.get_webview_window(&label(panel)) {
                if let Some(frame) = frame_of(&window) {
                    store.remember(panel, frame);
                }
                let _ = window.destroy();
            }
        }
        store.flush(true);
    }
}

/// Window events of a panel never touch the meter's own geometry or lifetime.
pub fn on_event(window: &Window, panel: &'static str, event: &WindowEvent) {
    let Some(store) = window.try_state::<Arc<Store>>() else {
        return;
    };
    match event {
        WindowEvent::Moved(_) | WindowEvent::Resized(_) => {
            if let (Ok(position), Ok(size)) = (window.outer_position(), window.outer_size()) {
                store.remember(
                    panel,
                    Frame {
                        x: position.x,
                        y: position.y,
                        width: size.width,
                        height: size.height,
                    },
                );
            }
        }
        WindowEvent::Destroyed => {
            if !store.quitting.load(Ordering::Relaxed) {
                store.set_open(panel, false);
                store.flush(true);
            }
        }
        _ => {}
    }
}

fn require_panel(window: &WebviewWindow) -> Result<(), String> {
    panel_of(window.label())
        .map(|_| ())
        .ok_or_else(|| "Only a panel window can do this".to_string())
}

/// Open or close one panel; answers with the panels that are open now.
#[tauri::command]
pub async fn set_overlay(
    app: AppHandle,
    store: State<'_, Arc<Store>>,
    panel: String,
    open: bool,
) -> Result<Vec<String>, String> {
    let panel = valid(&panel).ok_or("Unknown panel")?;
    if open {
        self::open(&app, &store, panel)?;
    } else {
        close(&app, &store, panel);
    }
    Ok(open_now(&app))
}

#[tauri::command]
pub fn list_overlays(app: AppHandle) -> Vec<String> {
    open_now(&app)
}

#[tauri::command]
pub fn overlay_drag(window: WebviewWindow) -> Result<(), String> {
    require_panel(&window)?;
    window.start_dragging().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn overlay_resize(window: WebviewWindow) -> Result<(), String> {
    require_panel(&window)?;
    window
        .as_ref()
        .window()
        .start_resize_dragging(tauri_runtime::ResizeDirection::SouthEast)
        .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn screen(x: i32, y: i32, width: u32, height: u32) -> Frame {
        Frame { x, y, width, height }
    }
    fn directory(name: &str) -> PathBuf {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_or(0, |time| time.as_nanos());
        let path = std::env::temp_dir().join(format!("luma-overlays-{name}-{}-{nanos}", std::process::id()));
        fs::create_dir_all(&path).unwrap();
        path
    }

    #[test]
    fn only_our_panels_have_labels_and_names() {
        for panel in PANELS {
            assert_eq!(panel_of(&label(panel)), Some(panel));
            assert_eq!(valid(panel), Some(panel));
            let (width, height) = default_size(panel);
            assert!((MIN_EDGE..=MAX_EDGE).contains(&width) && (MIN_EDGE / 2..=MAX_EDGE).contains(&height));
        }
        for other in ["main", "overlay-", "overlay-main", "overlay-pvp2", "OVERLAY-pvp", ""] {
            assert_eq!(panel_of(other), None, "{other}");
        }
        assert_eq!(valid("../pvp"), None);
        assert_eq!(valid(""), None);
    }

    #[test]
    fn a_remembered_frame_is_brought_back_onto_a_screen() {
        let screens = [screen(0, 0, 1920, 1080), screen(1920, 0, 1280, 1024)];
        let kept = Frame { x: 2000, y: 100, width: 300, height: 250 };
        assert_eq!(clamp(kept, &screens), kept);
        // A screen that was unplugged: the panel moves to the first screen's corner.
        let gone = Frame { x: 5000, y: 300, width: 300, height: 250 };
        assert_eq!(clamp(gone, &screens), Frame { x: 40, y: 40, width: 300, height: 250 });
        // Only a sliver of the title strip on screen is not reachable.
        let sliver = Frame { x: -280, y: 10, width: 300, height: 250 };
        assert_eq!(clamp(sliver, &screens).x, 40);
        // Half off the edge is still reachable.
        let half = Frame { x: -150, y: 10, width: 300, height: 250 };
        assert_eq!(clamp(half, &screens), half);
        // Absurd sizes are bounded, and no screen at all still gives a place.
        let huge = Frame { x: 0, y: 0, width: 90_000, height: 5 };
        let bounded = clamp(huge, &screens);
        assert_eq!((bounded.width, bounded.height), (MAX_EDGE, MIN_EDGE / 2));
        assert_eq!(clamp(kept, &[]).x, 40);
    }

    #[test]
    fn what_was_left_is_stored_and_garbage_is_ignored() {
        let directory = directory("store");
        let store = Store::load(&directory);
        assert!(store.open_panels().is_empty());
        let frame = Frame { x: 100, y: 120, width: 300, height: 260 };
        store.set_open("pvp", true);
        store.remember("pvp", frame);
        store.remember("pvp", Frame { x: -32_000, y: -32_000, width: 160, height: 28 });
        store.flush(false);
        assert!(!directory.join("overlays.json").exists(), "a change waits a second before it is written");
        store.flush(true);
        let again = Store::load(&directory);
        assert_eq!(again.open_panels(), vec!["pvp"]);
        assert_eq!(again.entry("pvp").frame, Some(frame));
        assert_eq!(again.entry("cube"), Entry::default());
        again.set_open("pvp", false);
        again.flush(true);
        assert!(Store::load(&directory).open_panels().is_empty());

        fs::write(
            directory.join("overlays.json"),
            br#"{"pvp":{"frame":{"x":1,"y":2,"width":3,"height":4},"open":true},"../evil":{"open":true},"cube":{"open":true}}"#,
        )
        .unwrap();
        let cleaned = Store::load(&directory);
        assert_eq!(cleaned.open_panels(), vec!["pvp", "cube"]);
        assert_eq!(cleaned.entry("pvp").frame, None, "a frame too small to be a window is dropped");
        fs::write(directory.join("overlays.json"), b"not json").unwrap();
        assert!(Store::load(&directory).open_panels().is_empty());
        fs::write(directory.join("overlays.json"), vec![b' '; (MAX_FILE + 1) as usize]).unwrap();
        assert!(Store::load(&directory).open_panels().is_empty());
        let _ = fs::remove_dir_all(directory);
    }
}

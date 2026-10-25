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
        atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering},
        Arc, Mutex,
    },
    time::{Duration, Instant},
};
use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, State, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder, Window, WindowEvent,
};

pub const PANELS: [&str; 18] = [
    "damage", "pvp", "vitals", "cube", "party", "tickets", "tracker", "cooldowns", "currencies", "effects",
    "timers", "flight", "bosshp", "actions", "rivals", "map", "ping", "controls",
];
/// The grid (in logical pixels) a window settles on once let go; 0 is off. Set by the windows from
/// the saved preference.
static SNAP_GRID: AtomicU32 = AtomicU32::new(0);
static LAST_MOVE: AtomicU64 = AtomicU64::new(0);
/// While locked (how Luma starts) the detached windows let every click through to the game and show
/// no title bar; unlocked (the editing state, Alt+E) they can be moved, resized and closed.
static LOCKED: AtomicBool = AtomicBool::new(true);
/// A window that is only shown while you fight, and for a while after.
const GRACE_MS: u64 = 15_000;
static LAST_ACTIVE: AtomicU64 = AtomicU64::new(0);
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
        "damage" => (340, 320),
        "pvp" => (300, 300),
        "vitals" => (300, 240),
        "party" => (360, 340),
        "tickets" => (340, 420),
        "tracker" => (290, 300),
        "cooldowns" => (300, 300),
        "currencies" => (270, 240),
        "effects" => (290, 300),
        "cube" => (340, 120),
        "timers" => (290, 260),
        "flight" => (260, 96),
        "bosshp" => (300, 170),
        "actions" => (300, 140),
        "rivals" => (300, 200),
        "map" => (300, 350),
        "ping" => (150, 60),
        "controls" => (340, 560),
        _ => (280, 180),
    }
}

/// The narrowest a panel may be.
pub fn min_width(panel: &str) -> u32 {
    // A window's content is scaled to its size, so it may be made small; only the controls keep a floor.
    match panel {
        "ping" => 120,
        "controls" => 220,
        _ => 150,
    }
}

/// The Hidden Cube marker is not a window to look at: it is drawn straight onto the screen and lets
/// every click through, except while the player is placing it.
pub fn is_marker(panel: &str) -> bool {
    matches!(panel, "cube" | "ping" | "flight")
}

/// The Overlay controls window is where the others are opened; it is never locked and never remembered open.
pub fn is_controls(panel: &str) -> bool {
    panel == "controls"
}

pub fn locked() -> bool {
    LOCKED.load(Ordering::Relaxed)
}

/// Lock or unlock every detached window: a locked one lets clicks through, an unlocked one can be edited.
pub fn set_locked(app: &AppHandle, locked: bool) {
    LOCKED.store(locked, Ordering::Relaxed);
    for panel in PANELS {
        if is_controls(panel) {
            continue;
        }
        if let Some(window) = app.get_webview_window(&label(panel)) {
            let _ = window.set_ignore_cursor_events(locked);
        }
    }
    let _ = app.emit("luma-overlay-lock", locked);
}

/// Windows that only show while you fight: the damage breakdown.
pub fn auto_hide(panel: &str) -> bool {
    panel == "damage"
}

/// Whether an auto-hiding window shows now: you fought within the grace time.
pub fn visible_now(last_active: u64, now: u64) -> bool {
    last_active != 0 && last_active <= now && now - last_active < GRACE_MS
}

fn clock() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |time| time.as_millis() as u64)
}

/// Show or hide the auto-hiding windows from whether a fight is on.
pub fn sync_combat(app: &AppHandle, active: bool) {
    let now = clock();
    if active {
        LAST_ACTIVE.store(now, Ordering::Relaxed);
    }
    let visible = visible_now(LAST_ACTIVE.load(Ordering::Relaxed), now);
    for panel in PANELS {
        if !auto_hide(panel) {
            continue;
        }
        if let Some(window) = app.get_webview_window(&label(panel)) {
            if window.is_visible().unwrap_or(true) != visible {
                let _ = if visible { window.show() } else { window.hide() };
            }
        }
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
        let mut entries: BTreeMap<String, Entry> = entries;
        // The skill table now lives in the main window, so the separate damage breakdown is only an
        // extra. It was open by default before: close it once, and the player may open it again.
        // The ping and the flight time were ordinary windows before they became markers: their old
        // places mean nothing, so they start from their own once (bottom-right for the ping).
        let markers = directory.join("overlays-markers-moved.done");
        if !markers.exists() {
            for panel in ["ping", "flight"] {
                if let Some(entry) = entries.get_mut(panel) {
                    entry.frame = None;
                }
            }
            let _ = fs::write(&markers, b"1");
        }
        // The skill table is in the main window; a window of its own for it is not offered any more, and
        // one an older version left open is closed.
        if let Some(entry) = entries.get_mut("damage") {
            entry.open = false;
        }
        // The Cube marker is there from the first start too; it draws nothing until a Cube is near.
        entries.entry("cube".to_string()).or_insert(Entry { frame: None, open: true });
        // So are the ping, in the corner where the game draws its own, and the flight time, which shows
        // only while flying.
        entries.entry("ping".to_string()).or_insert(Entry { frame: None, open: true });
        entries.entry("flight".to_string()).or_insert(Entry { frame: None, open: true });
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

pub fn open(app: &AppHandle, store: &Store, panel: &'static str, manual: bool) -> Result<(), String> {
    // Opening it by hand shows an auto-hiding window for the grace time, so it is seen at once.
    if manual && auto_hide(panel) {
        LAST_ACTIVE.store(clock(), Ordering::Relaxed);
    }
    let show = !auto_hide(panel) || visible_now(LAST_ACTIVE.load(Ordering::Relaxed), clock());
    if let Some(window) = app.get_webview_window(&label(panel)) {
        if show {
            window.show().map_err(|error| error.to_string())?;
        }
        if !is_controls(panel) {
            store.set_open(panel, true);
        }
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
    .min_inner_size(
        f64::from(if is_marker(panel) { 40 } else { min_width(panel) }),
        f64::from(if is_marker(panel) { 40 } else { MIN_EDGE / 2 }),
    )
    .focusable(false)
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .shadow(false)
    .resizable(!is_marker(panel))
    .focused(false)
    .visible(false)
    .build()
    .map_err(|error| error.to_string())?;
    let screens = screens(app);
    let remembered = store.entry(panel).frame.map(|frame| clamp(frame, &screens));
    if let Some(frame) = remembered {
        // An older, narrower frame is widened to the least the rows need.
        let scale = window.scale_factor().unwrap_or(1.0);
        let narrowest = (f64::from(min_width(panel)) * scale).round() as u32;
        // The Cube marker keeps its own size and only its place is remembered.
        let size = if is_marker(panel) {
            PhysicalSize::new((f64::from(width) * scale).round() as u32, (f64::from(height) * scale).round() as u32)
        } else {
            PhysicalSize::new(frame.width.max(narrowest), frame.height)
        };
        let _ = window.set_size(size);
        let _ = window.set_position(PhysicalPosition::new(frame.x, frame.y));
    } else if is_marker(panel) {
        place_marker(app, &window, panel);
    } else if let Some(place) = beside_meter(app, panel) {
        // Only the position is chosen; the size is the default one.
        let place = clamp(Frame { width: MIN_EDGE, height: MIN_EDGE, ..place }, &screens);
        let _ = window.set_position(PhysicalPosition::new(place.x, place.y));
    }
    if locked() && !is_controls(panel) {
        let _ = window.set_ignore_cursor_events(true);
    }
    if show {
        window.show().map_err(|error| error.to_string())?;
    }
    if !is_controls(panel) {
        store.set_open(panel, true);
    }
    Ok(())
}

/// Alt+E: open the controls window and unlock the windows for editing, or close it and lock them again.
/// A window is built off the hotkey thread.
pub fn toggle_controls(app: &AppHandle) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let _ = set_controls(&app, app.get_webview_window(&label("controls")).is_none());
    });
}

fn set_controls(app: &AppHandle, open: bool) -> Result<(), String> {
    let store = app.try_state::<Arc<Store>>().ok_or("Windows are unavailable")?;
    if open {
        self::open(app, &store, "controls", true)?;
        set_locked(app, false);
    } else {
        if let Some(window) = app.get_webview_window(&label("controls")) {
            let _ = window.close();
        }
        set_locked(app, true);
    }
    Ok(())
}

#[tauri::command]
pub async fn overlay_controls(app: AppHandle, open: bool) -> Result<(), String> {
    set_controls(&app, open)
}

/// A marker with nothing to draw (the Cube with none near, the flight time on the ground) is hidden, so
/// no transparent window is composed over the game for nothing; it is shown again the moment it has.
#[tauri::command]
pub fn overlay_visible(window: WebviewWindow, visible: bool) -> Result<(), String> {
    require_panel(&window)?;
    if !is_marker(panel_of(window.label()).unwrap_or("")) {
        return Err("Only a marker can hide itself".into());
    }
    if window.is_visible().unwrap_or(true) == visible {
        return Ok(());
    }
    if visible { window.show() } else { window.hide() }.map_err(|error| error.to_string())
}

#[tauri::command]
pub fn overlay_lock(app: AppHandle, locked: bool) {
    set_locked(&app, locked);
}

#[tauri::command]
pub fn overlay_locked() -> bool {
    locked()
}

/// A window that is stuck or shows nothing is reloaded; every detached window asks the shell for the state again.
#[tauri::command]
pub fn overlay_reload(app: AppHandle) {
    for panel in PANELS {
        if let Some(window) = app.get_webview_window(&label(panel)) {
            let _ = window.eval("location.reload()");
        }
    }
}

/// The controls window changes a few look-and-feel preferences; the meter window saves them.
#[tauri::command]
pub fn overlay_preference(app: AppHandle, patch: serde_json::Map<String, serde_json::Value>) -> Result<(), String> {
    const ALLOWED: [&str; 5] = ["overlayScale", "overlayRate", "overlaySnap", "opacity", "combatDetection"];
    let patch: serde_json::Map<String, serde_json::Value> = patch.into_iter().filter(|(key, _)| ALLOWED.contains(&key.as_str())).collect();
    if patch.is_empty() {
        return Err("Nothing to change".into());
    }
    app.emit_to("main", "luma-preference-patch", patch).map_err(|error| error.to_string())
}

/// Settings and Analysis open inside the meter's window, which is bare while locked: the controls
/// window asks for them.
#[tauri::command]
pub fn overlay_main_action(app: AppHandle, action: String) -> Result<(), String> {
    if !["settings", "analysis"].contains(&action.as_str()) {
        return Err("Unknown action".into());
    }
    let window = app.get_webview_window("main").ok_or("Luma window is unavailable")?;
    let _ = window.set_ignore_cursor_events(false);
    let _ = window.show();
    let _ = window.set_focus();
    app.emit_to("main", "luma-main-action", action).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn overlay_show_main(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// A first place for a marker: the Cube top centre, where it is seen without covering the fight; the
/// ping in the bottom-right corner, where the game draws its own; the flight time low and central.
fn place_marker(app: &AppHandle, window: &WebviewWindow, panel: &str) {
    let Some(monitor) = app.primary_monitor().ok().flatten() else {
        return;
    };
    let size = window.outer_size().unwrap_or(PhysicalSize::new(340, 120));
    let work = monitor.work_area();
    let (left, top) = (work.position.x, work.position.y);
    let (width, height) = (work.size.width as i32, work.size.height as i32);
    let (x, y) = match panel {
        "ping" => (width - size.width as i32 - 16, height - size.height as i32 - 18),
        "flight" => ((width - size.width as i32) / 2, (f64::from(height) * 0.66) as i32),
        _ => ((width - size.width as i32) / 2, (f64::from(height) * 0.12) as i32),
    };
    let _ = window.set_position(PhysicalPosition::new(left + x, top + y));
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
            let _ = open(&app, &store, panel, false);
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
            if matches!(event, WindowEvent::Moved(_)) && !is_marker(panel) {
                schedule_snap(window.clone());
            }
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

/// The grid line nearest to a coordinate.
pub fn snap_to(value: i32, grid: i32) -> i32 {
    let grid = grid.max(1);
    (f64::from(value) / f64::from(grid)).round() as i32 * grid
}

/// Once a window has stopped moving for a moment, settle it on the grid (when that is switched on).
fn schedule_snap(window: Window) {
    let grid = SNAP_GRID.load(Ordering::Relaxed);
    if grid == 0 {
        return;
    }
    let stamp = clock();
    LAST_MOVE.store(stamp, Ordering::Relaxed);
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(450));
        if LAST_MOVE.load(Ordering::Relaxed) != stamp {
            return;
        }
        let (Ok(position), Ok(factor)) = (window.outer_position(), window.scale_factor()) else {
            return;
        };
        let step = ((f64::from(grid) * factor).round() as i32).max(1);
        let (x, y) = (snap_to(position.x, step), snap_to(position.y, step));
        if (x, y) != (position.x, position.y) {
            let _ = window.set_position(PhysicalPosition::new(x, y));
        }
    });
}

/// A window tells the shell how it should look: the grid it snaps to (0 = off) and how big its page
/// is drawn.
#[tauri::command]
pub fn overlay_options(window: WebviewWindow, snap: u32, scale: f64) -> Result<(), String> {
    require_panel(&window)?;
    if !scale.is_finite() {
        return Err("Not a scale".into());
    }
    SNAP_GRID.store(snap.min(80), Ordering::Relaxed);
    window
        .set_zoom(scale.clamp(0.7, 1.8))
        .map_err(|error| error.to_string())
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
        self::open(&app, &store, panel, true)?;
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

/// Make a panel window as tall as its content (the page measures it), so nothing is cut off and no
/// window has to be resized by hand. The width stays what it is.
#[tauri::command]
pub fn overlay_fit(window: WebviewWindow, height: f64) -> Result<(), String> {
    require_panel(&window)?;
    if !height.is_finite() {
        return Err("Not a height".into());
    }
    let scale = window.scale_factor().map_err(|error| error.to_string())?;
    let size = window.inner_size().map_err(|error| error.to_string())?;
    let target = (height.clamp(60.0, 1000.0) * scale).round() as u32;
    if target.abs_diff(size.height) <= 2 {
        return Ok(());
    }
    window
        .set_size(PhysicalSize::new(size.width, target))
        .map_err(|error| error.to_string())
}

/// Placing the Cube marker: while on, the marker takes clicks so it can be dragged; off, every click
/// goes through to the game again.
#[tauri::command]
pub fn cube_marker_edit(app: AppHandle, enabled: bool) -> Result<(), String> {
    let window = app
        .get_webview_window(&label("cube"))
        .ok_or("Open the Hidden Cube window first")?;
    window
        .set_ignore_cursor_events(!enabled)
        .map_err(|error| error.to_string())?;
    window
        .emit("luma-marker-edit", enabled)
        .map_err(|error| error.to_string())
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
            assert!(width >= min_width(panel), "{panel} opens narrower than its least");
        }
        assert!(min_width("party") <= 200 && min_width("tickets") <= 200, "a window can be made small: its content scales");
        for other in ["main", "overlay-", "overlay-main", "overlay-pvp2", "OVERLAY-pvp", ""] {
            assert_eq!(panel_of(other), None, "{other}");
        }
        assert_eq!(valid("../pvp"), None);
        assert_eq!(valid(""), None);
    }

    #[test]
    fn the_controls_window_is_not_remembered_and_every_panel_has_a_size() {
        assert!(is_controls("controls") && !is_controls("pvp"));
        assert!(PANELS.contains(&"controls") && PANELS.contains(&"ping"));
        assert!(default_size("ping").0 >= min_width("ping"));
    }

    #[test]
    fn a_window_settles_on_the_nearest_grid_line() {
        assert_eq!(snap_to(0, 20), 0);
        assert_eq!(snap_to(9, 20), 0);
        assert_eq!(snap_to(10, 20), 20);
        assert_eq!(snap_to(487, 20), 480);
        assert_eq!(snap_to(-13, 20), -20);
        assert_eq!(snap_to(-9, 20), 0);
        assert_eq!(snap_to(33, 0), 33, "a zero grid never divides by zero");
        assert_eq!(snap_to(snap_to(487, 20), 20), snap_to(487, 20), "snapping twice moves nothing");
    }

    #[test]
    fn only_the_cube_ping_and_flight_are_markers_drawn_without_a_window() {
        for marker in ["cube", "ping", "flight"] {
            assert!(is_marker(marker), "{marker}");
        }
        for panel in PANELS.iter().filter(|panel| !["cube", "ping", "flight"].contains(panel)) {
            assert!(!is_marker(panel), "{panel}");
        }
        assert!(locked(), "Luma starts locked: the windows let every click through");
        assert!(!auto_hide("cube"), "the marker draws nothing by itself when no Cube is near");
    }

    #[test]
    fn the_damage_window_shows_while_you_fight_and_for_a_while_after() {
        assert!(auto_hide("damage") && !auto_hide("pvp") && !auto_hide("tickets"));
        assert!(!visible_now(0, 1_000_000), "before any fight it stays hidden");
        assert!(visible_now(1_000_000, 1_000_000));
        assert!(visible_now(1_000_000, 1_000_000 + GRACE_MS - 1));
        assert!(!visible_now(1_000_000, 1_000_000 + GRACE_MS));
        assert!(!visible_now(2_000_000, 1_000_000 + GRACE_MS), "a clock that went back never shows it forever");
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
        // Only the Cube marker is open before anything was chosen: the skill table is in the main window.
        assert_eq!(store.open_panels(), vec!["cube", "flight", "ping"]);
        let frame = Frame { x: 100, y: 120, width: 300, height: 260 };
        store.set_open("pvp", true);
        store.remember("pvp", frame);
        store.remember("pvp", Frame { x: -32_000, y: -32_000, width: 160, height: 28 });
        store.flush(false);
        assert!(!directory.join("overlays.json").exists(), "a change waits a second before it is written");
        store.flush(true);
        let again = Store::load(&directory);
        assert_eq!(again.open_panels(), vec!["pvp", "cube", "flight", "ping"]);
        assert_eq!(again.entry("pvp").frame, Some(frame));
        assert_eq!(again.entry("tracker"), Entry::default());
        again.set_open("pvp", false);
        again.set_open("damage", false);
        again.set_open("cube", false);
        again.set_open("flight", false);
        again.set_open("ping", false);
        again.flush(true);
        assert!(Store::load(&directory).open_panels().is_empty(), "closing the breakdown is remembered");

        fs::write(
            directory.join("overlays.json"),
            br#"{"pvp":{"frame":{"x":1,"y":2,"width":3,"height":4},"open":true},"../evil":{"open":true},"cube":{"open":true}}"#,
        )
        .unwrap();
        let cleaned = Store::load(&directory);
        assert_eq!(cleaned.open_panels(), vec!["pvp", "cube", "flight", "ping"]);
        assert_eq!(cleaned.entry("pvp").frame, None, "a frame too small to be a window is dropped");
        fs::write(directory.join("overlays.json"), b"not json").unwrap();
        assert_eq!(Store::load(&directory).open_panels(), vec!["cube", "flight", "ping"]);
        fs::write(directory.join("overlays.json"), vec![b' '; (MAX_FILE + 1) as usize]).unwrap();
        assert_eq!(Store::load(&directory).open_panels(), vec!["cube", "flight", "ping"]);
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn a_damage_window_left_open_by_an_older_version_is_closed() {
        let directory = directory("moved");
        fs::write(
            directory.join("overlays.json"),
            br#"{"damage":{"frame":{"x":484,"y":156,"width":300,"height":209},"open":true},"party":{"open":true}}"#,
        )
        .unwrap();
        let first = Store::load(&directory);
        assert_eq!(first.open_panels(), vec!["cube", "party", "flight", "ping"], "the skill table is in the main window now");
        assert!(!first.entry("damage").open);
        assert_eq!(first.entry("damage").frame.map(|frame| frame.x), Some(484));
        // It is never offered again, so it stays closed on every later start.
        first.set_open("damage", true);
        first.flush(true);
        assert_eq!(Store::load(&directory).open_panels(), vec!["cube", "party", "flight", "ping"]);
        let _ = fs::remove_dir_all(directory);
    }
}

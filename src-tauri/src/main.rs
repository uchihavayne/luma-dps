#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod audio_capture;
mod capture_dump;
mod audio_decode;
mod community;
mod cube_locator;
mod cube_signal;
mod event_schedule;
mod fullscreen_overlay;
mod hotkeys;
mod local_history;
mod native_capture;
mod obs_server;
mod overlays;
mod personal_bests;
mod pet_cache;
mod pet_reference;
mod team_sync;
mod update_key;
mod updates;
mod window_mode;

use luma_engine::MeterEngine;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    fs,
    io::Write,
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc, Mutex,
    },
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{Emitter, Manager, State, WebviewWindow};

const MIN_METER_HEIGHT: f64 = 200.0;
const COMMUNITY_ENDPOINT: &str = "https://luma-dps-community.uchihavayne.chatgpt.site";

/// A failed optional HTTPS initialization must not prevent local measurement,
/// settings or capture from opening.
struct CommunityRuntime {
    service: Result<Arc<community::Service>, String>,
}

impl CommunityRuntime {
    fn new(path: PathBuf) -> Self {
        Self {
            service: community::Service::new(COMMUNITY_ENDPOINT, path).map(Arc::new),
        }
    }

    fn service(&self) -> Result<Arc<community::Service>, String> {
        self.service.as_ref().cloned().map_err(Clone::clone)
    }

    fn snapshot(&self) -> community::Snapshot {
        match &self.service {
            Ok(service) => service.snapshot(),
            Err(message) => community::Snapshot {
                configured: false,
                endpoint: COMMUNITY_ENDPOINT.into(),
                shares: Vec::new(),
                pending_count: 0,
                storage_error: message.clone(),
            },
        }
    }
}

struct TeamRuntime {
    service: Result<Arc<team_sync::Service>, String>,
}

impl TeamRuntime {
    fn service(&self) -> Result<Arc<team_sync::Service>, String> {
        self.service.as_ref().cloned().map_err(Clone::clone)
    }
}

struct HotkeyRuntime {
    service: Result<Arc<hotkeys::HotkeyService>, String>,
}
impl HotkeyRuntime {
    fn service(&self) -> Result<Arc<hotkeys::HotkeyService>, String> {
        self.service.as_ref().cloned().map_err(Clone::clone)
    }
    fn snapshot(&self) -> Value {
        match &self.service {
            Ok(service) => serde_json::to_value(service.state()).unwrap_or(Value::Null),
            Err(error) => {
                serde_json::json!({"supported":cfg!(windows),"enabled":false,"bindings":[],"errors":[error]})
            }
        }
    }
    fn rescue_available(&self) -> bool {
        self.service.as_ref().is_ok_and(|service| {
            service
                .state()
                .bindings
                .iter()
                .any(|binding| binding.enabled && binding.action == hotkeys::Action::ToggleLock)
        })
    }
    fn fullscreen_rescue_available(&self) -> bool {
        self.service.as_ref().is_ok_and(|service| {
            service.state().bindings.iter().any(|binding| {
                binding.enabled && binding.action == hotkeys::Action::ToggleFullscreen
            })
        })
    }
}

#[derive(Default)]
struct FullscreenRuntime {
    state: Mutex<fullscreen_overlay::State>,
}
struct UpdateRuntime {
    service: Result<Arc<updates::UpdateService>, String>,
}
impl UpdateRuntime {
    fn service(&self) -> Result<Arc<updates::UpdateService>, String> {
        self.service.as_ref().cloned().map_err(Clone::clone)
    }
    fn snapshot(&self) -> Value {
        match &self.service {
            Ok(service) => service.snapshot(),
            Err(error) => {
                serde_json::json!({"supported":cfg!(windows),"status":"error","error":error,"current_version":env!("CARGO_PKG_VERSION")})
            }
        }
    }
}

fn configured_hotkeys(preferences: &Preferences) -> Vec<hotkeys::Binding> {
    let mut bindings: Vec<hotkeys::Binding> = preferences
        .extra
        .get("hotkeys")
        .and_then(|value| serde_json::from_value(value.clone()).ok())
        .and_then(|bindings| hotkeys::normalize_bindings(bindings).ok())
        .unwrap_or_else(hotkeys::default_bindings);
    // Older configurations contain six actions. Add the new rescue once;
    // an explicitly disabled rescue remains disabled.
    if !bindings
        .iter()
        .any(|binding| binding.action == hotkeys::Action::ToggleFullscreen)
    {
        if let Some(rescue) = hotkeys::default_bindings()
            .into_iter()
            .find(|binding| binding.action == hotkeys::Action::ToggleFullscreen)
        {
            bindings.push(rescue);
        }
    }
    bindings
}
fn cursor_pass_through(
    preferences: &Preferences,
    panel_open: bool,
    rescue_available: bool,
) -> Result<bool, String> {
    let requested = preferences
        .extra
        .get("clickThroughWhenLocked")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    if requested && preferences.locked && !rescue_available {
        return Err(
            "Enable a working lock/unlock global shortcut before using click-through".into(),
        );
    }
    Ok(requested && preferences.locked && !panel_open)
}

#[tauri::command]
fn get_hotkey_state(runtime: State<Arc<HotkeyRuntime>>) -> Value {
    runtime.snapshot()
}

#[tauri::command]
fn set_hotkeys(
    window: WebviewWindow,
    shared: State<Arc<Shared>>,
    runtime: State<Arc<HotkeyRuntime>>,
    bindings: Vec<hotkeys::Binding>,
) -> Result<Value, String> {
    let bindings = hotkeys::normalize_bindings(bindings)?;
    let _change = shared
        .preference_change
        .lock()
        .map_err(|_| "Preferences unavailable")?;
    let previous = shared
        .preferences
        .lock()
        .map_err(|_| "Preferences unavailable")?
        .clone();
    let mut preferences = previous.clone();
    let has_rescue = bindings
        .iter()
        .any(|binding| binding.enabled && binding.action == hotkeys::Action::ToggleLock);
    if fullscreen_overlay_enabled(&preferences)
        && !bindings
            .iter()
            .any(|binding| binding.enabled && binding.action == hotkeys::Action::ToggleFullscreen)
    {
        return Err(
            "Exit the full-screen overlay before disabling its global exit shortcut".into(),
        );
    }
    cursor_pass_through(
        &preferences,
        shared.panel_open.load(Ordering::Relaxed),
        has_rescue,
    )?;
    let service = runtime.service()?;
    let old = service.state().bindings;
    if let Err(error) = service.update(bindings.clone()) {
        if !runtime.rescue_available() {
            let _ = window.set_ignore_cursor_events(false);
        }
        if !runtime.fullscreen_rescue_available() {
            recover_fullscreen_without_rescue(&window, &shared, &previous);
        }
        return Err(error);
    }
    preferences.extra.insert(
        "hotkeys".into(),
        serde_json::to_value(bindings).map_err(|_| "Could not save shortcut settings")?,
    );
    if let Err(error) = persist(&shared, &preferences) {
        let rollback = service.update(old);
        if !runtime.rescue_available() {
            let _ = window.set_ignore_cursor_events(false);
        }
        if !runtime.fullscreen_rescue_available() {
            recover_fullscreen_without_rescue(&window, &shared, &previous);
        }
        return Err(if let Err(rollback) = rollback {
            format!("{error}; shortcut restoration failed: {rollback}")
        } else {
            error
        });
    }
    let mut current = shared
        .preferences
        .lock()
        .map_err(|_| "Preferences unavailable")?;
    preferences.width = current.width;
    preferences.height = current.height;
    *current = preferences.clone();
    drop(current);
    let _ = window.emit("luma-preferences", &preferences);
    let result = runtime.snapshot();
    let _ = window.emit("luma-hotkey-state", &result);
    Ok(result)
}

#[tauri::command]
fn get_update_state(runtime: State<Arc<UpdateRuntime>>) -> Value {
    runtime.snapshot()
}
#[tauri::command]
async fn check_updates(
    app: tauri::AppHandle,
    runtime: State<'_, Arc<UpdateRuntime>>,
) -> Result<Value, String> {
    let service = runtime.service()?;
    tauri::async_runtime::spawn_blocking(move || {
        let result = service.check();
        let _ = app.emit("luma-update-state", service.snapshot());
        result
    })
    .await
    .map_err(|_| "Update check worker stopped")?
}
#[tauri::command]
async fn download_update(
    app: tauri::AppHandle,
    runtime: State<'_, Arc<UpdateRuntime>>,
) -> Result<Value, String> {
    let service = runtime.service()?;
    tauri::async_runtime::spawn_blocking(move || {
        let result = service.download();
        let _ = app.emit("luma-update-state", service.snapshot());
        result
    })
    .await
    .map_err(|_| "Update download worker stopped")?
}
#[tauri::command]
async fn install_update(
    app: tauri::AppHandle,
    shared: State<'_, Arc<Shared>>,
    runtime: State<'_, Arc<UpdateRuntime>>,
) -> Result<Value, String> {
    let service = runtime.service()?;
    let shared = shared.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        if service.snapshot()["downloaded"] != true {
            return Err("Download the verified update first".into());
        }
        // Freeze and archive the current fight before starting a helper. A
        // failed save cannot leave a helper that installs on some later exit.
        persist_history(&shared)?;
        let current =
            std::env::current_exe().map_err(|_| "Current application path is unavailable")?;
        let was_paused = {
            let mut engine = shared
                .engine
                .lock()
                .map_err(|_| "Meter state unavailable")?;
            let paused = engine.live_state(now_ms()).paused;
            engine.set_paused_at(true, now_ms());
            engine.reset();
            engine.set_paused_at(true, now_ms());
            paused
        };
        let result =
            persist_history(&shared).and_then(|_| service.install(current, std::process::id()));
        let state = match result {
            Ok(state) => state,
            Err(error) => {
                if let Ok(mut engine) = shared.engine.lock() {
                    engine.set_paused_at(was_paused, now_ms());
                }
                return Err(error);
            }
        };
        let _ = app.emit("luma-update-state", &state);
        shared.stopping.store(true, Ordering::Relaxed);
        app.exit(0);
        Ok(state)
    })
    .await
    .map_err(|_| "Update installation worker stopped")?
}

fn change_locked(
    window: &WebviewWindow,
    shared: &Shared,
    runtime: &HotkeyRuntime,
    locked: bool,
) -> Result<Preferences, String> {
    let _change = shared
        .preference_change
        .lock()
        .map_err(|_| "Preferences unavailable")?;
    let previous = shared
        .preferences
        .lock()
        .map_err(|_| "Preferences unavailable")?
        .clone();
    let mut preferences = previous.clone();
    preferences.locked = locked;
    let panel_open = shared.panel_open.load(Ordering::Relaxed);
    let pass_through = cursor_pass_through(&preferences, panel_open, runtime.rescue_available())?;
    persist(shared, &preferences)?;
    if let Err(error) = window
        .set_resizable(
            !locked
                && !panel_open
                && !compact_strip(&preferences)
                && !fullscreen_overlay_enabled(&preferences),
        )
        .and_then(|_| window.set_ignore_cursor_events(pass_through))
    {
        let _ = persist(shared, &previous);
        let _ = window.set_resizable(
            !previous.locked
                && !panel_open
                && !compact_strip(&previous)
                && !fullscreen_overlay_enabled(&previous),
        );
        let _ = window.set_ignore_cursor_events(
            cursor_pass_through(&previous, panel_open, runtime.rescue_available()).unwrap_or(false),
        );
        return Err(error.to_string());
    }
    let mut current = shared
        .preferences
        .lock()
        .map_err(|_| "Preferences unavailable")?;
    preferences.width = current.width;
    preferences.height = current.height;
    *current = preferences.clone();
    let _ = window.emit("luma-preferences", &preferences);
    invalidate_fullscreen_pointer(window);
    Ok(preferences)
}

fn handle_global_hotkey(
    app: &tauri::AppHandle,
    shared: &Shared,
    action: hotkeys::Action,
) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or("Luma window is unavailable")?;
    match action {
        hotkeys::Action::ToggleVisibility => {
            if window.is_visible().map_err(|error| error.to_string())? {
                window.hide()
            } else {
                window.show()
            }
            .map_err(|error| error.to_string())?;
        }
        hotkeys::Action::ToggleLock => {
            let locked = shared
                .preferences
                .lock()
                .map_err(|_| "Preferences unavailable")?
                .locked;
            let runtime = app
                .try_state::<Arc<HotkeyRuntime>>()
                .ok_or("Global hotkeys are unavailable")?;
            change_locked(&window, shared, &runtime, !locked)?;
        }
        hotkeys::Action::TogglePause => {
            let mut engine = shared
                .engine
                .lock()
                .map_err(|_| "Meter state unavailable")?;
            let paused = engine.live_state(now_ms()).paused;
            engine.set_paused_at(!paused, now_ms());
        }
        hotkeys::Action::Reset => {
            shared
                .engine
                .lock()
                .map_err(|_| "Meter state unavailable")?
                .reset();
        }
        hotkeys::Action::Settings => {
            window
                .set_ignore_cursor_events(false)
                .map_err(|error| error.to_string())?;
            window.show().map_err(|error| error.to_string())?;
            let _ = window.set_focus();
        }
        hotkeys::Action::CopySummary => {}
        hotkeys::Action::ToggleFullscreen => {
            let runtime = app
                .try_state::<Arc<HotkeyRuntime>>()
                .ok_or("Global hotkeys are unavailable")?;
            let cube = app
                .try_state::<Arc<cube_locator::Service>>()
                .ok_or("Cube service is unavailable")?;
            let mut preferences = shared
                .preferences
                .lock()
                .map_err(|_| "Preferences unavailable")?
                .clone();
            let enabled = !fullscreen_overlay_enabled(&preferences);
            request_fullscreen_layout(&mut preferences, enabled, None)?;
            change_preferences(
                &window,
                shared,
                &cube,
                &runtime,
                preferences,
                PreferenceOrigin::NativeWindowAction,
            )?;
        }
    }
    let _ = app.emit("luma-hotkey", serde_json::json!({"action":action}));
    if let Ok(state) = snapshot(shared) {
        let _ = app.emit("luma-state", state);
    }
    Ok(())
}

fn compact_strip(preferences: &Preferences) -> bool {
    preferences
        .extra
        .get("compactStrip")
        .and_then(Value::as_bool)
        .unwrap_or(false)
}
fn meter_min_height(preferences: &Preferences, panel_open: bool) -> f64 {
    if compact_strip(preferences) && !panel_open {
        44.0
    } else {
        MIN_METER_HEIGHT
    }
}
fn apply_compact_transition(
    window: &WebviewWindow,
    shared: &Shared,
    previous: &Preferences,
    next: &Preferences,
) -> Result<(), tauri::Error> {
    if fullscreen_overlay_enabled(next) || fullscreen_overlay_enabled(previous) {
        return Ok(());
    }
    if compact_strip(previous) == compact_strip(next) {
        return Ok(());
    }
    if shared.panel_open.load(Ordering::Relaxed) {
        if let Ok(mut restore) = shared.panel_restore.lock() {
            if let Some(restore) = restore.as_mut() {
                restore.size = tauri::LogicalSize::new(
                    next.width,
                    if compact_strip(next) {
                        44.0
                    } else {
                        next.height
                    },
                )
                .to_physical(window.scale_factor()?);
            }
        }
        return Ok(());
    }
    shared
        .size_transition_until
        .store(now_ms() + 500, Ordering::Relaxed);
    window.set_min_size(Some(tauri::LogicalSize::new(
        320.0,
        meter_min_height(next, false),
    )))?;
    window.set_size(tauri::LogicalSize::new(
        next.width,
        if compact_strip(next) {
            44.0
        } else {
            next.height
        },
    ))
}

fn fullscreen_overlay_enabled(preferences: &Preferences) -> bool {
    preferences
        .extra
        .get("fullscreenOverlay")
        .and_then(Value::as_bool)
        == Some(true)
}

fn request_fullscreen_layout(
    preferences: &mut Preferences,
    enabled: bool,
    layout: Option<&str>,
) -> Result<(), String> {
    if layout.is_some_and(|layout| !matches!(layout, "dashboard" | "hud")) {
        return Err("Invalid fullscreen layout".into());
    }
    if enabled || layout.is_some() {
        preferences.extra.insert(
            "fullscreenLayout".into(),
            Value::String(layout.unwrap_or("dashboard").into()),
        );
    }
    preferences
        .extra
        .insert("fullscreenOverlay".into(), Value::Bool(enabled));
    Ok(())
}

fn recover_fullscreen_without_rescue(
    window: &WebviewWindow,
    shared: &Shared,
    previous: &Preferences,
) {
    if !fullscreen_overlay_enabled(previous) {
        return;
    }
    let mut preferences = previous.clone();
    preferences
        .extra
        .insert("fullscreenOverlay".into(), Value::Bool(false));
    if apply_fullscreen_transition(window, shared, previous, &preferences).is_err() {
        // Releasing input is mandatory if the OS cannot restore the window.
        let _ = window.set_ignore_cursor_events(true);
        let _ = window.hide();
        if let Some(runtime) = window.try_state::<Arc<FullscreenRuntime>>() {
            if let Ok(mut state) = runtime.state.lock() {
                state.commit(false, None);
            }
        }
    }
    let _ = persist(shared, &preferences);
    if let Ok(mut current) = shared.preferences.lock() {
        *current = preferences.clone();
    }
    let _ = window.emit("luma-preferences", &preferences);
    let _ = window.emit(
        "luma-fullscreen-error",
        "Full-screen mode exited because its global exit shortcut is unavailable",
    );
}

fn invalidate_fullscreen_pointer(window: &WebviewWindow) {
    if let Some(runtime) = window.try_state::<Arc<FullscreenRuntime>>() {
        if let Ok(mut state) = runtime.state.lock() {
            state.revision = state.revision.wrapping_add(1);
        }
    }
}

fn captured_geometry(
    window: &WebviewWindow,
    geometry: PanelGeometry,
) -> Result<fullscreen_overlay::Geometry, String> {
    let center_x = i64::from(geometry.position.x) + i64::from(geometry.size.width) / 2;
    let center_y = i64::from(geometry.position.y) + i64::from(geometry.size.height) / 2;
    let original_scale = window
        .available_monitors()
        .ok()
        .into_iter()
        .flatten()
        .find(|monitor| {
            let position = monitor.position();
            let size = monitor.size();
            center_x >= i64::from(position.x)
                && center_y >= i64::from(position.y)
                && center_x < i64::from(position.x) + i64::from(size.width)
                && center_y < i64::from(position.y) + i64::from(size.height)
        })
        .map(|monitor| monitor.scale_factor());
    let normal = fullscreen_overlay::Geometry {
        x: geometry.position.x,
        y: geometry.position.y,
        width: geometry.size.width,
        height: geometry.size.height,
        scale: original_scale.unwrap_or(window.scale_factor().map_err(|error| error.to_string())?),
    };
    if !normal.valid() {
        return Err("The meter window geometry is unavailable".into());
    }
    Ok(normal)
}

fn prepare_fullscreen_preferences(
    window: &WebviewWindow,
    shared: &Shared,
    hotkeys: &HotkeyRuntime,
    previous: &Preferences,
    next: &mut Preferences,
) -> Result<(), String> {
    // Only native code may supply restoration geometry.
    match previous.extra.get("fullscreenRestoreGeometry") {
        Some(value) => {
            next.extra
                .insert("fullscreenRestoreGeometry".into(), value.clone());
        }
        None => {
            next.extra.remove("fullscreenRestoreGeometry");
        }
    }
    if !fullscreen_overlay_enabled(next) {
        return Ok(());
    }
    if !hotkeys.fullscreen_rescue_available() {
        return Err(
            "Enable a working full-screen overlay global shortcut before using full-screen mode"
                .into(),
        );
    }
    if !fullscreen_overlay_enabled(previous) {
        let geometry = shared
            .panel_restore
            .lock()
            .map_err(|_| "Panel window geometry unavailable")?
            .as_ref()
            .copied()
            .unwrap_or(PanelGeometry {
                position: window.outer_position().map_err(|error| error.to_string())?,
                size: window.inner_size().map_err(|error| error.to_string())?,
            });
        let normal = captured_geometry(window, geometry)?;
        next.extra.insert(
            "fullscreenRestoreGeometry".into(),
            serde_json::to_value(normal).map_err(|_| "Could not save meter geometry")?,
        );
    }
    Ok(())
}

fn restored_fullscreen_geometry(
    window: &WebviewWindow,
    normal: fullscreen_overlay::Geometry,
    compact: bool,
) -> Result<(PanelGeometry, tauri::Monitor), String> {
    let monitors = window
        .available_monitors()
        .map_err(|error| error.to_string())?;
    let area = |monitor: &tauri::Monitor| {
        let rect = monitor.work_area();
        fullscreen_overlay::Area {
            x: rect.position.x,
            y: rect.position.y,
            width: rect.size.width,
            height: rect.size.height,
        }
    };
    let monitor = monitors
        .iter()
        .find(|monitor| normal.intersects(area(monitor)))
        .cloned()
        .or(window
            .current_monitor()
            .map_err(|error| error.to_string())?)
        .or(window
            .primary_monitor()
            .map_err(|error| error.to_string())?)
        .ok_or("No monitor is available for the meter")?;
    let normal = normal.fit(area(&monitor), monitor.scale_factor(), compact);
    Ok((
        PanelGeometry {
            position: tauri::PhysicalPosition::new(normal.x, normal.y),
            size: tauri::PhysicalSize::new(normal.width, normal.height),
        },
        monitor,
    ))
}

fn apply_fullscreen_transition(
    window: &WebviewWindow,
    shared: &Shared,
    previous: &Preferences,
    next: &Preferences,
) -> Result<(), String> {
    let enabled = fullscreen_overlay_enabled(next);
    if enabled == fullscreen_overlay_enabled(previous) {
        return Ok(());
    }
    let runtime = window
        .try_state::<Arc<FullscreenRuntime>>()
        .ok_or("Full-screen overlay service is unavailable")?;
    let mut state = runtime
        .state
        .lock()
        .map_err(|_| "Full-screen overlay state unavailable")?;
    let mut normal = if enabled {
        next.extra
            .get("fullscreenRestoreGeometry")
            .cloned()
            .and_then(|value| serde_json::from_value::<fullscreen_overlay::Geometry>(value).ok())
    } else {
        state.normal.or_else(|| {
            previous
                .extra
                .get("fullscreenRestoreGeometry")
                .cloned()
                .and_then(|value| {
                    serde_json::from_value::<fullscreen_overlay::Geometry>(value).ok()
                })
        })
    }
    .filter(|geometry| geometry.valid())
    .ok_or("The original meter geometry is unavailable")?;
    shared
        .size_transition_until
        .store(now_ms() + 1000, Ordering::Relaxed);
    shared.geometry_save_due.store(0, Ordering::Relaxed);
    let panel_open = shared.panel_open.load(Ordering::Relaxed);
    if enabled {
        let result = window
            .set_ignore_cursor_events(true)
            .and_then(|_| window.set_max_size(None::<tauri::LogicalSize<f64>>))
            .and_then(|_| window.set_resizable(false))
            .and_then(|_| window.set_fullscreen(true));
        if let Err(error) = result {
            let _ = window.set_fullscreen(false);
            let _ = window.set_max_size(Some(tauri::LogicalSize::new(1600.0, 1600.0)));
            let _ =
                window.set_resizable(!previous.locked && !panel_open && !compact_strip(previous));
            let _ = window.set_ignore_cursor_events(false);
            return Err(error.to_string());
        }
        state.commit(true, Some(normal));
    } else {
        normal.width = (next.width * normal.scale).round() as u32;
        normal.height = (if compact_strip(next) {
            44.0
        } else {
            next.height
        } * normal.scale)
            .round() as u32;
        let (normal_geometry, monitor) =
            restored_fullscreen_geometry(window, normal, compact_strip(next))?;
        let target = if panel_open {
            drawer_geometry(
                normal_geometry,
                *monitor.work_area(),
                monitor.scale_factor(),
            )?
        } else {
            normal_geometry
        };
        let result = window
            .set_fullscreen(false)
            .and_then(|_| window.set_position(target.position))
            .and_then(|_| {
                window.set_min_size(Some(tauri::LogicalSize::new(
                    320.0,
                    meter_min_height(next, panel_open),
                )))
            })
            .and_then(|_| window.set_max_size(Some(tauri::LogicalSize::new(1600.0, 1600.0))))
            .and_then(|_| window.set_size(target.size))
            .and_then(|_| window.set_resizable(!next.locked && !panel_open && !compact_strip(next)))
            .and_then(|_| window.set_ignore_cursor_events(false));
        if let Err(error) = result {
            let _ = window.set_max_size(None::<tauri::LogicalSize<f64>>);
            let _ = window.set_resizable(false);
            let _ = window.set_fullscreen(true);
            state.revision = state.revision.wrapping_add(1);
            return Err(error.to_string());
        }
        *shared
            .panel_restore
            .lock()
            .map_err(|_| "Panel window geometry unavailable")? =
            panel_open.then_some(normal_geometry);
        state.commit(false, None);
    }
    Ok(())
}

#[tauri::command]
fn set_fullscreen_overlay(
    window: WebviewWindow,
    shared: State<Arc<Shared>>,
    cube: State<Arc<cube_locator::Service>>,
    hotkeys: State<Arc<HotkeyRuntime>>,
    enabled: bool,
    layout: Option<String>,
) -> Result<Preferences, String> {
    let mut preferences = shared
        .preferences
        .lock()
        .map_err(|_| "Preferences unavailable")?
        .clone();
    request_fullscreen_layout(&mut preferences, enabled, layout.as_deref())?;
    change_preferences(
        &window,
        &shared,
        &cube,
        &hotkeys,
        preferences,
        PreferenceOrigin::NativeWindowAction,
    )
}

#[tauri::command]
fn set_overlay_hit_regions(
    runtime: State<Arc<FullscreenRuntime>>,
    regions: Vec<fullscreen_overlay::HitRegion>,
    interactive_regions: Option<Vec<fullscreen_overlay::HitRegion>>,
) -> Result<(), String> {
    fullscreen_overlay::validate_regions(&regions)?;
    let interactive_regions = interactive_regions.unwrap_or_default();
    fullscreen_overlay::validate_interactive_regions(&interactive_regions)?;
    let mut state = runtime
        .state
        .lock()
        .map_err(|_| "Full-screen overlay state unavailable")?;
    state.regions = regions;
    state.interactive_regions = interactive_regions;
    state.revision = state.revision.wrapping_add(1);
    Ok(())
}

fn pointer_mode(
    shared: &Shared,
    fullscreen: bool,
    rescue_available: bool,
) -> fullscreen_overlay::PointerMode {
    let preferences = shared.preferences.lock().ok();
    preferences
        .as_ref()
        .map(|value| {
            pointer_mode_preferences(
                value,
                fullscreen,
                shared.panel_open.load(Ordering::Relaxed),
                rescue_available,
            )
        })
        .unwrap_or(fullscreen_overlay::PointerMode::Window)
}

fn pointer_mode_preferences(
    preferences: &Preferences,
    fullscreen: bool,
    panel_open: bool,
    rescue_available: bool,
) -> fullscreen_overlay::PointerMode {
    let click_through = preferences
        .extra
        .get("clickThroughWhenLocked")
        .and_then(Value::as_bool)
        == Some(true);
    fullscreen_overlay::PointerMode::from_policy(
        fullscreen,
        preferences.locked,
        click_through && rescue_available,
        panel_open,
    )
}

fn start_fullscreen_pointer_worker(
    window: WebviewWindow,
    shared: Arc<Shared>,
    runtime: Arc<FullscreenRuntime>,
    hotkeys: Arc<HotkeyRuntime>,
) {
    std::thread::spawn(move || {
        let mut applied = None;
        let mut hold = fullscreen_overlay::PointerHold::default();
        while !shared.stopping.load(Ordering::Relaxed) {
            let state = runtime.state.lock().ok().map(|state| {
                (
                    state.active,
                    state.regions.clone(),
                    state.interactive_regions.clone(),
                    state.revision,
                )
            });
            if let Some((fullscreen, regions, interactive_regions, revision)) = state {
                let mode = pointer_mode(&shared, fullscreen, hotkeys.rescue_available());
                let point = if mode == fullscreen_overlay::PointerMode::Window {
                    None
                } else {
                    fullscreen_overlay::cursor_position().and_then(|cursor| {
                        let position = window.inner_position().ok()?;
                        let scale = window.scale_factor().ok()?;
                        fullscreen_overlay::logical_cursor(cursor, (position.x, position.y), scale)
                    })
                };
                let inside = fullscreen_overlay::accepts_pointer(
                    mode,
                    &regions,
                    &interactive_regions,
                    point,
                );
                let desired =
                    hold.ignore_cursor(mode, inside, fullscreen_overlay::primary_button_down());
                if applied != Some((revision, mode, desired)) {
                    let target = window.clone();
                    let policy = runtime.clone();
                    let current_shared = shared.clone();
                    let current_hotkeys = hotkeys.clone();
                    // Native mode transitions and cursor writes are serialized
                    // on the UI thread. Revalidate after dispatch so an update
                    // calculated before exit cannot disable normal-window input.
                    if window
                        .app_handle()
                        .run_on_main_thread(move || {
                            // Preference writers already acquire this lock
                            // before the overlay state. Keep the same order and
                            // hold both through the write to reject old modes.
                            if let Ok(preferences) = current_shared.preferences.lock() {
                                if let Ok(mut state) = policy.state.lock() {
                                    let current_mode = pointer_mode_preferences(
                                        &preferences,
                                        state.active,
                                        current_shared.panel_open.load(Ordering::Relaxed),
                                        current_hotkeys.rescue_available(),
                                    );
                                    state.apply_pointer_update(
                                        revision,
                                        mode,
                                        current_mode,
                                        || target.set_ignore_cursor_events(desired).is_ok(),
                                    );
                                }
                            }
                        })
                        .is_ok()
                    {
                        applied = Some((revision, mode, desired));
                    }
                }
                std::thread::sleep(Duration::from_millis(25));
            } else {
                applied = None;
                std::thread::sleep(Duration::from_millis(125));
            }
        }
    });
}

fn team_own_data(payload: Value, capture_live: bool, at: u64) -> Value {
    let local = &payload["local"];
    let cooldowns: Vec<Value> = payload["cooldowns"].as_array().into_iter().flatten().take(64).filter_map(|row| {
        let observed = row["observed_at_ms"].as_u64()?;
        let age = at.checked_sub(observed)?;
        if age > team_sync::FRESH_MS { return None; }
        let estimate = row["estimated_remaining_ms"].as_u64().filter(|v| *v > 0)
            .and_then(|value| value.checked_add(age)).filter(|value| *value <= 3_600_000);
        let charges = row["charges_observed_at_ms"].as_u64()
            .filter(|charge_at| *charge_at == observed)
            .and_then(|_| row["charges"].as_u64());
        Some(serde_json::json!({"skill_id":row["skill_id"],"raw_remaining_units":row["raw_remaining_units"],
            "estimated_remaining_ms":estimate,"charges":charges,"age_ms":age,
            "ready_confirmed":capture_live && row["ready_confirmed"] == true && row["raw_remaining_units"] == 0}))
    }).collect();
    serde_json::json!({"display_name":local["name"].as_str().unwrap_or(""),
        "class_name":local["class_name"].as_str().unwrap_or("Unknown"),
        "capture_live":capture_live && local["identity_source"] == "server",
        "cooldowns":if capture_live {cooldowns} else {Vec::new()}})
}

fn community_record_id(value: Option<&str>) -> Result<Option<u64>, String> {
    let Some(value) = value.filter(|value| !value.is_empty()) else {
        return Ok(None);
    };
    if value.len() > 20 || !value.bytes().all(|byte| byte.is_ascii_digit()) {
        return Err("Invalid community encounter identifier".into());
    }
    let id = value
        .parse::<u64>()
        .ok()
        .filter(|id| *id != 0 && id.to_string() == value)
        .ok_or("Invalid community encounter identifier")?;
    Ok(Some(id))
}

/// Return an owned record while the engine is locked. Callers drop that lock
/// before serialization, disk persistence or any network request.
fn select_community_record(
    engine: &MeterEngine,
    record_id: Option<&str>,
    at_ms: u64,
) -> Result<luma_engine::Encounter, String> {
    let selected = community_record_id(record_id)?;
    let (_, history) = engine.history_snapshot();
    if let Some(id) = selected {
        return history
            .into_iter()
            .find(|record| record.id == id)
            .ok_or_else(|| {
                "The selected community encounter is no longer in local history".into()
            });
    }
    let current = engine.current_record(at_ms);
    if !history.iter().any(|record| record.id == current.id) {
        return Err(
            "Finish this encounter before sharing, or choose a completed record from history"
                .into(),
        );
    }
    Ok(current)
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(default)]
struct Preferences {
    theme: String,
    #[serde(rename = "textScale", alias = "scale")]
    text_scale: f64,
    opacity: f64,
    locked: bool,
    #[serde(rename = "mode", alias = "target_mode")]
    target_mode: String,
    width: f64,
    height: f64,
    #[serde(rename = "cubeAutoListen")]
    cube_auto_listen: bool,
    #[serde(flatten)]
    extra: serde_json::Map<String, Value>,
}

impl Default for Preferences {
    fn default() -> Self {
        Self {
            theme: "aurora".into(),
            text_scale: 1.0,
            opacity: 0.96,
            locked: false,
            target_mode: "all".into(),
            width: 420.0,
            height: 340.0,
            cube_auto_listen: true,
            extra: Default::default(),
        }
    }
}

impl Preferences {
    fn migrate_legacy_dimensions(mut self) -> Self {
        if (116.0..MIN_METER_HEIGHT).contains(&self.height) {
            self.height = MIN_METER_HEIGHT;
        }
        self.discard_session_marks();
        self
    }

    fn discard_session_marks(&mut self) {
        // Actor ids may be reused after a reconnect. Manual boss selections
        // belong to the current live session and must never be restored.
        self.extra.remove("bossIds");
    }

    fn automatic_cube_capture(&self) -> Option<(&'static str, f32)> {
        self.cube_auto_listen.then(|| {
            let threshold = self
                .extra
                .get("cubeThreshold")
                .and_then(Value::as_f64)
                .filter(|value| value.is_finite() && (0.6..=0.97).contains(value))
                .unwrap_or(0.82) as f32;
            // Automatic listening never broadens capture to other applications,
            // including when an older preference saved a system-output source.
            ("game", threshold)
        })
    }

    /// How an encounter ends: "hits" or the game's own combat state, and the tail in seconds.
    fn combat_detection(&self) -> (&str, u64) {
        let setting = self.extra.get("combatDetection");
        let source = match setting.and_then(|value| value.get("source")).and_then(Value::as_str) {
            Some("game") => "game",
            _ => "hits",
        };
        let seconds = setting
            .and_then(|value| value.get("seconds"))
            .and_then(Value::as_u64)
            .filter(|seconds| (5..=300).contains(seconds))
            .unwrap_or(10);
        (source, seconds)
    }

    fn validate(&self) -> Result<(), String> {
        if let Some(setting) = self.extra.get("combatDetection") {
            let source = setting.get("source").and_then(Value::as_str);
            let seconds = setting.get("seconds").and_then(Value::as_u64);
            if !matches!(source, Some("hits" | "game"))
                || seconds.is_none_or(|seconds| !(5..=300).contains(&seconds))
            {
                return Err("Invalid combat detection".into());
            }
        }
        if self
            .extra
            .get("fullscreenLayout")
            .is_some_and(|value| !matches!(value.as_str(), Some("dashboard" | "hud")))
        {
            return Err("Invalid fullscreen layout".into());
        }
        for key in ["fullscreenOverlay"] {
            if self.extra.get(key).is_some_and(|value| !value.is_boolean()) {
                return Err("Invalid full-screen overlay preference".into());
            }
        }
        for (key, min, max) in [
            ("overlayX", 0.0, 20_000.0),
            ("overlayY", 0.0, 20_000.0),
            ("overlayWidth", 280.0, 1200.0),
            ("overlayHeight", 200.0, 1200.0),
        ] {
            if self.extra.get(key).is_some_and(|value| {
                value
                    .as_f64()
                    .is_none_or(|number| !number.is_finite() || !(min..=max).contains(&number))
            }) {
                return Err("Invalid overlay panel geometry".into());
            }
        }
        if let Some(name) = self.extra.get("characterName") {
            validate_character_name(name.as_str().ok_or("Character name must be text")?)?;
        }
        if self.theme.len() > 40
            || !self
                .theme
                .bytes()
                .all(|c| c.is_ascii_alphanumeric() || c == b'-')
        {
            return Err("Invalid theme name".into());
        }
        if !self.text_scale.is_finite()
            || !(0.65..=2.0).contains(&self.text_scale)
            || !self.opacity.is_finite()
            || !(0.0..=1.0).contains(&self.opacity)
            || !self.width.is_finite()
            || !(320.0..=1600.0).contains(&self.width)
            || !self.height.is_finite()
            || !(MIN_METER_HEIGHT..=1600.0).contains(&self.height)
            || !matches!(self.target_mode.as_str(), "all" | "boss" | "both")
        {
            return Err("Invalid meter preferences".into());
        }
        Ok(())
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct PanelGeometry {
    position: tauri::PhysicalPosition<i32>,
    size: tauri::PhysicalSize<u32>,
}

#[derive(Clone, Copy, Debug)]
enum PanelOperation {
    Position(tauri::PhysicalPosition<i32>),
    Size(tauri::Size),
    Resizable(bool),
}

fn drawer_geometry(
    previous: PanelGeometry,
    work_area: tauri::PhysicalRect<i32, u32>,
    scale_factor: f64,
) -> Result<PanelGeometry, String> {
    if !scale_factor.is_finite()
        || scale_factor <= 0.0
        || (work_area.size.width as f64) < (320.0 * scale_factor).ceil()
        || (work_area.size.height as f64) < (MIN_METER_HEIGHT * scale_factor).ceil()
    {
        return Err("The monitor work area is unavailable or too small for the panel".into());
    }
    let size = tauri::PhysicalSize::new(
        (820.0 * scale_factor)
            .round()
            .max((320.0 * scale_factor).ceil())
            .min(work_area.size.width as f64) as u32,
        (700.0 * scale_factor)
            .round()
            .max((MIN_METER_HEIGHT * scale_factor).ceil())
            .min(work_area.size.height as f64) as u32,
    );
    let left = i64::from(work_area.position.x);
    let top = i64::from(work_area.position.y);
    let right = left + i64::from(work_area.size.width - size.width);
    let bottom = top + i64::from(work_area.size.height - size.height);
    let x = i64::from(previous.position.x).clamp(left, right);
    let y = i64::from(previous.position.y).clamp(top, bottom);
    Ok(PanelGeometry {
        position: tauri::PhysicalPosition::new(
            i32::try_from(x).map_err(|_| "Invalid monitor work area")?,
            i32::try_from(y).map_err(|_| "Invalid monitor work area")?,
        ),
        size,
    })
}

fn apply_panel_layout(
    previous: PanelGeometry,
    previously_resizable: bool,
    position: Option<tauri::PhysicalPosition<i32>>,
    size: tauri::Size,
    resizable: bool,
    mut apply: impl FnMut(PanelOperation) -> Result<(), String>,
) -> Result<(), String> {
    let operations = [
        Some(PanelOperation::Resizable(resizable)),
        position.map(PanelOperation::Position),
        Some(PanelOperation::Size(size)),
    ];
    for operation in operations.into_iter().flatten() {
        if let Err(error) = apply(operation) {
            // Restore position before physical size so a drawer dragged to a
            // different-DPI monitor returns to its original pixel geometry.
            let mut rollback_errors = Vec::new();
            for restore in [
                PanelOperation::Position(previous.position),
                PanelOperation::Size(previous.size.into()),
                PanelOperation::Resizable(previously_resizable),
            ] {
                if let Err(error) = apply(restore) {
                    rollback_errors.push(error);
                }
            }
            return Err(if rollback_errors.is_empty() {
                error
            } else {
                format!(
                    "{error}; unable to fully restore the previous window: {}",
                    rollback_errors.join("; ")
                )
            });
        }
    }
    Ok(())
}

struct Shared {
    engine: Mutex<MeterEngine>,
    preferences: Mutex<Preferences>,
    capture: Mutex<native_capture::CaptureStatus>,
    data_dir: PathBuf,
    stopping: AtomicBool,
    panel_open: AtomicBool,
    panel_restore: Mutex<Option<PanelGeometry>>,
    size_transition_until: AtomicU64,
    settings_write: Mutex<()>,
    history_write: Mutex<()>,
    history_saved_revision: AtomicU64,
    history_storage_error: Mutex<String>,
    pet_cache: Mutex<pet_cache::Store>,
    personal_bests: Mutex<personal_bests::Store>,
    pet_cache_revision: AtomicU64,
    preference_change: Mutex<()>,
    geometry_save_due: AtomicU64,
    capture_worker: Mutex<Option<std::thread::JoinHandle<()>>>,
    obs: Mutex<Option<obs_server::RunningServer>>,
    calendar: Mutex<Option<event_schedule::Service>>,
}

static STATE_REVISION: AtomicU64 = AtomicU64::new(0);

fn refresh_personal_bests(shared: &Shared, force: bool) {
    let observations = shared
        .engine
        .lock()
        .map(|mut engine| engine.take_record_observations())
        .unwrap_or_default();
    if let Ok(mut store) = shared.personal_bests.lock() {
        for observation in observations {
            store.observe(observation);
        }
        store.flush(now_ms(), force);
    }
}

#[tauri::command]
fn get_personal_bests(shared: State<'_, Arc<Shared>>) -> Result<Value, String> {
    shared
        .personal_bests
        .lock()
        .map(|store| store.snapshot())
        .map_err(|_| "Personal bests unavailable".into())
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn refresh_pet_cache(shared: &Shared, force: bool) {
    let received = shared.engine.lock().ok().and_then(|engine| {
        let revision = engine.character_revision();
        (revision > shared.pet_cache_revision.load(Ordering::Relaxed))
            .then(|| (revision, engine.character_snapshot()))
    });
    if let Ok(mut cache) = shared.pet_cache.lock() {
        if let Some((revision, snapshot)) = received {
            if revision > shared.pet_cache_revision.load(Ordering::Relaxed) {
                cache.observe(&snapshot, now_ms());
                shared.pet_cache_revision.store(revision, Ordering::Relaxed);
            }
        }
        cache.flush(now_ms(), force);
    }
}

#[cfg(windows)]
struct DesktopInstance(windows_sys::Win32::Foundation::HANDLE);

#[cfg(windows)]
impl DesktopInstance {
    fn try_acquire(name: &str) -> Result<Option<Self>, String> {
        use windows_sys::Win32::{
            Foundation::{CloseHandle, GetLastError, SetLastError, ERROR_ALREADY_EXISTS},
            System::Threading::CreateMutexW,
        };
        let name: Vec<u16> = name.encode_utf16().chain(Some(0)).collect();
        // Retaining the named kernel object prevents a second desktop process
        // from starting capture or writing the same local settings/history.
        // No mutex ownership or waiting is needed; OS closes it on a crash.
        unsafe {
            SetLastError(0);
            let handle = CreateMutexW(std::ptr::null(), 0, name.as_ptr());
            let error = GetLastError();
            if handle.is_null() {
                return Err(format!("Luma başlangıç kontrolü yapılamadı ({error})."));
            }
            if error == ERROR_ALREADY_EXISTS {
                CloseHandle(handle);
                Ok(None)
            } else {
                Ok(Some(Self(handle)))
            }
        }
    }
}

#[cfg(windows)]
impl Drop for DesktopInstance {
    fn drop(&mut self) {
        unsafe { windows_sys::Win32::Foundation::CloseHandle(self.0) };
    }
}

#[cfg(windows)]
fn notify_desktop_startup(message: &str) {
    use windows_sys::Win32::UI::WindowsAndMessaging::{MessageBoxW, MB_ICONINFORMATION, MB_OK};
    let message: Vec<u16> = message.encode_utf16().chain(Some(0)).collect();
    let title: Vec<u16> = "Luma DPS".encode_utf16().chain(Some(0)).collect();
    unsafe {
        MessageBoxW(
            std::ptr::null_mut(),
            message.as_ptr(),
            title.as_ptr(),
            MB_OK | MB_ICONINFORMATION,
        );
    }
}

fn resized_meter_dimensions(
    size: tauri::PhysicalSize<u32>,
    scale_factor: f64,
) -> Option<tauri::LogicalSize<f64>> {
    // Windows emits a zero client size when minimizing. This is not a new
    // meter size and must not replace the saved dimensions with their minima.
    if size.width == 0 || size.height == 0 || !scale_factor.is_finite() || scale_factor <= 0.0 {
        return None;
    }
    let width = size.width as f64 / scale_factor;
    let height = size.height as f64 / scale_factor;
    if !width.is_finite() || !height.is_finite() {
        return None;
    }
    Some(tauri::LogicalSize::new(
        width.clamp(320.0, 1600.0),
        height.clamp(MIN_METER_HEIGHT, 1600.0),
    ))
}

fn snapshot(shared: &Shared) -> Result<Value, String> {
    // Read the disk-backed ledger before holding the live engine lock.
    let record_status = shared
        .personal_bests
        .lock()
        .map_err(|_| "Personal bests unavailable")?
        .status(now_ms());
    let mut engine = shared
        .engine
        .lock()
        .map_err(|_| "Meter state unavailable")?;
    let capture = shared
        .capture
        .lock()
        .map_err(|_| "Capture state unavailable")?
        .clone();
    let now = now_ms();
    if let Some(sample) = capture_latency_sample(&capture, now) {
        engine.observe_latency(sample, now);
    }
    let mut state = serde_json::to_value(engine.live_state(now)).map_err(|e| e.to_string())?;
    if let Some(object) = state.as_object_mut() {
        object.insert("personal_bests".into(), record_status);
        object.insert(
            "history_storage_error".into(),
            Value::String(
                shared
                    .history_storage_error
                    .lock()
                    .map_err(|_| "History status unavailable")?
                    .clone(),
            ),
        );
        object.insert(
            "capture".into(),
            serde_json::to_value(capture).map_err(|e| e.to_string())?,
        );
        // The engine lock still guards this snapshot's creation. Event pushes
        // and IPC replies can then be ordered even if delivery is delayed.
        object.insert(
            "state_revision".into(),
            Value::from(STATE_REVISION.fetch_add(1, Ordering::Relaxed) + 1),
        );
    }
    Ok(state)
}

fn capture_latency_sample(
    capture: &native_capture::CaptureStatus,
    now: u64,
) -> Option<luma_engine::latency::Sample> {
    let latency = &capture.network_latency;
    let at = latency.observed_at_ms?;
    if capture.status != "capturing"
        || latency.status != "ready"
        || latency.source != "windows-tcp-estats"
        || at == 0
        || at > now
        || now - at > 5000
        || latency.measured_connections == 0
        || latency.measured_connections > 128
        || latency.measured_connections > latency.game_connections
    {
        return None;
    }
    Some(luma_engine::latency::Sample {
        observed_at_ms: at,
        rtt_ms: latency.rtt_ms.filter(|v| *v <= 120000)?,
        latest_rtt_ms: latency.latest_rtt_ms.filter(|v| *v <= 120000),
        variation_ms: latency.variation_ms.filter(|v| *v <= 120000),
        measured_connections: latency.measured_connections as u32,
    })
}

#[cfg(test)]
mod latency_capture_tests {
    use super::*;
    #[test]
    fn only_current_measured_game_paths_can_enter_encounter_rtt_history() {
        let mut capture = native_capture::CaptureStatus::default();
        capture.status = "capturing".into();
        capture.network_latency.status = "ready".into();
        capture.network_latency.observed_at_ms = Some(1000);
        capture.network_latency.rtt_ms = Some(0);
        capture.network_latency.measured_connections = 1;
        capture.network_latency.game_connections = 2;
        assert_eq!(capture_latency_sample(&capture, 1000).unwrap().rtt_ms, 0);
        assert!(capture_latency_sample(&capture, 999).is_none());
        assert!(capture_latency_sample(&capture, 6001).is_none());
        capture.network_latency.measured_connections = 3;
        assert!(capture_latency_sample(&capture, 1000).is_none());
        capture.network_latency.measured_connections = 1;
        capture.status = "stopped".into();
        assert!(capture_latency_sample(&capture, 1000).is_none());
    }
}

#[cfg(test)]
mod shell_tests {
    use super::*;

    #[test]
    fn queued_settings_cannot_undo_native_window_toggles_but_explicit_actions_can() {
        for native_enabled in [false, true] {
            let mut previous = Preferences::default();
            previous.locked = native_enabled;
            previous
                .extra
                .insert("fullscreenOverlay".into(), Value::Bool(native_enabled));
            let mut queued = previous.clone();
            queued.locked = !native_enabled;
            queued
                .extra
                .insert("fullscreenOverlay".into(), Value::Bool(!native_enabled));
            queued.theme = "pearl".into();
            queued.opacity = 0.4;
            queued
                .extra
                .insert("overlayX".into(), serde_json::json!(80));

            let mut settings = queued.clone();
            preserve_native_window_preferences(
                &previous,
                &mut settings,
                PreferenceOrigin::Settings,
            );
            assert_eq!(settings.locked, native_enabled);
            assert_eq!(fullscreen_overlay_enabled(&settings), native_enabled);
            assert_eq!(settings.theme, "pearl");
            assert_eq!(settings.opacity, 0.4);
            assert_eq!(settings.extra["overlayX"], 80);

            preserve_native_window_preferences(
                &previous,
                &mut queued,
                PreferenceOrigin::NativeWindowAction,
            );
            assert_eq!(queued.locked, !native_enabled);
            assert_eq!(fullscreen_overlay_enabled(&queued), !native_enabled);
        }
    }

    #[test]
    fn older_shortcuts_gain_only_the_new_fullscreen_rescue_and_explicit_disable_survives() {
        let mut preferences = Preferences::default();
        let old: Vec<_> = hotkeys::default_bindings()
            .into_iter()
            .filter(|binding| binding.action != hotkeys::Action::ToggleFullscreen)
            .collect();
        preferences
            .extra
            .insert("hotkeys".into(), serde_json::to_value(&old).unwrap());
        let migrated = configured_hotkeys(&preferences);
        assert_eq!(&migrated[..6], &old);
        assert_eq!(migrated.len(), 7);
        assert_eq!(migrated[6].action, hotkeys::Action::ToggleFullscreen);
        assert_eq!(migrated[6].shortcut, "Ctrl+Alt+Shift+F5");
        let mut disabled = migrated;
        disabled[6].enabled = false;
        preferences
            .extra
            .insert("hotkeys".into(), serde_json::to_value(&disabled).unwrap());
        assert_eq!(configured_hotkeys(&preferences), disabled);
    }

    #[test]
    fn fullscreen_canvas_preferences_never_replace_normal_meter_dimensions() {
        let mut preferences = Preferences::default();
        let original = (preferences.width, preferences.height);
        preferences
            .extra
            .insert("fullscreenOverlay".into(), Value::Bool(true));
        for (key, value) in [
            ("overlayX", 40.0),
            ("overlayY", 60.0),
            ("overlayWidth", 500.0),
            ("overlayHeight", 700.0),
        ] {
            preferences
                .extra
                .insert(key.into(), serde_json::json!(value));
        }
        assert!(preferences.validate().is_ok());
        assert!(fullscreen_overlay_enabled(&preferences));
        assert_eq!((preferences.width, preferences.height), original);
        preferences.opacity = 0.0;
        assert!(preferences.validate().is_ok());
        preferences.opacity = -0.01;
        assert!(preferences.validate().is_err());
        preferences.opacity = 1.0;
        preferences
            .extra
            .insert("fullscreenOverlay".into(), serde_json::json!("true"));
        assert!(preferences.validate().is_err());
        preferences
            .extra
            .insert("fullscreenOverlay".into(), Value::Bool(false));
        preferences
            .extra
            .insert("overlayWidth".into(), serde_json::json!(5000));
        assert!(preferences.validate().is_err());
    }

    #[test]
    fn combat_detection_defaults_to_hits_and_rejects_nonsense() {
        let mut preferences = Preferences::default();
        assert_eq!(preferences.combat_detection(), ("hits", 10));
        preferences
            .extra
            .insert("combatDetection".into(), serde_json::json!({"source": "game", "seconds": 45}));
        assert!(preferences.validate().is_ok());
        assert_eq!(preferences.combat_detection(), ("game", 45));
        for bad in [
            serde_json::json!({"source": "party", "seconds": 10}),
            serde_json::json!({"source": "game", "seconds": 4}),
            serde_json::json!({"source": "game", "seconds": 301}),
            serde_json::json!({"source": "game", "seconds": "10"}),
            serde_json::json!({"seconds": 10}),
            serde_json::json!("game"),
        ] {
            preferences.extra.insert("combatDetection".into(), bad);
            assert!(preferences.validate().is_err());
            // Whatever is stored, the engine is only ever handed a valid setting.
            let (source, seconds) = preferences.combat_detection();
            assert!(matches!(source, "hits" | "game") && (5..=300).contains(&seconds));
        }
    }

    #[test]
    fn queued_settings_cannot_revert_a_native_fullscreen_layout_selection() {
        for native_layout in [None, Some("dashboard"), Some("hud")] {
            let mut previous = Preferences::default();
            if let Some(layout) = native_layout {
                previous
                    .extra
                    .insert("fullscreenLayout".into(), Value::String(layout.into()));
            }
            let mut queued = previous.clone();
            let stale_layout = if native_layout == Some("hud") {
                "dashboard"
            } else {
                "hud"
            };
            queued.extra.insert(
                "fullscreenLayout".into(),
                Value::String(stale_layout.into()),
            );
            queued.theme = "pearl".into();
            let mut settings = queued.clone();
            preserve_native_window_preferences(
                &previous,
                &mut settings,
                PreferenceOrigin::Settings,
            );
            assert_eq!(
                settings.extra.get("fullscreenLayout"),
                previous.extra.get("fullscreenLayout")
            );
            assert_eq!(settings.theme, "pearl");
            preserve_native_window_preferences(
                &previous,
                &mut queued,
                PreferenceOrigin::NativeWindowAction,
            );
            assert_eq!(queued.extra["fullscreenLayout"], stale_layout);
        }
    }

    #[test]
    fn fullscreen_entry_defaults_to_dashboard_and_explicit_hud_keeps_saved_geometry() {
        let mut preferences = Preferences::default();
        preferences
            .extra
            .insert("overlayX".into(), serde_json::json!(800));
        preferences
            .extra
            .insert("overlayY".into(), serde_json::json!(400));
        preferences
            .extra
            .insert("overlayWidth".into(), serde_json::json!(420));
        preferences
            .extra
            .insert("overlayHeight".into(), serde_json::json!(340));
        preferences.extra.insert(
            "fullscreenRestoreGeometry".into(),
            serde_json::json!({"private":"unchanged"}),
        );
        let original = preferences.clone();
        request_fullscreen_layout(&mut preferences, false, Some("hud")).unwrap();
        assert!(!fullscreen_overlay_enabled(&preferences));
        assert_eq!(preferences.extra["fullscreenLayout"], "hud");
        request_fullscreen_layout(&mut preferences, true, Some("hud")).unwrap();
        assert_eq!(preferences.extra["fullscreenLayout"], "hud");
        request_fullscreen_layout(&mut preferences, false, None).unwrap();
        assert!(!fullscreen_overlay_enabled(&preferences));
        assert_eq!(preferences.extra["fullscreenLayout"], "hud");
        request_fullscreen_layout(&mut preferences, true, None).unwrap();
        assert_eq!(preferences.extra["fullscreenLayout"], "dashboard");
        assert_eq!(
            (preferences.width, preferences.height),
            (original.width, original.height)
        );
        for key in [
            "overlayX",
            "overlayY",
            "overlayWidth",
            "overlayHeight",
            "fullscreenRestoreGeometry",
        ] {
            assert_eq!(preferences.extra[key], original.extra[key]);
        }
        assert!(preferences.validate().is_ok());
        let before = preferences.clone();
        assert!(request_fullscreen_layout(&mut preferences, false, Some("unsupported")).is_err());
        assert_eq!(
            serde_json::to_value(&preferences).unwrap(),
            serde_json::to_value(&before).unwrap()
        );
    }

    #[test]
    fn fullscreen_layout_validation_accepts_legacy_missing_and_both_modes_only() {
        let mut preferences = Preferences::default();
        assert!(preferences.validate().is_ok());
        for value in [serde_json::json!("dashboard"), serde_json::json!("hud")] {
            preferences.extra.insert("fullscreenLayout".into(), value);
            assert!(preferences.validate().is_ok());
        }
        for value in [
            serde_json::json!("fullscreen"),
            serde_json::json!(true),
            serde_json::json!(null),
            serde_json::json!(4),
        ] {
            preferences.extra.insert("fullscreenLayout".into(), value);
            assert!(preferences.validate().is_err());
        }
    }

    #[test]
    fn click_through_requires_a_rescue_and_drawers_always_accept_input() {
        let mut preferences = Preferences::default();
        preferences
            .extra
            .insert("clickThroughWhenLocked".into(), Value::Bool(true));
        assert_eq!(
            cursor_pass_through(&preferences, false, false).unwrap(),
            false
        );
        preferences.locked = true;
        assert!(cursor_pass_through(&preferences, false, false).is_err());
        assert_eq!(
            pointer_mode_preferences(&preferences, false, false, false),
            fullscreen_overlay::PointerMode::Window
        );
        assert_eq!(
            pointer_mode_preferences(&preferences, false, false, true),
            fullscreen_overlay::PointerMode::Controls
        );
        assert_eq!(
            pointer_mode_preferences(&preferences, true, false, false),
            fullscreen_overlay::PointerMode::Meter
        );
        assert_eq!(
            pointer_mode_preferences(&preferences, true, false, true),
            fullscreen_overlay::PointerMode::Controls
        );
        assert_eq!(
            pointer_mode_preferences(&preferences, false, true, true),
            fullscreen_overlay::PointerMode::Window
        );
        assert_eq!(
            cursor_pass_through(&preferences, false, true).unwrap(),
            true
        );
        assert_eq!(
            cursor_pass_through(&preferences, true, true).unwrap(),
            false
        );
        preferences.locked = false;
        assert_eq!(
            pointer_mode_preferences(&preferences, false, false, true),
            fullscreen_overlay::PointerMode::Window
        );
        assert_eq!(
            cursor_pass_through(&preferences, true, false).unwrap(),
            false
        );
    }

    #[test]
    fn compact_minimum_is_session_only_and_normal_geometry_survives_expand() {
        let mut preferences = Preferences::default();
        preferences.height = 600.0;
        preferences
            .extra
            .insert("compactStrip".into(), Value::Bool(true));
        assert_eq!(meter_min_height(&preferences, false), 44.0);
        assert_eq!(meter_min_height(&preferences, true), MIN_METER_HEIGHT);
        assert_eq!(preferences.height, 600.0);
        assert!(preferences.validate().is_ok());
        preferences
            .extra
            .insert("compactStrip".into(), Value::Bool(false));
        assert_eq!(meter_min_height(&preferences, false), MIN_METER_HEIGHT);
        preferences.text_scale = 2.0;
        assert!(preferences.validate().is_ok());
        preferences.text_scale = 2.01;
        assert!(preferences.validate().is_err());
    }

    #[test]
    fn relay_uses_only_own_allowlisted_fields_and_does_not_rejuvenate_charges() {
        let payload = serde_json::json!({"local":{"name":"Example","class_name":"Ranger","actor_id":7,"identity_source":"server"},
            "party":{"members":[{"name":"Private teammate"}]},"cooldowns":[{"skill_id":12,"raw_remaining_units":12000,
                "estimated_remaining_ms":3000,"observed_at_ms":1000,"charges":2,"charges_observed_at_ms":1,"ready_confirmed":false}]});
        let data = team_own_data(payload.clone(), true, 7000);
        assert_eq!(data["cooldowns"][0]["estimated_remaining_ms"], 9000);
        assert!(data["cooldowns"][0]["charges"].is_null());
        assert_eq!(data["cooldowns"][0]["age_ms"], 6000);
        assert!(!data.to_string().contains("actor_id"));
        assert!(!data.to_string().contains("Private teammate"));
        assert_eq!(
            team_own_data(payload.clone(), true, 7001)["cooldowns"],
            serde_json::json!([])
        );
        assert_eq!(
            team_own_data(payload, false, 1000)["cooldowns"],
            serde_json::json!([])
        );
    }

    #[test]
    fn legacy_small_windows_keep_preferences_and_gain_visible_roster_space() {
        let preferences: Preferences = serde_json::from_value(serde_json::json!({
            "height": 116.0, "width": 350.0, "theme": "violet", "opacity": 0.88,
            "cubeAutoListen": false, "characterName": "Saved name"
        }))
        .unwrap();
        let migrated = preferences.migrate_legacy_dimensions();
        assert_eq!(migrated.height, MIN_METER_HEIGHT);
        assert_eq!(migrated.width, 350.0);
        assert_eq!(migrated.theme, "violet");
        assert_eq!(migrated.opacity, 0.88);
        assert!(!migrated.cube_auto_listen);
        assert_eq!(migrated.extra["characterName"], "Saved name");
        assert!(migrated.validate().is_ok());
        let minimum = resized_meter_dimensions(tauri::PhysicalSize::new(320, 116), 1.0).unwrap();
        assert_eq!(minimum.height, MIN_METER_HEIGHT);
    }

    #[test]
    fn legacy_boss_marks_are_discarded_on_load_and_on_every_settings_save() {
        let preferences: Preferences = serde_json::from_value(serde_json::json!({
            "bossIds": [9, 12], "theme": "violet", "characterName": "Saved name"
        }))
        .unwrap();
        let migrated = preferences.clone().migrate_legacy_dimensions();
        assert!(!migrated.extra.contains_key("bossIds"));
        assert_eq!(migrated.extra["characterName"], "Saved name");
        let mut shared = fixture_shared(MeterEngine::default(), preferences.clone());
        let directory = std::env::temp_dir().join(format!(
            "luma-session-boss-settings-{}-{}",
            std::process::id(),
            now_ms()
        ));
        shared.data_dir = directory.clone();
        persist(&shared, &preferences).unwrap();
        let stored: Value =
            serde_json::from_slice(&fs::read(directory.join("preferences.json")).unwrap()).unwrap();
        assert!(stored.get("bossIds").is_none());
        assert_eq!(stored["theme"], "violet");
        assert_eq!(stored["characterName"], "Saved name");
        fs::remove_file(directory.join("preferences.json")).unwrap();
        fs::remove_dir(directory).unwrap();
    }

    #[test]
    fn manual_boss_marks_change_only_the_live_engine_without_a_settings_write() {
        let mut engine = community_fixture_engine();
        engine.set_boss_targets(&[]);
        let shared = fixture_shared(engine, Preferences::default());
        set_live_boss_targets(&shared, &[2]).unwrap();
        let state = shared.engine.lock().unwrap().state(3_000);
        assert!(
            state
                .targets
                .iter()
                .find(|target| target.id == 2)
                .unwrap()
                .is_boss
        );
        assert!(!shared
            .preferences
            .lock()
            .unwrap()
            .extra
            .contains_key("bossIds"));
        assert!(shared.data_dir.as_os_str().is_empty());
        for invalid in [vec![0], vec![u64::from(u32::MAX) + 1], vec![2; 257]] {
            assert!(set_live_boss_targets(&shared, &invalid).is_err());
        }
        assert!(
            shared
                .engine
                .lock()
                .unwrap()
                .state(3_000)
                .targets
                .iter()
                .find(|target| target.id == 2)
                .unwrap()
                .is_boss
        );
    }

    #[test]
    fn cube_automatic_listening_migrates_legacy_settings_and_respects_explicit_stop() {
        let default = Preferences::default();
        assert_eq!(default.automatic_cube_capture(), Some(("game", 0.82)));
        let legacy: Preferences = serde_json::from_value(serde_json::json!({
            "cubeSource": "system", "cubeThreshold": 0.73
        }))
        .unwrap();
        assert_eq!(legacy.automatic_cube_capture(), Some(("game", 0.73)));
        let stopped: Preferences = serde_json::from_value(serde_json::json!({
            "cubeAutoListen": false, "cubeSource": "system"
        }))
        .unwrap();
        assert_eq!(stopped.automatic_cube_capture(), None);
        assert_eq!(
            serde_json::to_value(stopped).unwrap()["cubeAutoListen"],
            false
        );
        for invalid in [
            serde_json::json!(-1),
            serde_json::json!(1.5),
            serde_json::json!("0.7"),
        ] {
            let preferences: Preferences = serde_json::from_value(serde_json::json!({
                "cubeThreshold": invalid
            }))
            .unwrap();
            assert_eq!(preferences.automatic_cube_capture(), Some(("game", 0.82)));
        }
    }

    #[test]
    fn stopping_cube_audio_is_not_blocked_by_a_settings_write_error() {
        let mut shared = fixture_shared(MeterEngine::default(), Preferences::default());
        let blocked_directory = std::env::temp_dir().join(format!(
            "luma-cube-blocked-settings-{}-{}",
            std::process::id(),
            now_ms()
        ));
        fs::write(&blocked_directory, b"temporary settings-error fixture").unwrap();
        shared.data_dir = blocked_directory.clone();
        let service =
            cube_locator::Service::new(std::env::temp_dir().join("luma-cube-validation-only"))
                .unwrap();
        let stopped = AtomicBool::new(false);
        let result = change_cube_listening(&shared, false, || {
            stopped.store(true, Ordering::Relaxed);
            service.stop()
        });
        assert!(result.is_err());
        assert!(stopped.load(Ordering::Relaxed));
        assert!(!shared.preferences.lock().unwrap().cube_auto_listen);
        assert_eq!(
            serde_json::to_value(service.snapshot().unwrap()).unwrap()["enabled"],
            false
        );
        fs::remove_file(blocked_directory).unwrap();
    }

    fn fixture_shared(engine: MeterEngine, preferences: Preferences) -> Shared {
        Shared {
            engine: Mutex::new(engine),
            preferences: Mutex::new(preferences),
            capture: Mutex::new(native_capture::CaptureStatus::default()),
            data_dir: PathBuf::new(),
            stopping: AtomicBool::new(false),
            panel_open: AtomicBool::new(false),
            panel_restore: Mutex::new(None),
            size_transition_until: AtomicU64::new(0),
            settings_write: Mutex::new(()),
            history_write: Mutex::new(()),
            history_saved_revision: AtomicU64::new(0),
            history_storage_error: Mutex::new(String::new()),
            pet_cache: Mutex::new(pet_cache::Store::open(PathBuf::new())),
            personal_bests: Mutex::new(personal_bests::Store::open(PathBuf::new())),
            pet_cache_revision: AtomicU64::new(0),
            preference_change: Mutex::new(()),
            geometry_save_due: AtomicU64::new(0),
            capture_worker: Mutex::new(None),
            obs: Mutex::new(None),
            calendar: Mutex::new(None),
        }
    }

    #[test]
    fn automatic_capture_diagnostics_exclude_private_state_and_do_not_start_capture() {
        let mut preferences = Preferences::default();
        preferences.extra.insert(
            "characterName".into(),
            Value::String("PRIVATE-CHARACTER".into()),
        );
        let shared = fixture_shared(MeterEngine::default(), preferences);
        {
            let mut capture = shared.capture.lock().unwrap();
            capture.status = "api-version-mismatch".into();
            capture.error_code = Some("0x8007051A".into());
            capture.detail = "PacketMonitorInitialize failed: PRIVATE-PATH PRIVATE-IP".into();
            capture.admin.detail = "PRIVATE-ADMIN-DETAIL".into();
        }
        let report = capture_diagnostics(&shared).unwrap();
        assert_eq!(report["mode"], "native");
        assert_eq!(report["app_version"], env!("CARGO_PKG_VERSION"));
        assert_eq!(report["compatibility"]["diagnostic_only"], true);
        assert_eq!(report["compatibility"]["capture_started"], false);
        assert_eq!(report["capture"]["status"], "api-version-mismatch");
        assert_eq!(report["capture"]["error_code"], "0x8007051A");
        assert_eq!(report["capture"]["operation"], "PacketMonitorInitialize");
        assert_eq!(report["capture"].as_object().unwrap().len(), 4);
        assert!(!report.to_string().contains("PRIVATE-"));
        assert!(shared.capture_worker.lock().unwrap().is_none());
        assert!(!shared.stopping.load(Ordering::Relaxed));
        assert_eq!(
            shared.capture.lock().unwrap().status,
            "api-version-mismatch"
        );
    }

    #[test]
    fn successive_snapshots_are_ordered_without_changing_engine_damage_or_rates() {
        let shared = fixture_shared(MeterEngine::default(), Preferences::default());
        let mut previous_revision = 0;
        for (at, amount, total, events) in [(1000, 100, 100, 1), (2000, 200, 300, 2)] {
            shared.engine.lock().unwrap().ingest_event(
                luma_engine::packets::Event::Damage(luma_engine::packets::Hit {
                    source: 1,
                    target: 2,
                    skill: 14090000,
                    amount,
                    critical: false,
                    tick: false,
                    flags: 0,
                    angle: 0,
                }),
                at,
            );
            let mut first = snapshot(&shared).unwrap();
            let mut second = snapshot(&shared).unwrap();
            let first_revision = first["state_revision"].as_u64().unwrap();
            let second_revision = second["state_revision"].as_u64().unwrap();
            assert!(first_revision > previous_revision);
            assert!(second_revision > first_revision);
            assert_eq!(first["total_damage"], total);
            let current = shared.engine.lock().unwrap().live_state(now_ms());
            assert_eq!(current.total_damage, total);
            assert_eq!(current.diagnostics.damage_events, events);
            assert_eq!(first["dps"].as_f64().unwrap(), current.dps);
            first.as_object_mut().unwrap().remove("state_revision");
            second.as_object_mut().unwrap().remove("state_revision");
            assert_eq!(first, second);
            previous_revision = second_revision;
        }
    }

    #[test]
    fn a_drawer_opened_near_the_bottom_right_stays_inside_the_monitor_work_area() {
        let meter = PanelGeometry {
            position: tauri::PhysicalPosition::new(1700, 980),
            size: tauri::PhysicalSize::new(420, 240),
        };
        let drawer = drawer_geometry(
            meter,
            tauri::PhysicalRect {
                position: tauri::PhysicalPosition::new(0, 40),
                size: tauri::PhysicalSize::new(1920, 1000),
            },
            1.0,
        )
        .unwrap();
        assert_eq!(drawer.position, tauri::PhysicalPosition::new(1100, 340));
        assert_eq!(drawer.size, tauri::PhysicalSize::new(820, 700));
        let mut current = drawer;
        let mut resizable = false;
        apply_panel_layout(
            drawer,
            false,
            Some(meter.position),
            meter.size.into(),
            true,
            |operation| {
                apply_test_operation(&mut current, &mut resizable, operation);
                Ok(())
            },
        )
        .unwrap();
        assert_eq!(current, meter);
        assert!(resizable);
    }

    #[test]
    fn drawer_dimensions_use_monitor_dpi_and_negative_physical_coordinates() {
        let meter = PanelGeometry {
            position: tauri::PhysicalPosition::new(-1810, -100),
            size: tauri::PhysicalSize::new(630, 360),
        };
        let drawer = drawer_geometry(
            meter,
            tauri::PhysicalRect {
                position: tauri::PhysicalPosition::new(-1920, -1020),
                size: tauri::PhysicalSize::new(1920, 1000),
            },
            1.25,
        )
        .unwrap();
        assert_eq!(drawer.size, tauri::PhysicalSize::new(1025, 875));
        assert_eq!(drawer.position, tauri::PhysicalPosition::new(-1810, -895));
        let small_monitor = drawer_geometry(
            meter,
            tauri::PhysicalRect {
                position: tauri::PhysicalPosition::new(-1280, 30),
                size: tauri::PhysicalSize::new(1280, 690),
            },
            1.5,
        )
        .unwrap();
        assert_eq!(small_monitor.size, tauri::PhysicalSize::new(1230, 690));
        assert_eq!(
            small_monitor.position,
            tauri::PhysicalPosition::new(-1280, 30)
        );
    }

    #[test]
    fn invalid_or_insufficient_monitor_bounds_do_not_propose_a_partial_window_move() {
        let meter = PanelGeometry {
            position: tauri::PhysicalPosition::new(100, 120),
            size: tauri::PhysicalSize::new(420, 240),
        };
        let work_area = tauri::PhysicalRect {
            position: tauri::PhysicalPosition::new(0, 0),
            size: tauri::PhysicalSize::new(640, 480),
        };
        for scale_factor in [0.0, -1.0, f64::NAN, f64::INFINITY, 2.5] {
            assert!(drawer_geometry(meter, work_area, scale_factor).is_err());
        }
        let unavailable = tauri::PhysicalRect {
            size: tauri::PhysicalSize::new(0, 0),
            ..work_area
        };
        assert!(drawer_geometry(meter, unavailable, 1.0).is_err());
    }

    #[cfg(windows)]
    #[test]
    fn desktop_instance_guard_rejects_duplicates_and_releases_its_kernel_object() {
        let name = format!("Local\\com.luma.independent.test.{}", std::process::id());
        let first = DesktopInstance::try_acquire(&name).unwrap().unwrap();
        assert!(DesktopInstance::try_acquire(&name).unwrap().is_none());
        assert!(DesktopInstance::try_acquire(&name).unwrap().is_none());
        drop(first);
        let next = DesktopInstance::try_acquire(&name).unwrap().unwrap();
        drop(next);
        assert!(DesktopInstance::try_acquire(&name).unwrap().is_some());
    }

    #[test]
    fn minimized_or_invalid_resize_events_do_not_replace_saved_meter_dimensions() {
        let mut saved = tauri::LogicalSize::new(540.0, 320.0);
        for (size, factor) in [
            (tauri::PhysicalSize::new(0, 0), 1.0),
            (tauri::PhysicalSize::new(500, 0), 1.0),
            (tauri::PhysicalSize::new(0, 300), 1.0),
            (tauri::PhysicalSize::new(500, 300), 0.0),
            (tauri::PhysicalSize::new(500, 300), f64::NAN),
            (tauri::PhysicalSize::new(500, 300), -1.0),
            (tauri::PhysicalSize::new(500, 300), f64::INFINITY),
        ] {
            if let Some(size) = resized_meter_dimensions(size, factor) {
                saved = size;
            }
        }
        assert_eq!(saved, tauri::LogicalSize::new(540.0, 320.0));
        saved = resized_meter_dimensions(tauri::PhysicalSize::new(810, 480), 1.5).unwrap();
        assert_eq!(saved, tauri::LogicalSize::new(540.0, 320.0));
        saved = resized_meter_dimensions(tauri::PhysicalSize::new(960, 540), 1.5).unwrap();
        assert_eq!(saved, tauri::LogicalSize::new(640.0, 360.0));
    }

    #[test]
    fn headless_capture_requires_an_explicit_request() {
        let default_arguments = vec!["--probe-seconds".into(), "10".into()];
        assert!(!probe_capture_requested(&default_arguments, None));
        assert!(!probe_capture_requested(&default_arguments, Some("0")));
        assert!(!probe_capture_requested(&default_arguments, Some("true")));
        assert!(probe_capture_requested(&default_arguments, Some("1")));
        let mut live_arguments = default_arguments;
        live_arguments.push("--probe-capture".into());
        assert!(probe_capture_requested(&live_arguments, None));
    }

    fn apply_test_operation(
        geometry: &mut PanelGeometry,
        resizable: &mut bool,
        operation: PanelOperation,
    ) {
        match operation {
            PanelOperation::Position(position) => geometry.position = position,
            PanelOperation::Size(size) => geometry.size = size.to_physical(1.0),
            PanelOperation::Resizable(value) => *resizable = value,
        }
    }

    #[test]
    fn closing_a_moved_drawer_restores_original_meter_geometry() {
        let meter = PanelGeometry {
            position: tauri::PhysicalPosition::new(-1800, 180),
            size: tauri::PhysicalSize::new(630, 360),
        };
        let drawer = PanelGeometry {
            position: tauri::PhysicalPosition::new(900, 70),
            size: tauri::PhysicalSize::new(1025, 875),
        };
        let mut current = drawer;
        let mut resizable = false;
        apply_panel_layout(
            drawer,
            false,
            Some(meter.position),
            meter.size.into(),
            true,
            |operation| {
                apply_test_operation(&mut current, &mut resizable, operation);
                Ok(())
            },
        )
        .unwrap();
        assert_eq!(current, meter);
        assert!(resizable);
    }

    #[test]
    fn failed_drawer_open_and_close_restore_prior_geometry_and_resize_lock() {
        let meter = PanelGeometry {
            position: tauri::PhysicalPosition::new(-1800, 180),
            size: tauri::PhysicalSize::new(630, 360),
        };
        let drawer = PanelGeometry {
            position: tauri::PhysicalPosition::new(900, 70),
            size: tauri::PhysicalSize::new(1025, 875),
        };
        for (previous, previously_resizable, position, size, resizable) in [
            (
                meter,
                true,
                None,
                tauri::LogicalSize::new(820.0, 700.0).into(),
                false,
            ),
            (drawer, false, Some(meter.position), meter.size.into(), true),
        ] {
            let mut current = previous;
            let mut current_resizable = previously_resizable;
            let mut fail_once = true;
            let result = apply_panel_layout(
                previous,
                previously_resizable,
                position,
                size,
                resizable,
                |operation| {
                    apply_test_operation(&mut current, &mut current_resizable, operation);
                    // Model a native resize that changed geometry before failing.
                    if matches!(operation, PanelOperation::Size(_)) && fail_once {
                        fail_once = false;
                        return Err("resize failure".into());
                    }
                    Ok(())
                },
            );
            assert_eq!(result.unwrap_err(), "resize failure");
            assert_eq!(current, previous);
            assert_eq!(current_resizable, previously_resizable);
        }
    }

    #[test]
    fn live_state_excludes_static_preferences_and_uploaded_data() {
        let mut preferences = Preferences::default();
        preferences.extra.insert(
            "background".into(),
            Value::String("private-background-marker".into()),
        );
        preferences.extra.insert(
            "importedHistory".into(),
            serde_json::json!([{"name": "private-import-marker"}]),
        );
        let mut engine = MeterEngine::default();
        engine.ingest_event(
            luma_engine::packets::Event::Damage(luma_engine::packets::Hit {
                source: 1,
                target: 2,
                skill: 14090000,
                amount: 100,
                critical: false,
                tick: false,
                flags: 0,
                angle: 0,
            }),
            1000,
        );
        engine.reset();
        let shared = fixture_shared(engine, preferences);
        let state = snapshot(&shared).unwrap();
        assert!(state.get("preferences").is_none());
        assert!(state.get("background").is_none());
        assert!(state.get("importedHistory").is_none());
        assert!(state.get("capture").is_some());
        assert!(state.get("diagnostics").is_some());
        assert!(state["history"].as_array().unwrap().is_empty());
        assert!(state.get("history_revision").is_some());
        assert_eq!(state["history_count"], 1);
        let (revision, history) = shared.engine.lock().unwrap().history_snapshot();
        assert_eq!(state["history_revision"], revision);
        assert_eq!(history.len(), 1);
        assert_eq!(history[0].total_damage, 100);
        let encoded = serde_json::to_string(&state).unwrap();
        assert!(!encoded.contains("private-background-marker"));
        assert!(!encoded.contains("private-import-marker"));
    }

    fn community_fixture_engine() -> MeterEngine {
        let mut engine = MeterEngine::default();
        engine.set_boss_targets(&[9]);
        for (target, amount, at) in [(2, 100, 1_000), (9, 200, 2_000)] {
            engine.ingest_event(
                luma_engine::packets::Event::Damage(luma_engine::packets::Hit {
                    source: 1,
                    target,
                    skill: 14_090_000,
                    amount,
                    critical: false,
                    tick: false,
                    flags: 0,
                    angle: 0,
                }),
                at,
            );
        }
        engine
    }

    fn imported_history_fixture() -> Shared {
        let mut engine = community_fixture_engine();
        engine.reset();
        let (_, captured) = engine.history_snapshot();
        assert_eq!(captured.len(), 1);
        engine.merge_history(&captured).unwrap();
        engine.ingest_event(
            luma_engine::packets::Event::Damage(luma_engine::packets::Hit {
                source: 1,
                target: 2,
                skill: 14_090_000,
                amount: 50,
                critical: false,
                tick: false,
                flags: 0,
                angle: 0,
            }),
            4_000,
        );
        fixture_shared(engine, Preferences::default())
    }

    #[test]
    fn failed_import_clear_save_preserves_history_revision_and_current_combat() {
        let shared = imported_history_fixture();
        let before = shared.engine.lock().unwrap().history_snapshot();
        let current = shared.engine.lock().unwrap().current_record(5_000);
        let saved = before.0.saturating_sub(1);
        shared
            .history_saved_revision
            .store(saved, Ordering::Relaxed);
        let result = clear_imported_history_with(&shared, |records| {
            assert_eq!(records.len(), 1);
            assert!(records.iter().all(|record| record.source != "imported"));
            Err("Injected history write failure".into())
        });
        assert_eq!(result.unwrap_err(), "Injected history write failure");
        let after = shared.engine.lock().unwrap().history_snapshot();
        assert_eq!(after.0, before.0);
        assert_eq!(
            serde_json::to_value(after.1).unwrap(),
            serde_json::to_value(before.1).unwrap()
        );
        assert_eq!(shared.history_saved_revision.load(Ordering::Relaxed), saved);
        assert_eq!(
            *shared.history_storage_error.lock().unwrap(),
            "Injected history write failure"
        );
        assert_eq!(
            serde_json::to_value(shared.engine.lock().unwrap().current_record(5_000)).unwrap(),
            serde_json::to_value(current).unwrap()
        );
    }

    #[test]
    fn successful_import_clear_commits_only_retained_history_and_tracks_its_saved_revision() {
        let shared = imported_history_fixture();
        let before = shared.engine.lock().unwrap().history_snapshot();
        let current = shared.engine.lock().unwrap().current_record(5_000);
        *shared.history_storage_error.lock().unwrap() = "Previous storage error".into();
        let mut committed = Vec::new();
        let removed = clear_imported_history_with(&shared, |records| {
            committed = records.to_vec();
            Ok(())
        })
        .unwrap();
        assert_eq!(removed, 1);
        assert_eq!(committed.len(), 1);
        assert!(committed.iter().all(|record| record.source != "imported"));
        let after = shared.engine.lock().unwrap().history_snapshot();
        assert_eq!(after.0, before.0.wrapping_add(1));
        assert_eq!(
            serde_json::to_value(&after.1).unwrap(),
            serde_json::to_value(committed).unwrap()
        );
        assert_eq!(
            shared.history_saved_revision.load(Ordering::Relaxed),
            after.0
        );
        assert!(shared.history_storage_error.lock().unwrap().is_empty());
        assert_eq!(
            serde_json::to_value(shared.engine.lock().unwrap().current_record(5_000)).unwrap(),
            serde_json::to_value(current).unwrap()
        );
        let mut saved_again = false;
        assert_eq!(
            clear_imported_history_with(&shared, |_| {
                saved_again = true;
                Ok(())
            })
            .unwrap(),
            0
        );
        assert!(saved_again);
        assert_eq!(shared.engine.lock().unwrap().history_revision(), after.0);
        let state = snapshot(&shared).unwrap();
        assert_eq!(state["history_count"], 1);
        assert_eq!(state["history_revision"], after.0);
        assert_eq!(state["history_storage_error"], "");
    }

    #[test]
    fn community_record_ids_are_exact_and_cannot_address_files_or_other_commands() {
        assert_eq!(community_record_id(None).unwrap(), None);
        assert_eq!(community_record_id(Some("")).unwrap(), None);
        assert_eq!(community_record_id(Some("42")).unwrap(), Some(42));
        for value in [
            "0",
            "01",
            " 1",
            "1 ",
            "-1",
            "1.0",
            "1e3",
            "../history.json",
            "18446744073709551616",
        ] {
            assert!(community_record_id(Some(value)).is_err(), "{value}");
        }
    }

    #[test]
    fn community_current_selection_preserves_target_filter_and_requires_completion() {
        // The fixture's boss is alive, so its fight stays open for the boss limit (30 s) after the last hit.
        let mut engine = community_fixture_engine();
        assert!(select_community_record(&engine, None, 2_100).is_err());
        engine.pause(true);
        assert!(!engine.live_state(2_100).encounter_active);
        assert!(select_community_record(&engine, None, 2_100).is_err());
        engine.pause(false);
        engine.tick(32_000);
        engine.set_target_mode("boss");
        let current = select_community_record(&engine, None, 32_000).unwrap();
        assert_eq!(current.total_damage, 200);
        assert!(current.targets.iter().all(|target| target.id == 9));
        let saved =
            select_community_record(&engine, Some(&current.id.to_string()), 32_000).unwrap();
        assert_eq!(saved.total_damage, 300);
        assert!(select_community_record(&engine, Some("9999999"), 32_000).is_err());
    }

    #[test]
    fn community_selection_clones_only_the_chosen_record_and_preserves_import_source() {
        // The fixture's boss is alive, so its fight stays open for the boss limit (30 s) after the last hit.
        let mut engine = community_fixture_engine();
        engine.tick(32_000);
        let (_, records) = engine.history_snapshot();
        let original = records[0].clone();
        let mut other_engine = MeterEngine::default();
        other_engine.merge_history(&[original]).unwrap();
        let (_, imported) = other_engine.history_snapshot();
        let id = imported[0].id.to_string();
        let selected = select_community_record(&other_engine, Some(&id), 32_000).unwrap();
        assert_eq!(selected.source, "imported");
        assert_eq!(selected.total_damage, 300);
        other_engine.reset();
        assert_eq!(selected.total_damage, 300);
        assert_eq!(selected.damage_samples.len(), 2);
    }

    #[test]
    fn optional_community_initialization_failure_leaves_a_readable_offline_state() {
        let runtime = CommunityRuntime {
            service: Err("HTTPS initialization unavailable".into()),
        };
        let state = runtime.snapshot();
        assert!(!state.configured);
        assert_eq!(state.endpoint, COMMUNITY_ENDPOINT);
        assert!(state.shares.is_empty());
        assert_eq!(state.pending_count, 0);
        assert_eq!(state.storage_error, "HTTPS initialization unavailable");
        assert!(runtime.service().is_err());
    }
}

fn persist(shared: &Shared, preferences: &Preferences) -> Result<(), String> {
    let _write = shared
        .settings_write
        .lock()
        .map_err(|_| "Settings writer unavailable")?;
    let mut preferences = preferences.clone();
    preferences.discard_session_marks();
    preferences.validate()?;
    fs::create_dir_all(&shared.data_dir)
        .map_err(|e| format!("Cannot create Luma settings directory: {e}"))?;
    let path = shared.data_dir.join("preferences.json");
    let temporary = shared.data_dir.join("preferences.json.new");
    let bytes = serde_json::to_vec_pretty(&preferences).map_err(|e| e.to_string())?;
    if bytes.len() > 4 * 1024 * 1024 {
        return Err("Luma preferences exceed the 4 MB local storage limit".into());
    }
    fs::write(&temporary, bytes).map_err(|e| format!("Cannot save Luma settings: {e}"))?;
    fs::rename(temporary, path).map_err(|e| format!("Cannot replace Luma settings: {e}"))
}

#[tauri::command]
fn get_state(shared: State<Arc<Shared>>) -> Result<Value, String> {
    snapshot(&shared)
}

#[tauri::command]
fn get_cube_state(
    service: State<Arc<cube_locator::Service>>,
) -> Result<cube_locator::CubeState, String> {
    service.snapshot()
}

fn change_cube_listening(
    shared: &Shared,
    enabled: bool,
    operation: impl FnOnce() -> Result<cube_locator::CubeState, String>,
) -> Result<cube_locator::CubeState, String> {
    let _change = shared
        .preference_change
        .lock()
        .map_err(|_| "Preferences unavailable")?;
    let mut current = shared
        .preferences
        .lock()
        .map_err(|_| "Preferences unavailable")?;
    let mut staged = current.clone();
    staged.cube_auto_listen = enabled;
    let saved = persist(shared, &staged);
    if saved.is_ok() || !enabled {
        *current = staged;
    }
    drop(current);
    if enabled {
        saved?;
        operation()
    } else {
        // Stop even if saving fails: an explicit request to stop audio takes
        // precedence over a local storage error.
        let state = operation();
        saved?;
        state
    }
}

#[tauri::command]
async fn start_cube_locator(
    service: State<'_, Arc<cube_locator::Service>>,
    shared: State<'_, Arc<Shared>>,
    source: String,
    threshold: f32,
) -> Result<cube_locator::CubeState, String> {
    let service = service.inner().clone();
    let shared = shared.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        if !matches!(source.as_str(), "game" | "system")
            || !threshold.is_finite()
            || !(0.6..=0.97).contains(&threshold)
        {
            return Err("Invalid Cube source or sensitivity".into());
        }
        change_cube_listening(&shared, true, || service.start(&source, threshold))
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn stop_cube_locator(
    service: State<'_, Arc<cube_locator::Service>>,
    shared: State<'_, Arc<Shared>>,
) -> Result<cube_locator::CubeState, String> {
    let service = service.inner().clone();
    let shared = shared.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        change_cube_listening(&shared, false, || service.stop())
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command(rename_all = "snake_case")]
async fn import_cube_reference(
    service: State<'_, Arc<cube_locator::Service>>,
    data: String,
    start_seconds: f64,
    end_seconds: Option<f64>,
) -> Result<cube_locator::CubeState, String> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        service.import_reference(&data, start_seconds, end_seconds)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn reset_cube_reference(
    service: State<'_, Arc<cube_locator::Service>>,
) -> Result<cube_locator::CubeState, String> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.reset_reference())
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
fn get_app_info() -> Value {
    serde_json::json!({
        "version": env!("CARGO_PKG_VERSION"),
        "edition": "independent",
        "capture": "windows-packet-monitor",
    })
}

fn capture_diagnostics(shared: &Shared) -> Result<Value, String> {
    let compatibility = native_capture::compatibility_report();
    let capture = shared
        .capture
        .lock()
        .map_err(|_| "Capture state unavailable")?;
    Ok(serde_json::json!({
        "type": "luma-capture-diagnostics",
        "schema_version": 1,
        "app_version": env!("CARGO_PKG_VERSION"),
        "mode": "native",
        "compatibility": compatibility,
        "capture": {
            "status": capture.status,
            "error_code": capture.error_code,
            "operation": native_capture::diagnostic_operation(&capture.detail),
            "elevated": capture.admin.elevated,
        },
    }))
}

#[tauri::command]
fn get_capture_diagnostics(shared: State<Arc<Shared>>) -> Result<Value, String> {
    capture_diagnostics(shared.inner())
}

#[tauri::command]
fn get_event_schedule(shared: State<Arc<Shared>>) -> Result<Value, String> {
    let calendar = shared
        .calendar
        .lock()
        .map_err(|_| "Calendar state unavailable")?;
    Ok(calendar.as_ref().map(event_schedule::Service::snapshot).unwrap_or_else(|| serde_json::json!({"feeds":[],"status":"bundled","last_checked_ms":0,"last_success_ms":0,"message":"Bundled event calendar"})))
}

#[tauri::command]
fn refresh_event_schedule(shared: State<Arc<Shared>>) -> Result<Value, String> {
    let calendar = shared
        .calendar
        .lock()
        .map_err(|_| "Calendar state unavailable")?;
    if let Some(calendar) = calendar.as_ref() {
        calendar.refresh();
        Ok(calendar.snapshot())
    } else {
        Ok(
            serde_json::json!({"feeds":[],"status":"bundled","last_checked_ms":0,"last_success_ms":0,"message":"Bundled event calendar"}),
        )
    }
}

fn obs_state(server: Option<&obs_server::RunningServer>) -> Result<Value, String> {
    let Some(server) = server else {
        return Ok(serde_json::json!({"running": false}));
    };
    let mut value = serde_json::to_value(server.info()).map_err(|e| e.to_string())?;
    value
        .as_object_mut()
        .ok_or("Streaming state unavailable")?
        .insert("running".into(), Value::Bool(true));
    Ok(value)
}

#[tauri::command]
fn get_obs_state(shared: State<Arc<Shared>>) -> Result<Value, String> {
    let server = shared
        .obs
        .lock()
        .map_err(|_| "Streaming state unavailable")?;
    obs_state(server.as_ref())
}

#[tauri::command(rename_all = "snake_case")]
fn start_obs(
    shared: State<Arc<Shared>>,
    scope: String,
    hide_names: bool,
    lan_enabled: Option<bool>,
    port: Option<u16>,
) -> Result<Value, String> {
    let scope = obs_server::ObsScope::parse(&scope)?;
    let options = obs_server::ObsOptions {
        lan_enabled: lan_enabled.unwrap_or(false),
        port,
    }
    .validate()?;
    let mut server = shared
        .obs
        .lock()
        .map_err(|_| "Streaming state unavailable")?;
    if server.as_ref().is_some_and(|server| {
        let info = server.info();
        info.scope == scope
            && info.hide_names == hide_names
            && info.lan_enabled == options.lan_enabled
            && options.port.is_none_or(|port| port == info.port)
    }) {
        return obs_state(server.as_ref());
    }
    let weak = Arc::downgrade(shared.inner());
    let provider: obs_server::SnapshotProvider = Arc::new(move || {
        weak.upgrade()
            .and_then(|shared| snapshot(&shared).ok())
            .unwrap_or_else(|| serde_json::json!({"status":"disconnected"}))
    });
    // Preserve the working source if a new LAN address/port cannot be opened.
    let next = obs_server::start_with_options(scope, hide_names, options, provider)?;
    if let Some(mut previous) = server.replace(next) {
        previous.stop();
    }
    obs_state(server.as_ref())
}

#[tauri::command]
fn stop_obs(shared: State<Arc<Shared>>) -> Result<Value, String> {
    if let Some(mut server) = shared
        .obs
        .lock()
        .map_err(|_| "Streaming state unavailable")?
        .take()
    {
        server.stop();
    }
    Ok(serde_json::json!({"running": false}))
}

#[tauri::command]
async fn get_community_state(
    runtime: State<'_, Arc<CommunityRuntime>>,
) -> Result<community::Snapshot, String> {
    let runtime = runtime.inner().clone();
    tauri::async_runtime::spawn_blocking(move || runtime.snapshot())
        .await
        .map_err(|_| "Community state request was interrupted".into())
}

#[tauri::command]
fn get_team_state(runtime: State<'_, Arc<TeamRuntime>>) -> Result<team_sync::Snapshot, String> {
    Ok(runtime.service()?.snapshot())
}

#[tauri::command]
async fn create_team_room(
    runtime: State<'_, Arc<TeamRuntime>>,
) -> Result<team_sync::Snapshot, String> {
    let service = runtime.service()?;
    tauri::async_runtime::spawn_blocking(move || service.create_room())
        .await
        .map_err(|_| "Team room request interrupted".to_string())?
}

#[tauri::command]
async fn join_team_room(
    runtime: State<'_, Arc<TeamRuntime>>,
    invite: String,
) -> Result<team_sync::Snapshot, String> {
    let service = runtime.service()?;
    tauri::async_runtime::spawn_blocking(move || service.join_room(&invite))
        .await
        .map_err(|_| "Team room request interrupted".to_string())?
}

#[tauri::command]
async fn leave_team_room(
    runtime: State<'_, Arc<TeamRuntime>>,
) -> Result<team_sync::Snapshot, String> {
    let service = runtime.service()?;
    tauri::async_runtime::spawn_blocking(move || service.leave_confirmed())
        .await
        .map_err(|_| "Team room leave interrupted".to_string())?
}

#[tauri::command]
fn get_team_invite(runtime: State<'_, Arc<TeamRuntime>>) -> Result<String, String> {
    runtime.service()?.invite()
}

#[tauri::command]
async fn create_community_share(
    runtime: State<'_, Arc<CommunityRuntime>>,
    shared: State<'_, Arc<Shared>>,
    record_id: Option<String>,
    options: community::ShareOptions,
) -> Result<community::Share, String> {
    let runtime = runtime.inner().clone();
    let shared = shared.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let service = runtime.service()?;
        let record = {
            let engine = shared
                .engine
                .lock()
                .map_err(|_| "Meter history unavailable")?;
            select_community_record(&engine, record_id.as_deref(), now_ms())?
        };
        service.share(&record, &options)
    })
    .await
    .map_err(|_| "Community sharing was interrupted".to_string())?
}

#[tauri::command]
async fn get_community_rankings(
    runtime: State<'_, Arc<CommunityRuntime>>,
    filters: community::RankingFilters,
) -> Result<community::Rankings, String> {
    let runtime = runtime.inner().clone();
    tauri::async_runtime::spawn_blocking(move || runtime.service()?.rankings(&filters))
        .await
        .map_err(|_| "Community ranking request was interrupted".to_string())?
}

#[tauri::command]
async fn get_community_statistics(
    runtime: State<'_, Arc<CommunityRuntime>>,
    filters: community::RankingFilters,
) -> Result<community::Statistics, String> {
    let runtime = runtime.inner().clone();
    tauri::async_runtime::spawn_blocking(move || runtime.service()?.statistics(&filters))
        .await
        .map_err(|_| "Community statistics request was interrupted".to_string())?
}

#[tauri::command]
async fn get_share_link(
    runtime: State<'_, Arc<CommunityRuntime>>,
    id: String,
) -> Result<String, String> {
    let runtime = runtime.inner().clone();
    tauri::async_runtime::spawn_blocking(move || runtime.service()?.share_link(&id))
        .await
        .map_err(|_| "Community link request was interrupted".to_string())?
}

#[tauri::command]
async fn revoke_community_share(
    runtime: State<'_, Arc<CommunityRuntime>>,
    id: String,
) -> Result<community::Snapshot, String> {
    let runtime = runtime.inner().clone();
    tauri::async_runtime::spawn_blocking(move || runtime.service()?.revoke(&id))
        .await
        .map_err(|_| "Community revocation was interrupted".to_string())?
}

#[tauri::command]
async fn open_community_url(
    runtime: State<'_, Arc<CommunityRuntime>>,
    url: String,
) -> Result<(), String> {
    let runtime = runtime.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let service = runtime.service()?;
        if !service.allows_url(&url) {
            return Err("Only valid reports on the Luma community service can be opened".into());
        }
        native_capture::open_support_url(&url)
    })
    .await
    .map_err(|_| "Community report could not be opened".to_string())?
}

// Typed payload: serialized directly instead of first building a `Value` tree of the
// whole (up to 32 MB) history.
#[derive(serde::Serialize)]
struct HistoryPayload {
    revision: u64,
    history: Vec<luma_engine::Encounter>,
}

#[tauri::command]
fn get_history(shared: State<Arc<Shared>>) -> Result<HistoryPayload, String> {
    let (revision, history) = shared
        .engine
        .lock()
        .map_err(|_| "Meter history unavailable")?
        .history_snapshot();
    Ok(HistoryPayload { revision, history })
}

#[tauri::command]
fn get_current_encounter(shared: State<Arc<Shared>>) -> Result<Value, String> {
    let record = shared
        .engine
        .lock()
        .map_err(|_| "Meter state unavailable")?
        .current_record(now_ms());
    serde_json::to_value(record).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_assistance_state(shared: State<Arc<Shared>>) -> Result<Value, String> {
    let assistance = shared
        .engine
        .lock()
        .map_err(|_| "Meter state unavailable")?
        .assistance_snapshot(now_ms());
    serde_json::to_value(assistance).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_character_state(shared: State<Arc<Shared>>) -> Result<Value, String> {
    let data = shared
        .engine
        .lock()
        .map_err(|_| "Meter state unavailable")?
        .character_snapshot();
    let cache = shared
        .pet_cache
        .lock()
        .map_err(|_| "Pet cache unavailable")?;
    let mut value =
        serde_json::to_value(cache.project(data, now_ms())).map_err(|e| e.to_string())?;
    if let Some(object) = value.as_object_mut() {
        object.insert(
            "pet_storage_error".into(),
            Value::String(cache.error.clone()),
        );
    }
    Ok(value)
}

#[tauri::command]
fn get_field_bosses(shared: State<Arc<Shared>>) -> Result<Value, String> {
    let data = shared
        .engine
        .lock()
        .map_err(|_| "Meter state unavailable")?
        .field_boss_snapshot();
    serde_json::to_value(data).map_err(|e| e.to_string())
}

fn persist_history(shared: &Shared) -> Result<(), String> {
    let _write = shared
        .history_write
        .lock()
        .map_err(|_| "History writer unavailable")?;
    let (revision, records) = shared
        .engine
        .lock()
        .map_err(|_| "History unavailable")?
        .history_snapshot();
    let result = local_history::save(&shared.data_dir.join("history.json"), &records);
    if let Ok(mut message) = shared.history_storage_error.lock() {
        let expected = records.len().min(200);
        *message = match &result {
            Err(error) => error.clone(),
            Ok(retained) if *retained < expected => format!(
                "{} oldest encounters exceed the history storage limit and were not saved",
                expected - retained
            ),
            Ok(_) => String::new(),
        };
    }
    result?;
    shared
        .history_saved_revision
        .store(revision, Ordering::Relaxed);
    Ok(())
}

#[tauri::command]
fn import_history(shared: State<Arc<Shared>>, document: String) -> Result<Value, String> {
    let records = local_history::parse(document.as_bytes())?;
    shared
        .engine
        .lock()
        .map_err(|_| "Meter state unavailable")?
        .merge_history(&records)?;
    persist_history(&shared)?;
    let (revision, history) = shared
        .engine
        .lock()
        .map_err(|_| "History unavailable")?
        .history_snapshot();
    Ok(serde_json::json!({"revision": revision, "history": history}))
}

fn clear_imported_history_with(
    shared: &Shared,
    save: impl FnOnce(&[luma_engine::Encounter]) -> Result<(), String>,
) -> Result<usize, String> {
    let _write = shared
        .history_write
        .lock()
        .map_err(|_| "History writer unavailable")?;
    let mut engine = shared.engine.lock().map_err(|_| "History unavailable")?;
    let (_, history) = engine.history_snapshot();
    let retained: Vec<_> = history
        .into_iter()
        .filter(|record| record.source != "imported")
        .collect();
    // Keep the engine locked through the disk commit so a newly completed
    // encounter cannot be omitted from the staged file. A failed save leaves
    // both history and its revision unchanged.
    let result = save(&retained);
    if let Ok(mut message) = shared.history_storage_error.lock() {
        *message = result.as_ref().err().cloned().unwrap_or_default();
    }
    result?;
    let removed = engine.clear_imported_history();
    shared
        .history_saved_revision
        .store(engine.history_revision(), Ordering::Relaxed);
    Ok(removed)
}

#[tauri::command]
fn clear_imported_history(shared: State<Arc<Shared>>) -> Result<Value, String> {
    clear_imported_history_with(&shared, |records| {
        local_history::save(&shared.data_dir.join("history.json"), records).map(|_| ())
    })?;
    snapshot(&shared)
}

#[tauri::command(rename_all = "snake_case")]
fn arm_training(
    shared: State<Arc<Shared>>,
    duration_ms: u64,
    target_id: Option<u64>,
) -> Result<Value, String> {
    shared
        .engine
        .lock()
        .map_err(|_| "Meter state unavailable")?
        .arm_training_on_target(duration_ms, target_id)?;
    snapshot(&shared)
}

#[tauri::command]
fn cancel_training(shared: State<Arc<Shared>>) -> Result<Value, String> {
    shared
        .engine
        .lock()
        .map_err(|_| "Meter state unavailable")?
        .cancel_training();
    snapshot(&shared)
}

#[tauri::command]
fn get_preferences(shared: State<Arc<Shared>>) -> Result<Preferences, String> {
    Ok(shared
        .preferences
        .lock()
        .map_err(|_| "Preferences unavailable")?
        .clone())
}

#[tauri::command]
fn set_preferences(
    window: WebviewWindow,
    shared: State<Arc<Shared>>,
    cube: State<Arc<cube_locator::Service>>,
    hotkeys: State<Arc<HotkeyRuntime>>,
    preferences: Preferences,
) -> Result<Preferences, String> {
    change_preferences(
        &window,
        &shared,
        &cube,
        &hotkeys,
        preferences,
        PreferenceOrigin::Settings,
    )
}

#[derive(Clone, Copy)]
enum PreferenceOrigin {
    Settings,
    NativeWindowAction,
}

fn preserve_native_window_preferences(
    previous: &Preferences,
    incoming: &mut Preferences,
    origin: PreferenceOrigin,
) {
    if matches!(origin, PreferenceOrigin::Settings) {
        // Theme/range/gesture saves contain whole snapshots. They may have
        // been queued before a global shortcut or an explicit window action.
        incoming.locked = previous.locked;
        incoming.extra.insert(
            "fullscreenOverlay".into(),
            Value::Bool(fullscreen_overlay_enabled(previous)),
        );
        match previous.extra.get("fullscreenLayout") {
            Some(layout) => {
                incoming
                    .extra
                    .insert("fullscreenLayout".into(), layout.clone());
            }
            None => {
                incoming.extra.remove("fullscreenLayout");
            }
        }
    }
}

fn change_preferences(
    window: &WebviewWindow,
    shared: &Shared,
    cube: &Arc<cube_locator::Service>,
    hotkeys: &HotkeyRuntime,
    mut preferences: Preferences,
    origin: PreferenceOrigin,
) -> Result<Preferences, String> {
    let _change = shared
        .preference_change
        .lock()
        .map_err(|_| "Preferences unavailable")?;
    let previous = shared
        .preferences
        .lock()
        .map_err(|_| "Preferences unavailable")?
        .clone();
    // Read and preserve these fields while holding preference_change, so a
    // queued settings snapshot cannot race an authoritative native toggle.
    preserve_native_window_preferences(&previous, &mut preferences, origin);
    // Native resize owns geometry. Theme/UI saves can contain stale dimensions.
    preferences.width = previous.width;
    preferences.height = previous.height;
    // Only the transactional shortcut command can change OS registrations.
    match previous.extra.get("hotkeys") {
        Some(bindings) => {
            preferences.extra.insert("hotkeys".into(), bindings.clone());
        }
        None => {
            preferences.extra.remove("hotkeys");
        }
    }
    preferences.discard_session_marks();
    prepare_fullscreen_preferences(window, shared, hotkeys, &previous, &mut preferences)?;
    preferences.validate()?;
    let pass_through = cursor_pass_through(
        &preferences,
        shared.panel_open.load(Ordering::Relaxed),
        hotkeys.rescue_available(),
    )?;
    persist(&shared, &preferences)?;
    if let Err(error) = window
        .set_resizable(
            !preferences.locked
                && !shared.panel_open.load(Ordering::Relaxed)
                && !compact_strip(&preferences)
                && !fullscreen_overlay_enabled(&preferences),
        )
        .and_then(|_| window.set_ignore_cursor_events(pass_through))
        .and_then(|_| apply_compact_transition(&window, &shared, &previous, &preferences))
    {
        let _ = persist(&shared, &previous);
        let _ = window.set_ignore_cursor_events(
            cursor_pass_through(
                &previous,
                shared.panel_open.load(Ordering::Relaxed),
                hotkeys.rescue_available(),
            )
            .unwrap_or(false),
        );
        let _ = window.set_resizable(
            !previous.locked
                && !shared.panel_open.load(Ordering::Relaxed)
                && !compact_strip(&previous)
                && !fullscreen_overlay_enabled(&previous),
        );
        let _ = apply_compact_transition(&window, &shared, &preferences, &previous);
        invalidate_fullscreen_pointer(window);
        return Err(error.to_string());
    }
    if let Err(error) = apply_fullscreen_transition(window, shared, &previous, &preferences) {
        let _ = persist(shared, &previous);
        let _ = apply_compact_transition(window, shared, &preferences, &previous);
        let _ = window.set_resizable(
            !previous.locked
                && !shared.panel_open.load(Ordering::Relaxed)
                && !compact_strip(&previous)
                && !fullscreen_overlay_enabled(&previous),
        );
        let _ = window.set_ignore_cursor_events(
            cursor_pass_through(
                &previous,
                shared.panel_open.load(Ordering::Relaxed),
                hotkeys.rescue_available(),
            )
            .unwrap_or(false),
        );
        invalidate_fullscreen_pointer(window);
        return Err(error);
    }
    shared
        .engine
        .lock()
        .map_err(|_| "Meter state unavailable")?
        .set_target_mode(&preferences.target_mode);
    let (combat_source, combat_seconds) = preferences.combat_detection();
    shared
        .engine
        .lock()
        .map_err(|_| "Meter state unavailable")?
        .set_combat_detection(combat_source, combat_seconds)?;
    let character_name = preferences
        .extra
        .get("characterName")
        .and_then(Value::as_str)
        .unwrap_or("");
    let previous_name = previous
        .extra
        .get("characterName")
        .and_then(Value::as_str)
        .unwrap_or("");
    if character_name != previous_name {
        shared
            .engine
            .lock()
            .map_err(|_| "Meter state unavailable")?
            .set_character_name(character_name);
    }
    let mut current = shared
        .preferences
        .lock()
        .map_err(|_| "Preferences unavailable")?;
    preferences.width = current.width;
    preferences.height = current.height;
    *current = preferences.clone();
    drop(current);
    if preferences.cube_auto_listen != previous.cube_auto_listen {
        // The saved preference expresses the user's intent; capture health is
        // reported independently through CubeState and retryable errors.
        if let Some((source, threshold)) = preferences.automatic_cube_capture() {
            let _ = cube.start(source, threshold);
        } else {
            let _ = cube.stop();
        }
    }
    invalidate_fullscreen_pointer(window);
    let _ = window.emit("luma-preferences", &preferences);
    Ok(preferences)
}

fn validate_character_name(name: &str) -> Result<(), String> {
    if name.chars().count() > 64 || name.chars().any(char::is_control) {
        return Err("Character name must contain at most 64 printable characters".into());
    }
    Ok(())
}

#[tauri::command]
fn set_local_player(
    shared: State<Arc<Shared>>,
    id: Option<u64>,
    name: String,
) -> Result<Value, String> {
    validate_character_name(&name)?;
    if id.is_some_and(|id| id == 0 || id > u32::MAX as u64) {
        return Err("Invalid observed character ID".into());
    }
    shared
        .engine
        .lock()
        .map_err(|_| "Meter state unavailable")?
        .set_local_player(id, name.trim())?;
    snapshot(&shared)
}

#[tauri::command]
fn set_character_name(shared: State<Arc<Shared>>, name: String) -> Result<Value, String> {
    validate_character_name(&name)?;
    let _change = shared
        .preference_change
        .lock()
        .map_err(|_| "Preferences unavailable")?;
    let mut preferences = shared
        .preferences
        .lock()
        .map_err(|_| "Preferences unavailable")?;
    let mut staged = preferences.clone();
    staged
        .extra
        .insert("characterName".into(), Value::String(name.trim().into()));
    persist(&shared, &staged)?;
    *preferences = staged;
    drop(preferences);
    shared
        .engine
        .lock()
        .map_err(|_| "Meter state unavailable")?
        .set_character_name(name.trim());
    snapshot(&shared)
}

#[tauri::command]
fn set_party_members(shared: State<Arc<Shared>>, ids: Vec<u64>) -> Result<Value, String> {
    if ids.len() > 12 || ids.iter().any(|id| *id == 0 || *id > u32::MAX as u64) {
        return Err("Choose up to 12 observed party members".into());
    }
    shared
        .engine
        .lock()
        .map_err(|_| "Meter state unavailable")?
        .set_party_members(&ids)?;
    snapshot(&shared)
}

#[tauri::command]
fn reset_encounter(shared: State<Arc<Shared>>) -> Result<Value, String> {
    shared
        .engine
        .lock()
        .map_err(|_| "Meter state unavailable")?
        .reset();
    snapshot(&shared)
}

#[tauri::command]
fn set_paused(shared: State<Arc<Shared>>, paused: bool) -> Result<Value, String> {
    shared
        .engine
        .lock()
        .map_err(|_| "Meter state unavailable")?
        .set_paused_at(paused, now_ms());
    snapshot(&shared)
}

#[tauri::command]
fn set_target_mode(shared: State<Arc<Shared>>, mode: String) -> Result<Value, String> {
    if !matches!(mode.as_str(), "all" | "boss" | "both") {
        return Err("Target mode must be all, boss, or both".into());
    }
    let _change = shared
        .preference_change
        .lock()
        .map_err(|_| "Preferences unavailable")?;
    let mut preferences = shared
        .preferences
        .lock()
        .map_err(|_| "Preferences unavailable")?;
    let mut staged = preferences.clone();
    staged.target_mode = mode.clone();
    persist(&shared, &staged)?;
    *preferences = staged;
    drop(preferences);
    shared
        .engine
        .lock()
        .map_err(|_| "Meter state unavailable")?
        .set_target_mode(&mode);
    snapshot(&shared)
}

fn set_live_boss_targets(shared: &Shared, ids: &[u64]) -> Result<(), String> {
    if ids.len() > 256 || ids.iter().any(|id| *id == 0 || *id > u32::MAX as u64) {
        return Err("Choose up to 256 observed boss target IDs".into());
    }
    shared
        .engine
        .lock()
        .map_err(|_| "Meter state unavailable")?
        .set_boss_targets(ids);
    Ok(())
}

#[tauri::command]
fn set_boss_targets(shared: State<Arc<Shared>>, ids: Vec<u64>) -> Result<Value, String> {
    set_live_boss_targets(&shared, &ids)?;
    snapshot(&shared)
}

#[tauri::command]
fn set_locked(
    window: WebviewWindow,
    shared: State<Arc<Shared>>,
    hotkeys: State<Arc<HotkeyRuntime>>,
    locked: bool,
) -> Result<Preferences, String> {
    change_locked(&window, &shared, &hotkeys, locked)
}

#[tauri::command]
fn start_resize(window: WebviewWindow, shared: State<Arc<Shared>>) -> Result<(), String> {
    if shared
        .preferences
        .lock()
        .ok()
        .is_some_and(|preferences| fullscreen_overlay_enabled(&preferences))
    {
        return Err("Resize the meter panel inside the full-screen canvas".into());
    }
    if shared
        .preferences
        .lock()
        .ok()
        .is_some_and(|preferences| compact_strip(&preferences))
    {
        return Err("Expand the compact strip before resizing".into());
    }
    if shared.panel_open.load(Ordering::Relaxed) {
        return Err("Close the open panel before resizing the meter".into());
    }
    if shared
        .preferences
        .lock()
        .map_err(|_| "Preferences unavailable")?
        .locked
    {
        return Err("Unlock the meter before resizing".into());
    }
    window
        .as_ref()
        .window()
        .start_resize_dragging(tauri_runtime::ResizeDirection::SouthEast)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn start_drag(window: WebviewWindow, shared: State<Arc<Shared>>) -> Result<(), String> {
    if shared
        .preferences
        .lock()
        .ok()
        .is_some_and(|preferences| fullscreen_overlay_enabled(&preferences))
    {
        return Err("Move the meter panel inside the full-screen canvas".into());
    }
    if shared
        .preferences
        .lock()
        .map_err(|_| "Preferences unavailable")?
        .locked
        && !shared.panel_open.load(Ordering::Relaxed)
    {
        return Err("Unlock the meter before moving it".into());
    }
    window.start_dragging().map_err(|e| e.to_string())
}

#[tauri::command]
fn resize_by(
    window: WebviewWindow,
    shared: State<Arc<Shared>>,
    dx: f64,
    dy: f64,
) -> Result<(), String> {
    if shared
        .preferences
        .lock()
        .ok()
        .is_some_and(|preferences| fullscreen_overlay_enabled(&preferences))
    {
        return Err("Resize the meter panel inside the full-screen canvas".into());
    }
    if shared
        .preferences
        .lock()
        .ok()
        .is_some_and(|preferences| compact_strip(&preferences))
    {
        return Err("Expand the compact strip before resizing".into());
    }
    if !dx.is_finite() || !dy.is_finite() || dx.abs() > 500.0 || dy.abs() > 500.0 {
        return Err("Invalid resize step".into());
    }
    if shared
        .preferences
        .lock()
        .map_err(|_| "Preferences unavailable")?
        .locked
    {
        return Err("Unlock the meter before resizing".into());
    }
    if shared.panel_open.load(Ordering::Relaxed) {
        return Err("Close the open panel before resizing the meter".into());
    }
    let size = window.inner_size().map_err(|e| e.to_string())?;
    let factor = window.scale_factor().map_err(|e| e.to_string())?;
    window
        .set_size(tauri::LogicalSize::new(
            (size.width as f64 / factor + dx).clamp(320.0, 1600.0),
            (size.height as f64 / factor + dy).clamp(MIN_METER_HEIGHT, 1600.0),
        ))
        .map_err(|e| e.to_string())
}

fn roster_height_limit(requested: f64, available: f64) -> Result<f64, String> {
    if !requested.is_finite()
        || !(200.0..=800.0).contains(&requested)
        || !available.is_finite()
        || available < 200.0
    {
        return Err("Invalid roster minimum height".into());
    }
    Ok(requested.ceil().min(available.floor()))
}

#[cfg(test)]
mod roster_height_tests {
    use super::roster_height_limit;

    #[test]
    fn roster_height_keeps_readable_rows_inside_the_monitor() {
        assert_eq!(roster_height_limit(200.0, 720.0).unwrap(), 200.0);
        assert_eq!(roster_height_limit(308.2, 720.0).unwrap(), 309.0);
        assert_eq!(roster_height_limit(800.0, 600.0).unwrap(), 600.0);
        for height in [f64::NAN, f64::INFINITY, 0.0, 199.0, 801.0] {
            assert!(roster_height_limit(height, 720.0).is_err());
        }
        assert!(roster_height_limit(300.0, f64::NAN).is_err());
        assert!(roster_height_limit(300.0, 100.0).is_err());
    }
}

#[tauri::command]
fn set_roster_min_height(
    window: WebviewWindow,
    shared: State<Arc<Shared>>,
    height: f64,
) -> Result<f64, String> {
    let preferences = shared
        .preferences
        .lock()
        .map_err(|_| "Preferences unavailable")?;
    if shared.panel_open.load(Ordering::Relaxed)
        || fullscreen_overlay_enabled(&preferences)
        || compact_strip(&preferences)
    {
        return Ok(0.0);
    }
    drop(preferences);
    let factor = window.scale_factor().map_err(|error| error.to_string())?;
    let monitor = window
        .current_monitor()
        .map_err(|error| error.to_string())?;
    let available = monitor.as_ref().map_or(800.0, |monitor| {
        monitor.work_area().size.height as f64 / factor - 8.0
    });
    let minimum = roster_height_limit(height, available)?;
    window
        .set_min_size(Some(tauri::LogicalSize::new(320.0, minimum)))
        .map_err(|error| error.to_string())?;
    let size = window.inner_size().map_err(|error| error.to_string())?;
    if size.height as f64 / factor + 0.5 < minimum {
        window
            .set_size(tauri::LogicalSize::new(size.width as f64 / factor, minimum))
            .map_err(|error| error.to_string())?;
        if let Some(monitor) = monitor {
            let position = window.outer_position().map_err(|error| error.to_string())?;
            let work = monitor.work_area();
            let y = (position.y as f64)
                .min(work.position.y as f64 + work.size.height as f64 - minimum * factor)
                .max(work.position.y as f64);
            window
                .set_position(tauri::PhysicalPosition::new(position.x, y as i32))
                .map_err(|error| error.to_string())?;
        }
    }
    Ok(minimum)
}

#[tauri::command]
fn close_window(window: WebviewWindow) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

struct PanelInputTransition<'a> {
    window: &'a WebviewWindow,
    shared: &'a Shared,
    previous: bool,
    committed: bool,
}

impl<'a> PanelInputTransition<'a> {
    fn begin(window: &'a WebviewWindow, shared: &'a Shared, previous: bool, open: bool) -> Self {
        // Stop an already queued click-through write before resizing/opening
        // the drawer. A failed transition restores the prior input policy.
        if open {
            shared.panel_open.store(true, Ordering::Relaxed);
        }
        invalidate_fullscreen_pointer(window);
        Self {
            window,
            shared,
            previous,
            committed: false,
        }
    }
}

impl Drop for PanelInputTransition<'_> {
    fn drop(&mut self) {
        if !self.committed {
            self.shared
                .panel_open
                .store(self.previous, Ordering::Relaxed);
            invalidate_fullscreen_pointer(self.window);
        }
    }
}

#[tauri::command]
fn set_panel_open(
    window: WebviewWindow,
    shared: State<Arc<Shared>>,
    hotkeys: State<Arc<HotkeyRuntime>>,
    open: bool,
) -> Result<(), String> {
    let _change = shared
        .preference_change
        .lock()
        .map_err(|_| "Preferences unavailable")?;
    let previously_open = shared.panel_open.load(Ordering::Relaxed);
    if previously_open == open {
        return Ok(());
    }
    let mut input_transition = PanelInputTransition::begin(&window, &shared, previously_open, open);
    if open {
        window
            .set_ignore_cursor_events(false)
            .map_err(|error| error.to_string())?;
    }
    let preferences = shared
        .preferences
        .lock()
        .map_err(|_| "Preferences unavailable")?
        .clone();
    if fullscreen_overlay_enabled(&preferences) {
        shared.panel_open.store(open, Ordering::Relaxed);
        invalidate_fullscreen_pointer(&window);
        input_transition.committed = true;
        return Ok(());
    }
    let previous = PanelGeometry {
        position: window.outer_position().map_err(|error| error.to_string())?,
        size: window.inner_size().map_err(|error| error.to_string())?,
    };
    let mut restore = shared
        .panel_restore
        .lock()
        .map_err(|_| "Panel window geometry unavailable")?;
    let (position, size) = if open {
        let monitor = match window
            .current_monitor()
            .map_err(|error| error.to_string())?
        {
            Some(monitor) => monitor,
            None => window
                .primary_monitor()
                .map_err(|error| error.to_string())?
                .ok_or("No monitor is available for the panel")?,
        };
        let geometry = drawer_geometry(previous, *monitor.work_area(), monitor.scale_factor())?;
        (Some(geometry.position), geometry.size.into())
    } else {
        let geometry = restore
            .as_ref()
            .ok_or("The meter's original window geometry is unavailable")?;
        (Some(geometry.position), geometry.size.into())
    };
    shared
        .size_transition_until
        .store(now_ms() + 500, Ordering::Relaxed);
    if !open {
        window
            .set_min_size(Some(tauri::LogicalSize::new(
                320.0,
                meter_min_height(&preferences, false),
            )))
            .map_err(|error| error.to_string())?;
    }
    let layout = apply_panel_layout(
        previous,
        !previously_open && !preferences.locked && !compact_strip(&preferences),
        position,
        size,
        !open && !preferences.locked && !compact_strip(&preferences),
        |operation| {
            match operation {
                PanelOperation::Position(position) => window.set_position(position),
                PanelOperation::Size(size) => window.set_size(size),
                PanelOperation::Resizable(resizable) => window.set_resizable(resizable),
            }
            .map_err(|error| error.to_string())
        },
    );
    if let Err(error) = layout {
        let _ = window.set_min_size(Some(tauri::LogicalSize::new(
            320.0,
            meter_min_height(&preferences, previously_open),
        )));
        let _ = window.set_ignore_cursor_events(
            cursor_pass_through(&preferences, previously_open, hotkeys.rescue_available())
                .unwrap_or(false),
        );
        return Err(error);
    }
    window
        .set_min_size(Some(tauri::LogicalSize::new(
            320.0,
            meter_min_height(&preferences, open),
        )))
        .map_err(|error| error.to_string())?;
    *restore = if open { Some(previous) } else { None };
    shared.panel_open.store(open, Ordering::Relaxed);
    let pass_through =
        cursor_pass_through(&preferences, open, hotkeys.rescue_available()).unwrap_or(false);
    window
        .set_ignore_cursor_events(pass_through)
        .map_err(|error| error.to_string())?;
    invalidate_fullscreen_pointer(&window);
    input_transition.committed = true;
    Ok(())
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    if url != "https://buymeacoffee.com/12hrsofficp" {
        return Err("This link is not allowed".into());
    }
    native_capture::open_support_url(&url)
}

#[tauri::command]
fn open_pet_reference(url: String) -> Result<(), String> {
    let checked = pet_reference::checked_url(&url)?;
    native_capture::open_support_url(&checked)
}

#[tauri::command]
fn export_encounter(shared: State<Arc<Shared>>) -> Result<String, String> {
    let encounter = shared
        .engine
        .lock()
        .map_err(|_| "Meter state unavailable")?
        .current_record(now_ms());
    if encounter.total_damage == 0 {
        return Err("This encounter has no damage to export for the selected target mode".into());
    }
    let document =
        serde_json::json!({"type": "luma-history", "version": 1, "encounters": [encounter]});
    let directory = shared.data_dir.join("exports");
    fs::create_dir_all(&directory).map_err(|e| format!("Cannot create export directory: {e}"))?;
    let path = directory.join(format!("luma-encounter-{}.json", now_ms()));
    fs::write(
        &path,
        serde_json::to_vec_pretty(&document).map_err(|e| e.to_string())?,
    )
    .map_err(|e| format!("Cannot export encounter: {e}"))?;
    Ok(path.to_string_lossy().into_owned())
}

/// Save the last `seconds` of received game frames to the app data folder, on request only.
#[tauri::command]
fn save_capture(
    shared: State<Arc<Shared>>,
    label: String,
    seconds: u64,
) -> Result<String, String> {
    let seconds = seconds.clamp(10, 300);
    let now = now_ms();
    let frames = shared
        .engine
        .lock()
        .map_err(|_| "Meter state is unavailable")?
        .recent_frames(now.saturating_sub(seconds * 1000));
    if frames.is_empty() {
        return Err("No game traffic has been received in that time".into());
    }
    capture_dump::write(&shared.data_dir.join("captures"), &label, now, seconds, &frames)
        .map(|path| path.display().to_string())
}

#[tauri::command]
fn export_document(
    shared: State<Arc<Shared>>,
    format: String,
    content: String,
) -> Result<String, String> {
    if !matches!(format.as_str(), "json" | "csv" | "html" | "ics")
        || content.is_empty()
        || content.len() > 16 * 1024 * 1024
    {
        return Err("Choose a nonempty JSON, CSV, HTML, or ICS file up to 16 MB".into());
    }
    if format == "json" {
        let _: Value = serde_json::from_str(&content).map_err(|_| "Report is not valid JSON")?;
    }
    let directory = shared.data_dir.join("exports");
    fs::create_dir_all(&directory).map_err(|e| format!("Cannot create export directory: {e}"))?;
    let timestamp = now_ms();
    for attempt in 0..32 {
        let path = directory.join(format!("luma-report-{timestamp}-{attempt}.{format}"));
        match fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&path)
        {
            Ok(mut file) => {
                file.write_all(content.as_bytes())
                    .map_err(|e| format!("Cannot save report: {e}"))?;
                return Ok(path.to_string_lossy().into_owned());
            }
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(format!("Cannot save report: {error}")),
        }
    }
    Err("Too many reports were exported at once; try again".into())
}

fn run_probe_if_requested() -> bool {
    let arguments: Vec<String> = std::env::args().skip(1).collect();
    let Some(index) = arguments
        .iter()
        .position(|value| value == "--probe-seconds")
    else {
        return false;
    };
    let seconds = arguments
        .get(index + 1)
        .and_then(|value| value.parse::<u64>().ok())
        .filter(|value| (1..=30).contains(value));
    let Some(seconds) = seconds else {
        eprintln!("--probe-seconds requires an integer from 1 to 30");
        std::process::exit(2);
    };
    let output = arguments
        .iter()
        .position(|value| value == "--probe-output")
        .and_then(|index| arguments.get(index + 1))
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(format!("luma-native-probe-{}.json", now_ms())));
    let capture_requested = probe_capture_requested(
        &arguments,
        std::env::var("LUMA_PROBE_CAPTURE").ok().as_deref(),
    );
    if capture_requested {
        std::env::remove_var("LUMA_CAPTURE_DISABLED");
    } else {
        std::env::set_var("LUMA_CAPTURE_DISABLED", "1");
    }
    let backend = native_capture::inspect_backend();
    let shared = Arc::new(Shared {
        engine: Mutex::new(MeterEngine::default()),
        preferences: Mutex::new(Preferences::default()),
        capture: Mutex::new(native_capture::CaptureStatus::default()),
        data_dir: PathBuf::new(),
        stopping: AtomicBool::new(false),
        panel_open: AtomicBool::new(false),
        panel_restore: Mutex::new(None),
        size_transition_until: AtomicU64::new(0),
        settings_write: Mutex::new(()),
        history_write: Mutex::new(()),
        history_saved_revision: AtomicU64::new(0),
        history_storage_error: Mutex::new(String::new()),
        pet_cache: Mutex::new(pet_cache::Store::open(PathBuf::new())),
        personal_bests: Mutex::new(personal_bests::Store::open(PathBuf::new())),
        pet_cache_revision: AtomicU64::new(0),
        preference_change: Mutex::new(()),
        geometry_save_due: AtomicU64::new(0),
        capture_worker: Mutex::new(None),
        obs: Mutex::new(None),
        calendar: Mutex::new(None),
    });
    let worker = native_capture::spawn(shared.clone());
    let started = std::time::Instant::now();
    while started.elapsed() < Duration::from_secs(seconds) {
        if let Ok(mut engine) = shared.engine.lock() {
            engine.tick(now_ms());
        }
        std::thread::sleep(Duration::from_millis(100));
    }
    shared.stopping.store(true, Ordering::Relaxed);
    let _ = worker.join();
    let result = (|| -> Result<(), String> {
        let mut state = snapshot(&shared)?;
        if let Some(object) = state.as_object_mut() {
            object.insert("capture_diagnostics".into(), capture_diagnostics(&shared)?);
            object.insert("probe".into(), serde_json::json!({ "version": env!("CARGO_PKG_VERSION"), "duration_ms": started.elapsed().as_millis(),
                "capture_requested": capture_requested, "api_exports_present": backend.is_ok(), "api_error": backend.err(), "window_opened": false }));
        }
        let bytes = serde_json::to_vec_pretty(&state).map_err(|e| e.to_string())?;
        fs::write(&output, &bytes).map_err(|e| format!("Cannot write native probe result: {e}"))?;
        println!("{}", String::from_utf8_lossy(&bytes));
        Ok(())
    })();
    if let Err(error) = result {
        eprintln!("{error}");
        std::process::exit(1);
    }
    true
}

fn probe_capture_requested(arguments: &[String], environment: Option<&str>) -> bool {
    arguments.iter().any(|value| value == "--probe-capture") || environment == Some("1")
}

fn main() {
    if updates::run_helper_if_requested() {
        return;
    }
    if run_probe_if_requested() {
        return;
    }
    #[cfg(windows)]
    let _desktop_instance = match DesktopInstance::try_acquire(
        "Local\\com.luma.independent.desktop",
    ) {
        Ok(Some(instance)) => instance,
        Ok(None) => {
            notify_desktop_startup("Luma zaten açık. Açık olan Luma penceresini kullanın.\n\nLuma is already running. Use the existing Luma window.");
            return;
        }
        Err(message) => {
            notify_desktop_startup(&message);
            return;
        }
    };
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_state,
            get_personal_bests,
            get_cube_state,
            start_cube_locator,
            stop_cube_locator,
            import_cube_reference,
            reset_cube_reference,
            get_app_info,
            get_capture_diagnostics,
            get_event_schedule,
            refresh_event_schedule,
            get_obs_state,
            start_obs,
            stop_obs,
            get_hotkey_state,
            set_hotkeys,
            get_update_state,
            check_updates,
            download_update,
            install_update,
            get_community_state,
            create_community_share,
            get_community_rankings,
            get_community_statistics,
            get_share_link,
            revoke_community_share,
            open_community_url,
            get_team_state,
            create_team_room,
            join_team_room,
            leave_team_room,
            get_team_invite,
            get_history,
            get_current_encounter,
            get_assistance_state,
            get_character_state,
            get_field_bosses,
            import_history,
            clear_imported_history,
            arm_training,
            cancel_training,
            get_preferences,
            set_preferences,
            set_fullscreen_overlay,
            set_overlay_hit_regions,
            set_local_player,
            set_character_name,
            set_party_members,
            reset_encounter,
            set_paused,
            set_target_mode,
            overlays::set_overlay,
            overlays::list_overlays,
            overlays::overlay_drag,
            overlays::overlay_resize,
            set_boss_targets,
            set_locked,
            start_resize,
            start_drag,
            resize_by,
            set_roster_min_height,
            close_window,
            set_panel_open,
            open_url,
            open_pet_reference,
            export_encounter,
            export_document,
            save_capture
        ])
        .setup(|app| {
            let data_dir = app.path().app_local_data_dir()?;
            app.manage(Arc::new(CommunityRuntime::new(
                data_dir.join("community-shares.json"),
            )));
            let cube = Arc::new(cube_locator::Service::new(data_dir.clone())?);
            app.manage(cube.clone());
            let preferences_path = data_dir.join("preferences.json");
            let mut preferences = fs::metadata(&preferences_path)
                .ok()
                .filter(|metadata| metadata.len() <= 4 * 1024 * 1024)
                .and_then(|_| fs::read(preferences_path).ok())
                .and_then(|bytes| serde_json::from_slice::<Preferences>(&bytes).ok())
                .map(Preferences::migrate_legacy_dimensions)
                .filter(|value| value.validate().is_ok())
                .unwrap_or_default();
            let requested_fullscreen = fullscreen_overlay_enabled(&preferences);
            // Register and verify the global exit shortcut before expanding a
            // restored full-monitor window.
            preferences.extra.insert("fullscreenOverlay".into(), Value::Bool(false));
            if let Some((source, threshold)) = preferences.automatic_cube_capture() {
                // This starts only the background worker. It waits for AION2
                // and never opens a microphone or another process's output.
                let _ = cube.start(source, threshold);
            }
            let mut engine = MeterEngine::default();
            let restored_history = local_history::load(&data_dir.join("history.json"));
            if let Ok(records) = &restored_history {
                engine.restore_history(records);
            }
            // Cube templates learned from opening one with a key, kept between runs.
            app.manage(Arc::new(overlays::Store::load(&data_dir)));
            let cube_templates_path = data_dir.join("cube-templates.json");
            if let Some(saved) = fs::read(&cube_templates_path)
                .ok()
                .filter(|bytes| bytes.len() <= 4096)
                .and_then(|bytes| serde_json::from_slice::<Vec<u32>>(&bytes).ok())
            {
                engine.learn_cube_templates(saved);
            }
            let mut cube_templates_saved = engine.cube_templates();
            let history_revision = engine.history_revision();
            let history_error = restored_history.err().unwrap_or_default();
            engine.set_target_mode(&preferences.target_mode);
            let (combat_source, combat_seconds) = preferences.combat_detection();
            let _ = engine.set_combat_detection(combat_source, combat_seconds);
            engine.set_character_name(
                preferences
                    .extra
                    .get("characterName")
                    .and_then(Value::as_str)
                    .unwrap_or(""),
            );
            if let Some(window) = app.get_webview_window("main") {
                window.set_min_size(Some(tauri::LogicalSize::new(320.0,meter_min_height(&preferences,false))))?;
                window.set_size(tauri::LogicalSize::new(
                    preferences.width,
                    if compact_strip(&preferences){44.0}else{preferences.height},
                ))?;
                window.set_resizable(!preferences.locked && !compact_strip(&preferences))?;
                if requested_fullscreen {
                    if let Some(normal) = preferences.extra.get("fullscreenRestoreGeometry").cloned()
                        .and_then(|value| serde_json::from_value::<fullscreen_overlay::Geometry>(value).ok())
                        .filter(|geometry| geometry.valid())
                    {
                        if let Ok((geometry, _)) = restored_fullscreen_geometry(&window, normal, compact_strip(&preferences)) {
                            window.set_position(geometry.position)?;
                            window.set_size(geometry.size)?;
                        }
                    }
                }
            }
            let calendar = event_schedule::Service::start(data_dir.join("event-calendars.json"));
            let pet_cache = pet_cache::Store::open(data_dir.join("pet-counters.json"));
            let personal_bests = personal_bests::Store::open(data_dir.join("personal-bests.json"));
            let shared = Arc::new(Shared {
                engine: Mutex::new(engine),
                preferences: Mutex::new(preferences),
                capture: Mutex::new(native_capture::CaptureStatus::default()),
                data_dir,
                stopping: AtomicBool::new(false),
                panel_open: AtomicBool::new(false),
                panel_restore: Mutex::new(None),
                size_transition_until: AtomicU64::new(0),
                settings_write: Mutex::new(()),
                history_write: Mutex::new(()),
                history_saved_revision: AtomicU64::new(history_revision),
                history_storage_error: Mutex::new(history_error),
                pet_cache: Mutex::new(pet_cache),
                personal_bests: Mutex::new(personal_bests),
                pet_cache_revision: AtomicU64::new(0),
                preference_change: Mutex::new(()),
                geometry_save_due: AtomicU64::new(0),
                capture_worker: Mutex::new(None),
                obs: Mutex::new(None),
                calendar: Mutex::new(Some(calendar)),
            });
            app.manage(shared.clone());
            let handle=app.handle().clone();let weak=Arc::downgrade(&shared);
            let bindings=shared.preferences.lock().map(|preferences|configured_hotkeys(&preferences)).unwrap_or_else(|_|hotkeys::default_bindings());
            let callback=Arc::new(move|action|{
                let app=handle.clone();let weak=weak.clone();let dispatch=handle.run_on_main_thread(move||{
                    if let Some(shared)=weak.upgrade(){if let Err(error)=handle_global_hotkey(&app,&shared,action){let _=app.emit("luma-hotkey",serde_json::json!({"action":action,"error":error}));}}
                });
                if dispatch.is_err(){let _=handle.emit("luma-hotkey",serde_json::json!({"action":action,"error":"Global shortcut could not reach the Luma window"}));}
            });
            let hotkey_service = hotkeys::HotkeyService::start(bindings.clone(), callback).map(Arc::new);
            if let Ok(service) = &hotkey_service {
                if !service.state().errors.is_empty() && bindings.iter().any(|binding|
                    binding.enabled && binding.action == hotkeys::Action::ToggleFullscreen)
                {
                    // A newly added F5 conflict must not disable the six older
                    // working shortcuts. Keep fullscreen unavailable safely.
                    let fallback = bindings.into_iter().map(|mut binding| {
                        if binding.action == hotkeys::Action::ToggleFullscreen { binding.enabled = false; }
                        binding
                    }).collect();
                    let _ = service.update(fallback);
                }
            }
            let hotkey_runtime=Arc::new(HotkeyRuntime{service:hotkey_service});
            if let Some(window)=app.get_webview_window("main"){
                let enabled=shared.preferences.lock().ok().and_then(|preferences|cursor_pass_through(&preferences,false,hotkey_runtime.rescue_available()).ok()).unwrap_or(false);
                let _=window.set_ignore_cursor_events(enabled);
            }
            app.manage(hotkey_runtime.clone());
            let fullscreen_runtime = Arc::new(FullscreenRuntime::default());
            app.manage(fullscreen_runtime.clone());
            if let Some(window) = app.get_webview_window("main") {
                if requested_fullscreen {
                    let mut requested = shared.preferences.lock()
                        .map_err(|_| "Preferences unavailable")?.clone();
                    requested.extra.insert("fullscreenOverlay".into(), Value::Bool(true));
                    if let Err(error) = change_preferences(&window, &shared, &cube, &hotkey_runtime, requested, PreferenceOrigin::NativeWindowAction) {
                        let _ = window.emit("luma-fullscreen-error", error);
                        if let Ok(preferences) = shared.preferences.lock() { let _ = persist(&shared, &preferences); }
                    }
                }
                start_fullscreen_pointer_worker(
                    window,
                    shared.clone(),
                    fullscreen_runtime,
                    hotkey_runtime.clone(),
                );
            }
            let updates=Arc::new(UpdateRuntime{service:updates::UpdateService::new(shared.data_dir.clone(),env!("CARGO_PKG_VERSION")).map(Arc::new)});
            let automatic=shared.preferences.lock().ok().is_some_and(|preferences|preferences.extra.get("autoCheckUpdates").and_then(Value::as_bool)!=Some(false));
            app.manage(updates.clone());
            if automatic {if let Ok(service)=updates.service(){let app=app.handle().clone();std::thread::spawn(move||{let _=service.check();let _=app.emit("luma-update-state",service.snapshot());});}}
            let weak_shared = Arc::downgrade(&shared);
            let provider: team_sync::OwnProvider = Arc::new(move || {
                let Some(shared) = weak_shared.upgrade() else {
                    return Value::Null;
                };
                let at = now_ms();
                let live = shared.capture.lock().ok().is_some_and(|capture| {
                    capture.status == "capturing"
                        && capture.game_connections > 0
                        && capture
                            .last_packet_at_ms
                            .is_some_and(|last| at >= last && at - last <= team_sync::FRESH_MS)
                });
                let payload = shared
                    .engine
                    .lock()
                    .ok()
                    .map(|engine| engine.team_sync_payload(at))
                    .unwrap_or(Value::Null);
                team_own_data(payload, live, at)
            });
            app.manage(Arc::new(TeamRuntime {
                service: team_sync::Service::new(provider).map(Arc::new),
            }));
            *shared
                .capture_worker
                .lock()
                .map_err(|_| "Capture worker unavailable")? =
                Some(native_capture::spawn(shared.clone()));
            overlays::restore(app.handle());
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                let mut history_retry_at = 0;
                let mut calendar_revision = None;
                let mut cube_revision = None;
                let mut z_order_checked_at=0;let mut last_topmost=None;
                while !shared.stopping.load(Ordering::Relaxed) {
                    if now_ms()>=z_order_checked_at {
                        z_order_checked_at=now_ms()+500;
                        let only_game=shared.preferences.lock().ok().is_some_and(|preferences|preferences.extra.get("onlyAboveGame").and_then(Value::as_bool)==Some(true));
                        let topmost=!only_game || window_mode::is_game_or_luma_foreground();
                        if last_topmost!=Some(topmost){if let Some(window)=handle.get_webview_window("main"){if window.set_always_on_top(topmost).is_ok(){last_topmost=Some(topmost);}}}
                    }
                    let deadline = shared.geometry_save_due.load(Ordering::Relaxed);
                    if deadline != 0
                        && now_ms() >= deadline
                        && shared
                            .geometry_save_due
                            .compare_exchange(deadline, 0, Ordering::Relaxed, Ordering::Relaxed)
                            .is_ok()
                    {
                        if let (Ok(_change), Ok(preferences)) =
                            (shared.preference_change.lock(), shared.preferences.lock())
                        {
                            if persist(&shared, &preferences).is_err() {
                                shared
                                    .geometry_save_due
                                    .store(now_ms() + 1000, Ordering::Relaxed);
                            }
                        }
                    }
                    if let Ok(mut engine) = shared.engine.lock() {
                        engine.tick(now_ms());
                    }
                    let cube_notice = shared.engine.lock().ok().map(|engine| {
                        (engine.cube_radar(now_ms()), engine.cube_templates())
                    });
                    if let Some((radar, templates)) = cube_notice {
                        cube.set_network(cube_locator::NetworkCube::from_radar(&radar));
                        if templates != cube_templates_saved
                            && serde_json::to_vec(&templates)
                                .ok()
                                .is_some_and(|bytes| fs::write(&cube_templates_path, bytes).is_ok())
                        {
                            cube_templates_saved = templates;
                        }
                    }
                    refresh_pet_cache(&shared, false);
                    refresh_personal_bests(&shared, false);
                    if let Some(panels) = handle.try_state::<Arc<overlays::Store>>() {
                        panels.flush(false);
                    }
                    if let Ok(state) = snapshot(&shared) {
                        let _ = handle.emit("luma-state", state);
                    }
                    let calendar_update = shared.calendar.lock().ok().and_then(|calendar| {
                        calendar.as_ref().and_then(|calendar| {
                            let revision = calendar.revision();
                            if calendar_revision == Some(revision) {
                                None
                            } else {
                                calendar_revision = Some(revision);
                                Some(calendar.snapshot())
                            }
                        })
                    });
                    if let Some(calendar) = calendar_update {
                        let _ = handle.emit("luma-calendar-state", calendar);
                    }
                    if let Ok(status) = cube.snapshot() {
                        if Some(status.revision) != cube_revision {
                            cube_revision = Some(status.revision);
                            let _ = handle.emit("luma-cube-state", status);
                        }
                    }
                    let history_revision = shared
                        .engine
                        .lock()
                        .ok()
                        .map(|engine| engine.history_revision());
                    if now_ms() >= history_retry_at
                        && history_revision.is_some_and(|revision| {
                            revision != shared.history_saved_revision.load(Ordering::Relaxed)
                        })
                    {
                        history_retry_at = if persist_history(&shared).is_ok() {
                            0
                        } else {
                            now_ms() + 5000
                        };
                    }
                    std::thread::sleep(Duration::from_millis(150));
                }
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            if let Some(panel) = overlays::panel_of(window.label()) {
                overlays::on_event(window, panel, event);
                return;
            }
            if let Some(shared) = window.try_state::<Arc<Shared>>() {
                match event {
                    tauri::WindowEvent::Destroyed => {
                        shared.stopping.store(true, Ordering::Relaxed);
                        overlays::shutdown(window.app_handle());
                    }
                    tauri::WindowEvent::Resized(size) => {
                        if shared.panel_open.load(Ordering::Relaxed)
                            || now_ms() < shared.size_transition_until.load(Ordering::Relaxed)
                            || shared.preferences.lock().ok().is_some_and(|preferences|
                                compact_strip(&preferences) || fullscreen_overlay_enabled(&preferences))
                        {
                            return;
                        }
                        if let (Ok(factor), Ok(mut preferences)) =
                            (window.scale_factor(), shared.preferences.lock())
                        {
                            let Some(size) = resized_meter_dimensions(*size, factor) else {
                                return;
                            };
                            preferences.width = size.width;
                            preferences.height = size.height;
                            shared
                                .geometry_save_due
                                .store(now_ms() + 350, Ordering::Relaxed);
                        }
                    }
                    _ => {}
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("Unable to launch Luma desktop")
        .run(|handle, event| {
            if matches!(event, tauri::RunEvent::Exit) {
                let shared = handle.state::<Arc<Shared>>();
                shared.stopping.store(true, Ordering::Relaxed);
                if let Some(panels) = handle.try_state::<Arc<overlays::Store>>() {
                    panels.flush(true);
                }
                if let Some(runtime) = handle.try_state::<Arc<TeamRuntime>>() {
                    if let Ok(service) = runtime.service() {
                        service.leave();
                    }
                }
                if let Some(cube) = handle.try_state::<Arc<cube_locator::Service>>() {
                    let _ = cube.stop();
                }
                if let Ok(mut calendar) = shared.calendar.lock() {
                    if let Some(mut calendar) = calendar.take() {
                        calendar.stop();
                    }
                }
                if let Ok(mut server) = shared.obs.lock() {
                    if let Some(mut server) = server.take() {
                        server.stop();
                    }
                }
                if let (Ok(_change), Ok(preferences)) =
                    (shared.preference_change.lock(), shared.preferences.lock())
                {
                    let _ = persist(&shared, &preferences);
                }
                if let Ok(mut worker) = shared.capture_worker.lock() {
                    if let Some(worker) = worker.take() {
                        let _ = worker.join();
                    }
                };
                refresh_pet_cache(&shared, true);
                if let Ok(mut engine) = shared.engine.lock() {
                    engine.reset();
                }
                refresh_personal_bests(&shared, true);
                let _ = persist_history(&shared);
            }
        });
}

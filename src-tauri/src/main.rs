#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod audio_capture;
mod audio_decode;
mod cube_locator;
mod cube_signal;
mod event_schedule;
mod local_history;
mod native_capture;
mod obs_server;

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
            height: 240.0,
            extra: Default::default(),
        }
    }
}

impl Preferences {
    fn validate(&self) -> Result<(), String> {
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
            || !(0.65..=1.6).contains(&self.text_scale)
            || !self.opacity.is_finite()
            || !(0.35..=1.0).contains(&self.opacity)
            || !self.width.is_finite()
            || !(320.0..=1600.0).contains(&self.width)
            || !self.height.is_finite()
            || !(116.0..=1600.0).contains(&self.height)
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
        || (work_area.size.height as f64) < (116.0 * scale_factor).ceil()
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
            .max((116.0 * scale_factor).ceil())
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
    preference_change: Mutex<()>,
    geometry_save_due: AtomicU64,
    capture_worker: Mutex<Option<std::thread::JoinHandle<()>>>,
    obs: Mutex<Option<obs_server::RunningServer>>,
    calendar: Mutex<Option<event_schedule::Service>>,
}

static STATE_REVISION: AtomicU64 = AtomicU64::new(0);

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
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
        height.clamp(116.0, 1600.0),
    ))
}

fn snapshot(shared: &Shared) -> Result<Value, String> {
    let engine = shared
        .engine
        .lock()
        .map_err(|_| "Meter state unavailable")?;
    let mut state = serde_json::to_value(engine.live_state(now_ms())).map_err(|e| e.to_string())?;
    if let Some(object) = state.as_object_mut() {
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
            serde_json::to_value(
                shared
                    .capture
                    .lock()
                    .map_err(|_| "Capture state unavailable")?
                    .clone(),
            )
            .map_err(|e| e.to_string())?,
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

#[cfg(test)]
mod shell_tests {
    use super::*;

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
            preference_change: Mutex::new(()),
            geometry_save_due: AtomicU64::new(0),
            capture_worker: Mutex::new(None),
            obs: Mutex::new(None),
            calendar: Mutex::new(None),
        }
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
}

fn persist(shared: &Shared, preferences: &Preferences) -> Result<(), String> {
    let _write = shared
        .settings_write
        .lock()
        .map_err(|_| "Settings writer unavailable")?;
    preferences.validate()?;
    fs::create_dir_all(&shared.data_dir)
        .map_err(|e| format!("Cannot create Luma settings directory: {e}"))?;
    let path = shared.data_dir.join("preferences.json");
    let temporary = shared.data_dir.join("preferences.json.new");
    let bytes = serde_json::to_vec_pretty(preferences).map_err(|e| e.to_string())?;
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

#[tauri::command]
async fn start_cube_locator(
    service: State<'_, Arc<cube_locator::Service>>,
    source: String,
    threshold: f32,
) -> Result<cube_locator::CubeState, String> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.start(&source, threshold))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn stop_cube_locator(
    service: State<'_, Arc<cube_locator::Service>>,
) -> Result<cube_locator::CubeState, String> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.stop())
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
fn start_obs(shared: State<Arc<Shared>>, scope: String, hide_names: bool) -> Result<Value, String> {
    let scope = obs_server::ObsScope::parse(&scope)?;
    let mut server = shared
        .obs
        .lock()
        .map_err(|_| "Streaming state unavailable")?;
    if server.as_ref().is_some_and(|server| {
        let info = server.info();
        info.scope == scope && info.hide_names == hide_names
    }) {
        return obs_state(server.as_ref());
    }
    if let Some(mut previous) = server.take() {
        previous.stop();
    }
    let weak = Arc::downgrade(shared.inner());
    let provider: obs_server::SnapshotProvider = Arc::new(move || {
        weak.upgrade()
            .and_then(|shared| snapshot(&shared).ok())
            .unwrap_or_else(|| serde_json::json!({"status":"disconnected"}))
    });
    *server = Some(obs_server::start(scope, hide_names, provider)?);
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
fn get_history(shared: State<Arc<Shared>>) -> Result<Value, String> {
    let (revision, history) = shared
        .engine
        .lock()
        .map_err(|_| "Meter history unavailable")?
        .history_snapshot();
    Ok(serde_json::json!({ "revision": revision, "history": history }))
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
    serde_json::to_value(data).map_err(|e| e.to_string())
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
        *message = result.as_ref().err().cloned().unwrap_or_default();
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
    mut preferences: Preferences,
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
    // Native resize owns geometry. Theme/UI saves can contain stale dimensions.
    preferences.width = previous.width;
    preferences.height = previous.height;
    preferences.validate()?;
    persist(&shared, &preferences)?;
    if let Err(error) =
        window.set_resizable(!preferences.locked && !shared.panel_open.load(Ordering::Relaxed))
    {
        let _ = persist(&shared, &previous);
        return Err(error.to_string());
    }
    shared
        .engine
        .lock()
        .map_err(|_| "Meter state unavailable")?
        .set_target_mode(&preferences.target_mode);
    if let Some(ids) = preferences.extra.get("bossIds").and_then(Value::as_array) {
        shared
            .engine
            .lock()
            .map_err(|_| "Meter state unavailable")?
            .set_boss_targets(&ids.iter().filter_map(Value::as_u64).collect::<Vec<_>>());
    }
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

#[tauri::command]
fn set_boss_targets(shared: State<Arc<Shared>>, ids: Vec<u64>) -> Result<Value, String> {
    if ids.len() > 256 {
        return Err("At most 256 boss target IDs may be selected".into());
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
    staged.extra.insert(
        "bossIds".into(),
        serde_json::to_value(&ids).map_err(|e| e.to_string())?,
    );
    persist(&shared, &staged)?;
    *preferences = staged;
    drop(preferences);
    shared
        .engine
        .lock()
        .map_err(|_| "Meter state unavailable")?
        .set_boss_targets(&ids);
    snapshot(&shared)
}

#[tauri::command]
fn set_locked(
    window: WebviewWindow,
    shared: State<Arc<Shared>>,
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
    persist(&shared, &preferences)?;
    if let Err(error) = window.set_resizable(!locked && !shared.panel_open.load(Ordering::Relaxed))
    {
        let _ = persist(&shared, &previous);
        return Err(error.to_string());
    }
    let mut current = shared
        .preferences
        .lock()
        .map_err(|_| "Preferences unavailable")?;
    preferences.width = current.width;
    preferences.height = current.height;
    *current = preferences.clone();
    Ok(preferences.clone())
}

#[tauri::command]
fn start_resize(window: WebviewWindow, shared: State<Arc<Shared>>) -> Result<(), String> {
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
            (size.height as f64 / factor + dy).clamp(116.0, 1600.0),
        ))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn close_window(window: WebviewWindow) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

#[tauri::command]
fn set_panel_open(
    window: WebviewWindow,
    shared: State<Arc<Shared>>,
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
    let preferences = shared
        .preferences
        .lock()
        .map_err(|_| "Preferences unavailable")?
        .clone();
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
    apply_panel_layout(
        previous,
        !previously_open && !preferences.locked,
        position,
        size,
        !open && !preferences.locked,
        |operation| {
            match operation {
                PanelOperation::Position(position) => window.set_position(position),
                PanelOperation::Size(size) => window.set_size(size),
                PanelOperation::Resizable(resizable) => window.set_resizable(resizable),
            }
            .map_err(|error| error.to_string())
        },
    )?;
    *restore = if open { Some(previous) } else { None };
    shared.panel_open.store(open, Ordering::Relaxed);
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
            get_cube_state,
            start_cube_locator,
            stop_cube_locator,
            import_cube_reference,
            reset_cube_reference,
            get_app_info,
            get_event_schedule,
            refresh_event_schedule,
            get_obs_state,
            start_obs,
            stop_obs,
            get_history,
            get_current_encounter,
            get_assistance_state,
            get_character_state,
            get_field_bosses,
            import_history,
            arm_training,
            cancel_training,
            get_preferences,
            set_preferences,
            set_local_player,
            set_character_name,
            set_party_members,
            reset_encounter,
            set_paused,
            set_target_mode,
            set_boss_targets,
            set_locked,
            start_resize,
            start_drag,
            resize_by,
            close_window,
            set_panel_open,
            open_url,
            export_encounter,
            export_document
        ])
        .setup(|app| {
            let data_dir = app.path().app_local_data_dir()?;
            let cube = Arc::new(cube_locator::Service::new(data_dir.clone())?);
            app.manage(cube.clone());
            let preferences_path = data_dir.join("preferences.json");
            let preferences = fs::metadata(&preferences_path)
                .ok()
                .filter(|metadata| metadata.len() <= 4 * 1024 * 1024)
                .and_then(|_| fs::read(preferences_path).ok())
                .and_then(|bytes| serde_json::from_slice::<Preferences>(&bytes).ok())
                .filter(|value| value.validate().is_ok())
                .unwrap_or_default();
            let mut engine = MeterEngine::default();
            let restored_history = local_history::load(&data_dir.join("history.json"));
            if let Ok(records) = &restored_history {
                engine.restore_history(records);
            }
            let history_revision = engine.history_revision();
            let history_error = restored_history.err().unwrap_or_default();
            engine.set_target_mode(&preferences.target_mode);
            engine.set_character_name(
                preferences
                    .extra
                    .get("characterName")
                    .and_then(Value::as_str)
                    .unwrap_or(""),
            );
            if let Some(ids) = preferences.extra.get("bossIds").and_then(Value::as_array) {
                engine.set_boss_targets(&ids.iter().filter_map(Value::as_u64).collect::<Vec<_>>());
            }
            if let Some(window) = app.get_webview_window("main") {
                window.set_size(tauri::LogicalSize::new(
                    preferences.width,
                    preferences.height,
                ))?;
                window.set_resizable(!preferences.locked)?;
            }
            let calendar = event_schedule::Service::start(data_dir.join("event-calendars.json"));
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
                preference_change: Mutex::new(()),
                geometry_save_due: AtomicU64::new(0),
                capture_worker: Mutex::new(None),
                obs: Mutex::new(None),
                calendar: Mutex::new(Some(calendar)),
            });
            app.manage(shared.clone());
            *shared
                .capture_worker
                .lock()
                .map_err(|_| "Capture worker unavailable")? =
                Some(native_capture::spawn(shared.clone()));
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                let mut history_retry_at = 0;
                let mut calendar_revision = None;
                let mut cube_revision = None;
                while !shared.stopping.load(Ordering::Relaxed) {
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
            if let Some(shared) = window.try_state::<Arc<Shared>>() {
                match event {
                    tauri::WindowEvent::Destroyed => {
                        shared.stopping.store(true, Ordering::Relaxed);
                    }
                    tauri::WindowEvent::Resized(size) => {
                        if shared.panel_open.load(Ordering::Relaxed)
                            || now_ms() < shared.size_transition_until.load(Ordering::Relaxed)
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
                if let Ok(mut engine) = shared.engine.lock() {
                    engine.reset();
                }
                let _ = persist_history(&shared);
            }
        });
}

//! Geometry and hit testing for the transparent full-monitor overlay. Cursor
//! coordinates are read only; no keyboard hook or game input is injected.

use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Geometry {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub scale: f64,
}

impl Geometry {
    pub fn valid(self) -> bool {
        self.scale.is_finite()
            && (0.5..=8.0).contains(&self.scale)
            && self.x.unsigned_abs() <= 1_000_000
            && self.y.unsigned_abs() <= 1_000_000
            && self.width > 0
            && self.height > 0
            && self.width <= 12_800
            && self.height <= 12_800
    }

    /// Fit to an available work area after a display was removed or its DPI
    /// changed. Physical coordinates preserve negative-origin monitors.
    pub fn fit(self, area: Area, scale: f64, compact: bool) -> Self {
        let scale = if scale.is_finite() && (0.5..=8.0).contains(&scale) {
            scale
        } else {
            self.scale
        };
        let logical_width = (self.width as f64 / self.scale).clamp(320.0, 1600.0);
        let logical_height =
            (self.height as f64 / self.scale).clamp(if compact { 44.0 } else { 200.0 }, 1600.0);
        let width = (logical_width * scale).round().max(1.0) as u32;
        let height = (logical_height * scale).round().max(1.0) as u32;
        let width = width.min(area.width.max(1));
        let height = height.min(area.height.max(1));
        let x = i64::from(self.x).clamp(
            i64::from(area.x),
            i64::from(area.x) + i64::from(area.width.saturating_sub(width)),
        ) as i32;
        let y = i64::from(self.y).clamp(
            i64::from(area.y),
            i64::from(area.y) + i64::from(area.height.saturating_sub(height)),
        ) as i32;
        Self {
            x,
            y,
            width,
            height,
            scale,
        }
    }

    pub fn intersects(self, area: Area) -> bool {
        i64::from(self.x) < i64::from(area.x) + i64::from(area.width)
            && i64::from(self.y) < i64::from(area.y) + i64::from(area.height)
            && i64::from(self.x) + i64::from(self.width) > i64::from(area.x)
            && i64::from(self.y) + i64::from(self.height) > i64::from(area.y)
    }
}

#[derive(Clone, Copy, Debug)]
pub struct Area {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct HitRegion {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

pub fn validate_regions(regions: &[HitRegion]) -> Result<(), String> {
    validate_bounded_regions(regions, 16)
}

pub fn validate_interactive_regions(regions: &[HitRegion]) -> Result<(), String> {
    validate_bounded_regions(regions, 128)
}

fn validate_bounded_regions(regions: &[HitRegion], limit: usize) -> Result<(), String> {
    if regions.len() > limit {
        return Err("Too many overlay input regions".into());
    }
    for region in regions {
        if ![region.x, region.y, region.width, region.height]
            .into_iter()
            .all(f64::is_finite)
            || region.x < 0.0
            || region.y < 0.0
            || region.width <= 0.0
            || region.height <= 0.0
            || region.x + region.width > 32_768.0
            || region.y + region.height > 32_768.0
        {
            return Err("Invalid overlay input region".into());
        }
    }
    Ok(())
}

pub fn logical_cursor(cursor: (i32, i32), origin: (i32, i32), scale: f64) -> Option<(f64, f64)> {
    (scale.is_finite() && (0.5..=8.0).contains(&scale)).then(|| {
        (
            (f64::from(cursor.0) - f64::from(origin.0)) / scale,
            (f64::from(cursor.1) - f64::from(origin.1)) / scale,
        )
    })
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum PointerMode {
    #[default]
    Window,
    Meter,
    Controls,
}

impl PointerMode {
    pub fn from_policy(
        fullscreen: bool,
        locked: bool,
        click_through: bool,
        panel_open: bool,
    ) -> Self {
        if locked && click_through && !panel_open {
            Self::Controls
        } else if fullscreen {
            Self::Meter
        } else {
            Self::Window
        }
    }
}

pub fn accepts_pointer(
    mode: PointerMode,
    regions: &[HitRegion],
    interactive_regions: &[HitRegion],
    point: Option<(f64, f64)>,
) -> bool {
    if mode == PointerMode::Window {
        return true;
    }
    point.is_some_and(|(x, y)| {
        contains(
            if mode == PointerMode::Controls {
                interactive_regions
            } else {
                regions
            },
            x,
            y,
        )
    })
}

#[derive(Default)]
pub struct PointerHold {
    initialized: bool,
    previous_down: bool,
    held: bool,
    passed: bool,
    release_grace: u8,
    pass_release_grace: u8,
    mode: PointerMode,
}

impl PointerHold {
    pub fn ignore_cursor(&mut self, mode: PointerMode, inside: bool, primary_down: bool) -> bool {
        if mode != self.mode {
            self.initialized = false;
            self.held = false;
            self.passed = false;
            self.release_grace = 0;
            self.pass_release_grace = 0;
            self.mode = mode;
        }
        if primary_down && (!self.initialized || !self.previous_down) {
            // A press already in progress at startup or a mode change has no
            // verified overlay origin. Keep it with the game until release.
            self.held = self.initialized && inside;
            self.passed = !self.held;
            self.release_grace = 0;
            self.pass_release_grace = 0;
        }
        if !primary_down {
            if self.held {
                self.release_grace = 2;
            }
            if self.passed {
                self.pass_release_grace = 2;
            }
            self.held = false;
            self.passed = false;
        }
        let accepted = mode == PointerMode::Window
            || (!self.passed
                && self.pass_release_grace == 0
                && (inside || self.held || self.release_grace > 0));
        self.release_grace = self.release_grace.saturating_sub(1);
        self.pass_release_grace = self.pass_release_grace.saturating_sub(1);
        self.previous_down = primary_down;
        self.initialized = true;
        !accepted
    }
}

pub fn contains(regions: &[HitRegion], x: f64, y: f64) -> bool {
    x.is_finite()
        && y.is_finite()
        && regions
            .iter()
            .any(|r| x >= r.x && y >= r.y && x < r.x + r.width && y < r.y + r.height)
}

#[derive(Default)]
pub struct State {
    pub active: bool,
    pub normal: Option<Geometry>,
    pub regions: Vec<HitRegion>,
    pub interactive_regions: Vec<HitRegion>,
    pub revision: u64,
}

impl State {
    pub fn commit(&mut self, active: bool, normal: Option<Geometry>) {
        self.active = active;
        self.normal = if active { normal } else { None };
        self.regions.clear();
        self.interactive_regions.clear();
        self.revision = self.revision.wrapping_add(1);
    }

    /// Invoke only on the window's UI thread. A queued cursor update may have
    /// outlived a mode exit, a lock change or a HUD move. Reject it before the
    /// native input policy changes. Failed native writes are retried using a
    /// fresh revision on the next worker iteration.
    pub fn apply_pointer_update(
        &mut self,
        revision: u64,
        expected_mode: PointerMode,
        current_mode: PointerMode,
        apply: impl FnOnce() -> bool,
    ) -> bool {
        if self.revision != revision || expected_mode != current_mode {
            return false;
        }
        let applied = apply();
        if !applied {
            self.revision = self.revision.wrapping_add(1);
        }
        applied
    }
}

#[cfg(windows)]
pub fn cursor_position() -> Option<(i32, i32)> {
    let mut point = windows_sys::Win32::Foundation::POINT { x: 0, y: 0 };
    // This returns the cursor location only. It neither consumes game input
    // nor needs elevated permissions.
    (unsafe { windows_sys::Win32::UI::WindowsAndMessaging::GetCursorPos(&mut point) } != 0)
        .then_some((point.x, point.y))
}

#[cfg(windows)]
pub fn primary_button_down() -> bool {
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
        GetAsyncKeyState, VK_LBUTTON, VK_RBUTTON,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{GetSystemMetrics, SM_SWAPBUTTON};
    let primary = if unsafe { GetSystemMetrics(SM_SWAPBUTTON) } != 0 {
        VK_RBUTTON
    } else {
        VK_LBUTTON
    };
    unsafe { GetAsyncKeyState(i32::from(primary)) as u16 & 0x8000 != 0 }
}

#[cfg(not(windows))]
pub fn primary_button_down() -> bool {
    false
}

#[cfg(not(windows))]
pub fn cursor_position() -> Option<(i32, i32)> {
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn locked_controls_work_in_window_and_fullscreen_while_background_passes_through() {
        let meter = [HitRegion {
            x: 10.0,
            y: 10.0,
            width: 420.0,
            height: 340.0,
        }];
        let controls = [HitRegion {
            x: 30.0,
            y: 80.0,
            width: 100.0,
            height: 28.0,
        }];
        for fullscreen in [false, true] {
            let mode = PointerMode::from_policy(fullscreen, true, true, false);
            assert_eq!(mode, PointerMode::Controls);
            assert!(accepts_pointer(mode, &meter, &controls, Some((50.0, 90.0))));
            assert!(!accepts_pointer(
                mode,
                &meter,
                &controls,
                Some((50.0, 180.0))
            ));
            assert!(!accepts_pointer(mode, &meter, &controls, None));
        }
        assert_eq!(
            PointerMode::from_policy(false, false, true, false),
            PointerMode::Window
        );
        assert_eq!(
            PointerMode::from_policy(false, true, true, true),
            PointerMode::Window
        );
        assert_eq!(
            PointerMode::from_policy(true, true, true, true),
            PointerMode::Meter
        );
        assert_eq!(
            PointerMode::from_policy(true, false, true, false),
            PointerMode::Meter
        );
        assert!(accepts_pointer(PointerMode::Window, &[], &[], None));
        assert!(accepts_pointer(
            PointerMode::Meter,
            &meter,
            &controls,
            Some((50.0, 180.0))
        ));
        assert!(!accepts_pointer(
            PointerMode::Meter,
            &meter,
            &controls,
            Some((500.0, 180.0))
        ));
    }

    #[test]
    fn locked_button_regions_use_client_logical_coordinates_at_mixed_dpi_and_negative_origins() {
        let controls = [HitRegion {
            x: 20.0,
            y: 40.0,
            width: 80.0,
            height: 30.0,
        }];
        for (cursor, origin, scale) in [
            ((30, 55), (0, 0), 1.0),
            ((-1875, 182), (-1920, 100), 1.5),
            ((-1240, -690), (-1300, -800), 2.0),
        ] {
            assert!(accepts_pointer(
                PointerMode::Controls,
                &[],
                &controls,
                logical_cursor(cursor, origin, scale)
            ));
        }
        assert!(!accepts_pointer(
            PointerMode::Controls,
            &[],
            &controls,
            logical_cursor((-1600, 182), (-1920, 100), 1.5)
        ));
        for invalid in [0.0, -1.0, f64::NAN, f64::INFINITY, 9.0] {
            assert!(logical_cursor((0, 0), (0, 0), invalid).is_none());
        }
    }

    #[test]
    fn control_regions_are_bounded_independently_and_keep_the_legacy_meter_limit() {
        let rect = HitRegion {
            x: 1.0,
            y: 1.0,
            width: 20.0,
            height: 20.0,
        };
        assert!(validate_interactive_regions(&[rect; 128]).is_ok());
        assert!(validate_interactive_regions(&[rect; 129]).is_err());
        assert!(validate_regions(&[rect; 16]).is_ok());
        assert!(validate_regions(&[rect; 17]).is_err());
        for rect in [
            HitRegion { x: -1.0, ..rect },
            HitRegion {
                width: f64::NAN,
                ..rect
            },
            HitRegion {
                height: 0.0,
                ..rect
            },
        ] {
            assert!(validate_interactive_regions(&[rect]).is_err());
        }
    }

    #[test]
    fn queued_locked_writes_cannot_override_drawer_unlock_or_fullscreen_mode_changes() {
        let mut state = State::default();
        let revision = state.revision;
        let mut writes = 0;
        for current in [PointerMode::Window, PointerMode::Meter] {
            assert!(
                !state.apply_pointer_update(revision, PointerMode::Controls, current, || {
                    writes += 1;
                    true
                })
            );
        }
        // Control hit testing also runs while the window is not fullscreen.
        assert!(!state.active);
        assert!(state.apply_pointer_update(
            revision,
            PointerMode::Controls,
            PointerMode::Controls,
            || {
                writes += 1;
                true
            }
        ));
        state.revision += 1;
        assert!(!state.apply_pointer_update(
            revision,
            PointerMode::Controls,
            PointerMode::Controls,
            || {
                writes += 1;
                true
            }
        ));
        assert_eq!(writes, 1);
    }

    #[test]
    fn a_press_started_on_a_control_keeps_input_through_release_without_capturing_game_drags() {
        let mut hold = PointerHold::default();
        assert!(hold.ignore_cursor(PointerMode::Controls, false, false));
        assert!(!hold.ignore_cursor(PointerMode::Controls, true, true));
        assert!(!hold.ignore_cursor(PointerMode::Controls, false, true));
        assert!(!hold.ignore_cursor(PointerMode::Controls, false, false));
        assert!(!hold.ignore_cursor(PointerMode::Controls, false, false));
        assert!(hold.ignore_cursor(PointerMode::Controls, false, false));
        assert!(hold.ignore_cursor(PointerMode::Controls, false, true));
        assert!(hold.ignore_cursor(PointerMode::Controls, true, true));
        assert!(hold.ignore_cursor(PointerMode::Controls, false, true));
        assert!(!hold.ignore_cursor(PointerMode::Window, false, true));
    }

    #[test]
    fn game_originated_presses_do_not_transfer_input_when_dragged_over_controls() {
        for mode in [PointerMode::Controls, PointerMode::Meter] {
            let mut hold = PointerHold::default();
            assert!(hold.ignore_cursor(mode, false, false));
            assert!(hold.ignore_cursor(mode, false, true));
            assert!(hold.ignore_cursor(mode, true, true));
            assert!(hold.ignore_cursor(mode, false, true));
            assert!(hold.ignore_cursor(mode, true, true));
            // Keep the release with its original recipient, then restore hover.
            assert!(hold.ignore_cursor(mode, true, false));
            assert!(hold.ignore_cursor(mode, true, false));
            assert!(!hold.ignore_cursor(mode, true, false));
            // A subsequent press actually started on a control is independent.
            assert!(!hold.ignore_cursor(mode, true, true));
            assert!(!hold.ignore_cursor(mode, false, true));
        }
    }

    #[test]
    fn already_down_at_startup_or_mode_change_keeps_the_original_input_recipient() {
        let mut hold = PointerHold::default();
        assert!(hold.ignore_cursor(PointerMode::Controls, true, true));
        assert!(hold.ignore_cursor(PointerMode::Controls, true, true));
        assert!(hold.ignore_cursor(PointerMode::Controls, true, false));
        assert!(hold.ignore_cursor(PointerMode::Controls, true, false));
        assert!(!hold.ignore_cursor(PointerMode::Controls, true, false));
        assert!(!hold.ignore_cursor(PointerMode::Window, true, true));
        assert!(hold.ignore_cursor(PointerMode::Controls, true, true));
        assert!(hold.ignore_cursor(PointerMode::Controls, true, false));
        assert!(hold.ignore_cursor(PointerMode::Controls, true, false));
        assert!(!hold.ignore_cursor(PointerMode::Controls, true, false));
    }

    #[test]
    fn queued_pointer_writes_cannot_override_an_exit_or_a_newer_layout() {
        let mut state = State::default();
        state.commit(true, None);
        let queued = state.revision;
        let mut native_writes = 0;
        state.commit(false, None);
        assert!(!state.apply_pointer_update(
            queued,
            PointerMode::Meter,
            PointerMode::Meter,
            || {
                native_writes += 1;
                true
            }
        ));
        assert_eq!(native_writes, 0);

        state.commit(true, None);
        assert!(!state.apply_pointer_update(
            queued,
            PointerMode::Meter,
            PointerMode::Meter,
            || {
                native_writes += 1;
                true
            }
        ));
        assert_eq!(native_writes, 0);
        let current = state.revision;
        assert!(state.apply_pointer_update(
            current,
            PointerMode::Meter,
            PointerMode::Meter,
            || {
                native_writes += 1;
                true
            }
        ));
        assert_eq!(native_writes, 1);

        assert!(!state.apply_pointer_update(
            current,
            PointerMode::Meter,
            PointerMode::Meter,
            || false
        ));
        assert_ne!(state.revision, current);
        assert!(!state.apply_pointer_update(
            current,
            PointerMode::Meter,
            PointerMode::Meter,
            || {
                native_writes += 1;
                true
            }
        ));
        assert_eq!(native_writes, 1);
    }

    #[test]
    fn input_is_limited_to_real_visible_regions_and_empty_canvas_passes_through() {
        let regions = [HitRegion {
            x: 30.0,
            y: 20.0,
            width: 420.0,
            height: 240.0,
        }];
        assert!(validate_regions(&regions).is_ok());
        assert!(contains(&regions, 30.0, 20.0));
        assert!(contains(&regions, 449.9, 259.9));
        assert!(!contains(&regions, 450.0, 30.0));
        assert!(!contains(&regions, 29.0, 20.0));
        assert!(!contains(&[], 100.0, 100.0));
        assert!(!contains(&regions, f64::NAN, 20.0));
    }

    #[test]
    fn malformed_or_unbounded_regions_are_rejected_before_state_changes() {
        let valid = HitRegion {
            x: 0.0,
            y: 0.0,
            width: 1920.0,
            height: 1080.0,
        };
        assert!(validate_regions(&[valid; 16]).is_ok());
        assert!(validate_regions(&[valid; 17]).is_err());
        for invalid in [
            HitRegion { x: -1.0, ..valid },
            HitRegion {
                width: f64::INFINITY,
                ..valid
            },
            HitRegion {
                height: 0.0,
                ..valid
            },
            HitRegion {
                x: 32_000.0,
                ..valid
            },
        ] {
            assert!(validate_regions(&[invalid]).is_err());
        }
    }

    #[test]
    fn display_removal_and_dpi_change_restore_a_visible_normal_window() {
        let original = Geometry {
            x: -1800,
            y: 100,
            width: 630,
            height: 360,
            scale: 1.5,
        };
        assert!(original.valid());
        let previous = Area {
            x: -1920,
            y: 0,
            width: 1920,
            height: 1040,
        };
        assert!(original.intersects(previous));
        let replacement = Area {
            x: 0,
            y: 0,
            width: 1920,
            height: 1040,
        };
        assert!(!original.intersects(replacement));
        let restored = original.fit(replacement, 1.0, false);
        assert_eq!((restored.x, restored.y), (0, 100));
        assert_eq!((restored.width, restored.height), (420, 240));
        assert_eq!(original.fit(previous, 1.5, false), original);
    }

    #[test]
    fn compact_window_restores_without_overwriting_normal_height() {
        let normal = Geometry {
            x: 50,
            y: 40,
            width: 420,
            height: 44,
            scale: 1.0,
        };
        let area = Area {
            x: 0,
            y: 0,
            width: 1280,
            height: 720,
        };
        assert_eq!(normal.fit(area, 1.0, true).height, 44);
        assert_eq!(normal.fit(area, 1.0, false).height, 200);
        let mut state = State::default();
        state.commit(true, Some(normal));
        assert!(state.active);
        assert_eq!(state.normal, Some(normal));
        state.regions.push(HitRegion {
            x: 0.0,
            y: 0.0,
            width: 10.0,
            height: 10.0,
        });
        state.commit(false, None);
        assert!(!state.active);
        assert!(state.normal.is_none());
        assert!(state.regions.is_empty());
    }
}

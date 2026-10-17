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
    if regions.len() > 16 {
        return Err("At most sixteen overlay input regions are supported".into());
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
    pub revision: u64,
}

impl State {
    pub fn commit(&mut self, active: bool, normal: Option<Geometry>) {
        self.active = active;
        self.normal = if active { normal } else { None };
        self.regions.clear();
        self.revision = self.revision.wrapping_add(1);
    }

    /// Invoke only on the window's UI thread. A queued cursor update may have
    /// outlived a mode exit, a lock change or a HUD move. Reject it before the
    /// native input policy changes. Failed native writes are retried using a
    /// fresh revision on the next worker iteration.
    pub fn apply_pointer_update(&mut self, revision: u64, apply: impl FnOnce() -> bool) -> bool {
        if !self.active || self.revision != revision {
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

#[cfg(not(windows))]
pub fn cursor_position() -> Option<(i32, i32)> {
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn queued_pointer_writes_cannot_override_an_exit_or_a_newer_layout() {
        let mut state = State::default();
        state.commit(true, None);
        let queued = state.revision;
        let mut native_writes = 0;
        state.commit(false, None);
        assert!(!state.apply_pointer_update(queued, || {
            native_writes += 1;
            true
        }));
        assert_eq!(native_writes, 0);

        state.commit(true, None);
        assert!(!state.apply_pointer_update(queued, || {
            native_writes += 1;
            true
        }));
        assert_eq!(native_writes, 0);
        let current = state.revision;
        assert!(state.apply_pointer_update(current, || {
            native_writes += 1;
            true
        }));
        assert_eq!(native_writes, 1);

        assert!(!state.apply_pointer_update(current, || false));
        assert_ne!(state.revision, current);
        assert!(!state.apply_pointer_update(current, || {
            native_writes += 1;
            true
        }));
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

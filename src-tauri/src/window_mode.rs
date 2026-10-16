//! Foreground-only z-order policy. This observes the active process name only;
//! it never injects input, focuses the game, or enumerates another app's content.

fn game_image(path: &str) -> bool {
    matches!(
        path.rsplit(['\\', '/'])
            .next()
            .unwrap_or("")
            .to_ascii_lowercase()
            .as_str(),
        "aion2.exe" | "aion2-win64-shipping.exe" | "aion2_client.exe"
    )
}

#[cfg(windows)]
pub fn is_game_or_luma_foreground() -> bool {
    use windows_sys::Win32::{
        Foundation::CloseHandle,
        System::Threading::{
            OpenProcess, QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION,
        },
        UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowThreadProcessId},
    };
    unsafe {
        let window = GetForegroundWindow();
        if window.is_null() {
            return false;
        }
        let mut pid = 0;
        GetWindowThreadProcessId(window, &mut pid);
        if pid == std::process::id() {
            return true;
        }
        if pid == 0 {
            return false;
        }
        let process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if process.is_null() {
            return false;
        }
        let mut path = vec![0u16; 32768];
        let mut length = path.len() as u32;
        let result = QueryFullProcessImageNameW(process, 0, path.as_mut_ptr(), &mut length);
        CloseHandle(process);
        result != 0 && game_image(&String::from_utf16_lossy(&path[..length as usize]))
    }
}

#[cfg(not(windows))]
pub fn is_game_or_luma_foreground() -> bool {
    false
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn only_exact_game_basenames_qualify_for_foreground_policy() {
        assert!(game_image("C:\\Games\\Aion2-Win64-Shipping.exe"));
        assert!(game_image("C:\\Games\\AION2.exe"));
        for name in [
            "C:\\Aion2.exe\\browser.exe",
            "browser-aion2.exe",
            "Aion2.exe.backup",
            "aion2",
            "",
        ] {
            assert!(!game_image(name));
        }
    }
}

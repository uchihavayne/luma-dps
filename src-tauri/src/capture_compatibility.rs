//! Bounded, local capability inspection. This module resolves exports only;
//! it never calls PacketMonitorInitialize or starts a capture session.

use serde::Serialize;
use std::sync::OnceLock;

pub const REQUIRED_EXPORTS: [&str; 11] = [
    "PacketMonitorInitialize",
    "PacketMonitorUninitialize",
    "PacketMonitorCreateLiveSession",
    "PacketMonitorCloseSessionHandle",
    "PacketMonitorCreateRealtimeStream",
    "PacketMonitorCloseRealtimeStream",
    "PacketMonitorSetSessionActive",
    "PacketMonitorAttachOutputToSession",
    "PacketMonitorEnumDataSources",
    "PacketMonitorAddSingleDataSourceToSession",
    "PacketMonitorAddCaptureConstraint",
];

#[derive(Clone, Debug, Serialize)]
pub struct CompatibilityReport {
    pub schema_version: u32,
    pub diagnostic_only: bool,
    pub capture_started: bool,
    pub os: OsReport,
    pub packet_monitor: PacketMonitorReport,
}

#[derive(Clone, Debug, Serialize)]
pub struct OsReport {
    pub status: &'static str,
    pub label: &'static str,
    pub architecture: &'static str,
    pub process_architecture: &'static str,
    pub major: Option<u32>,
    pub minor: Option<u32>,
    pub build: Option<u32>,
    pub ubr: Option<u32>,
    pub version_source: &'static str,
    pub error_code: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
pub struct PacketMonitorReport {
    pub status: &'static str,
    pub system32_only: bool,
    pub load_status: &'static str,
    pub load_error_code: Option<u32>,
    pub exports_present: Vec<&'static str>,
    pub exports_missing: Vec<&'static str>,
}

pub fn loader_failure_status(code: u32) -> &'static str {
    match code {
        5 | 1314 => "permission-required",
        126 => "api-unavailable",
        _ => "error",
    }
}

fn windows_label(major: u32, minor: u32, build: u32, product_type: u8) -> &'static str {
    if matches!(product_type, 2 | 3) {
        "Windows Server"
    } else if product_type != 1 {
        "Windows"
    } else if major == 10 && minor == 0 && build >= 22_000 {
        "Windows 11"
    } else if major == 10 && minor == 0 {
        "Windows 10"
    } else {
        "Windows"
    }
}

fn process_architecture() -> &'static str {
    match std::env::consts::ARCH {
        "x86" => "x86",
        "x86_64" => "x86_64",
        "aarch64" => "aarch64",
        "arm" => "arm",
        _ => "unknown",
    }
}

fn inspect_exports(
    load_error: Option<u32>,
    mut present: impl FnMut(&'static str) -> bool,
) -> PacketMonitorReport {
    let mut report = PacketMonitorReport {
        status: "exports-available",
        system32_only: true,
        load_status: "loaded",
        load_error_code: load_error,
        exports_present: Vec::new(),
        exports_missing: Vec::new(),
    };
    if let Some(code) = load_error {
        report.status = loader_failure_status(code);
        report.load_status = "failed";
        // A library that could not be loaded has unknown export availability.
        return report;
    }
    for name in REQUIRED_EXPORTS {
        if present(name) {
            report.exports_present.push(name);
        } else {
            report.exports_missing.push(name);
        }
    }
    if !report.exports_missing.is_empty() {
        report.status = "api-unavailable";
    }
    report
}

pub fn compatibility_report() -> CompatibilityReport {
    static REPORT: OnceLock<CompatibilityReport> = OnceLock::new();
    REPORT
        .get_or_init(|| {
            let (os, packet_monitor) = inspect_platform();
            CompatibilityReport {
                schema_version: 1,
                diagnostic_only: true,
                capture_started: false,
                os,
                packet_monitor,
            }
        })
        .clone()
}

#[cfg(not(windows))]
fn inspect_platform() -> (OsReport, PacketMonitorReport) {
    (
        OsReport {
            status: "unsupported",
            label: "Not Windows",
            architecture: process_architecture(),
            process_architecture: process_architecture(),
            major: None,
            minor: None,
            build: None,
            ubr: None,
            version_source: "not-windows",
            error_code: None,
        },
        PacketMonitorReport {
            status: "unsupported",
            system32_only: true,
            load_status: "not-windows",
            load_error_code: None,
            exports_present: Vec::new(),
            exports_missing: Vec::new(),
        },
    )
}

#[cfg(windows)]
fn inspect_platform() -> (OsReport, PacketMonitorReport) {
    let os = windows::inspect_os();
    let packet_monitor = match windows::SystemModule::load("pktmonapi.dll") {
        Ok(module) => inspect_exports(None, |name| module.symbol(name).is_some()),
        Err(code) => inspect_exports(Some(code), |_| unreachable!()),
    };
    (os, packet_monitor)
}

#[cfg(windows)]
pub mod windows {
    use super::{process_architecture, windows_label, OsReport};
    use std::{ffi::c_void, mem::size_of, ptr};
    use windows_sys::Win32::{
        Foundation::{FreeLibrary, GetLastError, HMODULE},
        System::LibraryLoader::{GetProcAddress, LoadLibraryExW, LOAD_LIBRARY_SEARCH_SYSTEM32},
    };

    pub type Export = unsafe extern "system" fn() -> isize;

    pub struct SystemModule {
        handle: HMODULE,
    }

    impl SystemModule {
        pub fn load(name: &'static str) -> Result<Self, u32> {
            // Every caller is internal; reject additions to the DLL whitelist.
            if !matches!(
                name,
                "pktmonapi.dll" | "ntdll.dll" | "kernel32.dll" | "advapi32.dll"
            ) {
                return Err(87);
            }
            let name: Vec<u16> = name.encode_utf16().chain(Some(0)).collect();
            let handle = unsafe {
                LoadLibraryExW(name.as_ptr(), ptr::null_mut(), LOAD_LIBRARY_SEARCH_SYSTEM32)
            };
            if handle.is_null() {
                Err(unsafe { GetLastError() })
            } else {
                Ok(Self { handle })
            }
        }

        pub fn symbol(&self, name: &'static str) -> Option<Export> {
            let name: Vec<u8> = name.bytes().chain(Some(0)).collect();
            unsafe { GetProcAddress(self.handle, name.as_ptr()) }
        }

        pub fn into_raw(mut self) -> HMODULE {
            let handle = self.handle;
            self.handle = ptr::null_mut();
            handle
        }
    }

    impl Drop for SystemModule {
        fn drop(&mut self) {
            if !self.handle.is_null() {
                unsafe { FreeLibrary(self.handle) };
            }
        }
    }

    #[repr(C)]
    struct VersionInfo {
        size: u32,
        major: u32,
        minor: u32,
        build: u32,
        platform: u32,
        service_pack: [u16; 128],
        service_pack_major: u16,
        service_pack_minor: u16,
        suite_mask: u16,
        product_type: u8,
        reserved: u8,
    }

    #[repr(C)]
    struct SystemInfo {
        architecture: u16,
        reserved: u16,
        page_size: u32,
        minimum_address: *mut c_void,
        maximum_address: *mut c_void,
        processor_mask: usize,
        processor_count: u32,
        processor_type: u32,
        allocation_granularity: u32,
        processor_level: u16,
        processor_revision: u16,
    }

    fn architecture() -> &'static str {
        type IsWow64Process2 = unsafe extern "system" fn(*mut c_void, *mut u16, *mut u16) -> i32;
        type GetNativeSystemInfo = unsafe extern "system" fn(*mut SystemInfo);
        let Ok(module) = SystemModule::load("kernel32.dll") else {
            return "unknown";
        };
        if let Some(symbol) = module.symbol("IsWow64Process2") {
            let inspect: IsWow64Process2 = unsafe { std::mem::transmute(symbol) };
            let mut process_machine = 0u16;
            let mut native_machine = 0u16;
            let current_process =
                unsafe { windows_sys::Win32::System::Threading::GetCurrentProcess() };
            if unsafe { inspect(current_process, &mut process_machine, &mut native_machine) } != 0 {
                return match native_machine {
                    0x014c => "x86",
                    0x01c4 => "arm",
                    0x0200 => "ia64",
                    0x8664 => "x86_64",
                    0xaa64 => "aarch64",
                    _ => "unknown",
                };
            }
        }
        let Some(symbol) = module.symbol("GetNativeSystemInfo") else {
            return "unknown";
        };
        let mut info: SystemInfo = unsafe { std::mem::zeroed() };
        let get_info: GetNativeSystemInfo = unsafe { std::mem::transmute(symbol) };
        unsafe { get_info(&mut info) };
        match info.architecture {
            0 => "x86",
            5 => "arm",
            6 => "ia64",
            9 => "x86_64",
            12 => "aarch64",
            _ => "unknown",
        }
    }

    fn update_build_revision() -> Option<u32> {
        type RegGetValue = unsafe extern "system" fn(
            *mut c_void,
            *const u16,
            *const u16,
            u32,
            *mut u32,
            *mut c_void,
            *mut u32,
        ) -> i32;
        let module = SystemModule::load("advapi32.dll").ok()?;
        let symbol = module.symbol("RegGetValueW")?;
        let get_value: RegGetValue = unsafe { std::mem::transmute(symbol) };
        let key: Vec<u16> = "SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion"
            .encode_utf16()
            .chain(Some(0))
            .collect();
        let name: Vec<u16> = "UBR".encode_utf16().chain(Some(0)).collect();
        let mut value = 0u32;
        let mut length = size_of::<u32>() as u32;
        let mut kind = 0u32;
        let result = unsafe {
            get_value(
                (-2_147_483_646isize) as *mut c_void,
                key.as_ptr(),
                name.as_ptr(),
                0x10 | 0x1_0000, // RRF_RT_REG_DWORD | RRF_SUBKEY_WOW6464KEY
                &mut kind,
                (&mut value as *mut u32).cast(),
                &mut length,
            )
        };
        (result == 0 && kind == 4 && length == 4).then_some(value)
    }

    pub fn inspect_os() -> OsReport {
        type RtlGetVersion = unsafe extern "system" fn(*mut VersionInfo) -> i32;
        let mut report = OsReport {
            status: "unavailable",
            label: "Windows",
            architecture: architecture(),
            process_architecture: process_architecture(),
            major: None,
            minor: None,
            build: None,
            ubr: None,
            version_source: "unavailable",
            error_code: None,
        };
        let module = match SystemModule::load("ntdll.dll") {
            Ok(module) => module,
            Err(code) => {
                report.error_code = Some(format!("win32:{code}"));
                return report;
            }
        };
        let Some(symbol) = module.symbol("RtlGetVersion") else {
            report.error_code = Some("win32:127".into());
            return report;
        };
        let get_version: RtlGetVersion = unsafe { std::mem::transmute(symbol) };
        let mut info: VersionInfo = unsafe { std::mem::zeroed() };
        info.size = size_of::<VersionInfo>() as u32;
        let result = unsafe { get_version(&mut info) };
        if result < 0 {
            report.error_code = Some(format!("ntstatus:0x{:08X}", result as u32));
            return report;
        }
        if info.major > 100 || info.minor > 100 || info.build > 10_000_000 {
            report.error_code = Some("invalid-version-data".into());
            return report;
        }
        report.status = "ready";
        report.label = windows_label(info.major, info.minor, info.build, info.product_type);
        report.major = Some(info.major);
        report.minor = Some(info.minor);
        report.build = Some(info.build);
        report.ubr = update_build_revision();
        report.version_source = "RtlGetVersion";
        report
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn actual_version_labels_distinguish_windows_10_11_and_server() {
        assert_eq!(windows_label(10, 0, 19_045, 1), "Windows 10");
        assert_eq!(windows_label(10, 0, 22_000, 1), "Windows 11");
        assert_eq!(windows_label(10, 0, 26_100, 1), "Windows 11");
        assert_eq!(windows_label(10, 0, 26_100, 3), "Windows Server");
        assert_eq!(windows_label(10, 0, 26_100, 0), "Windows");
        assert_eq!(windows_label(6, 3, 9_600, 1), "Windows");
    }

    #[test]
    fn loader_failures_preserve_runtime_errors_instead_of_inferring_an_old_os() {
        for (code, status) in [
            (126, "api-unavailable"),
            (5, "permission-required"),
            (1314, "permission-required"),
            (193, "error"),
            (1114, "error"),
            (87, "error"),
        ] {
            let report =
                inspect_exports(Some(code), |_| panic!("Failed load must not query exports"));
            assert_eq!(report.status, status);
            assert_eq!(report.load_error_code, Some(code));
            assert!(report.exports_present.is_empty());
            assert!(report.exports_missing.is_empty());
        }
    }

    #[test]
    fn capability_probe_queries_only_the_fixed_exports_and_does_not_initialize_capture() {
        let mut queried = Vec::new();
        let report = inspect_exports(None, |name| {
            queried.push(name);
            name != "PacketMonitorCreateRealtimeStream"
        });
        assert_eq!(queried, REQUIRED_EXPORTS);
        assert_eq!(report.status, "api-unavailable");
        assert_eq!(
            report.exports_missing,
            ["PacketMonitorCreateRealtimeStream"]
        );
        assert_eq!(report.exports_present.len(), 10);
        let loaded = inspect_exports(None, |_| true);
        assert_eq!(loaded.status, "exports-available");
    }

    #[test]
    fn diagnostic_operation_exposes_only_a_recognized_stage_and_no_error_text() {
        for operation in REQUIRED_EXPORTS
            .into_iter()
            .chain(["LoadLibraryExW", "GetProcAddress"])
        {
            assert_eq!(
                super::super::diagnostic_operation(&format!(
                    "{operation} failed: arbitrary private text"
                )),
                Some(operation)
            );
        }
        for detail in [
            "C:\\Users\\private\\capture.log",
            "Arbitrary failed operation",
            "prefix PacketMonitorInitialize failed",
            "PacketMonitorInitializeAdditional failed",
        ] {
            assert_eq!(super::super::diagnostic_operation(detail), None);
        }
    }

    #[test]
    fn actual_local_diagnostic_is_cached_and_does_not_claim_capture_was_started() {
        let first = serde_json::to_value(compatibility_report()).unwrap();
        let second = serde_json::to_value(compatibility_report()).unwrap();
        assert_eq!(first, second);
        assert_eq!(first["capture_started"], false);
        assert_eq!(first["diagnostic_only"], true);
        assert_eq!(first["packet_monitor"]["system32_only"], true);
        for kind in ["exports_present", "exports_missing"] {
            let names = first["packet_monitor"][kind].as_array().unwrap();
            assert!(names.len() <= REQUIRED_EXPORTS.len());
            assert!(names
                .iter()
                .all(|value| REQUIRED_EXPORTS.contains(&value.as_str().unwrap())));
        }
    }

    #[test]
    fn serialized_report_has_only_the_bounded_diagnostic_schema() {
        let report = CompatibilityReport {
            schema_version: 1,
            diagnostic_only: true,
            capture_started: false,
            os: OsReport {
                status: "ready",
                label: "Windows 11",
                architecture: "x86_64",
                process_architecture: "x86_64",
                major: Some(10),
                minor: Some(0),
                build: Some(26_100),
                ubr: Some(1),
                version_source: "RtlGetVersion",
                error_code: None,
            },
            packet_monitor: inspect_exports(None, |_| true),
        };
        let value = serde_json::to_value(report).unwrap();
        let keys: std::collections::BTreeSet<_> = value
            .as_object()
            .unwrap()
            .keys()
            .map(String::as_str)
            .collect();
        assert_eq!(
            keys,
            [
                "capture_started",
                "diagnostic_only",
                "os",
                "packet_monitor",
                "schema_version"
            ]
            .into_iter()
            .collect()
        );
        let json = value.to_string();
        assert!(!value["capture_started"].as_bool().unwrap());
        assert!(json.len() < 2_048);
        for excluded in [
            "user", "machine", "address", "path", "token", "payload", "computer", "hostname",
        ] {
            assert!(!json.to_lowercase().contains(excluded));
        }
    }
}

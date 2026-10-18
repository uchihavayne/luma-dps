//! Independently authored capture adapter for Windows' in-box Packet Monitor API.
//! API contracts: https://learn.microsoft.com/windows/win32/pktmon/pktmon-reference
//! It creates and closes only its own multi-session stream; it does not invoke the
//! system-wide `pktmon start/stop`, load a third-party driver, or write packet logs.

use serde::Serialize;
use std::sync::Arc;

#[path = "capture_compatibility.rs"]
mod compatibility;
pub use compatibility::{compatibility_report, CompatibilityReport};

pub fn diagnostic_operation(detail: &str) -> Option<&'static str> {
    compatibility::REQUIRED_EXPORTS
        .into_iter()
        .chain(["LoadLibraryExW", "GetProcAddress"])
        .find(|operation| {
            detail
                .strip_prefix(operation)
                .is_some_and(|suffix| suffix.starts_with(" failed") || suffix.starts_with(':'))
        })
}

#[derive(Clone, Serialize)]
pub struct AdminCapability {
    pub required: bool,
    pub elevated: bool,
    pub status: String,
    pub detail: String,
}

fn inspect_admin() -> AdminCapability {
    #[cfg(windows)]
    {
        match windows::is_elevated() {
            Ok(elevated) => AdminCapability {
                required: true,
                elevated,
                status: if elevated { "ready" } else { "required" }.into(),
                detail: if elevated {
                    "Administrator permission granted for Windows native capture"
                } else {
                    "Close Luma and reopen the executable, then approve the Windows administrator prompt"
                }
                .into(),
            },
            Err(error) => AdminCapability {
                required: true,
                elevated: false,
                status: "unknown".into(),
                detail: error,
            },
        }
    }
    #[cfg(not(windows))]
    {
        AdminCapability {
            required: false,
            elevated: false,
            status: "unsupported".into(),
            detail: "Windows native capture is available only on Windows".into(),
        }
    }
}

#[derive(Clone, Serialize)]
pub struct NetworkLatency {
    pub status: String,
    pub source: &'static str,
    pub selection: &'static str,
    pub rtt_ms: Option<u32>,
    pub latest_rtt_ms: Option<u32>,
    pub variation_ms: Option<u32>,
    pub observed_at_ms: Option<u64>,
    pub sampled_at_ms: Option<u64>,
    pub fresh_for_ms: u64,
    pub measured_connections: usize,
    pub game_connections: usize,
    pub error_code: Option<String>,
}

impl Default for NetworkLatency {
    fn default() -> Self {
        Self {
            status: "waiting".into(),
            source: "windows-tcp-estats",
            selection: "worst-active-game-tcp",
            rtt_ms: None,
            latest_rtt_ms: None,
            variation_ms: None,
            observed_at_ms: None,
            sampled_at_ms: None,
            fresh_for_ms: 5_000,
            measured_connections: 0,
            game_connections: 0,
            error_code: None,
        }
    }
}

#[derive(Clone, Serialize)]
pub struct CaptureStatus {
    pub status: String,
    pub detail: String,
    pub packets: u64,
    pub missed_packets: u64,
    pub stream_warnings: u64,
    pub largest_warning_packet: u64,
    pub game_connections: usize,
    pub game_processes: usize,
    pub last_packet_at_ms: Option<u64>,
    pub error_code: Option<String>,
    pub admin: AdminCapability,
    pub network_latency: NetworkLatency,
}

impl Default for CaptureStatus {
    fn default() -> Self {
        Self {
            status: "starting".into(),
            detail: "Preparing Windows native packet capture".into(),
            packets: 0,
            missed_packets: 0,
            stream_warnings: 0,
            largest_warning_packet: 0,
            game_connections: 0,
            game_processes: 0,
            last_packet_at_ms: None,
            error_code: None,
            admin: inspect_admin(),
            network_latency: NetworkLatency::default(),
        }
    }
}

struct CaptureFailure {
    status: &'static str,
    code: Option<String>,
    detail: String,
}

impl From<String> for CaptureFailure {
    fn from(detail: String) -> Self {
        Self {
            status: "error",
            code: None,
            detail,
        }
    }
}

impl From<&str> for CaptureFailure {
    fn from(detail: &str) -> Self {
        detail.to_owned().into()
    }
}

fn failed(shared: &crate::Shared, failure: CaptureFailure) {
    // No previous decoded session may keep reporting itself connected after a
    // capture failure. Stored encounter damage remains available for review.
    if let Ok(mut engine) = shared.engine.lock() {
        engine.connection_changed();
    }
    if let Ok(mut capture) = shared.capture.lock() {
        capture.status = failure.status.into();
        capture.detail = failure.detail;
        capture.error_code = failure.code;
        capture.game_connections = 0;
        capture.last_packet_at_ms = None;
        capture.network_latency = NetworkLatency {
            status: "unavailable".into(),
            error_code: capture.error_code.clone(),
            ..NetworkLatency::default()
        };
    }
}

pub fn spawn(shared: Arc<crate::Shared>) -> std::thread::JoinHandle<()> {
    std::thread::spawn(move || {
        if std::env::var_os("LUMA_CAPTURE_DISABLED").is_some() {
            update(
                &shared,
                "disabled",
                "Native capture disabled for this launch",
            );
            return;
        }
        #[cfg(windows)]
        {
            let admin = inspect_admin();
            if let Ok(mut capture) = shared.capture.lock() {
                capture.admin = admin.clone();
            }
            if admin.status == "required" {
                failed(
                    &shared,
                    CaptureFailure {
                        status: "permission-required",
                        code: Some("0x80070005".into()),
                        detail: admin.detail,
                    },
                );
                return;
            }
            if let Err(error) = windows::run(&shared) {
                failed(&shared, error);
            }
        }
        #[cfg(not(windows))]
        update(
            &shared,
            "unsupported",
            "Windows native capture is available only on Windows",
        );
    })
}

fn update(shared: &crate::Shared, status: &str, detail: &str) {
    if let Ok(mut capture) = shared.capture.lock() {
        capture.status = status.into();
        capture.detail = detail.into();
        capture.error_code = None;
    }
}

pub fn inspect_backend() -> Result<(), String> {
    #[cfg(windows)]
    {
        windows::inspect()
    }
    #[cfg(not(windows))]
    {
        Err("Windows native capture is available only on Windows".into())
    }
}

pub fn open_support_url(url: &str) -> Result<(), String> {
    #[cfg(windows)]
    unsafe {
        use windows_sys::Win32::{
            UI::Shell::ShellExecuteW, UI::WindowsAndMessaging::SW_SHOWNORMAL,
        };
        let wide: Vec<u16> = url.encode_utf16().chain(Some(0)).collect();
        let operation: Vec<u16> = "open".encode_utf16().chain(Some(0)).collect();
        let result = ShellExecuteW(
            std::ptr::null_mut(),
            operation.as_ptr(),
            wide.as_ptr(),
            std::ptr::null(),
            std::ptr::null(),
            SW_SHOWNORMAL,
        ) as isize;
        if result <= 32 {
            return Err(format!(
                "Windows could not open the support link ({result})"
            ));
        }
        Ok(())
    }
    #[cfg(not(windows))]
    {
        let _ = url;
        Err("Opening this link requires Windows".into())
    }
}

#[cfg(windows)]
mod windows {
    use super::{compatibility, update, CaptureFailure, NetworkLatency};
    use std::{
        collections::{HashMap, HashSet},
        ffi::c_void,
        mem::{size_of, transmute},
        ptr,
        sync::{
            atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering},
            mpsc::{sync_channel, Receiver, SyncSender},
            RwLock,
        },
        time::{Duration, Instant},
    };
    use windows_sys::Win32::{
        Foundation::{CloseHandle, GetLastError, HMODULE, INVALID_HANDLE_VALUE},
        NetworkManagement::IpHelper::{
            GetExtendedTcpTable, GetPerTcpConnectionEStats, SetPerTcpConnectionEStats,
            TCP_ESTATS_PATH_ROD_v0, TCP_ESTATS_PATH_RW_v0, TcpConnectionEstatsPath, MIB_TCPROW_LH,
            MIB_TCPROW_LH_0, MIB_TCPROW_OWNER_PID, TCP_TABLE_OWNER_PID_ALL,
        },
        Security::{GetTokenInformation, TokenElevation, TOKEN_ELEVATION, TOKEN_QUERY},
        System::{
            Diagnostics::ToolHelp::{
                CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
                TH32CS_SNAPPROCESS,
            },
            Threading::{GetCurrentProcess, OpenProcessToken},
        },
    };

    pub fn is_elevated() -> Result<bool, String> {
        unsafe {
            let mut token = ptr::null_mut();
            if OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token) == 0 {
                return Err(format!(
                    "Cannot verify Windows administrator permission (Windows error {})",
                    GetLastError()
                ));
            }
            let mut elevation = TOKEN_ELEVATION::default();
            let mut needed = 0;
            let result = GetTokenInformation(
                token,
                TokenElevation,
                (&mut elevation as *mut TOKEN_ELEVATION).cast(),
                size_of::<TOKEN_ELEVATION>() as u32,
                &mut needed,
            );
            let error = if result == 0 {
                Some(GetLastError())
            } else {
                None
            };
            CloseHandle(token);
            if let Some(error) = error {
                return Err(format!(
                    "Cannot verify Windows administrator permission (Windows error {error})"
                ));
            }
            Ok(elevation.TokenIsElevated != 0)
        }
    }

    type Handle = *mut c_void;
    type Init = unsafe extern "system" fn(u32, *mut c_void, *mut Handle) -> i32;
    type Close = unsafe extern "system" fn(Handle);
    type CreateSession = unsafe extern "system" fn(Handle, *const u16, *mut Handle) -> i32;
    type CreateStream =
        unsafe extern "system" fn(Handle, *const StreamConfiguration, *mut Handle) -> i32;
    type SetActive = unsafe extern "system" fn(Handle, u8) -> i32;
    type Attach = unsafe extern "system" fn(Handle, Handle) -> i32;
    type Enumerate =
        unsafe extern "system" fn(Handle, i32, u8, usize, *mut usize, *mut c_void) -> i32;
    type AddSource = unsafe extern "system" fn(Handle, *const c_void) -> i32;
    type AddConstraint = unsafe extern "system" fn(Handle, *const ProtocolConstraint) -> i32;

    #[repr(C)]
    #[derive(Clone, Copy)]
    union IpAddress {
        ipv4: u32,
        ipv4_bytes: [u8; 4],
        ipv6: [u64; 2],
    }

    // Public API layout, confirmed against Microsoft's installed pktmonapi.dll:
    // Name is 64 WCHARs; AddCaptureConstraint copies exactly 216 bytes on Win64.
    #[repr(C)]
    struct ProtocolConstraint {
        name: [u16; 64],
        present: u32,
        mac1: [u8; 6],
        mac2: [u8; 6],
        vlan: u16,
        ether_type: u16,
        dscp: u16,
        transport: u8,
        ip1: IpAddress,
        ip2: IpAddress,
        prefix1: u8,
        prefix2: u8,
        port1: u16,
        port2: u16,
        tcp_flags: u8,
        encapsulation: u32,
        vxlan_port: u16,
        packets: u64,
        bytes: u64,
    }

    fn incoming_constraint(connection: &Connection, index: usize) -> ProtocolConstraint {
        let mut constraint: ProtocolConstraint = unsafe { std::mem::zeroed() };
        for (target, character) in constraint
            .name
            .iter_mut()
            .zip(format!("LumaGame-{index}").encode_utf16())
        {
            *target = character;
        }
        // TCP, source/destination IPv4 addresses and ports. Full IPv4 prefixes
        // are explicit, so the upstream session accepts only this owned flow.
        constraint.present =
            (1 << 5) | (1 << 6) | (1 << 7) | (1 << 9) | (1 << 10) | (1 << 11) | (1 << 12);
        constraint.transport = 6;
        constraint.ip1.ipv4_bytes = connection.remote;
        constraint.ip2.ipv4_bytes = connection.local;
        constraint.prefix1 = 32;
        constraint.prefix2 = 32;
        constraint.port1 = connection.remote_port;
        constraint.port2 = connection.local_port;
        constraint
    }

    #[repr(C)]
    struct StreamConfiguration {
        context: *mut c_void,
        event_callback: Option<unsafe extern "system" fn(*mut c_void, *const c_void, i32)>,
        data_callback: Option<unsafe extern "system" fn(*mut c_void, *const DataDescriptor)>,
        buffer_multiplier: u16,
        truncation_size: u16,
    }

    #[repr(C)]
    struct DataDescriptor {
        data: *const c_void,
        data_size: u32,
        metadata_offset: u32,
        packet_offset: u32,
        packet_length: u32,
        missed_write: u32,
        missed_read: u32,
    }

    #[repr(C)]
    #[derive(Clone, Copy)]
    struct Metadata {
        packet_group: u64,
        packet_count: u16,
        appearance_count: u16,
        direction: u16,
        packet_type: u16,
        component: u16,
        edge: u16,
        reserved: u16,
        drop_reason: u32,
        drop_location: u32,
        processor: u16,
        timestamp: i64,
    }

    fn packet_timestamp_ms(timestamp: i64, received_at_ms: u64) -> u64 {
        const FILETIME_UNIX_EPOCH: i64 = 116_444_736_000_000_000;
        const MAX_PACKET_AGE_MS: u64 = 60_000;
        // Packet Monitor documents KeQuerySystemTime (100 ns since 1601).
        // Metadata from an unsupported layout must not become a distant-future
        // encounter start: snapshots use this same Unix millisecond clock.
        let Some(unix_ticks) = timestamp.checked_sub(FILETIME_UNIX_EPOCH) else {
            return received_at_ms;
        };
        let Ok(unix_ticks) = u64::try_from(unix_ticks) else {
            return received_at_ms;
        };
        let reported_ms = unix_ticks / 10_000;
        if reported_ms > received_at_ms
            || received_at_ms.saturating_sub(reported_ms) > MAX_PACKET_AGE_MS
        {
            received_at_ms
        } else {
            reported_ms
        }
    }

    struct Packet {
        bytes: Vec<u8>,
        timestamp_ms: u64,
        loss_epoch: u64,
    }
    struct CallbackContext {
        sender: SyncSender<Packet>,
        missed: AtomicU64,
        fatal_error: AtomicU32,
        warning: AtomicU32,
        warning_count: AtomicU64,
        largest_warning_packet: AtomicU64,
        previous_read_misses: AtomicU32,
        loss_epoch: AtomicU64,
        stopped: AtomicBool,
        endpoints: RwLock<HashSet<Connection>>,
    }

    impl CallbackContext {
        fn new(sender: SyncSender<Packet>, endpoints: HashSet<Connection>) -> Self {
            Self {
                sender,
                missed: AtomicU64::new(0),
                fatal_error: AtomicU32::new(0),
                warning: AtomicU32::new(0),
                warning_count: AtomicU64::new(0),
                largest_warning_packet: AtomicU64::new(0),
                previous_read_misses: AtomicU32::new(0),
                loss_epoch: AtomicU64::new(0),
                stopped: AtomicBool::new(false),
                endpoints: RwLock::new(endpoints),
            }
        }

        fn record_loss(&self, count: u64) {
            if count != 0 {
                self.missed.fetch_add(count, Ordering::Relaxed);
                self.loss_epoch.fetch_add(1, Ordering::Release);
            }
        }

        fn descriptor_loss(&self, write_misses: u32, read_misses: u32) {
            // Microsoft's stream worker copies its lifetime read-error counter
            // into every descriptor. Summing that absolute value repeatedly
            // invents losses. The ring's write count describes this packet.
            let previous = self
                .previous_read_misses
                .swap(read_misses, Ordering::Relaxed);
            let read_delta = read_misses.wrapping_sub(previous);
            self.record_loss(write_misses as u64 + read_delta as u64);
        }
    }

    unsafe extern "system" fn on_event(
        context: *mut c_void,
        information: *const c_void,
        kind: i32,
    ) {
        if context.is_null() || information.is_null() {
            return;
        }
        let context = &*(context as *const CallbackContext);
        if kind == 1 {
            context.stopped.store(true, Ordering::Relaxed);
        }
        // Stop/process-info records begin with a BOOLEAN then an aligned DWORD.
        if matches!(kind, 1 | 2 | 3) {
            let reason = ptr::read_unaligned(information.cast::<u8>().add(4).cast::<u32>());
            if kind == 2 {
                context.fatal_error.store(reason.max(1), Ordering::Relaxed);
            }
            if kind == 3 {
                context.warning.store(reason, Ordering::Relaxed);
                context.warning_count.fetch_add(1, Ordering::Relaxed);
                let length = ptr::read_unaligned(information.cast::<u8>().add(8).cast::<u64>());
                context
                    .largest_warning_packet
                    .fetch_max(length, Ordering::Relaxed);
                // Preserve the boundary on the next queued packet. The read
                // counter records the omitted packet separately, without
                // counting the warning twice or discarding valid queued data.
                context.loss_epoch.fetch_add(1, Ordering::Release);
            }
        }
    }

    unsafe extern "system" fn on_data(context: *mut c_void, descriptor: *const DataDescriptor) {
        if context.is_null() || descriptor.is_null() {
            return;
        }
        let context = &*(context as *const CallbackContext);
        let descriptor = &*descriptor;
        context.descriptor_loss(descriptor.missed_write, descriptor.missed_read);
        let length = descriptor.data_size as usize;
        let offset = descriptor.packet_offset as usize;
        let packet_length = descriptor.packet_length as usize;
        let metadata_offset = descriptor.metadata_offset as usize;
        if descriptor.data.is_null()
            || length > 16 * 1024 * 1024
            || packet_length == 0
            || packet_length > 9000
            || offset
                .checked_add(packet_length)
                .is_none_or(|end| end > length)
            || metadata_offset
                .checked_add(size_of::<Metadata>())
                .is_none_or(|end| end > length)
        {
            return;
        }
        let base = descriptor.data.cast::<u8>();
        let metadata = ptr::read_unaligned(base.add(metadata_offset).cast::<Metadata>());
        let bytes = std::slice::from_raw_parts(base.add(offset), packet_length);
        let Some(ip) = ipv4_packet(bytes, metadata.packet_type) else {
            return;
        };
        // Keep the read guard through enqueueing. Once a removal is published,
        // no callback can enqueue later traffic from the now-unowned tuple.
        // A poisoned ownership gate fails closed.
        let Ok(endpoints) = context.endpoints.read() else {
            return;
        };
        if direction(ip, &endpoints) != Some(true) {
            return;
        }
        let timestamp_ms = packet_timestamp_ms(metadata.timestamp, crate::now_ms());
        // A bounded nonblocking queue keeps the OS callback short and caps memory.
        if context
            .sender
            .try_send(Packet {
                bytes: ip.to_vec(),
                timestamp_ms,
                loss_epoch: context.loss_epoch.load(Ordering::Acquire),
            })
            .is_err()
        {
            context.record_loss(1);
        }
    }

    fn ipv4_packet(bytes: &[u8], packet_type: u16) -> Option<&[u8]> {
        let ip = match packet_type {
            3 => bytes, // PktMonPayload_IP
            1 => {
                if bytes.len() < 14 {
                    return None;
                }
                let mut offset = 14;
                let mut kind = u16::from_be_bytes([bytes[12], bytes[13]]);
                for _ in 0..2 {
                    if !matches!(kind, 0x8100 | 0x88a8) {
                        break;
                    }
                    if bytes.len() < offset + 4 {
                        return None;
                    }
                    kind = u16::from_be_bytes([bytes[offset + 2], bytes[offset + 3]]);
                    offset += 4;
                }
                if kind != 0x0800 {
                    return None;
                }
                bytes.get(offset..)?
            }
            2 => {
                if bytes.len() < 24 {
                    return None;
                }
                let control = u16::from_le_bytes([bytes[0], bytes[1]]);
                if (control >> 2) & 3 != 2 || control & 0x4000 != 0 {
                    return None;
                }
                let qos = control & 0x0080 != 0;
                let mut header = 24 + if control & 0x0300 == 0x0300 { 6 } else { 0 };
                if qos {
                    header += 2;
                }
                if qos && control & 0x8000 != 0 {
                    header += 4;
                }
                let snap = bytes.get(header..header + 8)?;
                if snap[..6] != [0xaa, 0xaa, 3, 0, 0, 0] || snap[6..8] != [8, 0] {
                    return None;
                }
                bytes.get(header + 8..)?
            }
            _ => return None,
        };
        if ip.len() < 40 || ip[0] >> 4 != 4 || ip[9] != 6 {
            return None;
        }
        let header = ((ip[0] & 15) as usize) * 4;
        let total = u16::from_be_bytes([ip[2], ip[3]]) as usize;
        let fragment = u16::from_be_bytes([ip[6], ip[7]]);
        // An incomplete/fragmented TCP segment cannot safely enter reassembly.
        if header < 20 || total < header + 20 || total > ip.len() || fragment & 0x3fff != 0 {
            return None;
        }
        Some(&ip[..total])
    }

    struct Api {
        // Kept loaded for the process lifetime so callback/function pointers stay valid.
        _module: HMODULE,
        initialize: Init,
        uninitialize: Close,
        create_session: CreateSession,
        close_session: Close,
        create_stream: CreateStream,
        close_stream: Close,
        set_active: SetActive,
        attach: Attach,
        enumerate: Enumerate,
        add_source: AddSource,
        add_constraint: AddConstraint,
    }

    impl Api {
        unsafe fn load() -> Result<Self, CaptureFailure> {
            let module = compatibility::windows::SystemModule::load("pktmonapi.dll").map_err(|code| CaptureFailure {
                status: compatibility::loader_failure_status(code),
                code: Some(format!("win32:{code}")),
                detail: format!("LoadLibraryExW failed for the Windows Packet Monitor API (Windows error {code}); automatic compatibility diagnostics contain the local capability result"),
            })?;
            macro_rules! symbol {
                ($index:literal, $kind:ty) => {{
                    let name = compatibility::REQUIRED_EXPORTS[$index];
                    let function = module.symbol(name);
                    match function {
                        Some(function) => {
                            transmute::<unsafe extern "system" fn() -> isize, $kind>(function)
                        }
                        None => {
                            return Err(CaptureFailure {
                                status: "api-unavailable",
                                code: Some("win32:127".into()),
                                detail: format!("GetProcAddress failed: Windows Packet Monitor does not export {name}; the capture API is unavailable"),
                            })
                        }
                    }
                }};
            }
            Ok(Self {
                initialize: symbol!(0, Init),
                uninitialize: symbol!(1, Close),
                create_session: symbol!(2, CreateSession),
                close_session: symbol!(3, Close),
                create_stream: symbol!(4, CreateStream),
                close_stream: symbol!(5, Close),
                set_active: symbol!(6, SetActive),
                attach: symbol!(7, Attach),
                enumerate: symbol!(8, Enumerate),
                add_source: symbol!(9, AddSource),
                add_constraint: symbol!(10, AddConstraint),
                _module: module.into_raw(),
            })
        }
    }

    fn check(result: i32, operation: &str) -> Result<(), CaptureFailure> {
        if result >= 0 {
            return Ok(());
        }
        let (status, hint) = match result as u32 {
            0x80070005 if is_elevated().unwrap_or(false) => (
                "permission-required",
                " Windows denied native capture even though Luma has administrator permission.",
            ),
            0x80070005 | 0x80070522 => (
                "permission-required",
                " Close Luma and reopen the executable, then approve the Windows administrator prompt.",
            ),
            0x8007051A if operation == "PacketMonitorInitialize" => (
                "api-version-mismatch",
                " Windows Packet Monitor rejected the requested API revision; automatic diagnostics identify the Windows build and available exports.",
            ),
            0x80070032 => (
                "operation-not-supported",
                " Windows Packet Monitor does not support this capture operation in the current configuration.",
            ),
            _ => (
                "error",
                " Native capture could not start; no encounter data is being collected.",
            ),
        };
        Err(CaptureFailure {
            status,
            code: Some(format!("0x{:08X}", result as u32)),
            detail: format!(
                "{operation} failed (HRESULT 0x{:08X}).{hint}",
                result as u32
            ),
        })
    }

    pub fn inspect() -> Result<(), String> {
        let report = compatibility::compatibility_report().packet_monitor;
        if report.status == "exports-available" {
            Ok(())
        } else if let Some(code) = report.load_error_code {
            Err(format!(
                "LoadLibraryExW failed for the Windows Packet Monitor API (Windows error {code})"
            ))
        } else {
            Err(format!(
                "Windows Packet Monitor is missing required exports: {}",
                report.exports_missing.join(", ")
            ))
        }
    }

    struct Session<'a> {
        api: &'a Api,
        handle: Handle,
        session: Handle,
        stream: Handle,
        context: Box<CallbackContext>,
        kernel_endpoints: HashSet<Connection>,
    }

    impl Session<'_> {
        fn refresh_endpoints(
            &mut self,
            endpoints: &HashSet<Connection>,
        ) -> Result<bool, CaptureFailure> {
            // Microsoft permits additions before or after session activation.
            // Retired exact kernel filters remain bounded; the synchronized
            // current-ownership gate removes their traffic immediately.
            // https://learn.microsoft.com/windows/win32/pktmon/packetmonitor/nf-packetmonitor-packetmonitoraddcaptureconstraint
            refresh_constraints(
                &self.context.endpoints,
                &mut self.kernel_endpoints,
                endpoints,
                |connection, index| unsafe {
                    check(
                        (self.api.add_constraint)(
                            self.session,
                            &incoming_constraint(connection, index),
                        ),
                        "PacketMonitorAddCaptureConstraint",
                    )
                },
            )
        }

        fn stop(&mut self) {
            // Stop accepting new callbacks before deactivation/closure. Packets
            // accepted under the previous ownership snapshot are still drained.
            if let Ok(mut endpoints) = self.context.endpoints.write() {
                endpoints.clear();
            }
            unsafe {
                if !self.session.is_null() {
                    (self.api.set_active)(self.session, 0);
                }
                // Close callbacks before reading final counters or draining
                // queued packets accepted while their tuples were owned.
                if !self.stream.is_null() {
                    (self.api.close_stream)(self.stream);
                    self.stream = ptr::null_mut();
                }
            }
        }
    }

    impl Drop for Session<'_> {
        fn drop(&mut self) {
            self.stop();
            unsafe {
                if !self.session.is_null() {
                    (self.api.close_session)(self.session);
                }
                if !self.handle.is_null() {
                    (self.api.uninitialize)(self.handle);
                }
            }
        }
    }

    unsafe fn create<'a>(
        api: &'a Api,
        sender: SyncSender<Packet>,
        endpoints: HashSet<Connection>,
    ) -> Result<Session<'a>, CaptureFailure> {
        if endpoints.is_empty() || endpoints.len() > MAX_CAPTURE_CONSTRAINTS {
            return Err("Native capture requires 1 to 128 owned game TCP connections".into());
        }
        let mut session = Session {
            api,
            handle: ptr::null_mut(),
            session: ptr::null_mut(),
            stream: ptr::null_mut(),
            kernel_endpoints: endpoints.clone(),
            context: Box::new(CallbackContext::new(sender, endpoints)),
        };
        check(
            (api.initialize)(0x00010000, ptr::null_mut(), &mut session.handle),
            "PacketMonitorInitialize",
        )?;
        let name: Vec<u16> = format!("LumaIndependent-{}", std::process::id())
            .encode_utf16()
            .chain(Some(0))
            .collect();
        check(
            (api.create_session)(session.handle, name.as_ptr(), &mut session.session),
            "PacketMonitorCreateLiveSession",
        )?;
        for (index, connection) in session.kernel_endpoints.iter().enumerate() {
            let constraint = incoming_constraint(connection, index);
            check(
                (api.add_constraint)(session.session, &constraint),
                "PacketMonitorAddCaptureConstraint",
            )?;
        }
        // Restrict to NICs. The API returns pointers to source specifications in
        // its own output buffer; pass them back without guessing their layout.
        let mut needed = 0usize;
        let result = (api.enumerate)(session.handle, 1, 0, 0, &mut needed, ptr::null_mut());
        if needed == 0 {
            check(result, "PacketMonitorEnumDataSources")?;
            return Err("Windows reported no network interfaces for capture".into());
        }
        if needed > 16 * 1024 * 1024 {
            return Err("Windows returned an invalid capture interface list".into());
        }
        let mut buffer = vec![0usize; (needed + size_of::<usize>() - 1) / size_of::<usize>()];
        let capacity = buffer.len() * size_of::<usize>();
        check(
            (api.enumerate)(
                session.handle,
                1,
                0,
                capacity,
                &mut needed,
                buffer.as_mut_ptr().cast(),
            ),
            "PacketMonitorEnumDataSources",
        )?;
        let count = ptr::read(buffer.as_ptr().cast::<u32>()) as usize;
        let pointer_offset = size_of::<usize>();
        if count == 0 || count > (capacity - pointer_offset) / size_of::<usize>() {
            return Err("Windows returned no usable capture network interfaces".into());
        }
        for index in 0..count {
            let source = ptr::read(
                (buffer.as_ptr().cast::<u8>())
                    .add(pointer_offset + index * size_of::<usize>())
                    .cast::<*const c_void>(),
            );
            if source.is_null() {
                return Err("Windows returned an invalid capture interface".into());
            }
            check(
                (api.add_source)(session.session, source),
                "PacketMonitorAddSingleDataSourceToSession",
            )?;
        }
        let configuration = StreamConfiguration {
            context: (&mut *session.context as *mut CallbackContext).cast(),
            event_callback: Some(on_event),
            data_callback: Some(on_data),
            buffer_multiplier: 10,
            truncation_size: 9000,
        };
        check(
            (api.create_stream)(session.handle, &configuration, &mut session.stream),
            "PacketMonitorCreateRealtimeStream",
        )?;
        check(
            (api.attach)(session.session, session.stream),
            "PacketMonitorAttachOutputToSession",
        )?;
        check(
            (api.set_active)(session.session, 1),
            "PacketMonitorSetSessionActive",
        )?;
        Ok(session)
    }

    #[derive(Clone, Hash, PartialEq, Eq)]
    struct Connection {
        local: [u8; 4],
        local_port: u16,
        remote: [u8; 4],
        remote_port: u16,
    }

    const MAX_CAPTURE_CONSTRAINTS: usize = 128;

    fn refresh_constraints(
        current: &RwLock<HashSet<Connection>>,
        installed: &mut HashSet<Connection>,
        requested: &HashSet<Connection>,
        mut add: impl FnMut(&Connection, usize) -> Result<(), CaptureFailure>,
    ) -> Result<bool, CaptureFailure> {
        {
            let mut owned = current
                .write()
                .map_err(|_| CaptureFailure::from("Native capture ownership gate unavailable"))?;
            *owned = requested.clone();
        }
        let additions: Vec<_> = requested.difference(installed).cloned().collect();
        if requested.is_empty()
            || installed.is_empty()
            || installed.len().saturating_add(additions.len()) > MAX_CAPTURE_CONSTRAINTS
        {
            return Ok(false);
        }
        // Do not hold the ownership write lock across a Windows API call: an
        // immediate callback must be able to check the newly published set.
        for connection in additions {
            add(&connection, installed.len())?;
            installed.insert(connection);
        }
        Ok(true)
    }

    struct GameConnections {
        processes: usize,
        endpoints: HashSet<Connection>,
    }

    #[derive(Clone, Copy)]
    struct PathReading {
        count: u32,
        smoothed_ms: u32,
        latest_ms: u32,
        variation_ms: u32,
    }

    struct PathHistory {
        count: u32,
        observed_at_ms: Option<u64>,
        reading: PathReading,
    }

    #[derive(Default)]
    struct LatencyMonitor {
        paths: HashMap<Connection, PathHistory>,
    }

    impl LatencyMonitor {
        fn sample(
            &mut self,
            endpoints: &HashSet<Connection>,
            now: u64,
            mut read: impl FnMut(&Connection) -> Result<PathReading, u32>,
        ) -> NetworkLatency {
            self.paths
                .retain(|endpoint, _| endpoints.contains(endpoint));
            let mut state = NetworkLatency {
                sampled_at_ms: Some(now),
                game_connections: endpoints.len(),
                ..NetworkLatency::default()
            };
            if endpoints.is_empty() {
                return state;
            }
            let mut failures = 0;
            let mut first_error: Option<u32> = None;
            for endpoint in endpoints {
                let reading = match read(endpoint) {
                    Ok(reading)
                        if reading.smoothed_ms <= 120_000
                            && reading.latest_ms <= 120_000
                            && reading.variation_ms <= 120_000 =>
                    {
                        reading
                    }
                    Ok(_) => {
                        self.paths.remove(endpoint);
                        failures += 1;
                        first_error = Some(first_error.unwrap_or(13).min(13));
                        continue;
                    }
                    Err(error) => {
                        // Never retain a displayed RTT after the OS can no longer
                        // read that connection or says collection is disabled.
                        self.paths.remove(endpoint);
                        failures += 1;
                        first_error = Some(first_error.unwrap_or(error).min(error));
                        continue;
                    }
                };
                if let Some(path) = self.paths.get_mut(endpoint) {
                    let delta = reading.count.wrapping_sub(path.count);
                    if delta > 0 && delta < u32::MAX / 2 {
                        path.observed_at_ms = Some(now);
                        path.reading = reading;
                    } else if delta > 0 {
                        // A reset/reused tuple is a new baseline, not a fresh
                        // sample from the previous game connection.
                        path.observed_at_ms = None;
                    }
                    path.count = reading.count;
                } else {
                    // Existing Windows counters can predate Luma. One read
                    // cannot prove when the last RTT sample was measured.
                    self.paths.insert(
                        endpoint.clone(),
                        PathHistory {
                            count: reading.count,
                            observed_at_ms: None,
                            reading,
                        },
                    );
                }
            }
            state.error_code = first_error.map(|error| format!("win32:{error}"));
            let mut selected: Option<&PathHistory> = None;
            let mut newest = None;
            for path in self.paths.values() {
                let Some(observed) = path.observed_at_ms else {
                    continue;
                };
                newest = Some(newest.unwrap_or(0).max(observed));
                if now < observed || now - observed > state.fresh_for_ms {
                    continue;
                }
                state.measured_connections += 1;
                if selected.is_none_or(|previous| {
                    (path.reading.smoothed_ms, observed)
                        > (
                            previous.reading.smoothed_ms,
                            previous.observed_at_ms.unwrap_or(0),
                        )
                }) {
                    selected = Some(path);
                }
            }
            if let Some(path) = selected {
                state.status = "ready".into();
                state.rtt_ms = Some(path.reading.smoothed_ms);
                state.latest_rtt_ms = Some(path.reading.latest_ms);
                state.variation_ms = Some(path.reading.variation_ms);
                state.observed_at_ms = path.observed_at_ms;
            } else {
                state.observed_at_ms = newest;
                state.status = if failures == endpoints.len() {
                    "unavailable"
                } else if newest.is_some() {
                    "stale"
                } else {
                    "collecting"
                }
                .into();
            }
            state
        }
    }

    fn read_path(endpoint: &Connection) -> Result<PathReading, u32> {
        let row = MIB_TCPROW_LH {
            Anonymous: MIB_TCPROW_LH_0 { dwState: 5 },
            dwLocalAddr: u32::from_ne_bytes(endpoint.local),
            dwLocalPort: u32::from(endpoint.local_port.to_be()),
            dwRemoteAddr: u32::from_ne_bytes(endpoint.remote),
            dwRemotePort: u32::from(endpoint.remote_port.to_be()),
        };
        let mut rw = TCP_ESTATS_PATH_RW_v0::default();
        let mut rod = TCP_ESTATS_PATH_ROD_v0::default();
        let result = unsafe {
            GetPerTcpConnectionEStats(
                &row,
                TcpConnectionEstatsPath,
                (&mut rw as *mut TCP_ESTATS_PATH_RW_v0).cast(),
                0,
                size_of::<TCP_ESTATS_PATH_RW_v0>() as u32,
                ptr::null_mut(),
                0,
                0,
                (&mut rod as *mut TCP_ESTATS_PATH_ROD_v0).cast(),
                0,
                size_of::<TCP_ESTATS_PATH_ROD_v0>() as u32,
            )
        };
        if result != 0 {
            return Err(result);
        }
        if !rw.EnableCollection {
            // EStats observes normal Windows TCP traffic. It sends no probe or
            // game packet. Microsoft recommends leaving collection enabled to
            // avoid resetting another diagnostic tool's connection counters.
            // https://learn.microsoft.com/windows/win32/api/iphlpapi/nf-iphlpapi-setpertcpconnectionestats
            let enabled = TCP_ESTATS_PATH_RW_v0 {
                EnableCollection: true,
            };
            let result = unsafe {
                SetPerTcpConnectionEStats(
                    &row,
                    TcpConnectionEstatsPath,
                    (&enabled as *const TCP_ESTATS_PATH_RW_v0).cast(),
                    0,
                    size_of::<TCP_ESTATS_PATH_RW_v0>() as u32,
                    0,
                )
            };
            if result != 0 {
                return Err(result);
            }
            // The just-read ROD was undefined while collection was disabled.
            // Use zero only as a baseline; it is never displayed as zero ping.
            return Ok(PathReading {
                count: 0,
                smoothed_ms: 0,
                latest_ms: 0,
                variation_ms: 0,
            });
        }
        Ok(PathReading {
            count: rod.CountRtt,
            smoothed_ms: rod.SmoothedRtt,
            latest_ms: rod.SampleRtt,
            variation_ms: rod.RttVar,
        })
    }

    fn read_tcp_table(
        mut read: impl FnMut(*mut c_void, &mut u32) -> u32,
    ) -> Result<Vec<u32>, CaptureFailure> {
        let mut needed = 0;
        let mut result = read(ptr::null_mut(), &mut needed);
        // Other processes may add connections between the size query and read.
        // Resize and retry that transient condition instead of stopping capture.
        for _ in 0..4 {
            if !matches!(result, 0 | 122) {
                break;
            }
            if needed < 4 || needed > 16 * 1024 * 1024 {
                return Err("Windows returned an invalid game TCP connection table".into());
            }
            let mut rows = vec![0u32; (needed as usize + 3) / 4];
            result = read(rows.as_mut_ptr().cast(), &mut needed);
            if result == 0 {
                return Ok(rows);
            }
        }
        Err(CaptureFailure {
            status: "error",
            code: Some(format!("win32:{result}")),
            detail: format!("Cannot read game TCP connections (Windows error {result})"),
        })
    }

    fn connections() -> Result<GameConnections, CaptureFailure> {
        unsafe {
            let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
            if snapshot == INVALID_HANDLE_VALUE {
                return Err(format!(
                    "Cannot identify AION2 process (Windows error {})",
                    GetLastError()
                )
                .into());
            }
            let mut process = PROCESSENTRY32W {
                dwSize: size_of::<PROCESSENTRY32W>() as u32,
                ..Default::default()
            };
            let mut pids = HashSet::new();
            let mut present = Process32FirstW(snapshot, &mut process);
            while present != 0 {
                let length = process
                    .szExeFile
                    .iter()
                    .position(|c| *c == 0)
                    .unwrap_or(process.szExeFile.len());
                let name =
                    String::from_utf16_lossy(&process.szExeFile[..length]).to_ascii_lowercase();
                if matches!(
                    name.as_str(),
                    "aion2.exe" | "aion2-win64-shipping.exe" | "aion2_client.exe"
                ) {
                    pids.insert(process.th32ProcessID);
                }
                present = Process32NextW(snapshot, &mut process);
            }
            CloseHandle(snapshot);
            if pids.is_empty() {
                return Ok(GameConnections {
                    processes: 0,
                    endpoints: HashSet::new(),
                });
            }
            let rows = read_tcp_table(|buffer, needed| {
                GetExtendedTcpTable(buffer, needed, 0, 2, TCP_TABLE_OWNER_PID_ALL, 0)
            })?;
            let count = rows[0] as usize;
            if 4 + count * size_of::<MIB_TCPROW_OWNER_PID>() > rows.len() * 4 {
                return Err("Windows returned a truncated game TCP connection table".into());
            }
            let mut found = HashSet::new();
            for index in 0..count {
                let row = ptr::read_unaligned(
                    rows.as_ptr()
                        .cast::<u8>()
                        .add(4 + index * size_of::<MIB_TCPROW_OWNER_PID>())
                        .cast::<MIB_TCPROW_OWNER_PID>(),
                );
                if row.dwState != 5 || !pids.contains(&row.dwOwningPid) {
                    continue;
                }
                if u16::from_be(row.dwRemotePort as u16) == 443
                    || u16::from_be(row.dwLocalPort as u16) == 443
                {
                    continue;
                }
                found.insert(Connection {
                    local: row.dwLocalAddr.to_ne_bytes(),
                    local_port: u16::from_be(row.dwLocalPort as u16),
                    remote: row.dwRemoteAddr.to_ne_bytes(),
                    remote_port: u16::from_be(row.dwRemotePort as u16),
                });
            }
            Ok(GameConnections {
                processes: pids.len(),
                endpoints: found,
            })
        }
    }

    fn direction(packet: &[u8], endpoints: &HashSet<Connection>) -> Option<bool> {
        let header = (packet[0] as usize & 15) * 4;
        let source: [u8; 4] = packet[12..16].try_into().ok()?;
        let destination: [u8; 4] = packet[16..20].try_into().ok()?;
        let source_port = u16::from_be_bytes([packet[header], packet[header + 1]]);
        let destination_port = u16::from_be_bytes([packet[header + 2], packet[header + 3]]);
        if endpoints.contains(&Connection {
            local: destination,
            local_port: destination_port,
            remote: source,
            remote_port: source_port,
        }) {
            return Some(true);
        }
        if endpoints.contains(&Connection {
            local: source,
            local_port: source_port,
            remote: destination,
            remote_port: destination_port,
        }) {
            return Some(false);
        }
        None
    }

    fn deliver_packet(shared: &crate::Shared, packet: Packet, applied_epoch: &mut u64) {
        if let Ok(mut engine) = shared.engine.lock() {
            if packet.loss_epoch != *applied_epoch {
                engine.capture_loss();
                *applied_epoch = packet.loss_epoch;
            }
            engine.ingest_tcp(&packet.bytes, true, packet.timestamp_ms);
        }
        if let Ok(mut capture) = shared.capture.lock() {
            capture.packets = capture.packets.saturating_add(1);
            capture.last_packet_at_ms = Some(crate::now_ms());
        }
    }

    struct ActiveCapture<'a> {
        session: Session<'a>,
        receiver: Receiver<Packet>,
        applied_epoch: u64,
    }

    #[derive(Default)]
    struct StreamTotals {
        missed: u64,
        warnings: u64,
        largest_packet: u64,
        warning: u32,
    }

    fn stream_totals(context: &CallbackContext) -> StreamTotals {
        let warnings = context.warning_count.load(Ordering::Relaxed);
        let reads = context.previous_read_misses.load(Ordering::Relaxed) as u64;
        StreamTotals {
            // A final oversized-packet event may have no subsequent descriptor
            // to report its updated read counter. Preserve that loss as well.
            missed: context
                .missed
                .load(Ordering::Relaxed)
                .saturating_add(warnings.saturating_sub(reads)),
            warnings,
            largest_packet: context.largest_warning_packet.load(Ordering::Relaxed),
            warning: context.warning.load(Ordering::Relaxed),
        }
    }

    fn close_active(mut active: ActiveCapture<'_>, shared: &crate::Shared) -> StreamTotals {
        active.session.stop();
        while let Ok(packet) = active.receiver.try_recv() {
            deliver_packet(shared, packet, &mut active.applied_epoch);
        }
        let final_epoch = active.session.context.loss_epoch.load(Ordering::Acquire);
        if final_epoch != active.applied_epoch {
            if let Ok(mut engine) = shared.engine.lock() {
                engine.capture_loss();
            }
        }
        stream_totals(&active.session.context)
    }

    pub fn run(shared: &crate::Shared) -> Result<(), CaptureFailure> {
        let api = unsafe { Api::load()? };
        let mut active: Option<ActiveCapture<'_>> = None;
        let mut endpoints = HashSet::new();
        let mut totals = StreamTotals::default();
        let mut latency = LatencyMonitor::default();
        let mut refresh = Instant::now() - Duration::from_secs(2);
        update(
            shared,
            "waiting",
            "Windows capture ready; waiting for AION2",
        );
        let result = (|| -> Result<(), CaptureFailure> {
            while !shared.stopping.load(Ordering::Relaxed) {
                if let Some(stream) = active.as_ref() {
                    let fatal = stream.session.context.fatal_error.load(Ordering::Relaxed);
                    if fatal != 0 {
                        return Err(CaptureFailure {
                        status: "error",
                        code: Some(format!("win32:{fatal}")),
                        detail: format!("Windows native packet stream stopped (Windows error {fatal}); reopen Luma to restart capture"),
                    });
                    }
                    if stream.session.context.stopped.load(Ordering::Relaxed) {
                        return Err(CaptureFailure {
                        status: "error",
                        code: Some("stream-stopped".into()),
                        detail: "Windows native packet stream stopped; reopen Luma to restart capture".into(),
                    });
                    }
                }
                if refresh.elapsed() >= Duration::from_secs(1) {
                    let refreshed = connections()?;
                    let session_changed =
                        !endpoints.is_empty() && endpoints.is_disjoint(&refreshed.endpoints);
                    if endpoints != refreshed.endpoints {
                        let had_capture = active.is_some();
                        let kept_session = !session_changed
                            && !refreshed.endpoints.is_empty()
                            && active.as_mut().is_some_and(|stream| {
                                stream
                                    .session
                                    .refresh_endpoints(&refreshed.endpoints)
                                    .unwrap_or(false)
                            });
                        if !kept_session {
                            // A new game generation, exhausted bounded filter
                            // cache or failed live API update falls back to a
                            // freshly filtered session. Preserve accepted queued
                            // packets and mark the actual interruption as loss.
                            if let Some(previous) = active.take() {
                                let previous = close_active(previous, shared);
                                totals.missed = totals.missed.saturating_add(previous.missed);
                                totals.warnings = totals.warnings.saturating_add(previous.warnings);
                                totals.largest_packet =
                                    totals.largest_packet.max(previous.largest_packet);
                                if previous.warning != 0 {
                                    totals.warning = previous.warning;
                                }
                            }
                            if session_changed {
                                if let Ok(mut engine) = shared.engine.lock() {
                                    engine.connection_changed();
                                }
                            }
                            // No filters means the Windows API captures the
                            // entire host. Never activate an unfiltered session.
                            if !refreshed.endpoints.is_empty() {
                                let (sender, receiver) = sync_channel(2048);
                                let session =
                                    unsafe { create(&api, sender, refreshed.endpoints.clone())? };
                                active = Some(ActiveCapture {
                                    session,
                                    receiver,
                                    applied_epoch: if had_capture && !session_changed {
                                        u64::MAX
                                    } else {
                                        0
                                    },
                                });
                            }
                        }
                        endpoints = refreshed.endpoints;
                    }
                    refresh = Instant::now();
                    let current = active
                        .as_ref()
                        .map(|stream| stream_totals(&stream.session.context))
                        .unwrap_or_default();
                    let network_latency = latency.sample(&endpoints, crate::now_ms(), read_path);
                    if let Ok(mut capture) = shared.capture.lock() {
                        capture.network_latency = network_latency;
                        capture.game_connections = endpoints.len();
                        capture.game_processes = refreshed.processes;
                        capture.missed_packets = totals.missed.saturating_add(current.missed);
                        capture.stream_warnings = totals.warnings.saturating_add(current.warnings);
                        capture.largest_warning_packet =
                            totals.largest_packet.max(current.largest_packet);
                        if endpoints.is_empty() || session_changed {
                            capture.last_packet_at_ms = None;
                        }
                        capture.status = if active.is_some() {
                            "capturing"
                        } else {
                            "waiting"
                        }
                        .into();
                        capture.detail = if refreshed.processes == 0 {
                            "Windows capture ready; waiting for AION2 to open"
                        } else if endpoints.is_empty() {
                            "AION2 is running; waiting for a supported game TCP connection"
                        } else if capture
                            .last_packet_at_ms
                            .is_none_or(|last| crate::now_ms().saturating_sub(last) > 5000)
                        {
                            "AION2 TCP connection detected; waiting for incoming game traffic"
                        } else {
                            "Windows native capture active; receiving AION2 TCP traffic"
                        }
                        .into();
                        let warning = if current.warning != 0 {
                            current.warning
                        } else {
                            totals.warning
                        };
                        if warning != 0 {
                            let detail = format!(
                                "; stream warning {warning} ({} packets omitted; largest {} bytes)",
                                capture.stream_warnings, capture.largest_warning_packet
                            );
                            capture.detail.push_str(&detail);
                        }
                    }
                }
                if let Some(stream) = active.as_mut() {
                    if let Ok(packet) = stream.receiver.recv_timeout(Duration::from_millis(100)) {
                        deliver_packet(shared, packet, &mut stream.applied_epoch);
                    }
                } else {
                    std::thread::sleep(Duration::from_millis(100));
                }
            }
            Ok(())
        })();
        // Both normal shutdown and every failure preserve accepted queued data
        // before failed() closes/archives the engine's connection state.
        let previous = active
            .take()
            .map(|stream| close_active(stream, shared))
            .unwrap_or_default();
        if let Ok(mut capture) = shared.capture.lock() {
            capture.missed_packets = totals.missed.saturating_add(previous.missed);
            capture.stream_warnings = totals.warnings.saturating_add(previous.warnings);
            capture.largest_warning_packet = totals.largest_packet.max(previous.largest_packet);
            capture.network_latency = NetworkLatency {
                status: "stopped".into(),
                ..NetworkLatency::default()
            };
        }
        result
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        const TEST_CLOCK_MS: u64 = 1_791_931_200_000;

        fn test_connection(port: u16) -> Connection {
            Connection {
                local: [192, 0, 2, 3],
                local_port: port,
                remote: [198, 51, 100, 9],
                remote_port: 7777,
            }
        }

        fn path(count: u32, rtt: u32) -> PathReading {
            PathReading {
                count,
                smoothed_ms: rtt,
                latest_ms: rtt + 4,
                variation_ms: 2,
            }
        }

        #[test]
        fn latency_requires_an_advancing_os_sample_and_expires_without_new_samples() {
            let endpoints = HashSet::from([test_connection(50_000)]);
            let mut monitor = LatencyMonitor::default();
            let baseline = monitor.sample(&endpoints, 1_000, |_| Ok(path(40, 81)));
            assert_eq!(baseline.status, "collecting");
            assert_eq!(baseline.rtt_ms, None);
            let fresh = monitor.sample(&endpoints, 2_000, |_| Ok(path(41, 83)));
            assert_eq!(fresh.status, "ready");
            assert_eq!(fresh.rtt_ms, Some(83));
            assert_eq!(fresh.latest_rtt_ms, Some(87));
            assert_eq!(fresh.variation_ms, Some(2));
            assert_eq!(fresh.observed_at_ms, Some(2_000));
            assert_eq!(fresh.measured_connections, 1);
            let unchanged = monitor.sample(&endpoints, 6_999, |_| Ok(path(41, 110)));
            assert_eq!(unchanged.rtt_ms, Some(83));
            assert_eq!(unchanged.observed_at_ms, Some(2_000));
            let stale = monitor.sample(&endpoints, 7_001, |_| Ok(path(41, 110)));
            assert_eq!(stale.status, "stale");
            assert_eq!(stale.rtt_ms, None);
            assert_eq!(stale.measured_connections, 0);
            assert_eq!(stale.observed_at_ms, Some(2_000));
            let resumed = monitor.sample(&endpoints, 8_000, |_| Ok(path(42, 80)));
            assert_eq!(resumed.rtt_ms, Some(80));
        }

        #[test]
        fn latency_uses_worst_active_owned_connection_and_drops_removed_tuples() {
            let slow = test_connection(50_001);
            let fast = test_connection(50_000);
            let mut endpoints = HashSet::from([slow.clone(), fast.clone()]);
            let mut monitor = LatencyMonitor::default();
            monitor.sample(&endpoints, 1_000, |_| Ok(path(1, 20)));
            let measured = monitor.sample(&endpoints, 2_000, |endpoint| {
                Ok(path(2, if endpoint == &slow { 99 } else { 20 }))
            });
            assert_eq!(measured.rtt_ms, Some(99));
            assert_eq!(measured.measured_connections, 2);
            assert_eq!(measured.game_connections, 2);
            endpoints.remove(&slow);
            let after_close = monitor.sample(&endpoints, 3_000, |_| Ok(path(3, 21)));
            assert_eq!(after_close.rtt_ms, Some(21));
            assert_eq!(monitor.paths.len(), 1);
            let serialized = serde_json::to_string(&after_close).unwrap();
            assert!(!serialized.contains("198.51.100.9"));
            assert!(!serialized.contains("50000"));
            assert_eq!(after_close.selection, "worst-active-game-tcp");
            let empty = monitor.sample(&HashSet::new(), 4_000, |_| unreachable!());
            assert_eq!(empty.status, "waiting");
            assert_eq!(empty.rtt_ms, None);
            assert!(monitor.paths.is_empty());
        }

        #[test]
        fn latency_never_reuses_unreadable_or_reset_statistics() {
            let endpoints = HashSet::from([test_connection(50_000)]);
            let mut monitor = LatencyMonitor::default();
            monitor.sample(&endpoints, 1_000, |_| Ok(path(7, 81)));
            monitor.sample(&endpoints, 2_000, |_| Ok(path(8, 81)));
            let denied = monitor.sample(&endpoints, 3_000, |_| Err(5));
            assert_eq!(denied.status, "unavailable");
            assert_eq!(denied.error_code.as_deref(), Some("win32:5"));
            assert_eq!(denied.rtt_ms, None);
            let restarted = monitor.sample(&endpoints, 4_000, |_| Ok(path(9, 80)));
            assert_eq!(restarted.status, "collecting");
            assert_eq!(restarted.rtt_ms, None);
            monitor.sample(&endpoints, 5_000, |_| Ok(path(10, 80)));
            let reset = monitor.sample(&endpoints, 6_000, |_| Ok(path(1, 79)));
            assert_eq!(reset.status, "collecting");
            assert_eq!(reset.rtt_ms, None);
            let bad = monitor.sample(&endpoints, 7_000, |_| Ok(path(2, u32::MAX - 4)));
            assert_eq!(bad.status, "unavailable");
            assert_eq!(bad.rtt_ms, None);
            assert_eq!(bad.error_code.as_deref(), Some("win32:13"));
        }

        #[test]
        fn latency_counter_wrap_and_zero_millisecond_samples_are_supported() {
            let endpoints = HashSet::from([test_connection(50_000)]);
            let mut monitor = LatencyMonitor::default();
            monitor.sample(&endpoints, 1_000, |_| Ok(path(u32::MAX, 1)));
            let wrapped = monitor.sample(&endpoints, 2_000, |_| Ok(path(0, 0)));
            assert_eq!(wrapped.rtt_ms, Some(0));
            assert_eq!(wrapped.status, "ready");
            let backward_clock = monitor.sample(&endpoints, 1_900, |_| Ok(path(0, 0)));
            assert_eq!(backward_clock.rtt_ms, None);
        }

        fn filetime(at_ms: u64) -> i64 {
            (at_ms * 10_000 + 116_444_736_000_000_000) as i64
        }

        fn observed_hit_packet(sequence: u32) -> Vec<u8> {
            let payload: Vec<_> = "0438e9de020600c80b9147ff003f02020002aff4b76301000000e4506a0100"
                .as_bytes()
                .chunks_exact(2)
                .map(|pair| u8::from_str_radix(std::str::from_utf8(pair).unwrap(), 16).unwrap())
                .collect();
            let mut frame = vec![(payload.len() + 4) as u8];
            frame.extend(payload);
            let mut bytes = vec![0u8; 40];
            bytes[0] = 0x45;
            bytes[2..4].copy_from_slice(&((40 + frame.len()) as u16).to_be_bytes());
            bytes[9] = 6;
            bytes[12..16].copy_from_slice(&[198, 51, 100, 9]);
            bytes[16..20].copy_from_slice(&[192, 0, 2, 3]);
            bytes[20..22].copy_from_slice(&7777u16.to_be_bytes());
            bytes[22..24].copy_from_slice(&50000u16.to_be_bytes());
            bytes[24..28].copy_from_slice(&sequence.to_be_bytes());
            bytes[32] = 0x50;
            bytes[33] = 0x18;
            bytes.extend(frame);
            bytes
        }

        fn own_engine() -> luma_engine::MeterEngine {
            let mut engine = luma_engine::MeterEngine::default();
            engine.ingest_event(
                luma_engine::packets::Event::Identity {
                    id: 1480,
                    name: "Player".into(),
                    class: None,
                    own: true,
                },
                TEST_CLOCK_MS,
            );
            engine
        }

        fn test_shared(engine: luma_engine::MeterEngine) -> crate::Shared {
            crate::Shared {
                engine: std::sync::Mutex::new(engine),
                preferences: std::sync::Mutex::new(crate::Preferences::default()),
                capture: std::sync::Mutex::new(super::super::CaptureStatus::default()),
                data_dir: std::path::PathBuf::new(),
                stopping: AtomicBool::new(false),
                panel_open: AtomicBool::new(false),
                panel_restore: std::sync::Mutex::new(None),
                size_transition_until: AtomicU64::new(0),
                settings_write: std::sync::Mutex::new(()),
                history_write: std::sync::Mutex::new(()),
                history_saved_revision: AtomicU64::new(0),
                history_storage_error: std::sync::Mutex::new(String::new()),
                preference_change: std::sync::Mutex::new(()),
                geometry_save_due: AtomicU64::new(0),
                capture_worker: std::sync::Mutex::new(None),
                obs: std::sync::Mutex::new(None),
                calendar: std::sync::Mutex::new(None),
            }
        }

        fn callback_ip(context: &mut CallbackContext, ip: &[u8]) {
            let offset = size_of::<Metadata>();
            let mut memory = vec![0u8; offset + ip.len()];
            let metadata = Metadata {
                packet_type: 3,
                ..unsafe { std::mem::zeroed() }
            };
            unsafe {
                ptr::write_unaligned(memory.as_mut_ptr().cast::<Metadata>(), metadata);
            }
            memory[offset..].copy_from_slice(ip);
            let descriptor = DataDescriptor {
                data: memory.as_ptr().cast(),
                data_size: memory.len() as u32,
                metadata_offset: 0,
                packet_offset: offset as u32,
                packet_length: ip.len() as u32,
                missed_write: 0,
                missed_read: 0,
            };
            unsafe {
                on_data((context as *mut CallbackContext).cast(), &descriptor);
            }
        }

        fn pet_packet(sequence: u32, record: &[u8]) -> Vec<u8> {
            let mut packet = observed_hit_packet(sequence);
            packet.truncate(40);
            packet.push((record.len() + 4) as u8);
            packet.extend(record);
            let length = packet.len() as u16;
            packet[2..4].copy_from_slice(&length.to_be_bytes());
            packet
        }

        #[test]
        fn live_constraint_addition_and_removal_preserve_real_pet_baseline_without_false_gap() {
            let primary = test_connection(50_000);
            let auxiliary = test_connection(50_001);
            let (sender, receiver) = sync_channel(8);
            let mut context = CallbackContext::new(sender, HashSet::from([primary.clone()]));
            let mut installed = HashSet::from([primary.clone()]);
            let shared = test_shared(own_engine());
            let inventory = [
                0, 0x90, 0, 0, 0, 0, 1, 0x12, 4, 0, 0, 0x12, 4, 0, 0, 2, 0, 0, 0, 1, 0x12, 4, 0, 0,
                32, 0, 0, 0,
            ];
            let gain = [0x0d, 0x90, 1, 0x12, 4, 0, 0, 1, 0, 0, 0];
            let first = pet_packet(100, &inventory);
            callback_ip(&mut context, &first);
            let mut epoch = 0;
            deliver_packet(&shared, receiver.try_recv().unwrap(), &mut epoch);
            let requested = HashSet::from([primary.clone(), auxiliary.clone()]);
            let mut additions = 0;
            assert!(refresh_constraints(
                &context.endpoints,
                &mut installed,
                &requested,
                |row, index| {
                    // The OS may invoke its callback immediately; the ownership
                    // lock must already be released and the new owner published.
                    let owned = context.endpoints.try_read().unwrap();
                    assert!(owned.contains(row));
                    assert_eq!(index, 1);
                    additions += 1;
                    Ok(())
                }
            )
            .ok()
            .unwrap());
            assert_eq!(additions, 1);
            let next = 100 + first.len() as u32 - 40;
            let second = pet_packet(next, &gain);
            callback_ip(&mut context, &second);
            deliver_packet(&shared, receiver.try_recv().unwrap(), &mut epoch);
            assert!(refresh_constraints(
                &context.endpoints,
                &mut installed,
                &HashSet::from([primary]),
                |_, _| panic!("removals do not add filters")
            )
            .ok()
            .unwrap());
            callback_ip(
                &mut context,
                &pet_packet(next + second.len() as u32 - 40, &gain),
            );
            deliver_packet(&shared, receiver.try_recv().unwrap(), &mut epoch);
            let mut engine = shared.engine.lock().unwrap();
            let pets = engine.character_snapshot().pet_progress.unwrap();
            assert_eq!(pets.continuity, luma_engine::character::PetContinuity::Live);
            assert_eq!(pets.pets[0].progress, Some(34));
            assert!(!pets.pets[0].progress_stale);
            assert_eq!(
                engine.live_state(crate::now_ms()).diagnostics.stream_gaps,
                0
            );
            assert_eq!(
                engine.live_state(crate::now_ms()).diagnostics.tcp_packets,
                3
            );
            assert_eq!(shared.capture.lock().unwrap().packets, 3);
            assert_eq!(context.loss_epoch.load(Ordering::Acquire), 0);
        }

        #[test]
        fn retired_kernel_tuple_is_blocked_until_current_game_ownership_returns() {
            let primary = test_connection(50_000);
            let other = test_connection(50_001);
            let (sender, receiver) = sync_channel(8);
            let mut context =
                CallbackContext::new(sender, HashSet::from([primary.clone(), other.clone()]));
            let mut installed = HashSet::from([primary.clone(), other.clone()]);
            let bytes = observed_hit_packet(100);
            callback_ip(&mut context, &bytes);
            assert!(receiver.try_recv().is_ok());
            assert!(refresh_constraints(
                &context.endpoints,
                &mut installed,
                &HashSet::from([other.clone()]),
                |_, _| panic!("cached filters are retained")
            )
            .ok()
            .unwrap());
            // The old exact filter can match a tuple reused by another process.
            // The current AION2 ownership gate must reject it before queueing.
            callback_ip(&mut context, &bytes);
            assert!(receiver.try_recv().is_err());
            assert!(installed.contains(&primary));
            assert!(refresh_constraints(
                &context.endpoints,
                &mut installed,
                &HashSet::from([primary, other]),
                |_, _| panic!("re-owned exact tuple needs no duplicate filter")
            )
            .ok()
            .unwrap());
            callback_ip(&mut context, &bytes);
            assert!(receiver.try_recv().is_ok());
            assert_eq!(installed.len(), 2);
        }

        #[test]
        fn full_filter_cache_requests_filtered_recreation_without_more_kernel_additions() {
            let mut installed: HashSet<_> = (0..MAX_CAPTURE_CONSTRAINTS)
                .map(|index| test_connection(40_000 + index as u16))
                .collect();
            let current = RwLock::new(installed.clone());
            let requested = HashSet::from([test_connection(50_000)]);
            assert!(
                !refresh_constraints(&current, &mut installed, &requested, |_, _| panic!(
                    "cache cap must be checked before the OS call"
                ))
                .ok()
                .unwrap()
            );
            assert_eq!(installed.len(), MAX_CAPTURE_CONSTRAINTS);
            assert!(*current.read().unwrap() == requested);
            let empty = HashSet::new();
            assert!(
                !refresh_constraints(&current, &mut installed, &empty, |_, _| panic!(
                    "never add an unfiltered session"
                ))
                .ok()
                .unwrap()
            );
            assert!(current.read().unwrap().is_empty());
        }

        #[test]
        fn failed_live_addition_requests_recreation_and_never_installs_the_failed_filter() {
            let first = test_connection(50_000);
            let second = test_connection(50_001);
            let current = RwLock::new(HashSet::from([first.clone()]));
            let mut installed = HashSet::from([first.clone()]);
            let requested = HashSet::from([first.clone(), second.clone()]);
            let result = refresh_constraints(&current, &mut installed, &requested, |row, _| {
                assert!(*row == second);
                assert!(current.try_read().unwrap().contains(row));
                Err(CaptureFailure::from("simulated live constraint failure"))
            });
            assert!(!result.unwrap_or(false)); // the run loop's filtered-recreate fallback
            assert!(installed == HashSet::from([first]));
            assert!(*current.read().unwrap() == requested);
        }

        #[test]
        fn documented_filetime_preserves_real_packet_time_and_millisecond_precision() {
            let reported_ms = TEST_CLOCK_MS - 45;
            assert_eq!(
                packet_timestamp_ms(filetime(reported_ms) + 9_999, TEST_CLOCK_MS),
                reported_ms
            );
            assert_eq!(
                packet_timestamp_ms(filetime(TEST_CLOCK_MS), TEST_CLOCK_MS),
                TEST_CLOCK_MS
            );
        }

        #[test]
        fn invalid_old_or_future_metadata_uses_callback_time_without_poisoning_the_clock() {
            for timestamp in [
                i64::MIN,
                -1,
                0,
                116_444_736_000_000_000,
                TEST_CLOCK_MS as i64,
                filetime(TEST_CLOCK_MS - 60_001),
                filetime(TEST_CLOCK_MS + 1),
                filetime(TEST_CLOCK_MS + 300_000),
                i64::MAX,
            ] {
                assert_eq!(packet_timestamp_ms(timestamp, TEST_CLOCK_MS), TEST_CLOCK_MS);
            }
            assert_eq!(
                packet_timestamp_ms(filetime(TEST_CLOCK_MS - 60_000), TEST_CLOCK_MS),
                TEST_CLOCK_MS - 60_000
            );
        }

        #[test]
        fn corrupt_future_metadata_cannot_turn_total_damage_into_personal_or_group_dps() {
            // The invalid timestamp observed in local 0.9.1 records, without any
            // packet, player or endpoint information from those records.
            const INVALID_TIMESTAMP: i64 = 5_617_301_119_262_100_000;
            let mut engine = own_engine();
            let mut sequence = 100;
            for offset in [0, 1_000, 2_000] {
                let packet = observed_hit_packet(sequence);
                sequence += (packet.len() - 40) as u32;
                let at = packet_timestamp_ms(INVALID_TIMESTAMP, TEST_CLOCK_MS + offset);
                engine.ingest_tcp(&packet, true, at);
            }
            engine.set_party_members(&[1480]).unwrap();
            let state = engine.live_state(TEST_CLOCK_MS + 3_000);
            assert_eq!(state.total_damage, 318);
            assert_eq!(state.elapsed_ms, 3_000);
            assert_eq!(state.dps, 106.0);
            assert_eq!(state.personal_total_damage, Some(318));
            assert_eq!(state.personal_elapsed_ms, 3_000);
            assert_eq!(state.personal_dps, Some(106.0));
            assert_eq!(state.party_total_damage, Some(318));
            assert_eq!(state.party_elapsed_ms, 3_000);
            assert_eq!(state.party_dps, Some(106.0));
            let record = engine.current_record(TEST_CLOCK_MS + 3_000);
            assert_eq!(record.damage_samples[0].timestamp_ms, TEST_CLOCK_MS);
            assert_eq!(record.damage_samples[2].timestamp_ms, TEST_CLOCK_MS + 2_000);
            engine.tick(TEST_CLOCK_MS + 12_000);
            let completed = engine.history_snapshot().1.remove(0);
            assert_eq!(completed.elapsed_ms, 12_000);
            assert_eq!(completed.personal_elapsed_ms, 12_000);
            assert_eq!(completed.personal_dps, Some(26.5));
        }

        #[test]
        fn fallback_packet_clock_keeps_the_training_cutoff_exclusive() {
            const INVALID_TIMESTAMP: i64 = 5_617_301_119_262_100_000;
            let mut engine = own_engine();
            engine.arm_training(60_000).unwrap();
            let mut sequence = 100;
            for offset in [0, 1_000, 59_000, 60_000] {
                let packet = observed_hit_packet(sequence);
                sequence += (packet.len() - 40) as u32;
                engine.ingest_tcp(
                    &packet,
                    true,
                    packet_timestamp_ms(INVALID_TIMESTAMP, TEST_CLOCK_MS + offset),
                );
            }
            let state = engine.live_state(TEST_CLOCK_MS + 60_000);
            assert_eq!(state.training.status, "complete");
            assert_eq!(state.training.total_damage, 318);
            assert_eq!(state.training.dps, 5.3);
            assert_eq!(state.training.remaining_ms, 0);
            assert_eq!(state.training.started_ms, Some(TEST_CLOCK_MS));
        }

        #[test]
        fn upstream_constraint_matches_only_incoming_owned_tuple() {
            let connection = Connection {
                local: [192, 0, 2, 3],
                local_port: 50000,
                remote: [198, 51, 100, 9],
                remote_port: 7777,
            };
            let constraint = incoming_constraint(&connection, 0);
            assert_eq!(constraint.present, 0x1ee0);
            assert_eq!(constraint.transport, 6);
            assert_eq!(unsafe { constraint.ip1.ipv4_bytes }, connection.remote);
            assert_eq!(unsafe { constraint.ip2.ipv4_bytes }, connection.local);
            assert_eq!((constraint.prefix1, constraint.prefix2), (32, 32));
            assert_eq!(constraint.port1, connection.remote_port);
            assert_eq!(constraint.port2, connection.local_port);
            assert_eq!(constraint.name[10], 0);
        }

        #[test]
        fn cumulative_read_misses_do_not_invent_repeated_losses() {
            let (sender, _) = sync_channel(4);
            let context = CallbackContext::new(sender, HashSet::new());
            context.descriptor_loss(2, 3);
            assert_eq!(context.missed.load(Ordering::Relaxed), 5);
            assert_eq!(context.loss_epoch.load(Ordering::Relaxed), 1);
            for _ in 0..100 {
                context.descriptor_loss(0, 3);
            }
            assert_eq!(context.missed.load(Ordering::Relaxed), 5);
            assert_eq!(context.loss_epoch.load(Ordering::Relaxed), 1);
            context.descriptor_loss(1, 4);
            assert_eq!(context.missed.load(Ordering::Relaxed), 7);
            assert_eq!(context.loss_epoch.load(Ordering::Relaxed), 2);
            context
                .previous_read_misses
                .store(u32::MAX, Ordering::Relaxed);
            context.descriptor_loss(0, 0);
            assert_eq!(context.missed.load(Ordering::Relaxed), 8);
        }

        #[test]
        fn oversized_packet_warning_is_recorded_once_before_and_after_descriptor() {
            let (sender, _) = sync_channel(4);
            let mut context = CallbackContext::new(sender, HashSet::new());
            // BOOLEAN IsWarning, DWORD Reason at offset4, UINT64 length at8.
            let information = [(122u64 << 32) | 1, 12000u64];
            unsafe {
                on_event(
                    (&mut context as *mut CallbackContext).cast(),
                    information.as_ptr().cast(),
                    3,
                );
            }
            let before = stream_totals(&context);
            assert_eq!(before.missed, 1);
            assert_eq!(before.warnings, 1);
            assert_eq!(before.warning, 122);
            assert_eq!(before.largest_packet, 12000);
            context.descriptor_loss(0, 1);
            for _ in 0..100 {
                context.descriptor_loss(0, 1);
            }
            let after = stream_totals(&context);
            assert_eq!(after.missed, 1);
            assert_eq!(after.warnings, 1);
        }

        #[test]
        fn queued_packets_before_loss_are_delivered_before_one_post_loss_reset() {
            let (sender, receiver) = sync_channel(8);
            let context = CallbackContext::new(sender, HashSet::new());
            let shared = crate::Shared {
                engine: std::sync::Mutex::new(luma_engine::MeterEngine::default()),
                preferences: std::sync::Mutex::new(crate::Preferences::default()),
                capture: std::sync::Mutex::new(super::super::CaptureStatus::default()),
                data_dir: std::path::PathBuf::new(),
                stopping: AtomicBool::new(false),
                panel_open: AtomicBool::new(false),
                panel_restore: std::sync::Mutex::new(None),
                size_transition_until: AtomicU64::new(0),
                settings_write: std::sync::Mutex::new(()),
                history_write: std::sync::Mutex::new(()),
                history_saved_revision: AtomicU64::new(0),
                history_storage_error: std::sync::Mutex::new(String::new()),
                preference_change: std::sync::Mutex::new(()),
                geometry_save_due: AtomicU64::new(0),
                capture_worker: std::sync::Mutex::new(None),
                obs: std::sync::Mutex::new(None),
                calendar: std::sync::Mutex::new(None),
            };
            let mut bytes = vec![0u8; 40];
            bytes[0] = 0x45;
            bytes[2..4].copy_from_slice(&40u16.to_be_bytes());
            bytes[9] = 6;
            bytes[20..22].copy_from_slice(&7777u16.to_be_bytes());
            bytes[22..24].copy_from_slice(&50000u16.to_be_bytes());
            bytes[32] = 0x50;
            for index in 0..4 {
                if index == 2 {
                    context.descriptor_loss(0, 1);
                }
                context
                    .sender
                    .try_send(Packet {
                        bytes: bytes.clone(),
                        timestamp_ms: 1000 + index,
                        loss_epoch: context.loss_epoch.load(Ordering::Acquire),
                    })
                    .ok()
                    .unwrap();
                // Later descriptors repeat the same absolute read count.
                if index >= 2 {
                    context.descriptor_loss(0, 1);
                }
            }
            let mut epoch = 0;
            for index in 0..4 {
                let packet = receiver.try_recv().unwrap();
                assert_eq!(packet.loss_epoch, if index < 2 { 0 } else { 1 });
                deliver_packet(&shared, packet, &mut epoch);
                let state = shared.engine.lock().unwrap().live_state(2000);
                assert_eq!(state.diagnostics.stream_gaps, u64::from(index >= 2));
            }
            assert_eq!(shared.capture.lock().unwrap().packets, 4);
            assert_eq!(
                shared
                    .engine
                    .lock()
                    .unwrap()
                    .live_state(2000)
                    .diagnostics
                    .tcp_packets,
                4
            );
            assert_eq!(context.missed.load(Ordering::Relaxed), 1);
        }

        #[test]
        fn win64_packet_monitor_abi_layouts() {
            assert_eq!(size_of::<Metadata>(), 48);
            assert_eq!(size_of::<DataDescriptor>(), 32);
            assert_eq!(size_of::<StreamConfiguration>(), 32);
            assert_eq!(size_of::<ProtocolConstraint>(), 216);
            assert_eq!(std::mem::align_of::<IpAddress>(), 8);
            assert_eq!(std::mem::offset_of!(ProtocolConstraint, present), 128);
            assert_eq!(std::mem::offset_of!(ProtocolConstraint, transport), 150);
            assert_eq!(std::mem::offset_of!(ProtocolConstraint, ip1), 152);
            assert_eq!(std::mem::offset_of!(ProtocolConstraint, ip2), 168);
            assert_eq!(std::mem::offset_of!(ProtocolConstraint, port1), 186);
            assert_eq!(std::mem::offset_of!(ProtocolConstraint, port2), 188);
        }
        #[test]
        fn network_layer_rejects_truncation_fragments_and_other_protocols() {
            let mut ip = vec![0u8; 40];
            ip[0] = 0x45;
            ip[2..4].copy_from_slice(&40u16.to_be_bytes());
            ip[9] = 6;
            assert_eq!(ipv4_packet(&ip, 3), Some(ip.as_slice()));
            assert!(ipv4_packet(&ip[..39], 3).is_none());
            ip[6] = 0x20;
            assert!(ipv4_packet(&ip, 3).is_none());
            ip[6] = 0;
            ip[9] = 17;
            assert!(ipv4_packet(&ip, 3).is_none());
        }
        #[test]
        fn ethernet_vlan_preserves_complete_ipv4_packet() {
            let mut frame = vec![0u8; 58];
            frame[12..14].copy_from_slice(&0x8100u16.to_be_bytes());
            frame[16..18].copy_from_slice(&0x0800u16.to_be_bytes());
            frame[18] = 0x45;
            frame[20..22].copy_from_slice(&40u16.to_be_bytes());
            frame[27] = 6;
            assert_eq!(ipv4_packet(&frame, 1), Some(&frame[18..]));
        }
        #[test]
        fn callback_queues_only_incoming_owned_game_flow() {
            let (sender, receiver) = sync_channel(4);
            let mut endpoints = HashSet::new();
            endpoints.insert(Connection {
                local: [192, 0, 2, 3],
                local_port: 50000,
                remote: [198, 51, 100, 9],
                remote_port: 7777,
            });
            let mut context = CallbackContext::new(sender, endpoints);
            let mut memory = vec![0u8; size_of::<Metadata>() + 40];
            let metadata: Metadata = unsafe { std::mem::zeroed() };
            unsafe {
                ptr::write_unaligned(
                    memory.as_mut_ptr().cast::<Metadata>(),
                    Metadata {
                        packet_type: 3,
                        timestamp: 5_617_301_119_262_100_000,
                        ..metadata
                    },
                );
            }
            let offset = size_of::<Metadata>();
            memory[offset] = 0x45;
            memory[offset + 2..offset + 4].copy_from_slice(&40u16.to_be_bytes());
            memory[offset + 9] = 6;
            memory[offset + 12..offset + 16].copy_from_slice(&[198, 51, 100, 9]);
            memory[offset + 16..offset + 20].copy_from_slice(&[192, 0, 2, 3]);
            memory[offset + 20..offset + 22].copy_from_slice(&7777u16.to_be_bytes());
            memory[offset + 22..offset + 24].copy_from_slice(&50000u16.to_be_bytes());
            let descriptor = DataDescriptor {
                data: memory.as_ptr().cast(),
                data_size: memory.len() as u32,
                metadata_offset: 0,
                packet_offset: offset as u32,
                packet_length: 40,
                missed_write: 0,
                missed_read: 0,
            };
            let received_after = crate::now_ms();
            unsafe {
                on_data((&mut context as *mut CallbackContext).cast(), &descriptor);
            }
            let packet = receiver.try_recv().unwrap();
            assert_eq!(packet.bytes, memory[offset..]);
            assert!(packet.timestamp_ms >= received_after);
            assert!(packet.timestamp_ms <= crate::now_ms());
            // A different local destination is unrelated to the owned process.
            memory[offset + 19] = 4;
            unsafe {
                on_data((&mut context as *mut CallbackContext).cast(), &descriptor);
            }
            assert!(receiver.try_recv().is_err());
            // A valid outgoing owned flow is still excluded from combat input.
            memory[offset + 12..offset + 16].copy_from_slice(&[192, 0, 2, 3]);
            memory[offset + 16..offset + 20].copy_from_slice(&[198, 51, 100, 9]);
            memory[offset + 20..offset + 22].copy_from_slice(&50000u16.to_be_bytes());
            memory[offset + 22..offset + 24].copy_from_slice(&7777u16.to_be_bytes());
            unsafe {
                on_data((&mut context as *mut CallbackContext).cast(), &descriptor);
            }
            assert!(receiver.try_recv().is_err());
        }

        #[test]
        fn stopped_stream_is_reported_even_without_fatal_reason() {
            let (sender, _) = sync_channel(4);
            let mut context = CallbackContext::new(sender, HashSet::new());
            // PACKETMONITOR_STREAM_STOP_INFO_OUT: BOOLEAN, padding, DWORD.
            let information = [0u32, 0u32];
            unsafe {
                on_event(
                    (&mut context as *mut CallbackContext).cast(),
                    information.as_ptr().cast(),
                    1,
                );
            }
            assert!(context.stopped.load(Ordering::Relaxed));
            assert_eq!(context.fatal_error.load(Ordering::Relaxed), 0);
        }

        #[test]
        fn capture_hresult_errors_have_actionable_categories() {
            let denied = check(0x80070005u32 as i32, "PacketMonitorInitialize")
                .err()
                .unwrap();
            assert_eq!(denied.status, "permission-required");
            assert_eq!(denied.code.as_deref(), Some("0x80070005"));
            let unsupported = check(0x8007051Au32 as i32, "PacketMonitorInitialize")
                .err()
                .unwrap();
            assert_eq!(unsupported.status, "api-version-mismatch");
            assert_eq!(unsupported.code.as_deref(), Some("0x8007051A"));
            let operation = check(0x80070032u32 as i32, "PacketMonitorAddCaptureConstraint")
                .err()
                .unwrap();
            assert_eq!(operation.status, "operation-not-supported");
            assert!(operation
                .detail
                .starts_with("PacketMonitorAddCaptureConstraint failed"));
            assert_eq!(
                check(0x8007051Au32 as i32, "PacketMonitorCreateRealtimeStream")
                    .err()
                    .unwrap()
                    .status,
                "error"
            );
            assert!(check(0, "PacketMonitorInitialize").is_ok());
        }

        #[test]
        fn tcp_table_growth_is_retried_without_stopping_capture() {
            let mut calls = 0;
            let rows = read_tcp_table(|buffer, needed| {
                calls += 1;
                match calls {
                    1 => {
                        assert!(buffer.is_null());
                        *needed = 4;
                        122
                    }
                    2 => {
                        assert!(!buffer.is_null());
                        assert_eq!(*needed, 4);
                        *needed = 128;
                        122
                    }
                    3 => {
                        assert_eq!(*needed, 128);
                        unsafe { ptr::write(buffer.cast::<u32>(), 0) };
                        *needed = 4;
                        0
                    }
                    _ => panic!("Unexpected extra TCP table query"),
                }
            })
            .ok()
            .unwrap();
            assert_eq!(calls, 3);
            assert_eq!(rows[0], 0);
            assert!(rows.len() >= 32);
        }
    }
}

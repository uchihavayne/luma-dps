//! Opt-in output audio capture through Windows WASAPI. No microphone is opened.
//! Process loopback isolates the AION2 process tree and requires Windows build 20348+.
//! https://learn.microsoft.com/en-us/samples/microsoft/windows-classic-samples/applicationloopbackaudio-sample/

use std::sync::{atomic::AtomicBool, Arc};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CaptureSource {
    GameProcess,
    SystemOutput,
}

#[derive(Debug)]
pub struct AudioChunk {
    pub sample_rate: u32,
    pub channels: u16,
    pub samples: Vec<f32>,
    pub discontinuity: bool,
    pub native_flags: Option<u32>,
}

fn samples_discontinuous(flags: u32) -> bool {
    // WASAPI's timestamp-error flag concerns timing metadata, not PCM continuity.
    // Only DATA_DISCONTINUITY (0x1) requires restarting spectral history.
    flags & 0x1 != 0
}

pub fn find_game_process() -> Result<Option<u32>, String> {
    #[cfg(windows)]
    {
        native::find_game_process()
    }
    #[cfg(not(windows))]
    {
        Err("Hidden Cube audio capture requires Windows".into())
    }
}

/// Runs on a dedicated worker until cancelled or the device/game disappears.
/// `SystemOutput` is used only when the user explicitly selects that source.
pub fn capture(
    source: CaptureSource,
    stop: Arc<AtomicBool>,
    on_audio: impl FnMut(AudioChunk) + Send,
) -> Result<(), String> {
    #[cfg(windows)]
    {
        native::capture(source, stop, on_audio)
    }
    #[cfg(not(windows))]
    {
        let _ = (source, stop, on_audio);
        Err("Hidden Cube audio capture requires Windows".into())
    }
}

fn is_game_executable(name: &str) -> bool {
    matches!(
        name.to_ascii_lowercase().as_str(),
        "aion2.exe" | "aion2-win64-shipping.exe" | "aion2_client.exe"
    )
}

#[derive(Clone, Copy, Debug)]
struct ProcessInfo {
    pid: u32,
    parent_pid: u32,
    game: bool,
}

fn select_game_root(processes: &[ProcessInfo]) -> Result<Option<u32>, String> {
    use std::collections::{HashMap, HashSet};
    let mut by_pid = HashMap::with_capacity(processes.len());
    for process in processes {
        if by_pid.insert(process.pid, process).is_some() {
            return Err(
                "Cannot identify AION2 audio: duplicate process IDs in the snapshot".into(),
            );
        }
        if process.game && process.pid == 0 {
            return Err("Cannot identify AION2 audio: invalid game process ID".into());
        }
    }
    let mut roots = Vec::new();
    for process in processes.iter().filter(|process| process.game) {
        let mut visited = HashSet::from([process.pid]);
        let mut parent = process.parent_pid;
        let mut game_ancestor = false;
        let mut depth = 0;
        while parent != 0 {
            if depth >= 256 || !visited.insert(parent) {
                return Err(
                    "Cannot identify AION2 audio: invalid or cyclic process ancestry".into(),
                );
            }
            let Some(ancestor) = by_pid.get(&parent) else {
                // A parent can exit before ToolHelp creates the snapshot.
                break;
            };
            game_ancestor |= ancestor.game;
            parent = ancestor.parent_pid;
            depth += 1;
        }
        if !game_ancestor {
            roots.push(process.pid);
        }
    }
    if roots.len() > 1 {
        return Err("Multiple independent AION2 games are running; close the extra game before using Cube audio".into());
    }
    Ok(roots.first().copied())
}

#[derive(Clone, Copy, Debug)]
enum Encoding {
    Float32,
    Pcm(u16),
}

#[derive(Clone, Copy, Debug)]
struct Format {
    rate: u32,
    channels: u16,
    block: usize,
    encoding: Encoding,
}

impl Format {
    fn validate(
        rate: u32,
        channels: u16,
        bits: u16,
        floating: bool,
        block: u16,
    ) -> Result<Self, String> {
        if !(8_000..=192_000).contains(&rate)
            || !(1..=8).contains(&channels)
            || !matches!(bits, 8 | 16 | 24 | 32)
            || (floating && bits != 32)
            || block as usize != channels as usize * (bits as usize / 8)
        {
            return Err("Output device has an unsupported or invalid audio format".into());
        }
        Ok(Self {
            rate,
            channels,
            block: block as usize,
            encoding: if floating {
                Encoding::Float32
            } else {
                Encoding::Pcm(bits)
            },
        })
    }

    /// Stereo is preserved. Surround is averaged to mono deliberately: channel
    /// layouts, binaural processing and speaker masks cannot establish a reliable
    /// left/right Cube direction, so a multichannel input never claims one.
    fn samples(self, data: &[u8], frames: u32, silent: bool) -> Result<Vec<f32>, String> {
        if frames as usize > self.rate as usize * 2 {
            return Err("Output audio packet exceeds the two-second safety limit".into());
        }
        let output_channels = if self.channels > 2 { 1 } else { self.channels };
        let count = frames as usize * output_channels as usize;
        if silent {
            return Ok(vec![0.0; count]);
        }
        let bytes = frames as usize * self.block;
        if data.len() != bytes {
            return Err("Output audio packet has an invalid byte length".into());
        }
        let width = self.block / self.channels as usize;
        let mut result = Vec::with_capacity(count);
        for frame in data.chunks_exact(self.block) {
            let mut mono = 0.0;
            for sample in frame.chunks_exact(width) {
                let value = match self.encoding {
                    Encoding::Float32 => f32::from_le_bytes(sample.try_into().unwrap()),
                    Encoding::Pcm(8) => (sample[0] as f32 - 128.0) / 128.0,
                    Encoding::Pcm(16) => {
                        i16::from_le_bytes(sample.try_into().unwrap()) as f32 / 32_768.0
                    }
                    Encoding::Pcm(24) => {
                        let raw = i32::from_le_bytes([
                            sample[0],
                            sample[1],
                            sample[2],
                            if sample[2] & 0x80 != 0 { 0xff } else { 0 },
                        ]);
                        raw as f32 / 8_388_608.0
                    }
                    Encoding::Pcm(32) => {
                        i32::from_le_bytes(sample.try_into().unwrap()) as f32 / 2_147_483_648.0
                    }
                    Encoding::Pcm(_) => unreachable!(),
                };
                let value = if value.is_finite() {
                    value.clamp(-1.0, 1.0)
                } else {
                    0.0
                };
                if self.channels <= 2 {
                    result.push(value);
                } else {
                    mono += value;
                }
            }
            if self.channels > 2 {
                result.push(mono / self.channels as f32);
            }
        }
        Ok(result)
    }
}

#[cfg(windows)]
mod native {
    use super::*;
    use std::{
        marker::PhantomData,
        mem::{size_of, ManuallyDrop},
        sync::{atomic::Ordering, mpsc, Mutex},
        time::{Duration, Instant},
    };
    use windows::{
        core::{implement, Interface, Ref, HRESULT},
        Win32::{
            Foundation::{CloseHandle, ERROR_NO_MORE_FILES, HANDLE},
            Media::Audio::*,
            System::{
                Com::{
                    CoCreateInstance, CoInitializeEx, CoTaskMemFree, CoUninitialize,
                    StructuredStorage::{
                        PROPVARIANT, PROPVARIANT_0, PROPVARIANT_0_0, PROPVARIANT_0_0_0,
                    },
                    BLOB, CLSCTX_ALL, COINIT_MULTITHREADED,
                },
                Diagnostics::ToolHelp::{
                    CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
                    TH32CS_SNAPPROCESS,
                },
                Variant::VT_BLOB,
            },
        },
    };

    struct Com;
    impl Drop for Com {
        fn drop(&mut self) {
            unsafe { CoUninitialize() }
        }
    }
    struct OwnedHandle(HANDLE);
    impl Drop for OwnedHandle {
        fn drop(&mut self) {
            unsafe {
                let _ = CloseHandle(self.0);
            }
        }
    }
    struct MixFormat(*mut WAVEFORMATEX);
    impl Drop for MixFormat {
        fn drop(&mut self) {
            unsafe {
                CoTaskMemFree(Some(self.0.cast()));
            }
        }
    }
    struct RunningClient<'a>(&'a IAudioClient);
    impl Drop for RunningClient<'_> {
        fn drop(&mut self) {
            unsafe {
                let _ = self.0.Stop();
            }
        }
    }
    struct Packet<'a> {
        capture: &'a IAudioCaptureClient,
        frames: u32,
    }
    impl Drop for Packet<'_> {
        fn drop(&mut self) {
            unsafe {
                let _ = self.capture.ReleaseBuffer(self.frames);
            }
        }
    }

    pub fn find_game_process() -> Result<Option<u32>, String> {
        unsafe {
            let snapshot = OwnedHandle(
                CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0)
                    .map_err(|e| format!("Cannot identify AION2 process: {e}"))?,
            );
            let mut entry = PROCESSENTRY32W {
                dwSize: size_of::<PROCESSENTRY32W>() as u32,
                ..Default::default()
            };
            match Process32FirstW(snapshot.0, &mut entry) {
                Ok(()) => {}
                Err(e) if e.code() == HRESULT::from_win32(ERROR_NO_MORE_FILES.0) => {
                    return Ok(None)
                }
                Err(e) => return Err(format!("Cannot list game processes: {e}")),
            }
            let mut processes = Vec::new();
            loop {
                let length = entry
                    .szExeFile
                    .iter()
                    .position(|x| *x == 0)
                    .unwrap_or(entry.szExeFile.len());
                processes.push(ProcessInfo {
                    pid: entry.th32ProcessID,
                    parent_pid: entry.th32ParentProcessID,
                    game: is_game_executable(&String::from_utf16_lossy(&entry.szExeFile[..length])),
                });
                match Process32NextW(snapshot.0, &mut entry) {
                    Ok(()) => {}
                    Err(e) if e.code() == HRESULT::from_win32(ERROR_NO_MORE_FILES.0) => break,
                    Err(e) => return Err(format!("Cannot continue game process enumeration: {e}")),
                }
            }
            // AION2 may launch another recognized AION2 executable. The process
            // loopback API already includes descendants, so capture the common
            // recognized root rather than treating its children as extra games.
            select_game_root(&processes)
        }
    }

    #[implement(IActivateAudioInterfaceCompletionHandler)]
    struct Completion {
        sender: Mutex<Option<mpsc::Sender<()>>>,
        _params: Arc<AUDIOCLIENT_ACTIVATION_PARAMS>,
    }
    impl IActivateAudioInterfaceCompletionHandler_Impl for Completion_Impl {
        fn ActivateCompleted(
            &self,
            _: Ref<'_, IActivateAudioInterfaceAsyncOperation>,
        ) -> windows::core::Result<()> {
            if let Ok(mut sender) = self.sender.lock() {
                if let Some(sender) = sender.take() {
                    let _ = sender.send(());
                }
            }
            Ok(())
        }
    }

    struct BorrowedActivation<'a> {
        variant: ManuallyDrop<PROPVARIANT>,
        _data: PhantomData<&'a AUDIOCLIENT_ACTIVATION_PARAMS>,
    }

    impl<'a> BorrowedActivation<'a> {
        fn new(params: &'a AUDIOCLIENT_ACTIVATION_PARAMS) -> Self {
            // windows-rs implements Drop for PROPVARIANT by calling
            // PropVariantClear. This VT_BLOB borrows Rust-owned data; wrapping
            // the entire variant prevents COM from freeing the borrowed pointer.
            Self {
                variant: ManuallyDrop::new(PROPVARIANT {
                    Anonymous: PROPVARIANT_0 {
                        Anonymous: ManuallyDrop::new(PROPVARIANT_0_0 {
                            vt: VT_BLOB,
                            Anonymous: PROPVARIANT_0_0_0 {
                                blob: BLOB {
                                    cbSize: size_of::<AUDIOCLIENT_ACTIVATION_PARAMS>() as u32,
                                    pBlobData: params as *const _ as *mut u8,
                                },
                            },
                            ..Default::default()
                        }),
                    },
                }),
                _data: PhantomData,
            }
        }

        fn as_ptr(&self) -> *const PROPVARIANT {
            &*self.variant
        }
    }

    fn process_client(pid: u32, stop: &AtomicBool) -> Result<Option<IAudioClient>, String> {
        unsafe {
            let params = Arc::new(AUDIOCLIENT_ACTIVATION_PARAMS {
                ActivationType: AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK,
                Anonymous: AUDIOCLIENT_ACTIVATION_PARAMS_0 {
                    ProcessLoopbackParams: AUDIOCLIENT_PROCESS_LOOPBACK_PARAMS {
                        TargetProcessId: pid,
                        ProcessLoopbackMode: PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE,
                    },
                },
            });
            // Windows marshals the borrowed blob during activation. The callback
            // retains another Arc until completion, including after cancellation.
            let variant = BorrowedActivation::new(&params);
            let (sender, receiver) = mpsc::channel();
            let handler: IActivateAudioInterfaceCompletionHandler = Completion {
                sender: Mutex::new(Some(sender)),
                _params: params.clone(),
            }
            .into();
            let operation = ActivateAudioInterfaceAsync(
                VIRTUAL_AUDIO_DEVICE_PROCESS_LOOPBACK,
                &IAudioClient::IID,
                Some(variant.as_ptr()),
                &handler,
            )
            .map_err(|e| {
                format!(
                    "AION2-only audio is unavailable (requires Windows build 20348 or later): {e}"
                )
            })?;
            let deadline = Instant::now() + Duration::from_secs(10);
            loop {
                if stop.load(Ordering::Acquire) {
                    return Ok(None);
                }
                match receiver.recv_timeout(Duration::from_millis(30)) {
                    Ok(()) => break,
                    Err(mpsc::RecvTimeoutError::Timeout) if Instant::now() < deadline => {}
                    _ => {
                        return Err(
                            "Windows did not finish activating AION2 audio within ten seconds"
                                .into(),
                        )
                    }
                }
            }
            let mut status = HRESULT(0);
            let mut interface = None;
            operation
                .GetActivateResult(&mut status, &mut interface)
                .map_err(|e| format!("Cannot activate AION2 audio: {e}"))?;
            status.ok().map_err(|e| {
                format!(
                    "AION2-only audio is unavailable (requires Windows build 20348 or later): {e}"
                )
            })?;
            interface
                .ok_or_else(|| "Windows returned no AION2 audio interface".to_string())?
                .cast::<IAudioClient>()
                .map(Some)
                .map_err(|e| format!("Windows returned an unsupported AION2 audio interface: {e}"))
        }
    }

    unsafe fn inspect_format(pointer: *const WAVEFORMATEX) -> Result<Format, String> {
        if pointer.is_null() {
            return Err("Output device returned no audio format".into());
        }
        let format = std::ptr::read_unaligned(pointer);
        let tag = format.wFormatTag;
        let mut floating = tag == 3;
        if tag == 0xfffe {
            if format.cbSize < 22 {
                return Err("Output audio extension is truncated".into());
            }
            let extended = std::ptr::read_unaligned(pointer.cast::<WAVEFORMATEXTENSIBLE>());
            let subtype = extended.SubFormat;
            let pcm = windows::core::GUID::from_u128(0x00000001_0000_0010_8000_00aa00389b71);
            let ieee = windows::core::GUID::from_u128(0x00000003_0000_0010_8000_00aa00389b71);
            if subtype != pcm && subtype != ieee {
                return Err("Output audio codec is unsupported".into());
            }
            floating = subtype == ieee;
        } else if tag != 1 && tag != 3 {
            return Err("Output audio codec is unsupported".into());
        }
        Format::validate(
            format.nSamplesPerSec,
            format.nChannels,
            format.wBitsPerSample,
            floating,
            format.nBlockAlign,
        )
    }

    unsafe fn endpoint_id(device: &IMMDevice) -> Result<String, String> {
        let pointer = device
            .GetId()
            .map_err(|e| format!("Cannot identify the output audio device: {e}"))?;
        if pointer.is_null() {
            return Err("Output audio device returned no identity".into());
        }
        let result = pointer
            .to_string()
            .map_err(|e| format!("Output audio device returned an invalid identity: {e}"));
        CoTaskMemFree(Some(pointer.0.cast()));
        result
    }

    pub fn capture(
        source: CaptureSource,
        stop: Arc<AtomicBool>,
        mut on_audio: impl FnMut(AudioChunk) + Send,
    ) -> Result<(), String> {
        if stop.load(Ordering::Acquire) {
            return Ok(());
        }
        unsafe {
            CoInitializeEx(None, COINIT_MULTITHREADED)
                .ok()
                .map_err(|e| format!("Cannot initialize Windows output audio: {e}"))?;
            let _com = Com;
            let game_pid = if source == CaptureSource::GameProcess {
                Some(find_game_process()?.ok_or_else(|| "AION2 is not running".to_string())?)
            } else {
                None
            };
            let (client, monitored_endpoint) = if let Some(pid) = game_pid {
                match process_client(pid, &stop)? {
                    Some(client) => (client, None),
                    None => return Ok(()),
                }
            } else {
                let enumerator: IMMDeviceEnumerator =
                    CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
                        .map_err(|e| format!("Cannot open Windows output device list: {e}"))?;
                let device = enumerator
                    .GetDefaultAudioEndpoint(eRender, eConsole)
                    .map_err(|e| format!("No default output audio device is available: {e}"))?;
                let identity = endpoint_id(&device)?;
                let client = device
                    .Activate::<IAudioClient>(CLSCTX_ALL, None)
                    .map_err(|e| format!("Cannot activate the selected system output: {e}"))?;
                (client, Some((enumerator, identity)))
            };
            let process_format = WAVEFORMATEX {
                wFormatTag: 1,
                nChannels: 2,
                nSamplesPerSec: 44_100,
                nAvgBytesPerSec: 176_400,
                nBlockAlign: 4,
                wBitsPerSample: 16,
                cbSize: 0,
            };
            let mix = if game_pid.is_none() {
                Some(MixFormat(client.GetMixFormat().map_err(|e| {
                    format!("Cannot read output audio format: {e}")
                })?))
            } else {
                None
            };
            let format_pointer = mix
                .as_ref()
                .map_or(&process_format as *const _, |mix| mix.0);
            let format = inspect_format(format_pointer)?;
            // Process loopback requests a stable stereo PCM format. The native
            // converter is required when the game renders at another rate or
            // layout. Endpoint loopback already uses its actual mix format.
            let stream_flags = AUDCLNT_STREAMFLAGS_LOOPBACK
                | if game_pid.is_some() {
                    AUDCLNT_STREAMFLAGS_AUTOCONVERTPCM
                } else {
                    0
                };
            client
                .Initialize(
                    AUDCLNT_SHAREMODE_SHARED,
                    stream_flags,
                    2_000_000,
                    0,
                    format_pointer,
                    None,
                )
                .map_err(|e| format!("Cannot initialize output audio loopback: {e}"))?;
            let audio: IAudioCaptureClient = client
                .GetService()
                .map_err(|e| format!("Cannot obtain output audio capture stream: {e}"))?;
            client
                .Start()
                .map_err(|e| format!("Cannot start output audio capture: {e}"))?;
            let _running = RunningClient(&client);
            let mut last_audio = Instant::now();
            let mut last_source_check = Instant::now();
            while !stop.load(Ordering::Acquire) {
                let mut packets = 0;
                loop {
                    if stop.load(Ordering::Acquire) {
                        break;
                    }
                    let available = audio
                        .GetNextPacketSize()
                        .map_err(|e| format!("Output audio device changed or disconnected: {e}"))?;
                    if available == 0 {
                        break;
                    }
                    let mut data = std::ptr::null_mut();
                    let mut frames = 0;
                    let mut flags = 0;
                    audio
                        .GetBuffer(&mut data, &mut frames, &mut flags, None, None)
                        .map_err(|e| format!("Cannot read output audio packet: {e}"))?;
                    let packet = Packet {
                        capture: &audio,
                        frames,
                    };
                    if frames > format.rate * 2 {
                        return Err("Output audio packet exceeds capture limits".into());
                    }
                    let silent = flags & AUDCLNT_BUFFERFLAGS_SILENT.0 as u32 != 0;
                    let bytes = frames as usize * format.block;
                    let raw = if silent {
                        &[][..]
                    } else {
                        if data.is_null() {
                            return Err("Windows returned an empty audio packet".into());
                        }
                        std::slice::from_raw_parts(data, bytes)
                    };
                    let samples = format.samples(raw, frames, silent)?;
                    drop(packet);
                    if frames > 0 {
                        on_audio(AudioChunk {
                            sample_rate: format.rate,
                            channels: if format.channels > 2 {
                                1
                            } else {
                                format.channels
                            },
                            samples,
                            discontinuity: samples_discontinuous(flags),
                            native_flags: Some(flags),
                        });
                        last_audio = Instant::now();
                    }
                    packets += 1;
                    if packets >= 128 {
                        break;
                    }
                }
                if last_audio.elapsed() >= Duration::from_millis(100) {
                    // A silent endpoint may stop generating loopback packets.
                    // Explicit silence expires previous detections without retaining audio.
                    let frames = format.rate / 10;
                    on_audio(AudioChunk {
                        sample_rate: format.rate,
                        channels: if format.channels > 2 {
                            1
                        } else {
                            format.channels
                        },
                        samples: format.samples(&[], frames, true)?,
                        discontinuity: true,
                        native_flags: None,
                    });
                    last_audio = Instant::now();
                }
                if last_source_check.elapsed() >= Duration::from_secs(2) {
                    if let Some(pid) = game_pid {
                        if find_game_process()? != Some(pid) {
                            return Err("AION2 closed or its process changed".into());
                        }
                    }
                    if let Some((enumerator, identity)) = &monitored_endpoint {
                        // Changing the default speakers need not invalidate the
                        // previous endpoint. Reopen so explicit system-output
                        // capture follows the user's current default device.
                        let current = enumerator
                            .GetDefaultAudioEndpoint(eRender, eConsole)
                            .map_err(|e| {
                                format!("No default output audio device is available: {e}")
                            })?;
                        if endpoint_id(&current)? != *identity {
                            return Err("Default output audio device changed; reopening the selected source".into());
                        }
                    }
                    last_source_check = Instant::now();
                }
                // Timer driven capture is supported without an event handle and
                // keeps stop latency below 30 ms while avoiding a busy loop.
                std::thread::sleep(Duration::from_millis(20));
            }
            Ok(())
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn borrowed_variant_never_frees_rust_owned_activation_memory() {
            let params = Arc::new(AUDIOCLIENT_ACTIVATION_PARAMS {
                ActivationType: AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK,
                Anonymous: AUDIOCLIENT_ACTIVATION_PARAMS_0 {
                    ProcessLoopbackParams: AUDIOCLIENT_PROCESS_LOOPBACK_PARAMS {
                        TargetProcessId: 1234,
                        ProcessLoopbackMode: PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE,
                    },
                },
            });
            let weak = Arc::downgrade(&params);
            for _ in 0..128 {
                let variant = BorrowedActivation::new(&params);
                unsafe {
                    let raw = &*variant.as_ptr();
                    assert_eq!(raw.vt(), VT_BLOB);
                    let blob = raw.Anonymous.Anonymous.Anonymous.blob;
                    assert_eq!(
                        blob.cbSize as usize,
                        size_of::<AUDIOCLIENT_ACTIVATION_PARAMS>()
                    );
                    assert_eq!(blob.pBlobData, Arc::as_ptr(&params) as *mut u8);
                    assert_eq!(
                        (*blob.pBlobData.cast::<AUDIOCLIENT_ACTIVATION_PARAMS>())
                            .Anonymous
                            .ProcessLoopbackParams
                            .TargetProcessId,
                        1234
                    );
                }
                drop(variant);
                assert_eq!(Arc::strong_count(&params), 1);
                assert_eq!(
                    unsafe { params.Anonymous.ProcessLoopbackParams.TargetProcessId },
                    1234
                );
            }
            drop(params);
            assert!(weak.upgrade().is_none());
        }

        #[test]
        fn completion_is_agile_and_retains_activation_data_until_release() {
            let params = Arc::new(AUDIOCLIENT_ACTIVATION_PARAMS::default());
            let weak = Arc::downgrade(&params);
            let (sender, receiver) = mpsc::channel();
            let handler: IActivateAudioInterfaceCompletionHandler = Completion {
                sender: Mutex::new(Some(sender)),
                _params: params,
            }
            .into();
            assert!(handler
                .cast::<windows::Win32::System::Com::IAgileObject>()
                .is_ok());
            assert!(weak.upgrade().is_some());
            unsafe {
                handler
                    .ActivateCompleted(None::<&IActivateAudioInterfaceAsyncOperation>)
                    .unwrap();
                handler
                    .ActivateCompleted(None::<&IActivateAudioInterfaceAsyncOperation>)
                    .unwrap();
            }
            receiver.recv_timeout(Duration::from_millis(100)).unwrap();
            assert!(receiver.try_recv().is_err());
            drop(handler);
            assert!(weak.upgrade().is_none());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn timestamp_uncertainty_does_not_discard_valid_pcm() {
        for flags in [0, 2, 4, 6] {
            assert!(!samples_discontinuous(flags));
        }
        for flags in [1, 3, 5, 7] {
            assert!(samples_discontinuous(flags));
        }
    }
    fn process(pid: u32, parent_pid: u32, name: &str) -> ProcessInfo {
        ProcessInfo {
            pid,
            parent_pid,
            game: is_game_executable(name),
        }
    }

    #[test]
    fn aion2_parent_and_same_named_child_are_one_game_tree() {
        let entries = [
            process(19_744, 0, "launcher.exe"),
            process(18_624, 19_744, "AION2.exe"),
            process(5_616, 18_624, "AION2.exe"),
        ];
        assert_eq!(select_game_root(&entries).unwrap(), Some(18_624));
    }

    #[test]
    fn shipping_child_and_intermediate_helper_select_recognized_root() {
        let entries = [
            process(90, 80, "AION2-Win64-Shipping.exe"),
            process(80, 70, "audio-helper.exe"),
            process(70, 60, "AION2.exe"),
            process(60, 0, "launcher.exe"),
        ];
        assert_eq!(select_game_root(&entries).unwrap(), Some(70));
        assert_eq!(
            select_game_root(&[
                process(90, 70, "AION2-Win64-Shipping.exe"),
                process(70, 0, "AION2.exe")
            ])
            .unwrap(),
            Some(70)
        );
    }

    #[test]
    fn independent_games_are_rejected_even_under_same_launcher() {
        let entries = [
            process(30, 10, "AION2.exe"),
            process(40, 10, "AION2_client.exe"),
            process(10, 0, "launcher.exe"),
        ];
        assert!(select_game_root(&entries)
            .unwrap_err()
            .contains("independent"));
        assert_eq!(
            select_game_root(&[process(10, 0, "launcher.exe")]).unwrap(),
            None
        );
        assert_eq!(
            select_game_root(&[process(30, 999, "AION2.exe")]).unwrap(),
            Some(30)
        );
    }

    #[test]
    fn duplicate_invalid_or_cyclic_process_ids_never_select_audio() {
        for entries in [
            vec![process(0, 0, "AION2.exe")],
            vec![process(30, 0, "AION2.exe"), process(30, 0, "helper.exe")],
            vec![process(30, 30, "AION2.exe")],
            vec![process(30, 40, "AION2.exe"), process(40, 30, "AION2.exe")],
            vec![
                process(30, 40, "AION2.exe"),
                process(40, 50, "helper.exe"),
                process(50, 40, "helper.exe"),
            ],
        ] {
            assert!(select_game_root(&entries).is_err());
        }
        let mut too_deep = vec![process(1, 2, "AION2.exe")];
        too_deep.extend((2..=258).map(|pid| process(pid, pid + 1, "helper.exe")));
        assert!(select_game_root(&too_deep).is_err());
    }
    #[test]
    fn only_actual_game_executables_are_eligible() {
        assert!(is_game_executable("AION2-Win64-Shipping.exe"));
        assert!(!is_game_executable("AION2Launcher.exe"));
        assert!(!is_game_executable("chrome.exe"));
        assert!(!is_game_executable("fake-aion2.exe"));
    }
    #[test]
    fn stereo_pcm_preserves_separate_channels_and_silence() {
        let f = Format::validate(48_000, 2, 16, false, 4).unwrap();
        let data = [0, 64, 0, 192];
        assert_eq!(f.samples(&data, 1, false).unwrap(), vec![0.5, -0.5]);
        assert_eq!(f.samples(&[], 1, true).unwrap(), vec![0.0, 0.0]);
        assert!(f.samples(&[0], 1, false).is_err());
    }
    #[test]
    fn surround_is_mono_and_invalid_blocks_are_rejected() {
        assert!(Format::validate(48_000, 2, 24, false, 4).is_err());
        assert!(Format::validate(48_000, 2, 16, true, 4).is_err());
        let f = Format::validate(48_000, 6, 16, false, 12).unwrap();
        assert_eq!(f.samples(&[0; 12], 1, false).unwrap(), vec![0.0]);
        assert!(f.samples(&[], 96_001, true).is_err());
    }
    #[test]
    fn float_and_signed_24_bit_are_bounded() {
        let f = Format::validate(48_000, 1, 32, true, 4).unwrap();
        assert_eq!(
            f.samples(&f32::NAN.to_le_bytes(), 1, false).unwrap(),
            vec![0.0]
        );
        let f = Format::validate(48_000, 1, 24, false, 3).unwrap();
        assert_eq!(f.samples(&[0, 0, 0x80], 1, false).unwrap(), vec![-1.0]);
    }

    #[cfg(windows)]
    #[test]
    fn cancelled_capture_opens_no_audio_device() {
        let stop = Arc::new(AtomicBool::new(true));
        for source in [CaptureSource::GameProcess, CaptureSource::SystemOutput] {
            capture(source, stop.clone(), |_| {
                panic!("cancelled capture emitted audio")
            })
            .unwrap();
        }
    }
}

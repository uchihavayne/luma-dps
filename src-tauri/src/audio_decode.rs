//! Local, bounded reference decoding through Windows Media Foundation.
//! https://learn.microsoft.com/windows/win32/api/mfreadwrite/nf-mfreadwrite-mfcreatesourcereaderfrombytestream

pub const MAX_REFERENCE_BYTES: usize = 8 * 1024 * 1024;
pub const MAX_REFERENCE_SECONDS: u32 = 30;

#[derive(Clone, Debug)]
pub struct DecodedAudio {
    pub sample_rate: u32,
    pub channels: u16,
    pub samples: Vec<f32>,
}

fn validate_input(bytes: &[u8]) -> Result<(), String> {
    if bytes.len() > MAX_REFERENCE_BYTES {
        return Err("Audio reference must be at most 8 MB".into());
    }
    if bytes.len() < 12 {
        return Err("Audio reference is empty or truncated".into());
    }
    let wav = &bytes[..4] == b"RIFF" && &bytes[8..12] == b"WAVE";
    let mp4 = &bytes[4..8] == b"ftyp";
    if !wav && !mp4 {
        return Err("Choose a WAV or M4A audio reference".into());
    }
    Ok(())
}

pub fn decode(bytes: &[u8]) -> Result<DecodedAudio, String> {
    validate_input(bytes)?;
    #[cfg(windows)]
    {
        native::decode(bytes)
    }
    #[cfg(not(windows))]
    {
        Err("Audio reference decoding requires Windows Media Foundation".into())
    }
}

#[cfg(windows)]
mod native {
    use super::*;
    use std::time::{Duration, Instant};
    use windows::Win32::{
        Media::MediaFoundation::*,
        System::Com::{CoInitializeEx, CoUninitialize, COINIT_MULTITHREADED},
        UI::Shell::SHCreateMemStream,
    };

    struct Com;
    impl Drop for Com {
        fn drop(&mut self) {
            unsafe { CoUninitialize() }
        }
    }
    struct Foundation;
    impl Drop for Foundation {
        fn drop(&mut self) {
            unsafe {
                let _ = MFShutdown();
            }
        }
    }
    struct Locked<'a>(&'a IMFMediaBuffer);
    impl Drop for Locked<'_> {
        fn drop(&mut self) {
            unsafe {
                let _ = self.0.Unlock();
            }
        }
    }
    fn error(context: &str, e: windows::core::Error) -> String {
        format!("{context}: {e}")
    }

    pub fn decode(bytes: &[u8]) -> Result<DecodedAudio, String> {
        unsafe {
            CoInitializeEx(None, COINIT_MULTITHREADED)
                .ok()
                .map_err(|e| error("Cannot initialize audio decoder", e))?;
            let _com = Com;
            MFStartup(MF_VERSION, MFSTARTUP_FULL)
                .map_err(|e| error("Windows Media Foundation is unavailable", e))?;
            let _foundation = Foundation;
            let stream = SHCreateMemStream(Some(bytes))
                .ok_or_else(|| "Cannot allocate audio reference stream".to_string())?;
            let byte_stream = MFCreateMFByteStreamOnStream(&stream)
                .map_err(|e| error("Cannot open audio reference stream", e))?;
            let reader = MFCreateSourceReaderFromByteStream(&byte_stream, None)
                .map_err(|e| error("Cannot read WAV/M4A audio reference", e))?;
            reader
                .SetStreamSelection(MF_SOURCE_READER_ALL_STREAMS.0 as u32, false)
                .map_err(|e| error("Cannot select audio stream", e))?;
            let index = MF_SOURCE_READER_FIRST_AUDIO_STREAM.0 as u32;
            reader
                .SetStreamSelection(index, true)
                .map_err(|e| error("Reference contains no supported audio stream", e))?;
            let wanted =
                MFCreateMediaType().map_err(|e| error("Cannot allocate audio format", e))?;
            wanted
                .SetGUID(&MF_MT_MAJOR_TYPE, &MFMediaType_Audio)
                .and_then(|_| wanted.SetGUID(&MF_MT_SUBTYPE, &MFAudioFormat_Float))
                .map_err(|e| error("Cannot select decoded audio format", e))?;
            reader
                .SetCurrentMediaType(index, None, &wanted)
                .map_err(|e| error("Cannot decode reference as floating point PCM", e))?;
            let actual = reader
                .GetCurrentMediaType(index)
                .map_err(|e| error("Cannot inspect decoded format", e))?;
            let rate = actual
                .GetUINT32(&MF_MT_AUDIO_SAMPLES_PER_SECOND)
                .map_err(|e| error("Reference has no valid sample rate", e))?;
            let channels = actual
                .GetUINT32(&MF_MT_AUDIO_NUM_CHANNELS)
                .map_err(|e| error("Reference has no valid channel count", e))?;
            if !(8_000..=192_000).contains(&rate) || !(1..=2).contains(&channels) {
                return Err("Reference must be mono or stereo, between 8 kHz and 192 kHz".into());
            }
            let limit = rate as usize * channels as usize * MAX_REFERENCE_SECONDS as usize;
            let mut samples = Vec::new();
            let deadline = Instant::now() + Duration::from_secs(8);
            let mut completed = false;
            for _ in 0..16_384 {
                if Instant::now() > deadline {
                    return Err("Audio reference took too long to decode".into());
                }
                let mut flags = 0;
                let mut sample = None;
                reader
                    .ReadSample(index, 0, None, Some(&mut flags), None, Some(&mut sample))
                    .map_err(|e| error("Cannot decode audio reference sample", e))?;
                if flags & MF_SOURCE_READERF_ERROR.0 as u32 != 0 {
                    return Err("Audio reference contains corrupt data".into());
                }
                if flags & MF_SOURCE_READERF_CURRENTMEDIATYPECHANGED.0 as u32 != 0 {
                    return Err("Audio reference changes format during playback".into());
                }
                if let Some(sample) = sample {
                    let buffer = sample
                        .ConvertToContiguousBuffer()
                        .map_err(|e| error("Cannot read decoded audio buffer", e))?;
                    let mut data = std::ptr::null_mut();
                    let mut size = 0;
                    buffer
                        .Lock(&mut data, None, Some(&mut size))
                        .map_err(|e| error("Cannot lock decoded audio buffer", e))?;
                    let _locked = Locked(&buffer);
                    let count = size as usize / 4;
                    if data.is_null()
                        || size as usize % (4 * channels as usize) != 0
                        || count > limit.saturating_sub(samples.len())
                    {
                        return Err("Audio reference is invalid or longer than 30 seconds".into());
                    }
                    let raw = std::slice::from_raw_parts(data, size as usize);
                    for part in raw.chunks_exact(4) {
                        let value = f32::from_le_bytes(part.try_into().unwrap());
                        if !value.is_finite() {
                            return Err("Audio reference contains non-finite PCM samples".into());
                        }
                        samples.push(value.clamp(-1.0, 1.0));
                    }
                }
                if flags & MF_SOURCE_READERF_ENDOFSTREAM.0 as u32 != 0 {
                    completed = true;
                    break;
                }
            }
            if !completed || samples.is_empty() {
                return Err("Audio reference is empty or exceeds decoding limits".into());
            }
            Ok(DecodedAudio {
                sample_rate: rate,
                channels: channels as u16,
                samples,
            })
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_oversize_and_unknown_containers_before_decoding() {
        assert!(decode(&[]).unwrap_err().contains("truncated"));
        assert!(decode(&[0; 20]).unwrap_err().contains("WAV or M4A"));
        assert!(decode(&vec![0; MAX_REFERENCE_BYTES + 1])
            .unwrap_err()
            .contains("8 MB"));
    }
    #[test]
    fn recognizes_wav_and_mp4_container_headers() {
        assert!(validate_input(b"RIFF1234WAVE").is_ok());
        assert!(validate_input(b"1234ftypM4A ").is_ok());
    }

    #[cfg(windows)]
    fn wav_float(rate: u32, channels: u16, frames: usize) -> Vec<u8> {
        let length = frames * channels as usize * 4;
        let mut bytes = Vec::with_capacity(length + 44);
        bytes.extend_from_slice(b"RIFF");
        bytes.extend_from_slice(&(length as u32 + 36).to_le_bytes());
        bytes.extend_from_slice(b"WAVEfmt ");
        bytes.extend_from_slice(&16_u32.to_le_bytes());
        bytes.extend_from_slice(&3_u16.to_le_bytes());
        bytes.extend_from_slice(&channels.to_le_bytes());
        bytes.extend_from_slice(&rate.to_le_bytes());
        bytes.extend_from_slice(&(rate * channels as u32 * 4).to_le_bytes());
        bytes.extend_from_slice(&(channels * 4).to_le_bytes());
        bytes.extend_from_slice(&32_u16.to_le_bytes());
        bytes.extend_from_slice(b"data");
        bytes.extend_from_slice(&(length as u32).to_le_bytes());
        for index in 0..frames * channels as usize {
            let value = if channels == 2 && index % 2 == 1 {
                -0.25_f32
            } else {
                0.5_f32
            };
            bytes.extend_from_slice(&value.to_le_bytes());
        }
        bytes
    }

    #[cfg(windows)]
    #[test]
    fn media_foundation_preserves_wav_stereo() {
        let actual = decode(&wav_float(48_000, 2, 1_200)).unwrap();
        assert_eq!(actual.sample_rate, 48_000);
        assert_eq!(actual.channels, 2);
        assert_eq!(actual.samples.len(), 2_400);
        assert!((actual.samples[0] - 0.5).abs() < 0.001);
        assert!((actual.samples[1] + 0.25).abs() < 0.001);
    }

    #[cfg(windows)]
    #[test]
    fn media_foundation_rejects_overlong_reference_without_truncation() {
        let result = decode(&wav_float(8_000, 1, 8_000 * 31));
        assert!(result.unwrap_err().contains("30 seconds"));
    }
}

//! A raw capture saved on request: the last minutes of received game frames, written as JSON
//! (`{"t": ms, "hex": "..."}` per frame) to the app's data folder so a feature that needs real
//! traffic can be built from it. Nothing is written until the user asks, nothing is uploaded, and
//! the frames can hold player names and chat, so the file stays on this computer unless the user
//! shares it.
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
};

const MAX_BYTES: usize = 24 * 1024 * 1024;
const KEEP_FILES: usize = 5;

pub fn clean_label(label: &str) -> String {
    label
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
        .take(32)
        .collect()
}

fn hex(bytes: &[u8], out: &mut String) {
    const DIGITS: &[u8; 16] = b"0123456789abcdef";
    for byte in bytes {
        out.push(DIGITS[usize::from(byte >> 4)] as char);
        out.push(DIGITS[usize::from(byte & 15)] as char);
    }
}

pub fn render(label: &str, now: u64, seconds: u64, frames: &[(u64, Vec<u8>)]) -> String {
    // The oldest frames go first when the file would exceed its size limit.
    let mut size = 0usize;
    let mut first = frames.len();
    for (index, (_, frame)) in frames.iter().enumerate().rev() {
        size += frame.len() * 2 + 32;
        if size > MAX_BYTES {
            break;
        }
        first = index;
    }
    let mut out = String::with_capacity(size.min(MAX_BYTES) + 256);
    out.push_str(&format!(
        "{{\"version\":1,\"saved_ms\":{now},\"label\":\"{}\",\"seconds\":{seconds},\"frames\":[",
        clean_label(label)
    ));
    for (index, (at, frame)) in frames[first..].iter().enumerate() {
        if index > 0 {
            out.push(',');
        }
        out.push_str(&format!("{{\"t\":{at},\"hex\":\""));
        hex(frame, &mut out);
        out.push_str("\"}");
    }
    out.push_str("]}");
    out
}

pub fn write(
    directory: &Path,
    label: &str,
    now: u64,
    seconds: u64,
    frames: &[(u64, Vec<u8>)],
) -> Result<PathBuf, String> {
    fs::create_dir_all(directory).map_err(|e| format!("Cannot create the capture folder: {e}"))?;
    let label = clean_label(label);
    let name = if label.is_empty() {
        format!("capture-{now}.json")
    } else {
        format!("capture-{now}-{label}.json")
    };
    let path = directory.join(name);
    let mut file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&path)
        .map_err(|e| format!("Cannot save the capture: {e}"))?;
    file.write_all(render(&label, now, seconds, frames).as_bytes())
        .map_err(|e| format!("Cannot save the capture: {e}"))?;
    drop(file);
    // Keep only the newest few: the names start with the save time.
    let mut saved: Vec<_> = fs::read_dir(directory)
        .map(|entries| {
            entries
                .filter_map(Result::ok)
                .map(|entry| entry.path())
                .filter(|path| {
                    path.file_name()
                        .and_then(|name| name.to_str())
                        .is_some_and(|name| name.starts_with("capture-") && name.ends_with(".json"))
                })
                .collect()
        })
        .unwrap_or_default();
    saved.sort();
    while saved.len() > KEEP_FILES {
        let _ = fs::remove_file(saved.remove(0));
    }
    Ok(path)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp(name: &str) -> PathBuf {
        let path = std::env::temp_dir().join(format!("luma-capture-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&path);
        path
    }

    #[test]
    fn a_capture_is_valid_json_with_every_frame_in_hex() {
        let frames = vec![(1_000, vec![0x04, 0x38, 0xff]), (1_050, vec![0x00])];
        let value: serde_json::Value = serde_json::from_str(&render("pvp-1", 9_000, 120, &frames)).unwrap();
        assert_eq!(value["version"], 1);
        assert_eq!(value["label"], "pvp-1");
        assert_eq!(value["seconds"], 120);
        assert_eq!(value["frames"][0]["t"], 1_000);
        assert_eq!(value["frames"][0]["hex"], "0438ff");
        assert_eq!(value["frames"][1]["hex"], "00");
        let empty: serde_json::Value = serde_json::from_str(&render("", 1, 10, &[])).unwrap();
        assert_eq!(empty["frames"].as_array().unwrap().len(), 0);
    }

    #[test]
    fn labels_cannot_inject_json_or_paths() {
        assert_eq!(clean_label("pvp \"x\"/../a_b-c"), "pvpxa_b-c");
        assert_eq!(clean_label(&"x".repeat(80)).len(), 32);
        let value: serde_json::Value = serde_json::from_str(&render("a\"b\\", 1, 1, &[])).unwrap();
        assert_eq!(value["label"], "ab");
    }

    #[test]
    fn the_oldest_frames_go_first_when_the_file_would_be_too_big() {
        let frames: Vec<_> = (0..10_000u64).map(|at| (at, vec![0xabu8; 4096])).collect();
        let text = render("big", 1, 1, &frames);
        assert!(text.len() <= MAX_BYTES + 512);
        let value: serde_json::Value = serde_json::from_str(&text).unwrap();
        let kept = value["frames"].as_array().unwrap();
        assert!(kept.len() < 10_000 && !kept.is_empty());
        assert_eq!(kept.last().unwrap()["t"], 9_999);
    }

    #[test]
    fn saving_keeps_only_the_newest_files_and_never_overwrites() {
        let directory = temp("keep");
        let frames = vec![(1, vec![1u8, 2])];
        let mut paths = Vec::new();
        for now in 1..=7u64 {
            paths.push(write(&directory, "t", now * 1000, 60, &frames).unwrap());
        }
        let names: Vec<_> = fs::read_dir(&directory)
            .unwrap()
            .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
            .collect();
        assert_eq!(names.len(), KEEP_FILES);
        assert!(paths[6].exists() && !paths[0].exists());
        // The same save time twice is refused rather than overwritten.
        assert!(write(&directory, "t", 7000, 60, &frames).is_err());
        let _ = fs::remove_dir_all(directory);
    }
}

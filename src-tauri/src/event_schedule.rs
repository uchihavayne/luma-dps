use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Condvar, Mutex, MutexGuard, OnceLock};
use std::thread::{self, JoinHandle};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const BODY_LIMIT: usize = 128 * 1024;
const CACHE_LIMIT: usize = 500 * 1024;
const REFRESH_MS: u64 = 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT: Duration = Duration::from_secs(5);
const FUTURE_TOLERANCE_MS: u64 = 5 * 60 * 1000;

#[derive(Clone, Copy)]
struct Definition {
    id: &'static str,
    url: &'static str,
}
const SOURCES: [Definition; 3] = [
    Definition {
        id: "rift",
        url: "https://aion2atlas.app/rift.ics",
    },
    Definition {
        id: "resets",
        url: "https://aion2atlas.app/resets.ics",
    },
    Definition {
        id: "bosses-eu",
        url: "https://aion2atlas.app/calendar/bosses-eu.ics",
    },
];

#[derive(Clone, Debug, Serialize, Deserialize)]
struct Feed {
    id: String,
    url: String,
    body: String,
    fetched_at_ms: u64,
}
#[derive(Serialize, Deserialize)]
struct Cache {
    schema_version: u32,
    feeds: Vec<Feed>,
}
#[derive(Default)]
struct State {
    feeds: Vec<Feed>,
    status: String,
    last_checked_ms: u64,
    last_success_ms: u64,
    message: String,
}
struct Control {
    state: Mutex<State>,
    refresh_requested: Mutex<bool>,
    wake: Condvar,
    stopping: AtomicBool,
    revision: AtomicU64,
}

/// An optional public-calendar client. It does not interact with capture,
/// accounts, game processes or other meters. Call start only in the GUI path.
pub struct Service {
    control: Arc<Control>,
    worker: Option<JoinHandle<()>>,
}
impl Service {
    pub fn start(cache_path: PathBuf) -> Self {
        Self::with_provider(cache_path, Arc::new(HttpProvider::new()))
    }
    fn with_provider(cache_path: PathBuf, provider: Arc<dyn Provider>) -> Self {
        let control = Arc::new(Control {
            state: Mutex::new(State {
                status: "checking".into(),
                ..Default::default()
            }),
            refresh_requested: Mutex::new(false),
            wake: Condvar::new(),
            stopping: AtomicBool::new(false),
            revision: AtomicU64::new(1),
        });
        let child = control.clone();
        let worker = thread::Builder::new()
            .name("luma-calendar".into())
            .spawn(move || run(child, cache_path, provider));
        let worker = match worker {
            Ok(worker) => Some(worker),
            Err(_) => {
                let mut state = lock(&control.state);
                state.status = "error".into();
                state.message = "Takvim güncellemesi başlatılamadı.".into();
                control.revision.fetch_add(1, Ordering::Release);
                None
            }
        };
        Self { control, worker }
    }
    pub fn snapshot(&self) -> Value {
        let state = lock(&self.control.state);
        json!({
            "feeds": state.feeds,
            "status": state.status,
            "last_checked_ms": state.last_checked_ms,
            "last_success_ms": state.last_success_ms,
            "message": state.message,
            "revision": self.revision(),
        })
    }
    pub fn revision(&self) -> u64 {
        self.control.revision.load(Ordering::Acquire)
    }
    /// Coalesces explicit refresh requests; network I/O remains on the worker.
    pub fn refresh(&self) {
        if !self.control.stopping.load(Ordering::Acquire) {
            *lock(&self.control.refresh_requested) = true;
            self.control.wake.notify_all();
        }
    }
    pub fn stop(&mut self) {
        self.control.stopping.store(true, Ordering::Release);
        *lock(&self.control.refresh_requested) = true;
        self.control.wake.notify_all();
        if let Some(worker) = self.worker.take() {
            let _ = worker.join();
        }
        lock(&self.control.state).status = "stopped".into();
        self.control.revision.fetch_add(1, Ordering::Release);
    }
}
impl Drop for Service {
    fn drop(&mut self) {
        self.stop()
    }
}
fn lock<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    mutex
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}
fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .min(u128::from(u64::MAX)) as u64
}

#[derive(Clone, Copy, Debug)]
enum Failure {
    Network,
    Redirect,
    Http(u16),
    TooLarge,
    Encoding,
    Invalid,
    Canceled,
}
trait Provider: Send + Sync {
    fn fetch(&self, source: Definition, stop: &AtomicBool) -> Result<String, Failure>;
}
struct HttpProvider {
    client: OnceLock<Option<reqwest::blocking::Client>>,
}
impl HttpProvider {
    fn new() -> Self {
        Self {
            client: OnceLock::new(),
        }
    }
    fn client(&self) -> Option<&reqwest::blocking::Client> {
        // Default certificate verification, system/environment proxy behavior
        // and trust roots are retained. No redirect or credential is allowed.
        self.client
            .get_or_init(|| {
                reqwest::blocking::Client::builder()
                    .user_agent("Luma-DPS Calendar")
                    .redirect(reqwest::redirect::Policy::none())
                    .connect_timeout(REQUEST_TIMEOUT)
                    .timeout(REQUEST_TIMEOUT)
                    .build()
                    .ok()
            })
            .as_ref()
    }
}
impl Provider for HttpProvider {
    fn fetch(&self, source: Definition, stop: &AtomicBool) -> Result<String, Failure> {
        if stop.load(Ordering::Acquire) {
            return Err(Failure::Canceled);
        }
        let client = self.client().ok_or(Failure::Network)?;
        if stop.load(Ordering::Acquire) {
            return Err(Failure::Canceled);
        }
        let mut response = client
            .get(source.url)
            .header(reqwest::header::ACCEPT, "text/calendar")
            .send()
            .map_err(|_| Failure::Network)?;
        if response.status().is_redirection() {
            return Err(Failure::Redirect);
        }
        if !response.status().is_success() {
            return Err(Failure::Http(response.status().as_u16()));
        }
        if response.url().as_str() != source.url {
            return Err(Failure::Redirect);
        }
        let content_type = response
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|value| value.to_str().ok())
            .unwrap_or("");
        if !content_type
            .split(';')
            .next()
            .unwrap_or("")
            .trim()
            .eq_ignore_ascii_case("text/calendar")
        {
            return Err(Failure::Invalid);
        }
        if response
            .content_length()
            .is_some_and(|length| length > BODY_LIMIT as u64)
        {
            return Err(Failure::TooLarge);
        }
        let mut bytes = Vec::new();
        let mut chunk = [0u8; 8192];
        loop {
            if stop.load(Ordering::Acquire) {
                return Err(Failure::Canceled);
            }
            // Reqwest's total request timeout also covers body consumption.
            let read = response.read(&mut chunk).map_err(|_| Failure::Network)?;
            if read == 0 {
                break;
            }
            if bytes.len().saturating_add(read) > BODY_LIMIT {
                return Err(Failure::TooLarge);
            }
            bytes.extend_from_slice(&chunk[..read]);
        }
        let body = String::from_utf8(bytes).map_err(|_| Failure::Encoding)?;
        if !feed_valid(source.id, &body) {
            return Err(Failure::Invalid);
        }
        Ok(body)
    }
}

fn calendar_valid(body: &str) -> bool {
    if body.len() > BODY_LIMIT
        || body
            .chars()
            .any(|ch| ch.is_control() && !matches!(ch, '\r' | '\n' | '\t'))
    {
        return false;
    }
    let body = body.trim().trim_start_matches('\u{feff}');
    if !body.starts_with("BEGIN:VCALENDAR\n") && !body.starts_with("BEGIN:VCALENDAR\r\n") {
        return false;
    }
    let lines: Vec<_> = body
        .lines()
        .map(|line| line.trim_end_matches('\r'))
        .collect();
    if lines.len() > 5000 || lines.last() != Some(&"END:VCALENDAR") {
        return false;
    }
    let mut events = 0usize;
    let mut in_event = false;
    let mut version = false;
    for line in lines {
        if line.len() > 8192 {
            return false;
        }
        match line {
            "VERSION:2.0" => version = true,
            "BEGIN:VEVENT" => {
                if in_event {
                    return false;
                }
                events += 1;
                in_event = true;
            }
            "END:VEVENT" => {
                if !in_event {
                    return false;
                }
                in_event = false;
            }
            _ => {}
        }
        if events > 64 {
            return false;
        }
    }
    version && !in_event && events > 0 && calendar_rows(body).is_some()
}
type Row = std::collections::HashMap<String, (String, String)>;
fn calendar_rows(body: &str) -> Option<Vec<Row>> {
    let mut logical = Vec::<String>::new();
    for line in body.lines() {
        let line = line.trim_end_matches('\r');
        if line.starts_with([' ', '\t']) {
            logical.last_mut()?.push_str(&line[1..]);
        } else if !line.is_empty() {
            logical.push(line.into());
        }
    }
    let mut stack = Vec::new();
    let mut rows = Vec::new();
    let mut current = None::<Row>;
    for line in logical {
        if line.len() > 4096 {
            return None;
        }
        if let Some(component) = line.strip_prefix("BEGIN:") {
            if stack.len() > 8 {
                return None;
            }
            if component == "VEVENT" {
                if current.is_some() || stack.last().map(String::as_str) != Some("VCALENDAR") {
                    return None;
                }
                current = Some(Row::new());
            }
            stack.push(component.to_string());
            continue;
        }
        if let Some(component) = line.strip_prefix("END:") {
            if stack.pop().as_deref() != Some(component) {
                return None;
            }
            if component == "VEVENT" {
                let row = current.take()?;
                if !row_valid(&row) {
                    return None;
                }
                rows.push(row);
            }
            continue;
        }
        if stack.last().map(String::as_str) != Some("VEVENT") {
            continue;
        }
        let (header, value) = line.split_once(':')?;
        let name = header.split(';').next()?.to_ascii_uppercase();
        if !["DTSTART", "DTEND", "RRULE", "SUMMARY", "UID", "DTSTAMP"].contains(&name.as_str()) {
            continue;
        }
        if current
            .as_mut()?
            .insert(name, (header.into(), value.into()))
            .is_some()
        {
            return None;
        }
    }
    (stack.is_empty() && current.is_none() && !rows.is_empty() && rows.len() <= 64).then_some(rows)
}
fn date_valid(value: &str) -> bool {
    let value = value.strip_suffix('Z').unwrap_or(value);
    if value.len() != 15
        || !value.is_ascii()
        || value.as_bytes()[8] != b'T'
        || value
            .bytes()
            .enumerate()
            .any(|(i, c)| i != 8 && !c.is_ascii_digit())
    {
        return false;
    }
    let number = |start, end| value[start..end].parse::<u32>().ok();
    let Some(year) = number(0, 4) else {
        return false;
    };
    let Some(month) = number(4, 6) else {
        return false;
    };
    let Some(day) = number(6, 8) else {
        return false;
    };
    let leap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
    let days = match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => {
            if leap {
                29
            } else {
                28
            }
        }
        _ => return false,
    };
    (2000..=2200).contains(&year)
        && (1..=days).contains(&day)
        && number(9, 11).is_some_and(|hour| hour < 24)
        && number(11, 13).is_some_and(|minute| minute < 60)
        && number(13, 15).is_some_and(|second| second < 60)
}
fn row_valid(row: &Row) -> bool {
    let Some((start_header, start)) = row.get("DTSTART") else {
        return false;
    };
    if !date_valid(start) {
        return false;
    }
    let mut zone = "UTC";
    let mut parameters = std::collections::HashSet::new();
    for parameter in start_header.split(';').skip(1) {
        let Some((key, value)) = parameter.split_once('=') else {
            return false;
        };
        if !parameters.insert(key) {
            return false;
        }
        match key {
            "TZID" => zone = value.trim_matches('"'),
            "VALUE" if value == "DATE-TIME" => {}
            _ => return false,
        }
    }
    if !["UTC", "Europe/Paris", "Europe/Berlin"].contains(&zone) {
        return false;
    }
    if start.ends_with('Z') {
        zone = "UTC"
    }
    if row
        .get("SUMMARY")
        .is_none_or(|(_, text)| text.trim().is_empty() || text.len() > 256)
        || row
            .get("UID")
            .is_none_or(|(_, text)| text.trim().is_empty() || text.len() > 256)
    {
        return false;
    }
    if let Some((end_header, end)) = row.get("DTEND") {
        if !date_valid(end) || start.ends_with('Z') != end.ends_with('Z') {
            return false;
        }
        let end_zone = end_header
            .split(';')
            .skip(1)
            .find_map(|parameter| parameter.strip_prefix("TZID="))
            .map(|value| value.trim_matches('"'))
            .unwrap_or(zone);
        if end_zone != zone && !end.ends_with('Z') {
            return false;
        }
        let start_wall = wall_seconds(start);
        let end_wall = wall_seconds(end);
        if end_wall < start_wall || end_wall - start_wall > 24 * 60 * 60 {
            return false;
        }
    }
    if row
        .get("DTSTAMP")
        .is_some_and(|(_, value)| !date_valid(value))
    {
        return false;
    }
    let Some((_, rrule)) = row.get("RRULE") else {
        return false;
    };
    let mut fields = std::collections::HashMap::new();
    for part in rrule.split(';') {
        let Some((key, value)) = part.split_once('=') else {
            return false;
        };
        if !["FREQ", "INTERVAL", "BYDAY", "UNTIL", "COUNT", "WKST"].contains(&key)
            || fields.insert(key, value).is_some()
        {
            return false;
        }
    }
    let interval = fields
        .get("INTERVAL")
        .map(|value| value.parse::<u32>())
        .unwrap_or(Ok(1));
    let Ok(interval) = interval else { return false };
    if interval == 0 || interval > 168 || fields.get("WKST").is_some_and(|day| *day != "MO") {
        return false;
    }
    if fields.get("UNTIL").is_some_and(|value| !date_valid(value)) {
        return false;
    }
    if fields.get("BYDAY").is_some_and(|days| {
        days.split(',')
            .any(|day| !["MO", "TU", "WE", "TH", "FR", "SA", "SU"].contains(&day))
    }) {
        return false;
    }
    match fields.get("FREQ").copied() {
        Some("HOURLY") => {
            zone == "UTC"
                && !fields.contains_key("BYDAY")
                && fields.get("COUNT").is_none_or(|value| {
                    value
                        .parse::<u32>()
                        .is_ok_and(|count| (1..=4096).contains(&count))
                })
        }
        Some("DAILY") => {
            interval == 1 && !fields.contains_key("COUNT") && !fields.contains_key("BYDAY")
        }
        Some("WEEKLY") => interval == 1 && !fields.contains_key("COUNT"),
        _ => false,
    }
}
fn wall_seconds(value: &str) -> u64 {
    // Called only after date_valid. Civil duration is sufficient for these
    // short, same-zone published event windows; UI handles timezone conversion.
    let number = |start, end| value[start..end].parse::<u64>().unwrap_or(0);
    let year = number(0, 4);
    let month = number(4, 6);
    let day = number(6, 8);
    let leap = |year: u64| year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
    let mut days = 0;
    for y in 2000..year {
        days += if leap(y) { 366 } else { 365 };
    }
    let month_days = [
        31,
        if leap(year) { 29 } else { 28 },
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31,
    ];
    days += month_days[..month as usize - 1].iter().sum::<u64>() + day - 1;
    days * 86400 + number(9, 11) * 3600 + number(11, 13) * 60 + number(13, 15)
}
fn feed_valid(id: &str, body: &str) -> bool {
    if !calendar_valid(body) {
        return false;
    }
    calendar_rows(body).is_some_and(|rows| {
        rows.iter().all(|row| {
            let title = row
                .get("SUMMARY")
                .map(|(_, value)| value.to_ascii_lowercase())
                .unwrap_or_default();
            let uid = row
                .get("UID")
                .map(|(_, value)| value.to_ascii_lowercase())
                .unwrap_or_default();
            let label = title + &uid;
            match id {
                "rift" => label.contains("rift"),
                "resets" => label.contains("daily") || label.contains("weekly"),
                "bosses-eu" => [
                    "watcher kaira",
                    "boss-kaira",
                    "artifact",
                    "siege bosses",
                    "executors",
                ]
                .iter()
                .any(|name| label.contains(name)),
                _ => false,
            }
        })
    })
}

fn load_cache(path: &Path, now: u64) -> Result<Vec<Feed>, ()> {
    if !path.exists() {
        return Ok(Vec::new());
    }
    let file = File::open(path).map_err(|_| ())?;
    if file.metadata().map_err(|_| ())?.len() > CACHE_LIMIT as u64 {
        return Err(());
    }
    let mut bytes = Vec::new();
    file.take(CACHE_LIMIT as u64 + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| ())?;
    if bytes.len() > CACHE_LIMIT {
        return Err(());
    }
    let cache: Cache = serde_json::from_slice(&bytes).map_err(|_| ())?;
    if cache.schema_version != 1 || cache.feeds.len() > SOURCES.len() {
        return Err(());
    }
    let mut seen = std::collections::HashSet::new();
    for feed in &cache.feeds {
        if !seen.insert(&feed.id)
            || !SOURCES
                .iter()
                .any(|source| source.id == feed.id && source.url == feed.url)
            || feed.fetched_at_ms == 0
            || feed.fetched_at_ms > now.saturating_add(FUTURE_TOLERANCE_MS)
            || !feed_valid(&feed.id, &feed.body)
        {
            return Err(());
        }
    }
    Ok(cache.feeds)
}

fn save_cache(path: &Path, feeds: &[Feed]) -> Result<(), ()> {
    let bytes = serde_json::to_vec(&Cache {
        schema_version: 1,
        feeds: feeds.to_vec(),
    })
    .map_err(|_| ())?;
    if bytes.len() > CACHE_LIMIT {
        return Err(());
    }
    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent).map_err(|_| ())?
        }
    }
    static NONCE: AtomicU64 = AtomicU64::new(0);
    let name = path.file_name().ok_or(())?.to_string_lossy();
    let temporary = path.with_file_name(format!(
        "{name}.tmp-{}-{}",
        std::process::id(),
        NONCE.fetch_add(1, Ordering::Relaxed)
    ));
    let result = (|| {
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)
            .map_err(|_| ())?;
        file.write_all(&bytes).map_err(|_| ())?;
        file.sync_all().map_err(|_| ())?;
        drop(file);
        replace_file(&temporary, path)
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    result
}
#[cfg(windows)]
fn replace_file(from: &Path, to: &Path) -> Result<(), ()> {
    use std::os::windows::ffi::OsStrExt;
    #[link(name = "kernel32")]
    extern "system" {
        fn MoveFileExW(existing: *const u16, new: *const u16, flags: u32) -> i32;
    }
    let from: Vec<_> = from.as_os_str().encode_wide().chain(Some(0)).collect();
    let to: Vec<_> = to.as_os_str().encode_wide().chain(Some(0)).collect();
    if unsafe { MoveFileExW(from.as_ptr(), to.as_ptr(), 1 | 8) } == 0 {
        Err(())
    } else {
        Ok(())
    }
}
#[cfg(not(windows))]
fn replace_file(from: &Path, to: &Path) -> Result<(), ()> {
    fs::rename(from, to).map_err(|_| ())
}

fn run(control: Arc<Control>, cache_path: PathBuf, provider: Arc<dyn Provider>) {
    {
        let mut state = lock(&control.state);
        match load_cache(&cache_path, now_ms()) {
            Ok(feeds) => {
                state.last_success_ms = feeds
                    .iter()
                    .map(|feed| feed.fetched_at_ms)
                    .max()
                    .unwrap_or(0);
                state.feeds = feeds;
                state.status = if state.feeds.is_empty() {
                    "checking"
                } else {
                    "cached"
                }
                .into();
            }
            Err(()) => {
                state.message =
                    "Kaydedilmiş takvim geçersiz; kaynak yeniden kontrol ediliyor.".into();
            }
        }
        control.revision.fetch_add(1, Ordering::Release);
    }
    let mut next_check = {
        let state = lock(&control.state);
        if state.feeds.len() == SOURCES.len() {
            state
                .feeds
                .iter()
                .map(|feed| feed.fetched_at_ms.saturating_add(REFRESH_MS))
                .min()
                .unwrap_or(0)
        } else {
            0
        }
    };
    loop {
        if control.stopping.load(Ordering::Acquire) {
            break;
        }
        let requested = {
            let mut flag = lock(&control.refresh_requested);
            let requested = *flag;
            *flag = false;
            requested
        };
        let now = now_ms();
        if requested || now >= next_check {
            refresh_round(&control, &cache_path, provider.as_ref());
            next_check = now_ms().saturating_add(REFRESH_MS);
        }
        if control.stopping.load(Ordering::Acquire) {
            break;
        }
        let mut flag = lock(&control.refresh_requested);
        if !*flag {
            // Error rounds back off for a full day; explicit refresh remains
            // available and startup can use a validated last-good cache.
            let wait = next_check.saturating_sub(now_ms()).clamp(1, REFRESH_MS);
            let waited = control.wake.wait_timeout(flag, Duration::from_millis(wait));
            flag = match waited {
                Ok((guard, _)) => guard,
                Err(poisoned) => poisoned.into_inner().0,
            };
            if !*flag && !control.stopping.load(Ordering::Acquire) {
                *flag = true;
            }
        }
    }
}
fn refresh_round(control: &Control, path: &Path, provider: &dyn Provider) {
    {
        let mut state = lock(&control.state);
        state.status = "checking".into();
        state.last_checked_ms = now_ms();
        control.revision.fetch_add(1, Ordering::Release);
    }
    let mut successes = 0;
    let mut failures = 0;
    for source in SOURCES {
        if control.stopping.load(Ordering::Acquire) {
            return;
        }
        match provider.fetch(source, &control.stopping) {
            Ok(body) if feed_valid(source.id, &body) => {
                let fetched_at_ms = now_ms();
                let mut state = lock(&control.state);
                state.feeds.retain(|feed| feed.id != source.id);
                state.feeds.push(Feed {
                    id: source.id.into(),
                    url: source.url.into(),
                    body,
                    fetched_at_ms,
                });
                state.last_success_ms = fetched_at_ms;
                control.revision.fetch_add(1, Ordering::Release);
                successes += 1;
            }
            Err(Failure::Canceled) => return,
            Err(Failure::Http(code)) => {
                let _ = code;
                failures += 1;
            }
            _ => failures += 1,
        }
    }
    let feeds = lock(&control.state).feeds.clone();
    let cached = if successes > 0 {
        save_cache(path, &feeds).is_ok()
    } else {
        true
    };
    let mut state = lock(&control.state);
    state.feeds.sort_by_key(|feed| {
        SOURCES
            .iter()
            .position(|source| source.id == feed.id)
            .unwrap_or(usize::MAX)
    });
    state.status = if failures == 0 {
        "ready"
    } else if state.feeds.is_empty() {
        "error"
    } else if successes == 0 {
        "cached"
    } else {
        "partial"
    }
    .into();
    state.message = if failures > 0 && state.feeds.is_empty() {
        "Takvim kaynaklarına erişilemedi."
    } else if failures > 0 {
        "Bazı kaynaklar güncellenemedi; son kaydedilmiş takvimler korunuyor."
    } else if !cached {
        "Takvim güncel; yerel önbellek kaydedilemedi."
    } else {
        ""
    }
    .into();
    control.revision.fetch_add(1, Ordering::Release);
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Instant;
    const ICAL:&str="BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:test@example.invalid\r\nDTSTART:20261013T000000Z\r\nRRULE:FREQ=DAILY\r\nSUMMARY:Test\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n";
    fn test_body(id: &str) -> String {
        ICAL.replace(
            "SUMMARY:Test",
            match id {
                "rift" => "SUMMARY:Test Rift",
                "resets" => "SUMMARY:Test Daily reset",
                _ => "SUMMARY:Test Watcher Kaira",
            },
        )
    }
    struct Mock {
        calls: Mutex<Vec<String>>,
        fail: AtomicBool,
        fail_one: Mutex<Option<String>>,
        wait: bool,
    }
    impl Provider for Mock {
        fn fetch(&self, source: Definition, stop: &AtomicBool) -> Result<String, Failure> {
            lock(&self.calls).push(source.url.into());
            if self.wait {
                while !stop.load(Ordering::Acquire) {
                    thread::sleep(Duration::from_millis(2));
                }
                return Err(Failure::Canceled);
            }
            if self.fail.load(Ordering::Acquire)
                || lock(&self.fail_one).as_deref() == Some(source.id)
            {
                Err(Failure::Network)
            } else {
                Ok(test_body(source.id))
            }
        }
    }
    fn path() -> PathBuf {
        static COUNT: AtomicU64 = AtomicU64::new(0);
        std::env::temp_dir().join(format!(
            "luma-calendar-test-{}-{}.json",
            std::process::id(),
            COUNT.fetch_add(1, Ordering::Relaxed)
        ))
    }
    fn mock() -> Arc<Mock> {
        Arc::new(Mock {
            calls: Mutex::new(Vec::new()),
            fail: AtomicBool::new(false),
            fail_one: Mutex::new(None),
            wait: false,
        })
    }
    fn wait_for(service: &Service, test: impl Fn(&Value) -> bool) {
        let deadline = Instant::now() + Duration::from_secs(2);
        loop {
            if test(&service.snapshot()) {
                return;
            }
            assert!(
                Instant::now() < deadline,
                "worker did not reach expected state"
            );
            thread::sleep(Duration::from_millis(2));
        }
    }
    fn feeds() -> Vec<Feed> {
        SOURCES
            .iter()
            .map(|source| Feed {
                id: source.id.into(),
                url: source.url.into(),
                body: test_body(source.id),
                fetched_at_ms: now_ms(),
            })
            .collect()
    }
    #[test]
    fn calendar_validation_rejects_html_truncation_control_bytes_and_event_overflow() {
        assert!(calendar_valid(ICAL));
        assert!(!calendar_valid(&format!("<html>{ICAL}")));
        assert!(!calendar_valid(&ICAL.replace("END:VEVENT", "")));
        assert!(!calendar_valid(&ICAL.replace("SUMMARY:Test", "SUMMARY:\0")));
        let too_many = format!(
            "BEGIN:VCALENDAR\nVERSION:2.0\n{}END:VCALENDAR",
            "BEGIN:VEVENT\nEND:VEVENT\n".repeat(65)
        );
        assert!(!calendar_valid(&too_many));
        assert!(!calendar_valid(&format!(
            "{ICAL}{}",
            "x".repeat(BODY_LIMIT)
        )));
    }
    #[test]
    fn unsupported_or_ambiguous_schedule_changes_are_rejected_before_cache_replace() {
        assert!(!calendar_valid(&ICAL.replace("FREQ=DAILY", "FREQ=MONTHLY")));
        assert!(!calendar_valid(
            &ICAL.replace("FREQ=DAILY", "FREQ=DAILY;BYDAY=MO")
        ));
        assert!(!calendar_valid(
            &ICAL.replace("FREQ=DAILY", "FREQ=WEEKLY;BYDAY=BOGUS")
        ));
        assert!(!calendar_valid(
            &ICAL.replace("20261013T000000Z", "20260230T000000Z")
        ));
        assert!(!calendar_valid(
            &ICAL.replace("FREQ=DAILY", "FREQ=DAILY;INTERVAL=2")
        ));
        assert!(!feed_valid("rift", &test_body("resets")));
        assert!(!calendar_valid(
            &ICAL.replace("BEGIN:VEVENT", "BEGIN:VALARM\r\nBEGIN:VEVENT")
        ));
        assert!(!calendar_valid(&ICAL.replace(
            "RRULE:FREQ=DAILY",
            "DTEND:20261012T000000Z\r\nRRULE:FREQ=DAILY"
        )));
        assert!(!calendar_valid(&ICAL.replace(
            "RRULE:FREQ=DAILY",
            "DTEND:20261015T000000Z\r\nRRULE:FREQ=DAILY"
        )));
    }
    #[test]
    fn malformed_oversized_or_foreign_cache_cannot_add_network_urls() {
        let path = path();
        fs::write(&path, "{}").unwrap();
        assert!(load_cache(&path, now_ms()).is_err());
        fs::write(&path, vec![b' '; CACHE_LIMIT + 1]).unwrap();
        assert!(load_cache(&path, now_ms()).is_err());
        let mut forged = feeds();
        forged[0].url = "https://example.invalid/private".into();
        fs::write(
            &path,
            serde_json::to_vec(&Cache {
                schema_version: 1,
                feeds: forged,
            })
            .unwrap(),
        )
        .unwrap();
        assert!(load_cache(&path, now_ms()).is_err());
        let provider = mock();
        let mut service = Service::with_provider(path.clone(), provider.clone());
        wait_for(&service, |state| state["status"] == "ready");
        assert_eq!(
            *lock(&provider.calls),
            SOURCES
                .iter()
                .map(|source| source.url.to_string())
                .collect::<Vec<_>>()
        );
        service.stop();
        let _ = fs::remove_file(path);
    }
    #[test]
    fn fresh_valid_cache_does_not_fetch_until_explicit_refresh() {
        let path = path();
        save_cache(&path, &feeds()).unwrap();
        let provider = mock();
        let mut service = Service::with_provider(path.clone(), provider.clone());
        wait_for(&service, |state| state["status"] == "cached");
        assert!(lock(&provider.calls).is_empty());
        service.refresh();
        wait_for(&service, |state| state["status"] == "ready");
        assert_eq!(lock(&provider.calls).len(), 3);
        assert_eq!(service.snapshot()["feeds"].as_array().unwrap().len(), 3);
        service.stop();
        let _ = fs::remove_file(path);
    }
    #[test]
    fn network_failure_keeps_each_last_good_body_and_the_previous_cache() {
        let path = path();
        save_cache(&path, &feeds()).unwrap();
        let before = fs::read(&path).unwrap();
        let provider = mock();
        provider.fail.store(true, Ordering::Release);
        let mut service = Service::with_provider(path.clone(), provider.clone());
        wait_for(&service, |state| state["status"] == "cached");
        service.refresh();
        wait_for(&service, |state| {
            state["last_checked_ms"].as_u64().unwrap() > 0 && state["status"] == "cached"
        });
        assert_eq!(service.snapshot()["feeds"].as_array().unwrap().len(), 3);
        assert_eq!(fs::read(&path).unwrap(), before);
        assert_eq!(lock(&provider.calls).len(), 3);
        service.stop();
        let _ = fs::remove_file(path);
    }
    #[test]
    fn one_failed_feed_keeps_its_timestamp_while_other_sources_refresh() {
        let path = path();
        let mut saved = feeds();
        let old = now_ms() - 1000;
        for feed in &mut saved {
            feed.fetched_at_ms = old;
        }
        save_cache(&path, &saved).unwrap();
        let provider = mock();
        *lock(&provider.fail_one) = Some("rift".into());
        let mut service = Service::with_provider(path.clone(), provider);
        wait_for(&service, |state| state["status"] == "cached");
        let before = service.revision();
        service.refresh();
        wait_for(&service, |state| state["status"] == "partial");
        let state = service.snapshot();
        let records = state["feeds"].as_array().unwrap();
        assert_eq!(records[0]["fetched_at_ms"], old);
        assert!(records[1]["fetched_at_ms"].as_u64().unwrap() > old);
        assert!(records[2]["fetched_at_ms"].as_u64().unwrap() > old);
        assert!(service.revision() > before);
        service.stop();
        let _ = fs::remove_file(path);
    }
    #[test]
    fn cache_replace_and_write_failure_preserve_previous_data() {
        let path = path();
        let original = feeds();
        save_cache(&path, &original).unwrap();
        let mut updated = original.clone();
        updated[0].body = test_body("rift").replace("Test Rift", "Updated Rift");
        save_cache(&path, &updated).unwrap();
        assert_eq!(
            load_cache(&path, now_ms()).unwrap()[0].body,
            updated[0].body
        );
        let before = fs::read(&path).unwrap();
        updated[0].body = "x".repeat(CACHE_LIMIT + 1);
        assert!(save_cache(&path, &updated).is_err());
        assert_eq!(fs::read(&path).unwrap(), before);
        let _ = fs::remove_file(path);
    }
    #[test]
    fn shutdown_wakes_sleep_and_stops_between_requests() {
        let path = path();
        let provider = Arc::new(Mock {
            calls: Mutex::new(Vec::new()),
            fail: AtomicBool::new(false),
            fail_one: Mutex::new(None),
            wait: true,
        });
        let mut service = Service::with_provider(path.clone(), provider.clone());
        let deadline = Instant::now() + Duration::from_secs(2);
        while lock(&provider.calls).is_empty() {
            assert!(Instant::now() < deadline);
            thread::sleep(Duration::from_millis(2));
        }
        let start = Instant::now();
        service.stop();
        assert!(start.elapsed() < Duration::from_secs(1));
        assert_eq!(lock(&provider.calls).len(), 1);
        assert_eq!(service.snapshot()["status"], "stopped");
        let _ = fs::remove_file(path);
    }
    #[test]
    #[ignore = "Explicit public HTTPS check; never part of offline tests."]
    fn subscribed_public_calendars_are_readable() {
        let provider = HttpProvider::new();
        let stop = AtomicBool::new(false);
        for source in SOURCES {
            let body = provider.fetch(source, &stop).unwrap();
            assert!(calendar_valid(&body));
        }
    }
}

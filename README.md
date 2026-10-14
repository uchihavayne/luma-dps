# Luma DPS

Luma is an independent Windows encounter meter for AION2 with personal, party and observed views, local analysis and a configurable overlay. The interface supports Turkish and English. This is a preview: supported protocol layouts have replay tests; live coverage outside the tested encounters still requires validation.

## Hızlı başlangıç · Türkçe

1. Windows x64 taşınabilir ZIP dosyasını bir klasöre çıkar ve `Luma-DPS.exe` dosyasını aç. Windows yönetici onayını kabul et. Windows'un Packet Monitor API'si ve WebView2 sistemde bulunmalıdır; Luma Npcap veya ayrı bir yakalama sürücüsü kurmaz.
2. Otomatik karakter adı ve ekipman kaydı için Luma açıkken karaktere giriş yap. Ölçüm varsayılan olarak **Kişisel** kapsamındadır. Adın alınmazsa **Karakterim** bölümünde kendi satırını seç veya tam karakter adını kaydet. Yakındaki oyuncular kişisel hasarına eklenmez.
3. **Etkinlik takvimi** bölümünden hazır EU etkinliklerini seç. Rift, Shugo ve diğer hazır saatlerde aralık veya başlangıç girmen gerekmez. Üst çubuktaki saati değiştirebilir veya kapatabilirsin; hatırlatıcıları ayrı ayrı açabilirsin.
4. Ayarlardan dili, tasarımı, renkleri, yazıyı ve satır bilgilerini seç. Analizden mevcut karşılaşmayı veya geçmişi HTML, CSV ya da JSON olarak dışa aktar. Paylaşmadan önce ad gizleme seçeneğini kullanabilirsin.
5. Hidden Cube aramak için küçük bardaki **Cube** düğmesini veya **Ayarlar → Hidden Cube** bölümünü açıp **Dinlemeyi başlat** seçeneğini kullan. Hazır ses referansı dahildir. Stereo sol/sağ yönünü ve sinyalin değişimini izle; kamera yönünü değiştirerek karşılaştır. Kesin metre, harita konumu ve ön/arka bilgisi sesten hesaplanmaz.

Bağlantı bekleniyorsa durum yazısının ayrıntısını kontrol et. Oyuna girişten sonra Luma'yı açmak bazı kimlik kayıtlarını kaçırabilir. Tarayıcı önizlemesi canlı oyun verisi okumaz. Bu sürümde yeni senkronize oyun testi hâlâ bekleniyor; kapsam sınırlamaları aşağıda açıklanıyor.

## Quick start · English

Extract the Windows portable archive and open `Luma-DPS.exe`. Release builds request the standard Windows administrator approval needed for native capture. Windows' built-in Packet Monitor streaming API and WebView2 must already be present. Luma installs no Npcap or extra capture driver. Unsupported Windows builds display the actual backend error.

The independent application uses a separate settings directory and application identity. It closes only its own capture session. Completed fights, preferences and imported reports stay on this device. There is no automatic upload or account requirement.

Start Luma before entering the character when testing automatic identity. Opening it after login may miss the self and build records; the meter then waits for received identity or an explicit fallback selection.

Choose your display language and appearance in Settings. Ready EU clocks need no entered interval or anchor; choose the compact header's event and enable reminders individually. Export the current encounter or history from Analysis as HTML, CSV or JSON, with optional anonymous names.

## Your character and measurement scope

The default is **Personal**. An explicit server self record identifies the current character automatically. No player's name or actor ID is hardcoded. If capture starts after login and misses that record, a saved name can bind to an exact, unique received player name, or the player can choose their observed row for the current session. An unresolved character shows an unavailable personal result rather than nearby players' damage.

**Party** uses received membership or an explicitly selected session roster. **Observed** includes the eligible actors visible in the received connection and is labelled separately. A typed alias does not create party membership. Switching characters or reconnecting clears session selections; imported encounters cannot set live identity.

## Included

- Per-player and per-skill damage, direct and periodic hits, critical/perfect/double/parry counters where supplied, target HP with observation time, and exact scope labels.
- Received cooldown/charge records, windup warnings when an actor targets you, active effects and encounter event timelines. Unknown timing and effect names retain their IDs.
- Personal 60/120/180/300-second training, optional target selection, first-own-hit start and fixed cutoff. Pausing cancels a training run; capture loss marks it incomplete.
- Recorded damage curves, activity summaries, historical progress, persistent local encounters, scoped HTML/CSV/JSON export, anonymous export and validated import. Curves require complete retained samples.
- Locally selected Combat Analyzer reports: totals, healing/HPS, damage taken, hit counters and skills. Comparison checks personal identity, measurement window, target and capture completeness.
- Received equipment, skills and Daevanion lists; unbound inspection records; immutable encounter-start build observations. Structural equipment coverage is partial.
- Ready EU event clocks for Rift, Shugo Festival, Dimensional Invasion, siege, siege bosses, Kaira, Nahma and daily/weekly resets. No interval or opening anchor is needed. Published calendar subscriptions refresh automatically, retain their last valid cache offline and keep source/timezone information. Custom timers remain optional.
- Received map boss slots with alive/dead status and server timestamps, selectable compact countdowns, per-event reminders and finite UTC calendar export.
- Explicit per-second values such as `12.3K/sn` (Turkish) or `12.3K/s` (English). Rates keep the K unit above 1000 rather than switching to M; totals retain their own K/M units. Combined rows show total damage followed by the rate, for example `1.2M (12.3K/sn)`. The upper summary and player rows independently show DPS, total damage or both.
- Invalid packet timestamps fall back to receipt time so the encounter clock can advance. Old saved encounters with damage but zero duration keep their totals and display an unavailable DPS instead of an invented rate.
- Turkish/English UI, four original layouts, twelve palettes including white, editable colors/fonts/density/columns, local images and appearance import/export.
- Native movement/resizing, keyboard resize, pause/reset, focus-safe updates and movable settings/analysis panels. Closing a panel restores the compact window's position and size.
- Optional same-PC OBS browser source with per-session access token, explicit measurement scope and hidden names by default. It starts only when enabled for that session.
- Optional Hidden Cube sound detection with a built-in spectral reference, stereo left/right indication, reference similarity and relative signal changes. Local WAV/M4A reference import accepts at most 8 MB and 30 seconds. Listening starts off; neither microphone capture nor automatic audio recording/upload is used.

## Hidden Cube sound locator

Open **Settings → Hidden Cube** or the small Cube button, then start listening. The default source is the AION2 process tree. This uses Windows' built-in [application loopback API](https://learn.microsoft.com/en-us/samples/microsoft/windows-classic-samples/applicationloopbackaudio-sample/) and requires Windows build 20348 or later. On older Windows builds, system output can be selected explicitly; it also includes sounds from other applications. A device change retries the same selected source without changing to system output automatically.

The supplied sound's spectral reference is included; its original recording is not distributed. The similarity percentage describes a signal match, not a probability. Direction uses the matched sound's stereo balance rather than the overall volume of the mixed audio. Mono and surround inputs do not provide a left/right arrow. An arrow is relative to the stereo audio render; turning the camera can help resolve front/back ambiguity.

Signal strength and its change are relative audio cues. Music, similar chimes, game volume, headphone processing, occlusion and camera movement can affect them. The locator cannot calculate exact metres, absolute coordinates, elevation or an objective compass bearing from a mixed stereo recording. A centered signal alone does not establish that the Cube is in front of the player.

You can replace the reference with a clean local WAV/M4A recording while listening is stopped. [Windows Media Foundation](https://learn.microsoft.com/en-us/windows/win32/api/mfreadwrite/nf-mfreadwrite-mfcreatesourcereaderfrombytestream) decodes it in memory; only a bounded spectral template is retained on this device. Silence and non-distinctive references are rejected. Stop listening before changing its source, sensitivity or reference.

Offline checks recognize the supplied reference at reduced volume and with synthetic left/right panning, while rejecting the tested silence, noise and unrelated tones. A separate 10-second AION2-only stereo capture successfully opened and stopped on Windows. These checks do not establish detection accuracy or a false-positive rate in every game scene. Live Cube detection and stereo guidance still need validation in the game.

## Coverage

The meter measures what the game connection supplies. A nearby player may not appear if the server does not send their events. Receiving traffic alone does not establish an encounter or local identity.

Boss classification and unfamiliar skill/target labels still need validated mappings or user selection. Map slot IDs are not guessed into boss names. A passed map deadline waits for a fresh server report rather than claiming the boss spawned. Ready event clocks use published community schedules and public calendar subscriptions; they do not establish live availability or NCSOFT confirmation. Nahma remains a provisional community preset. See [event sources and clock rules](docs/events-sources.md).

Live healing/resource classification remains unsupported where the wire form is ambiguous. Player/pet-to-player amounts are retained as unclassified and excluded from damage/HPS until that distinction is verified; PvP statistics are therefore not yet supported. Unsupported HPS is unavailable; saved game reports can provide their own healing totals. Verified NPC damage to a player's body is shown separately with coverage information. Automatic Odyle inventory is not included; the planner uses entered values. Public world rankings need a shared service and comparable uploaded encounters; this preview does not pretend local history is a world ranking.

Gear observations are partial and do not bundle another provider's item/skill/icon catalog. Equipment ownership requires confirmed server self identity; a matching inspection name or manual row selection is insufficient. Starting midway through a session can miss login lists.

TCP retransmissions are removed; bounded frame recovery and capture-loss reporting protect totals. Loss invalidates partial records and marks measurements. The native backend currently supports incoming IPv4 TCP for the allowed AION2 executables. IPv6, encrypted game traffic, unsupported executables and oversized/incomplete snapshots are reported limitations. See [capture details](src-tauri/NATIVE_CAPTURE.md), [protocol coverage](docs/observed-character-and-bosses.md) and [feature comparison](docs/feature-parity.md).

Browser preview has no live connection. `?demo=1` shows fixed sample records and an explicit DEMO label.

## Build and test

Run from this source directory on Windows with the MSVC build tools, Rust 1.95.0, Node.js 24 and Python 3.11 or newer. These are development tools; players only need the portable application and the Windows components described above.

```powershell
cargo test --manifest-path engine/Cargo.toml --locked
cargo test --manifest-path src-tauri/Cargo.toml --locked
node --test ui/tests/*.test.mjs
python -m unittest discover -s tools/tests -p "test_*.py"
python tools/package.py --check-source
cargo build --release --manifest-path src-tauri/Cargo.toml --locked
python tools/package.py
```

Use `--offline` for Cargo after the dependencies are cached. The frontend has no npm runtime dependency; the desktop build embeds it directly. Cargo lockfiles pin dependency versions; the workflow selects the Rust toolchain explicitly. Packaging compares configuration, Cargo/lockfile versions and the executable's file/product resources, rejects an executable older than its build inputs, verifies x64 and the administrator manifest, and includes public source hashes and dependency notices. Captures, local settings, exported reports and build caches are excluded. Source and portable archives include the documentation needed by their README links.

For a local browser preview, run `node ui/serve.mjs`, then open `http://127.0.0.1:7335/`. Add `?demo=1` to see clearly labelled sample data. See [UI behavior and development](ui/README.md).

The Windows GitHub Actions workflow runs tests and builds reviewable packages. It creates build artifacts; publishing a GitHub release is separate.

See [release checks](RELEASING.md), [changes](CHANGELOG.md) and [privacy/security reporting](SECURITY.md). A source archive is provided for review; application-specific distribution and modification terms remain in [LICENSE](LICENSE). Dependency licenses are included separately.

The calendar client requests only three fixed public HTTPS subscription URLs. It sends no character names, damage records or accounts. Refreshes happen at startup when needed, daily thereafter, or on explicit refresh. Invalid responses preserve the last valid schedule; certificate verification remains enabled.

Support: [Buy Me a Coffee](https://buymeacoffee.com/12hrsofficp).

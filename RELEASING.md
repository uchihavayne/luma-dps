# Preparing a Windows preview

Package only the `luma-independent` source tree as the repository root. Keep application source terms in `LICENSE` and the separate third-party notices. A reviewable source archive does not by itself grant an open-source license.

## Version and build

Set the desktop release version consistently in `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock` and `src-tauri/tauri.conf.json`. The engine can keep its own version when unchanged; its manifest and both lockfiles must agree. Move the final Unreleased changelog entry to that preview version and describe only completed changes.

Run on Windows with MSVC build tools, Rust 1.95.0, Node.js 24 and Python 3.11+:

```powershell
cargo fmt --manifest-path engine/Cargo.toml -- --check
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path engine/Cargo.toml --locked
cargo test --manifest-path src-tauri/Cargo.toml --locked
node --test ui/tests/*.test.mjs
python -m unittest discover -s tools/tests -p "test_*.py"
python tools/package.py --check-source
cargo build --release --manifest-path src-tauri/Cargo.toml --locked
python tools/package.py
```

Rebuild after any embedded frontend/native/engine/configuration edit. Packaging rejects an older build input timestamp, a mismatched file/product version, a non-x64 executable or a missing administrator manifest. It reads executable resources without launching capture or UAC. Timestamp freshness and source hashes aid review; they do not establish a cryptographically reproducible compiler output or code-signing identity.

The `release` directory contains the versioned portable ZIP, source ZIP and `SHA256SUMS.txt`. Each source/dependency file has a hash in `SOURCE_MANIFEST.json`, which also identifies the executable. ZIP output is deterministic for identical selected bytes with the same Python/zlib toolchain. Source collection is restricted to public code/docs/notices; settings, packet captures, reports and caches are excluded. Review both ZIP file lists before distribution and keep the two ZIPs and checksum file from the same packaging run.

## Acceptance checks

Automated tests and browser layout checks cover their specified cases. The final Windows executable still needs these live checks before a verified-accuracy or complete-replacement claim:

| Check | Required evidence | Current state |
| --- | --- | --- |
| Solo dummy | Synchronized 60-second Luma/Combat Analyzer totals, same actor/target/start/end, healthy capture | Pending on final preview |
| Nearby players | Personal total excludes strangers while Observed shows received actors | Pending on final preview |
| Real party | Automatic/explicit roster, personal versus party totals, reconnect invalidation | Pending on final preview |
| Window interaction | Drag settings, close/Escape, resize/lock, minimum size, DPI/multi-monitor placement | Final native check pending |
| Observed telemetry | Own login names/build, supported boss windup/effects and map slots | Content-specific live coverage pending |
| Hidden Cube sound | Real chime/other-sound negatives, stereo pan and camera turn, silence/stop/device change | Reference replay tested; live game check pending |

Confirm no DEMO data enters a native session, calendar updates fail safely offline, reports preserve scope/unknown values and OBS remains off until requested. Preserve the known limitations in the release notes: ambiguous live healing/PvP, partial equipment/catalog names, native capture constraints, manual Odyle and no official game-verified world rankings. Community rankings cover opted-in uploaded summaries only; confirm the deployed service's current audience before advertising public availability.

## GitHub handoff

The Windows workflow has read-only repository permissions, tests before building, and uploads review artifacts. It does not publish a release, sign the EXE, create a repository or start live capture. The action pins and compiler are verified against the primary [checkout](https://github.com/actions/checkout/releases/tag/v7.0.1), [setup-node](https://github.com/actions/setup-node/releases/tag/v7.1.0), [setup-python](https://github.com/actions/setup-python/releases/tag/v6.0.0), [upload-artifact](https://github.com/actions/upload-artifact/releases/tag/v7.0.2) and [Rust 1.95.0](https://blog.rust-lang.org/2026/04/16/Rust-1.95.0/) release pages.

After owner approval, publish the prepared tree and create a GitHub **prerelease** with the matching portable/source/checksum files. State the tested Windows/region and pending live gates plainly. Review repository visibility and application source terms, and configure an appropriate private channel for vulnerability reports. Do not upload the development workspace, capture files, probe snapshots or user history. Signing can be added when the publisher has its own certificate; checksums are not a signature.

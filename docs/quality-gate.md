# Automated quality gate

From a development checkout with the documented build tools installed:

```powershell
python tools/audit.py
```

This runs the actual frontend entry/module/preview-asset contract, JavaScript syntax checks, source packaging validation, both Rust formatting checks, and all engine, desktop, frontend, community and packaging/signing-tool tests. The runner continues through independent command groups so a failure does not hide later failures. A nonzero command, unavailable tool, timeout, empty test selection or all-skipped test suite fails the gate.

The default local report is `.cache/audit/report.json`. Per-group logs are saved next to it in a unique run directory. Reports state the source commit, dirty-working-tree flag, public-source SHA-256, test/skip counts and each check's result. The public source fingerprint must remain unchanged during checks. Each new run first replaces the old success with an in-progress result whose gate is closed, so a crash cannot leave an earlier success looking current. An ignored test remains visible in the report.

Use `--static-only` for the quick frontend contract check; it never marks the full gate passed. `--timeout 1200` sets a maximum in seconds for each command group. A timed-out command and its child process tree are stopped. The report does not start game capture, read private history or upload local logs. The GitHub workflow uploads its clean checkout's JSON report as `luma-audit-report`; a failed gate prevents the Windows release build and package steps. Publication and publisher signing remain explicit release actions.

## Review and regressions

Fixes should reproduce a concrete failure before changing behavior. Current regressions include filtered versus missing damage, completed boss classification after a connection boundary, scoped clocks through pauses, incomplete party rosters, missing target durations, pressed player rows during reordering, pet guide focus during gains, collection ownership through death, rejected previous-character snapshots, unavailable capture and clock reversal. Static checks also cover accidentally omitted modules, missing `type="module"`, duplicate/unresolved literal controls and preview assets that would otherwise return 404.

An automated pass covers these checks on these source bytes. It does not certify absence of every bug, full packet coverage, Windows compatibility or live accuracy. Synchronized Combat Analyzer totals, long real pet sessions, live World Boss contributor coverage and actual game-window/input/audio behavior remain separate acceptance checks in [RELEASING](../RELEASING.md). Browser demonstrations are synthetic and stay disabled in native sessions.

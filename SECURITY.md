# Privacy and security reports

Luma keeps encounters, settings, imported game reports and exported documents on the local computer. It does not automatically upload combat records or require an account. The calendar service reads three fixed public HTTPS subscriptions and sends no character or encounter data. The optional OBS listener binds only to `127.0.0.1`, starts on request and requires its session token for every endpoint. Treat that complete URL as private.

Hidden Cube listening starts automatically with the AION2 process tree as its source and waits when the game is absent. Older preferences without the automatic-listening field use this default. An explicit stop saves an opt-out for later launches. Automatic listening never switches to system output and does not open a microphone. Explicitly selecting system output for a manual session includes other applications' rendered audio. Live PCM exists only in bounded analysis buffers and is not recorded or uploaded. Selected WAV/M4A references are decoded in memory with 8 MB, 30-second and format limits. Only the resulting spectral template is retained in the local application data directory as `cube-reference.json`; the included built-in spectral template is separately packaged in the source.

For ordinary bugs, use the published repository's Issues with the application version, Windows build, game region, reproduction steps and a sanitized screenshot/error. Remove character names if desired. Do not attach raw captures, private settings, OBS tokens or unreviewed probe/history files publicly. Anonymous encounter export is available for selected-scope reports.

For a security issue, use the repository's private **Report a vulnerability** option when enabled. If no private channel is available, ask the publisher for one without posting exploit details or private data in a public issue. Report the affected version, reproduction conditions and impact privately. This preview has no claimed response-time guarantee.

The publisher can configure private reporting in the repository's security settings. Application-specific terms are in `LICENSE`; dependency notices remain separate.

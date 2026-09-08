# Encore validation — September 7, 2026

## Automated checks

- Production bundle and ESLint pass.
- Node tests cover URL validation; deterministic practice grids; hostile/malformed charts; perfect/good/miss timing; pause stability; seek resets; chord and strum judgments; double-scoring prevention; silence detection; known synthetic audio attack timing; controller identity/axis mapping; short keyboard taps; repeated key suppression; disconnect cleanup; audio-clock preroll/pause/resume; teardown during pending audio resume; sampled iframe clock interpolation, buffering, rate changes and seek re-anchoring.
- The eight-attack synthetic recording is detected within 40 ms of each known attack, with no notes during its silent gap. This does not establish accuracy on arbitrary commercial recordings or guitar transcription.
- No new runtime dependencies were added. React/Vite dependency versions were retained.

## Browser verification blocked

The browser tool twice refused to open the localhost app because its enforced security policy could not be verified. This was a tool-policy failure, not a rendering or playback result. No alternate browser automation or policy bypass was attempted.

Consequently the visual layout, actual decoding/playback, file picker/drop, YouTube embed/network behavior, fullscreen, Safari/Chrome behavior, and accessibility interactions remain unverified in a live browser. The source compiles, but that is not end-to-end verification.

## Remaining concrete acceptance checks

1. Run the built app and play the included demo. Confirm notes meet the line at audio attacks; pause, wait, resume, and finish the set. Verify score/history updates exactly once.
2. Import a representative MP3 and WAV, switch difficulty, cancel a long analysis by changing source, and try a protected/invalid file. Test custom-chart validation, export/reimport, and notes near the end of a song.
3. Play an embeddable YouTube recording, configure known BPM/first beat, pause inside the player, trigger buffering, seek, and change playback speed. Test an unavailable/restricted video and retry from the studio.
4. Add the same recording's video to local audio; verify muted video, video offset, pause/resume, and mismatch behavior. Supply a restricted YouTube API key to test candidate lookup, empty results, quota failure and manual selection.
5. On the actual Wii Remote + guitar and Mac, first establish pairing/virtual gamepad exposure through a compatible native helper. Then map and test every fret, both strum directions, a chord, star power, and disconnection. Neither pairing nor macOS 26 compatibility is established by this change.
6. Inspect desktop and narrow layouts, keyboard navigation, focus visibility, the controller dialog, reduced-motion behavior, and remapped fret labels. Confirm video controls remain unobscured.

## Delivery boundary

This is a reviewable browser implementation. Subscription-streaming connections, a native Wii Bluetooth driver, authored guitar transcription, signed desktop packaging, and a deployed release are not included. Their constraints and the available alternatives are documented in README.md and surfaced in the app.

## BPM and immersive-stage follow-up

Added synthetic pulse tests at 75, 90, 120, 155 and 180 BPM with offbeat fills; silence/short-input tests; distinct YouTube error 150/153 mappings; and mocked capture lifecycle tests covering audio-only recording, no-audio selection, cancellation during the picker, active cancellation, and releasing every sharing track.

The user reports error 150 for the Judas Priest video WtuoFv4dcwM. This matches YouTube's documented owner-embedding restriction; the browser tool still cannot inspect live playback because the enforced-policy check is unavailable. The restored full-stage backdrop, native video-control view, brightness/opacity sliders, tab sharing, actual captured-container decoding, and detection on commercial recordings require live browser acceptance. Code/tests passing do not establish those results.


## Native YouTube fallback follow-up

The user subsequently reported all attempted songs failing and supplied a screenshot of Led Zeppelin with error 150. There is no verified explanation for the difference from the original app. A native-watch-page extension was added as a separate playback path, using the existing YouTube video instead of an embedded player. The embed origin is real and the page now declares a referrer policy explicitly; no confirmed embed repair is claimed.

All 31 Node tests, lint, app build, and extension build pass. A synthetic DOM/media lifecycle test verifies video-clock scoring, pause stability, waiting through ads, and listener cleanup; it is not a real browser or YouTube test. Additional automated checks cover handoff round-trips, settings bounds, malformed hashes, and exclusion of local media/credentials from URLs. The extension bundles with no new runtime dependencies. Live extension installation, watch-page injection, synchronization, video-frame drawing, pause/seek, fullscreen, keyboard conflicts, ads, source changes, and cleanup still need acceptance testing. Browser access was again refused by the tool policy verifier; no alternate automation route was attempted.


## Native 0.4 gameplay and listening

The user confirmed native 0.3 gameplay works and supplied a screenshot. This supersedes the earlier unknown baseline for their browser, but does not validate these new changes. Native 0.4 introduces gem rendering, sustains, chord accents, combo/bonus meters, whole-song shared-tab feature extraction, automatic BPM, and recording-tagged chart exports.

37 Node tests pass, including new hold scoring/early release/seek reset, duration and overlap rejection, synthetic audio rests/sustains/difficulty accents, and mocked pre-listen timestamps, ad/pause exclusion, seek rejection, capture cancellation and cleanup. Lint and both builds pass. A fresh browser inspection attempt was again rejected by the enforced-policy verifier; no indirect workaround was used.

Remaining acceptance: reload extension 0.4, listen through the same Whole Lotta Love recording with this tab’s audio shared, replay and calibrate if needed; inspect the gems and tails, complete/release a chord sustain, trigger the bonus via Space and button, exercise mid-roll/paused listening, save/import the matching chart and reject a mismatched recording. Confirm audio capture and scoring on the actual browser. Full-mix detection does not establish guitar-only accuracy or absence of notes during guitar rests when other instruments continue.


## Crowd restoration

Confirmed the four MP3 assets and crowd logic in original commit 3825830. Restored playback through a shared crowd controller in the app and extension. All 40 tests and lint pass; both builds pass. New tests cover milestone/bonus cooldowns, sustained misses versus rests/seeks, and suppression of pending audio after pause/mute/disposal. The package contains all four original assets. Actual sound balance and browser resource/audio permissions remain unverified here.


## Native 0.5 save repair and quiet preparation

The user's screenshot showed the initial BPM-practice-grid state after reported full-song listening, with no saved confirmation. The former Save action merely clicked a download link; no persistent library existed. Listener polling also checked ads before completion, and navigation removed the overlay's in-memory chart. These are source-confirmed failure paths, not a live diagnosis of the exact screenshot.

45 Node tests and lint pass. Extension bundles include separate background/offscreen/player-bridge/library files. Tests cover persistent chart round-trip and quota errors, original-duration completion before a post-song ad, user-invoked capture/busy gating, stale/ad/pause clock suspension, and a synthetic offscreen lifecycle proving save-before-ready plus pause-before-capture-release on completion/cancellation/failure. These are mocks, not browser integration. The Downloads folder was inaccessible to the shell, so existence of a previous downloaded JSON could not be checked.

Live acceptance remains: approve the updated extension's storage/capture permissions if prompted, prepare a short video from its popup, switch away, verify silence and progress, cancel once, complete once with an ad transition, reopen and load the saved chart, inspect JSON backup in browser Downloads. Verify Chrome/Brave offscreen resource loading, user-gesture capture eligibility, autoplay, context lifetime, save errors and library restoration. The existing browser-policy block prevents that verification here. No claim of a shipped server or unattended playlist queue is made.


## Native 0.6: arcade controls and feedback

Bar chords can be switched off in setup for single-fret play, retaining note timing and sustain lengths. The stored source chart remains intact. Nightmare Hero is bundled across the app, extension, and setup/library pages; attribution and source are in public/fonts/SOURCE.txt. The native HUD now has a framed score counter, circular multiplier, streak counter, and glowing bonus tubes. Center-screen hit judgments are removed; 50-note multiples briefly appear at the top and fade over 1.4 seconds.

Native gameplay reserves Space for star power, including when a button has focus; P or Enter pauses. The web app retains its configurable bindings (Enter pauses by default). Bonus activation immediately cheers and restores the original layered synthetic arena ambience; it does not apply reverb to YouTube's audio. Five consecutive misses trigger boos subject to the reaction cooldown. Successful hits reset that miss run; rests and seeks cannot manufacture a boo. Crowd volume also controls the bonus ambience.

Reload extension 0.6.0 and refresh the YouTube page. Automated keyboard, chart, milestone and reaction checks pass. Browser policy prevents live visual/audio verification of this update; no live acceptance claim is made.

Validation: 48 Node tests pass; production app and extension builds and lint pass.


## Typography 0.6.1

Nightmare Hero is limited to display headings, branding, and streak celebrations. Barlow Condensed Medium/SemiBold handles smaller copy, forms, controls, counters, and fret labels across the app and extension. Fonts and the Barlow OFL license are bundled locally. Small native instructions and popup copy have larger type. Lint, both builds, and 48 existing tests pass; live visual verification remains blocked by browser policy.


## Gameplay 0.7

All chart sources, including previously saved charts, now pass through the selected difficulty arrangement. Easy uses four frets, single notes, minimum 0.8-second spacing, a 4.5-second approach and a 220 ms hit window. Medium uses minimum 0.42-second spacing, at most two-fret chords, a 3.4-second approach and a 180 ms window. Expert retains its 2.4-second approach and 140 ms window. Onset times remain unchanged; this slows the highway and reduces density without slowing the recording. Orange is disabled on Easy. Remapped sustain tails are trimmed to avoid overlapping frets.

The crowd meter starts at 70/100, gains two on a hit, loses five per Easy miss or seven otherwise, and ends the set at zero. Failure stops scoring and requires a fresh set. Boos intensify as health falls, with a three-second cooldown in danger; a synthetic detuned guitar clang accompanies repeated-miss reactions. Single misses are silent. Good/perfect hits create 0.32-second flame bursts; successfully held notes keep flames lit, and star power turns effects cyan. Reduced-motion uses smaller stable flames.

Bonus cheers loop through the eight-second power window, resume for the remaining duration after pause, and use a stronger level. The extension Play invocation now obtains tab audio and forwards dry playback through its offscreen document, with a parallel 190 ms feedback echo enabled only during bonus. No new permissions. Messages are restricted to the captured tab, and a six-second lost-heartbeat timeout releases capture. Quiet preparation and gameplay capture are mutually exclusive. The local-audio transport uses the same wet-only echo. Direct video capture is a fallback; iframe audio remains inaccessible. Audible mixing, capture latency, ads, real browser lifecycle, and flame appearance still require live acceptance because browser inspection is blocked.

Completed native runs can be saved with a display name to one storage key per attempt, including exact video ID, ruleset, chart SHA-256, difficulty, chord setting, play style, score, accuracy and best streak. Library shows history and exports score JSON. Saves are idempotent within the result view and storage failures are visible. Failed, sought or changed-speed native runs are not offered as eligible scores. Web sessions also save named history (up to 500 entries). These are local records, not verified identities or anti-cheat claims.

A SQLite community leaderboard prototype is in server/leaderboard.js. It has validated submissions, idempotent IDs, basic rate limiting and rankings separated by exact video and chart/settings. It is tested locally but not hosted or connected to the extension. See server/README.md for the remaining public-service work. No public global leaderboard exists yet.

Validation: 57 tests, lint and both production builds pass. The suite covers difficulty/hold mapping, failure/restart, score persistence, leaderboard HTTP behavior, sustained cheers, wet-only echo controls, and offscreen dry-output/ownership/cleanup. Live browser verification remains blocked.

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

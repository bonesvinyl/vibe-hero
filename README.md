# Vibe Hero — Encore

A five-fret rhythm game for your own music, built with React 19 and Vite. The Encore rebuild replaces random timer-driven notes with deterministic charts and playback-clock timing.

## Run locally

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. Choose **Try a demo**, **Take the stage**, then **Play set** for the included original 32-second groove. No account, API key, or audio upload is required.

```sh
npm test
npm run lint
npm run build
```

## Music sources

| Source                             | Available behavior                                                                              | Limits                                                                                                           |
| ---------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Local MP3 / WAV / M4A / FLAC / OGG | Decode locally, analyze attacks, generate a chart, play using the audio clock                   | Format support depends on the browser. Unprotected files only; 100 MB / 20 minutes maximum                       |
| YouTube                            | Embedded video with a BPM practice grid, tap tempo, first-beat offset, or imported chart        | Embeds do not expose decoded audio. No claim of automatic song transcription; embedding restrictions still apply |
| Local audio + YouTube video        | Full-stage muted video behind the highway follows the local song; adjustable video start offset | Select the same recording/edit. Ads, buffering, and alternate cuts can disrupt the visual match                  |
| Spotify / Apple Music              | Source panel explains the current service constraints                                           | No OAuth or subscription playback integration; standard developer terms restrict this game use                   |

Local analysis uses positive spectral flux, autocorrelation tempo estimation, adaptive peak selection, and difficulty-dependent minimum note spacing in a Web Worker. Notes retain detected attack times; they are not forced onto an estimated BPM grid. Lanes reflect spectral brightness, **not guitar pitch transcription**. Dense mixes can over- or under-detect notes. Tempo is an approximate display estimate with half/double-tempo ambiguity.

For a truly authored guitar part, import a chart for the exact recording. Future stem separation and pitch/riff analysis would be a separate, measured upgrade.

## Controls

Default controls use the familiar Guitar Hero color order: green, red, yellow, blue, orange.

- **A S D F G**: frets, left to right.
- **Enter**: pause / resume.
- **Space**: activate eight seconds of double points after filling star power.
- **Arrow Up / Down**: strum in Guitar / strum mode.
- **Keyboard / tap**: each fret press judges its lane. Chords require every fret.
- **Guitar / strum**: hold the exact frets, then strum. Extra frets and empty strums break the streak.

Open **Controllers** to map keyboard keys, gamepad buttons, or signed axes. Release an input before mapping it. Bindings persist on this browser. The live tester shows held controls; device selection uses the reported controller identity. Two identical model devices cannot currently be distinguished. Disconnecting a gamepad, hiding the tab, or losing focus pauses an active game.

## Wii Remote inside a guitar

This setup requires a native helper that exposes the guitar as a gamepad. The browser alone does not pair a Wii Remote.

[WiiController](https://github.com/WiiController/WiiController) advertises Guitar Hero 3 extension support and a virtual HID gamepad. Its [latest release, v0.14.0](https://github.com/WiiController/WiiController/releases/tag/v0.14.0), is from July 2021 and reports testing through macOS 11.4. That is **not evidence of compatibility with current macOS**, including this development Mac's Apple Silicon / macOS 26.6.1 setup.

If a compatible helper is available: connect the guitar extension to the remote, pair through the helper, then open Controllers in Vibe Hero and press a fret. Verify that a device appears, map five frets and both strum directions, and test held-fret-plus-strum input on the demo. Physical pairing and input have not been verified in this change. No helper or driver was installed and no system Bluetooth settings were changed.

A Wii-to-USB adapter is an alternative if wireless pairing is unavailable. Check its [Mac support and mode instructions](https://wiki.retrocultmods.com/main/v3-quickstart/) before choosing hardware; XInput and HID/keyboard modes are different.

## Timing

All notes store song-relative timestamps. Local playback uses the Web Audio clock and a 2.4-second preroll. YouTube uses its reported playback time with bounded interpolation between samples, freezing during pause/buffering and re-anchoring on new samples. Rendering and input judgments use the same clock and hit-line geometry.

- Perfect: within 55 ms; Good: within 140 ms.
- Combo multiplier: up to 4×; star power adds 2×.
- Positive timing calibration moves notes **later**, up to ±500 ms.
- Video offset is independent: a positive value skips an intro in the video.
- A backward seek over 250 ms or a forward discontinuity over one second resets the attempt, marking past notes skipped. Rewinding cannot accumulate points from the same attempt.
- Only completed sets enter the new local history. Existing legacy favorites are read, and legacy username/high-score/stat keys are left intact. Scores from the old random engine are not compared with the new system.

## Custom charts

In **Fine-tune your set**, import or export JSON:

```json
{
  "version": 1,
  "title": "Artist — exact recording",
  "notes": [
    { "time": 2.5, "lanes": [0] },
    { "time": 3.0, "lanes": [1, 3] }
  ]
}
```

Times are seconds from audio/video start. Lanes are 0–4. Notes must be strictly ordered, at least 40 ms apart, and inside the track duration. Chords are one timestamp with multiple unique lanes. Limits: 20,000 notes / 2 MB. Difficulty does not rewrite an imported chart. Sustain/whammy/pitch-bend chart events are not implemented.

## Music video search

A **Search YouTube** link builds a query from the editable song title; paste your chosen video's URL into Fine-tune. It works without credentials.

To enable **Find video matches** inside the app, copy `.env.example` to `.env.local`, supply a YouTube Data API v3 key, and restart Vite. The app requests up to five embeddable candidates; the user chooses the matching edit. Configure HTTP-referrer and API restrictions: `VITE_` values are public browser configuration. Search uses API quota and sends the song title to Google, not the local audio. Matching has not been live-tested with an API key.

## Spotify and Apple Music

As checked September 7, 2026:

- [Spotify Developer Policy](https://developer.spotify.com/policy) prohibits creating games and synchronizing sound recordings with visual media.
- [Apple Developer Program License Agreement, section 3.3.6(D)](https://developer.apple.com/support/terms/apple-developer-program-license-agreement/) restricts synchronizing MusicKit content with other content unless otherwise permitted by Apple in its documentation.

A subscription is not a source of downloadable PCM for the analysis worker. Do not add a token field that promises functionality these services do not support under the standard terms. A future provider integration needs an expressly permitted design or appropriate permissions.

## Mac app option

The app remains a browser app, with a standalone web manifest and icon. On supported macOS, [Safari's Add to Dock](https://support.apple.com/en-us/104996) provides a separate app window. A local server must remain running for a local URL; this change does not bundle a signed native executable or provide offline app-shell caching. No deployment was made.

## Implementation and validation

- `src/game/`: pure judgment/chart logic, audio analysis worker, transports, canvas rendering, controller bindings.
- `src/components/`: gameplay session, controller setup, highway preview.
- `src/App.jsx`: song preparation, source selection, chart import/export, local history.
- `tests/`: deterministic audio fixtures, media clock, lifecycle and input behavior.

See [validation notes](docs/VALIDATION.md) for passed checks and the remaining live browser and hardware checks.

## Automatic BPM and the immersive stage

The YouTube setup now includes **Auto-detect BPM**. Choose a local copy of the song or **Listen to a song tab**. For tab detection, play a steady section of the song in another browser tab, choose that tab in the sharing picker, and enable **Share tab audio**. The app records 20 seconds of audio only into memory, estimates tempo locally, and applies it to the BPM field. All sharing tracks stop on completion, cancellation, errors, or leaving the detector. Video frames are never recorded or uploaded. Browser tab-audio support varies; Chrome/Edge are the intended path, with a file picker fallback. No microphone is requested.

The estimator tests repeating periods across the onset envelope and handles longer-period aliases from fills. It reports pulse strength and does not promise perfect tempo on arbitrary music. Half/double-tempo controls remain available. Detection sets tempo only: the first-beat offset still needs to match the exact recording. Tab samples are used for tempo, not a full-song chart. File import on the Local audio tab continues to analyze the full song and generate timestamped notes.

[BPM Database](https://www.bpmdatabase.com/music/search/) is linked for manual lookup. Its [terms](https://www.bpmdatabase.com/terms/) prohibit automated collection without express written consent, so the app does not scrape it.

Videos now render behind the fretboard across the stage. Brightness and highway-opacity sliders let the player balance immersion and readability. **Video controls** pauses the game and exposes the native player; **Back to fretboard** pauses the video, and seeking during that preview resets the attempt when returning. Local audio without a video retains the studio backdrop.

YouTube errors are now differentiated. Error **150** (reported for `WtuoFv4dcwM`) means the owner disallows embedded playback, like error 101. A video can play on youtube.com while refusing playback in this game. Error **153** instead indicates missing player identification/referrer information. The app links to the original video and suggests another upload or local audio rather than treating every error as a generic restriction. See the [official error definitions](https://developers.google.com/youtube/iframe_api_reference#onError).

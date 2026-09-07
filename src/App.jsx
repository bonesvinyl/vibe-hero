import { useCallback, useEffect, useRef, useState } from "react";
import Controllers from "./components/Controllers";
import HighwayPreview from "./components/HighwayPreview";
import Session from "./components/Session";
import TempoDetection from "./components/TempoDetection";
import { analyzeBuffer, decodeFile, demoBuffer } from "./game/audio";
import { COLORS, validateChart, youtubeId } from "./game/chart";
import { loadBindings, readStored, writeStored } from "./game/controller";
import { videoMetadata } from "./game/youtube";
import "./App.css";

const sources = [
  { id: "local", title: "Local audio", icon: "↥" },
  { id: "youtube", title: "YouTube", icon: "▷" },
  { id: "streaming", title: "Streaming", icon: "♫" },
];
const safeArray = (value) => (Array.isArray(value) ? value : []);

export default function App() {
  const [source, setSource] = useState("local"),
    [track, setTrack] = useState(null),
    [title, setTitle] = useState("");
  const [url, setUrl] = useState(""),
    [backdrop, setBackdrop] = useState(""),
    [videoOffset, setVideoOffset] = useState(0);
  const [difficulty, setDifficulty] = useState("medium"),
    [mode, setMode] = useState("tap"),
    [bpm, setBpm] = useState(120),
    [firstBeat, setFirstBeat] = useState(2.5);
  const [offset, setOffset] = useState(() => {
    const v = readStored("vh.offset.v2", 0);
    return Number.isFinite(v) && Math.abs(v) <= 500 ? v : 0;
  });
  const [bindings, setBindings] = useState(loadBindings),
    [controllers, setControllers] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [analysis, setAnalysis] = useState(null),
    [imported, setImported] = useState(null),
    [session, setSession] = useState(null),
    [dragging, setDragging] = useState(false);
  const [history, setHistory] = useState(() =>
    safeArray(readStored("vh.history.v2", [])).filter(
      (v) => typeof v?.title === "string" && Number.isFinite(v.score),
    ),
  );
  const [favorites, setFavorites] = useState(() =>
    safeArray(readStored("favorites", [])).filter(
      (v) => typeof v?.videoId === "string" && /^[\w-]{11}$/.test(v.videoId),
    ),
  );
  const [videoMatches, setVideoMatches] = useState([]),
    [searching, setSearching] = useState(false);
  const task = useRef(null),
    request = useRef(0),
    taps = useRef([]),
    videoSearch = useRef(null);
  useEffect(
    () => () => {
      task.current?.abort();
      videoSearch.current?.abort();
    },
    [],
  );

  const cancel = () => {
    request.current++;
    task.current?.abort();
    videoSearch.current?.abort();
    setSearching(false);
    setBusy(false);
  };
  const changeSource = (id) => {
    cancel();
    setSource(id);
    setError("");
    setImported(null);
    setVideoMatches([]);
  };
  async function loadAudio(file, level = difficulty, demo = false) {
    if (!file && !demo) return;
    cancel();
    const id = ++request.current,
      controller = new AbortController();
    task.current = controller;
    setBusy(true);
    setError("");
    setAnalysis(null);
    setTrack(null);
    setImported(null);
    setBackdrop("");
    setVideoMatches([]);
    setSource("local");
    try {
      const buffer = demo ? demoBuffer() : await decodeFile(file);
      if (id !== request.current) return;
      const name = demo
        ? "After Hours — studio groove"
        : file.name.replace(/\.[^.]+$/, "").replaceAll("_", " ");
      setTitle(name);
      const result = await analyzeBuffer(buffer, level, controller.signal);
      if (id !== request.current) return;
      setTrack({
        buffer,
        name,
        id: demo ? "demo-v1" : `${file.name}:${file.size}:${file.lastModified}`,
      });
      setAnalysis(result);
      if (result.bpm) setBpm(result.bpm);
      if (!result.notes.length)
        setError(
          "No clear attacks detected. Try another recording or import a custom chart.",
        );
    } catch (cause) {
      if (id === request.current && cause.name !== "AbortError")
        setError(
          cause.message ||
            "Could not decode this file. Try an unprotected MP3, WAV, M4A, or FLAC.",
        );
    } finally {
      if (id === request.current) setBusy(false);
    }
  }
  async function changeDifficulty(value) {
    setDifficulty(value);
    if (!track || source !== "local" || imported) return;
    cancel();
    const id = ++request.current,
      controller = new AbortController();
    task.current = controller;
    setBusy(true);
    setError("");
    try {
      const result = await analyzeBuffer(
        track.buffer,
        value,
        controller.signal,
      );
      if (id === request.current) setAnalysis(result);
    } catch (cause) {
      if (id === request.current && cause.name !== "AbortError") {
        setAnalysis(null);
        setError(cause.message);
      }
    } finally {
      if (id === request.current) setBusy(false);
    }
  }
  async function importChart(file) {
    if (!file) return;
    const operation = request.current;
    try {
      if (file.size > 2 * 1024 * 1024)
        throw new Error("Chart files must be under 2 MB.");
      const value = JSON.parse(await file.text());
      if (operation !== request.current) return;
      validateChart(
        value,
        source === "local" && track ? track.buffer.duration : 1200,
      );
      setImported(value);
      setError("");
    } catch (cause) {
      setError(`Chart not loaded: ${cause.message}`);
    }
  }
  function exportChart() {
    const notes = imported?.notes || analysis?.notes;
    if (!notes?.length) return;
    const value = { version: 1, title, notes };
    const href = URL.createObjectURL(
      new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
    );
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = "vibe-hero-chart.json";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }
  async function start() {
    setError("");
    if (
      source === "local" &&
      (!track || !(imported?.notes.length || analysis?.notes.length))
    ) {
      setError("Choose a song with a chart first.");
      return;
    }
    const id = youtubeId(source === "local" ? backdrop : url);
    if ((source === "youtube" || backdrop.trim()) && !id) {
      setError("Paste a valid YouTube video URL.");
      return;
    }
    if (
      !Number.isFinite(videoOffset) ||
      Math.abs(videoOffset) > 300 ||
      !Number.isFinite(bpm) ||
      bpm < 40 ||
      bpm > 240 ||
      !Number.isFinite(firstBeat) ||
      firstBeat < 0 ||
      firstBeat > 120
    ) {
      setError(
        "Check BPM (40–240), first beat (0–120 seconds), and video offset (−300 to 300 seconds).",
      );
      return;
    }
    const config = {
      source,
      buffer: source === "local" ? track.buffer : null,
      notes:
        source === "local"
          ? imported
            ? validateChart(imported, track.buffer.duration)
            : analysis.notes
          : null,
      imported,
      difficulty,
      mode,
      bpm,
      firstBeat,
      offset,
      videoId: id,
      videoOffset,
      title: source === "local" ? title || track.name : "YouTube session",
      chartLabel: imported
        ? "Custom chart"
        : source === "local"
          ? "Audio-analyzed chart"
          : "BPM practice grid",
      identity: source === "local" ? track.id : id,
    };
    if (source === "youtube") {
      cancel();
      const op = ++request.current,
        controller = new AbortController();
      task.current = controller;
      setBusy(true);
      const timeout = setTimeout(() => controller.abort(), 4000);
      try {
        const metadata = await videoMetadata(id, controller.signal);
        config.title = metadata.title || config.title;
      } catch {
        /* Playback does not depend on optional oEmbed metadata. */
      } finally {
        clearTimeout(timeout);
        if (op === request.current) setBusy(false);
      }
      if (op !== request.current) return;
    }
    setSession(config);
  }
  const recordResult = useCallback(
    (result) => {
      setHistory((previous) => {
        const next = [
          {
            title: session.title,
            score: result.score,
            accuracy: result.accuracy,
            difficulty: session.difficulty,
            mode: session.mode,
            date: new Date().toISOString(),
          },
          ...previous,
        ].slice(0, 30);
        writeStored("vh.history.v2", next);
        return next;
      });
    },
    [session],
  );
  function favorite() {
    const id = youtubeId(url);
    if (!id) {
      setError("Add a valid YouTube URL before saving.");
      return;
    }
    const next = favorites.some((f) => f.videoId === id)
      ? favorites.filter((f) => f.videoId !== id)
      : [...favorites, { videoId: id, url, title: `YouTube · ${id}`, bpm }];
    setFavorites(next);
    writeStored("favorites", next);
  }
  function tapTempo() {
    const now = performance.now();
    taps.current = [...taps.current.filter((t) => now - t < 4000), now].slice(
      -8,
    );
    if (taps.current.length >= 3) {
      const delta = (now - taps.current[0]) / (taps.current.length - 1);
      setBpm(Math.min(240, Math.max(40, Math.round(60000 / delta))));
    }
  }
  async function findVideo() {
    const key = import.meta.env.VITE_YOUTUBE_API_KEY;
    if (!key || !title.trim()) return;
    videoSearch.current?.abort();
    const controller = new AbortController();
    videoSearch.current = controller;
    setSearching(true);
    setError("");
    setVideoMatches([]);
    try {
      const query = new URLSearchParams({
        key,
        part: "snippet",
        type: "video",
        videoEmbeddable: "true",
        maxResults: "5",
        q: `${title} official music video`,
      });
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?${query}`,
        { signal: controller.signal },
      );
      if (!response.ok)
        throw new Error(
          "Video search is unavailable. Check the YouTube API key/quota, or use Search YouTube.",
        );
      const data = await response.json();
      if (!controller.signal.aborted) setVideoMatches(data.items || []);
    } catch (cause) {
      if (cause.name !== "AbortError") setError(cause.message);
    } finally {
      if (!controller.signal.aborted) setSearching(false);
    }
  }

  if (session)
    return (
      <Session
        config={session}
        bindings={bindings}
        onExit={() => setSession(null)}
        onResult={recordResult}
      />
    );
  return (
    <div className="studio-shell">
      <header className="topbar">
        <a href="./" className="wordmark" aria-label="Vibe Hero home">
          vibe<span>hero</span>
          <sup>02</sup>
        </a>
        <nav aria-label="Studio navigation">
          <a className="nav-active" href="#studio">
            The studio
          </a>
          <button className="text-button" onClick={() => setControllers(true)}>
            Controllers <span>↗</span>
          </button>
        </nav>
        <span className="edition">
          <i className="status-light connected" /> ENCORE EDITION
        </span>
      </header>
      <main id="studio">
        <section className="intro">
          <div>
            <span className="eyebrow">YOUR MUSIC. YOUR MAIN STAGE.</span>
            <h1>
              One more <em>song.</em>
            </h1>
          </div>
          <p>
            Pick a track. Find your rhythm.
            <br />
            Make a little noise.
          </p>
        </section>
        <div className="studio-grid">
          <section className="setup-panel" aria-labelledby="setup-heading">
            <div className="section-heading">
              <h2 id="setup-heading">
                <span className="section-number">01</span> Build your set
              </h2>
              <span className="small">NO ACCOUNT NEEDED</span>
            </div>
            <div
              className="source-tabs"
              role="tablist"
              aria-label="Music source"
            >
              {sources.map((item) => (
                <button
                  role="tab"
                  aria-selected={source === item.id}
                  key={item.id}
                  onClick={() => changeSource(item.id)}
                >
                  <span>{item.icon}</span>
                  {item.title}
                </button>
              ))}
            </div>
            {source === "local" && (
              <div className="source-content">
                <label
                  className={`dropzone ${dragging ? "dragging" : ""}`}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragging(false);
                    loadAudio(event.dataTransfer.files[0]);
                  }}
                >
                  <input
                    type="file"
                    accept="audio/*,.mp3,.wav,.m4a,.flac,.ogg"
                    aria-label="Choose local audio file"
                    disabled={busy}
                    onChange={(event) => {
                      loadAudio(event.target.files[0]);
                      event.target.value = "";
                    }}
                  />
                  <span className="upload-icon">
                    {busy ? "◌" : track ? "✓" : "↥"}
                  </span>
                  <strong>
                    {busy
                      ? "Listening for the notes…"
                      : track
                        ? track.name
                        : "Drop a song here"}
                  </strong>
                  <span>
                    {busy
                      ? "Analyzing the audio on your Mac"
                      : "or click to browse your files"}
                  </span>
                  <small>MP3, WAV, M4A, FLAC · Up to 100 MB / 20 min</small>
                </label>
                <div className="file-note">
                  <span>
                    <i className="status-light connected" /> Audio stays on this
                    device.
                  </span>
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => loadAudio(null, difficulty, true)}
                  >
                    Try a demo ↗
                  </button>
                </div>
                {track && (
                  <div className="track-details">
                    <label>
                      Song title
                      <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                      />
                    </label>
                    <div className="analysis-line">
                      <span>{Math.round(track.buffer.duration)} sec</span>
                      <span>
                        {imported
                          ? imported.notes.length
                          : analysis?.notes.length || 0}{" "}
                        notes
                      </span>
                      <span>
                        {analysis?.bpm
                          ? `≈ ${analysis.bpm} BPM`
                          : "No tempo estimate"}
                      </span>
                    </div>
                    <p className="small">
                      {imported
                        ? "Using your imported chart."
                        : "Notes follow detected audio attacks. Lane choices are generated, not a transcription of the guitar part."}
                    </p>
                  </div>
                )}
              </div>
            )}
            {source === "youtube" && (
              <div className="source-content youtube-source">
                <label>
                  YouTube video URL
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => {
                      cancel();
                      setUrl(e.target.value);
                      setImported(null);
                    }}
                    placeholder="https://www.youtube.com/watch?v=…"
                  />
                </label>
                <p>
                  Play along with a music video. Use a BPM grid for practice, or
                  import a chart made for the exact recording.
                </p>
                <TempoDetection
                  key={youtubeId(url) || url}
                  videoId={youtubeId(url)}
                  onDetected={setBpm}
                />
                <div className="tempo-fields">
                  <label>
                    BPM
                    <input
                      type="number"
                      min="40"
                      max="240"
                      value={bpm}
                      onChange={(e) => setBpm(Number(e.target.value))}
                    />
                  </label>
                  <label>
                    First beat (sec)
                    <input
                      type="number"
                      min="0"
                      max="120"
                      step="0.05"
                      value={firstBeat}
                      onChange={(e) => setFirstBeat(Number(e.target.value))}
                    />
                  </label>
                  <button onClick={tapTempo}>Tap tempo</button>
                </div>
                <div className="chart-actions tempo-multiples">
                  <button
                    disabled={bpm / 2 < 40}
                    onClick={() => setBpm(bpm / 2)}
                  >
                    ½ tempo
                  </button>
                  <button
                    disabled={bpm * 2 > 240}
                    onClick={() => setBpm(bpm * 2)}
                  >
                    2× tempo
                  </button>
                </div>
                <div className="file-note">
                  <span className="small">
                    YouTube audio cannot be analyzed inside its embed.
                  </span>
                  <button className="text-button" onClick={favorite}>
                    {favorites.some((f) => f.videoId === youtubeId(url))
                      ? "★ Saved"
                      : "☆ Save video"}
                  </button>
                </div>
              </div>
            )}
            {source === "streaming" && (
              <div className="source-content streaming-info">
                <h3>Your library has a few limits.</h3>
                <p>
                  Spotify’s developer policy prohibits games. Apple Music’s
                  terms restrict synchronizing MusicKit content with other
                  content. Account connections for gameplay are unavailable
                  under those standard terms.
                </p>
                <div className="service-row">
                  <strong>Spotify</strong>
                  <a
                    href="https://developer.spotify.com/policy"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Developer policy ↗
                  </a>
                </div>
                <div className="service-row">
                  <strong>Apple Music</strong>
                  <a
                    href="https://developer.apple.com/support/terms/apple-developer-program-license-agreement/#:~:text=MusicKit%20Content%20cannot"
                    target="_blank"
                    rel="noreferrer"
                  >
                    MusicKit terms ↗
                  </a>
                </div>
                <p>
                  Use an unprotected audio file you own, including eligible
                  purchased downloads. Subscription downloads are protected and
                  cannot be imported.
                </p>
                <button onClick={() => changeSource("local")}>
                  Choose local audio →
                </button>
              </div>
            )}
            {source !== "streaming" && (
              <>
                <div className="section-heading subsection">
                  <h2>
                    <span className="section-number">02</span> Find your level
                  </h2>
                </div>
                <div className="difficulty-options">
                  {[
                    {
                      id: "easy",
                      title: "Easy",
                      sub: "Find the groove",
                      bars: 1,
                    },
                    {
                      id: "medium",
                      title: "Medium",
                      sub: "Turn it up",
                      bars: 2,
                    },
                    {
                      id: "expert",
                      title: "Expert",
                      sub: "Let it rip",
                      bars: 3,
                    },
                  ].map((item) => (
                    <button
                      disabled={busy || !!imported}
                      key={item.id}
                      aria-pressed={difficulty === item.id}
                      onClick={() => changeDifficulty(item.id)}
                    >
                      <span className="level-bars">
                        {[0, 1, 2].map((i) => (
                          <i
                            key={i}
                            className={i < item.bars ? "filled" : ""}
                          />
                        ))}
                      </span>
                      <strong>{item.title}</strong>
                      <small>{item.sub}</small>
                    </button>
                  ))}
                </div>
                <div className="play-mode">
                  <span>Play style</span>
                  <div>
                    <button
                      aria-pressed={mode === "tap"}
                      onClick={() => setMode("tap")}
                    >
                      Keyboard / tap
                    </button>
                    <button
                      aria-pressed={mode === "strum"}
                      onClick={() => setMode("strum")}
                    >
                      Guitar / strum
                    </button>
                  </div>
                </div>
                <details className="fine-tune">
                  <summary>
                    Fine-tune your set <span>+</span>
                  </summary>
                  <label className="range-label">
                    Timing offset{" "}
                    <strong>
                      {offset > 0 ? "+" : ""}
                      {offset} ms
                    </strong>
                    <input
                      type="range"
                      min="-500"
                      max="500"
                      step="5"
                      value={offset}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        setOffset(value);
                        writeStored("vh.offset.v2", value);
                      }}
                    />
                  </label>
                  <p className="small">
                    Positive values move notes later. If your hits feel late,
                    increase the offset. Use wired audio for the most consistent
                    timing.
                  </p>
                  <div className="chart-actions">
                    <label className="file-button">
                      Import chart
                      <input
                        type="file"
                        accept=".json,application/json"
                        disabled={busy}
                        onChange={(event) => {
                          importChart(event.target.files[0]);
                          event.target.value = "";
                        }}
                      />
                    </label>
                    <button
                      disabled={!(analysis?.notes.length || imported)}
                      onClick={exportChart}
                    >
                      Export chart
                    </button>
                    {imported && (
                      <button onClick={() => setImported(null)}>
                        Use generated chart
                      </button>
                    )}
                  </div>
                  {imported && (
                    <p className="small">
                      Custom chart loaded · {imported.notes.length} notes.
                      Difficulty does not modify imported charts.
                    </p>
                  )}
                  {source === "local" && track && (
                    <div className="backdrop-setup">
                      <label>
                        Music video URL (optional)
                        <input
                          type="url"
                          placeholder="Paste a matching YouTube video"
                          value={backdrop}
                          onChange={(e) => setBackdrop(e.target.value)}
                        />
                      </label>
                      <div className="file-note">
                        <a
                          href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${title} official music video`)}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Search YouTube ↗
                        </a>
                        {import.meta.env.VITE_YOUTUBE_API_KEY && (
                          <button disabled={searching} onClick={findVideo}>
                            {searching ? "Searching…" : "Find video matches"}
                          </button>
                        )}
                      </div>
                      {videoMatches.map((item) => (
                        <button
                          className="video-match"
                          key={item.id.videoId}
                          onClick={() =>
                            setBackdrop(
                              `https://www.youtube.com/watch?v=${item.id.videoId}`,
                            )
                          }
                        >
                          {item.snippet.title} ↗
                        </button>
                      ))}
                      <label>
                        Video start offset (sec)
                        <input
                          type="number"
                          min="-300"
                          max="300"
                          step="0.1"
                          value={videoOffset}
                          onChange={(e) =>
                            setVideoOffset(Number(e.target.value))
                          }
                        />
                      </label>
                      <p className="small">
                        The video is muted; your local track drives the game.
                        Positive offset skips a video intro. Different edits may
                        need manual adjustment.
                      </p>
                    </div>
                  )}
                </details>
                {error && (
                  <div className="error-message" role="alert">
                    {error}
                  </div>
                )}
                <button
                  className="primary start-button"
                  disabled={
                    busy ||
                    (source === "local" &&
                      (!track || !(analysis?.notes.length || imported))) ||
                    (source === "youtube" && !youtubeId(url))
                  }
                  onClick={start}
                >
                  {busy ? "Preparing your track…" : "Take the stage"}
                  <span>↗</span>
                </button>
              </>
            )}
          </section>
          <aside className="preview-panel">
            <div className="preview-heading">
              <span className="eyebrow">FIVE FRETS. INFINITE ENCORES.</span>
              <span className="live-tag">
                <i /> THE HIGHWAY
              </span>
            </div>
            <HighwayPreview />
            <div className="preview-caption">
              <span className="eyebrow">RIGHT ON THE LINE.</span>
              <h2>Feel every note.</h2>
              <p>
                Hit the frets as the notes cross the line.
                <br />
                Keep the streak. Chase the perfect set.
              </p>
              <div className="fret-legend">
                {["A", "S", "D", "F", "G"].map((key, i) => (
                  <kbd key={key} style={{ "--lane": COLORS[i] }}>
                    {key}
                  </kbd>
                ))}
              </div>
              <span className="small">
                Default keyboard controls · Enter to pause
              </span>
            </div>
            <div className="controller-callout">
              <span className="controller-symbol">⌘</span>
              <div>
                <strong>Got a real guitar?</strong>
                <p>Map your frets and strum bar.</p>
              </div>
              <button
                aria-label="Set up a guitar controller"
                onClick={() => setControllers(true)}
              >
                ↗
              </button>
            </div>
          </aside>
        </div>
        <section className="setlist">
          <div className="section-heading">
            <h2>
              <span className="section-number">↳</span> Your setlist
            </h2>
            <span className="small">SAVED ON THIS DEVICE</span>
          </div>
          {!history.length && !favorites.length ? (
            <div className="empty-setlist">
              <span>♪</span>
              <p>Your next favorite set starts here.</p>
              <button
                className="text-button"
                disabled={busy}
                onClick={() => loadAudio(null, difficulty, true)}
              >
                Warm up with the demo ↗
              </button>
            </div>
          ) : (
            <div className="setlist-rows">
              {history.slice(0, 5).map((entry, i) => (
                <div className="setlist-row" key={`${entry.date}-${i}`}>
                  <span className="muted">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <strong>{entry.title}</strong>
                  <span>{entry.difficulty}</span>
                  <span>{entry.accuracy}%</span>
                  <span>{entry.score.toLocaleString()} pts</span>
                </div>
              ))}
              {favorites.slice(0, 10).map((entry) => (
                <button
                  className="favorite-row"
                  key={entry.videoId}
                  onClick={() => {
                    changeSource("youtube");
                    setUrl(`https://www.youtube.com/watch?v=${entry.videoId}`);
                    if (
                      Number.isFinite(entry.bpm) &&
                      entry.bpm >= 40 &&
                      entry.bpm <= 240
                    )
                      setBpm(entry.bpm);
                    document
                      .getElementById("studio")
                      .scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  ☆ <span>{entry.title || entry.videoId}</span>Play video ↗
                </button>
              ))}
            </div>
          )}
        </section>
      </main>
      <footer className="studio-footer">
        <span>MADE FOR THE LOVE OF THE SONG.</span>
        <span>Browser-native · Mac-friendly · No audio uploaded</span>
        <a
          href="https://github.com/bonesvinyl/vibe-hero"
          target="_blank"
          rel="noreferrer"
        >
          View source ↗
        </a>
      </footer>
      {controllers && (
        <Controllers
          bindings={bindings}
          onChange={setBindings}
          onClose={() => setControllers(false)}
        />
      )}
    </div>
  );
}

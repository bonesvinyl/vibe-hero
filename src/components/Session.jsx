import { useEffect, useRef, useState } from "react";
import { Game, practiceChart, validateChart } from "../game/chart";
import { AudioTransport } from "../game/audio";
import { createVideo } from "../game/youtube";
import { bindingLabel, listenInput } from "../game/controller";
import { drawHighway } from "../game/draw";
import { SampledMediaClock } from "../game/clock";
import { youtubeWatchHandoff } from "../game/handoff";

const formatTime = (time) =>
  `${Math.floor(Math.max(0, time) / 60)}:${String(Math.floor(Math.max(0, time)) % 60).padStart(2, "0")}`;

export default function Session({ config, bindings, onExit, onResult }) {
  const canvas = useRef(null),
    videoHost = useRef(null),
    runtime = useRef(null),
    highwayOpacity = useRef(0.72);
  const [brightness, setBrightness] = useState(75),
    [boardOpacity, setBoardOpacity] = useState(72),
    [videoOnly, setVideoOnly] = useState(false);
  const [status, setStatus] = useState("loading"),
    [error, setError] = useState(""),
    [videoError, setVideoError] = useState("");
  const [hud, setHud] = useState({
    score: 0,
    combo: 0,
    accuracy: 0,
    time: -2.4,
    duration: config.buffer?.duration || 0,
    energy: 0,
    multiplier: 1,
  });
  useEffect(() => {
    const abort = new AbortController();
    let disposed = false,
      frame,
      lastHud = 0,
      backdrop = null,
      transport = null,
      game = null,
      state = "loading",
      held = [],
      completed = false,
      lastVideoSync = 0,
      stopInput = () => {},
      metadataDeadline = 0,
      viewingVideo = false;
    const offset = config.offset / 1000;
    const phase = (value) => {
      state = value;
      if (!disposed) setStatus(value);
    };
    const snapshot = (time) => ({
      score: game.score,
      combo: game.combo,
      best: game.best,
      accuracy: game.accuracy,
      hits: game.hits,
      misses: game.misses,
      energy: game.energy,
      multiplier: game.multiplier,
      power: time < game.powerUntil,
      time: transport.getTime(),
      duration: transport.duration,
      feedback: time < game.feedbackUntil ? game.feedback : "",
    });
    const pause = () => {
      if (!transport || !["playing", "buffering"].includes(state)) return;
      transport.pause();
      backdrop?.pauseVideo();
      phase("paused");
    };
    const finish = () => {
      if (!game || completed) return;
      completed = true;
      const time = transport.getTime() - offset;
      // Resolve the final window without interpreting completion as a seek.
      game.lastTime = Math.max(time, transport.duration + 0.15);
      game.update(game.lastTime);
      const result = snapshot(time);
      transport.pause();
      backdrop?.pauseVideo();
      setHud(result);
      phase("finished");
      onResult(result);
    };
    const play = async () => {
      if (!transport || completed || disposed) return;
      try {
        await transport.play();
        if (!disposed) {
          if (!game) metadataDeadline = performance.now() + 15000;
          phase(game ? "playing" : "buffering");
        }
      } catch (cause) {
        setError(cause.message);
        phase("paused");
      }
    };
    runtime.current = {
      toggle: () =>
        ["playing", "buffering"].includes(state) ? pause() : play(),
      pause,
      videoControls: (show) => {
        pause();
        viewingVideo = show;
        if (!show) {
          transport?.pause();
          backdrop?.pauseVideo();
          if (
            game &&
            Math.abs(transport.getTime() - offset - game.lastTime) > 0.25
          )
            game.reset(transport.getTime() - offset);
        }
      },
    };
    const tick = (now) => {
      if (disposed) return;
      // YouTube may return duration=0 at onReady, before playback exposes metadata.
      if (transport && !game && state !== "error") {
        const duration = transport.readDuration?.() || 0;
        if (duration > 0) {
          try {
            if (!Number.isFinite(duration) || duration < 3 || duration > 1200)
              throw new Error(
                "Choose a non-live YouTube video between 3 seconds and 20 minutes.",
              );
            transport.duration = duration;
            game = new Game(
              config.imported
                ? validateChart(config.imported, duration)
                : practiceChart(
                    duration,
                    config.bpm,
                    config.firstBeat,
                    config.difficulty,
                  ),
            );
            if (state === "buffering" && transport.playing) phase("playing");
          } catch (cause) {
            transport.pause();
            setError(cause.message);
            phase("error");
          }
        } else if (metadataDeadline && now > metadataDeadline) {
          transport.pause();
          setError(
            "Video duration is unavailable. Try a non-live video or a local file.",
          );
          phase("error");
        }
      }
      if (game && transport) {
        const mediaTime = transport.getTime(),
          chartTime = mediaTime - offset;
        if (state === "playing" && transport.playing) game.update(chartTime);
        if (
          state === "playing" &&
          mediaTime >= transport.duration + Math.max(0, offset) + 0.15
        )
          finish();
        if (
          state === "playing" &&
          mediaTime >= transport.duration &&
          !config.buffer
        )
          finish();
        drawHighway(
          canvas.current,
          game,
          chartTime,
          held,
          false,
          bindings.slice(0, 5).map(bindingLabel),
          highwayOpacity.current,
        );
        if (now - lastHud > 70 && state !== "finished") {
          setHud(snapshot(chartTime));
          lastHud = now;
        }
        if (backdrop && !viewingVideo && now - lastVideoSync > 700) {
          const target = mediaTime + config.videoOffset;
          if (
            state === "playing" &&
            mediaTime >= 0 &&
            target >= 0 &&
            target < backdrop.getDuration()
          ) {
            if (Math.abs(backdrop.getCurrentTime() - target) > 0.35)
              backdrop.seekTo(target, true);
            if (backdrop.getPlayerState() !== 1) backdrop.playVideo();
          } else backdrop.pauseVideo();
          lastVideoSync = now;
        }
      }
      frame = requestAnimationFrame(tick);
    };
    const prepare = async () => {
      try {
        if (config.buffer) {
          transport = new AudioTransport(config.buffer);
          game = new Game(config.notes);
          phase("ready");
          if (config.videoId) {
            const node = document.createElement("div");
            videoHost.current.append(node);
            createVideo(node, config.videoId, {
              signal: abort.signal,
              onError: (cause) => !disposed && setVideoError(cause.message),
              onBlocked: () =>
                !disposed &&
                setVideoError(
                  "Press Play in the video panel to enable the backdrop.",
                ),
            })
              .then((player) => {
                if (disposed) player.destroy();
                else {
                  backdrop = player;
                  player.mute();
                }
              })
              .catch((cause) => !disposed && setVideoError(cause.message));
          }
        } else {
          const node = document.createElement("div");
          videoHost.current.append(node);
          const player = await createVideo(node, config.videoId, {
            signal: abort.signal,
            onState: (value) => {
              if (!transport || disposed || completed || state === "error")
                return;
              if (viewingVideo) {
                transport.playing = false;
                return;
              }
              transport.playing = value === 1;
              if (value === 0) finish();
              else if (value === 1) phase(game ? "playing" : "buffering");
              else if (value === 3 && state === "playing") phase("buffering");
              else if (value === 2 && state !== "ready") phase("paused");
            },
            onError: (cause) => {
              if (!disposed) {
                setError(cause.message);
                pause();
                phase("error");
              }
            },
            onBlocked: () => {
              if (!disposed) {
                phase("paused");
                setError("Press Play in the video panel to allow playback.");
              }
            },
          });
          if (disposed) {
            player.destroy();
            return;
          }
          const clock = new SampledMediaClock();
          transport = {
            duration: 0,
            readDuration: () => player.getDuration(),
            playing: false,
            getTime: () =>
              clock.read(
                player.getCurrentTime(),
                transport.playing,
                performance.now(),
                player.getPlaybackRate(),
              ),
            play: () => player.playVideo(),
            pause: () => {
              player.pauseVideo();
              transport.playing = false;
            },
            destroy: () => player.destroy(),
          };
          phase("ready");
        }
        if (disposed) {
          transport?.destroy();
          return;
        }
        stopInput = listenInput(
          bindings,
          (values, edges) => {
            held = values.slice(0, 5);
            if (viewingVideo) return;
            if (edges[7]) runtime.current?.toggle();
            if (state !== "playing" || !transport.playing || !game) return;
            const time = transport.getTime() - offset;
            if (config.mode === "strum") {
              if (edges[5] || edges[6])
                game.hit(
                  held.flatMap((v, i) => (v ? [i] : [])),
                  time,
                  true,
                );
            } else
              edges.slice(0, 5).forEach((pressed, lane) => {
                if (pressed) game.hit([lane], time);
              });
            if (edges[8]) game.activate(time);
          },
          pause,
        );
      } catch (cause) {
        if (!disposed) {
          setError(cause.message);
          phase("error");
        }
      }
    };
    prepare();
    frame = requestAnimationFrame(tick);
    const hidden = () => {
      if (document.hidden) pause();
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      disposed = true;
      abort.abort();
      cancelAnimationFrame(frame);
      stopInput();
      transport?.destroy();
      backdrop?.destroy();
      document.removeEventListener("visibilitychange", hidden);
      runtime.current = null;
    };
  }, [config, bindings, onResult]);

  return (
    <main
      className={`session ${config.videoId ? "immersive-stage" : ""} ${videoOnly ? "video-only" : ""}`}
      style={{ "--video-brightness": brightness / 100 }}
    >
      {config.videoId && (
        <div className="stage-backdrop">
          <div ref={videoHost} className="backdrop-player" />
          <div className="backdrop-shade" />
        </div>
      )}
      <header className="session-header">
        <button className="text-button" onClick={onExit}>
          ← Back to studio
        </button>
        <span className="wordmark">
          vibe<span>hero</span>
          <sup>02</sup>
        </span>
        <button
          onClick={() => {
            if (!document.fullscreenElement)
              document.documentElement
                .requestFullscreen?.()
                .catch(() =>
                  setError("Fullscreen is unavailable in this browser."),
                );
            else document.exitFullscreen?.();
          }}
        >
          Fullscreen ⛶
        </button>
      </header>
      {config.videoId && (
        <div className="immersion-controls">
          <span className="eyebrow">ON THE MAIN STAGE</span>
          <label>
            Video brightness
            <input
              type="range"
              min="25"
              max="100"
              value={brightness}
              onChange={(e) => setBrightness(Number(e.target.value))}
            />
          </label>
          <label>
            Highway opacity
            <input
              type="range"
              min="25"
              max="100"
              value={boardOpacity}
              onChange={(e) => {
                setBoardOpacity(Number(e.target.value));
                highwayOpacity.current = Number(e.target.value) / 100;
              }}
            />
          </label>
          <button
            onClick={() => {
              const next = !videoOnly;
              runtime.current?.videoControls(next);
              setVideoOnly(next);
            }}
          >
            {videoOnly ? "Back to fretboard" : "Video controls"}
          </button>
        </div>
      )}
      <div className="stage-layout">
        <aside className="score-panel">
          <span className="eyebrow">ON STAGE</span>
          <h1>{config.title}</h1>
          <span className="tag">{config.chartLabel}</span>
          <div className="main-score">
            <span className="eyebrow">SCORE</span>
            <strong>{hud.score.toLocaleString()}</strong>
          </div>
          <div className="score-pair">
            <div>
              <strong>
                {hud.combo}
                <small>×</small>
              </strong>
              <span>streak</span>
            </div>
            <div>
              <strong>
                {hud.accuracy}
                <small>%</small>
              </strong>
              <span>notes hit</span>
            </div>
          </div>
          <div className="energy-label">
            <span>STAR POWER</span>
            <span>{hud.power ? "ACTIVE / 2×" : `${hud.energy}%`}</span>
          </div>
          <progress value={hud.energy} max="100" aria-label="Star power" />
          <p className="small">
            {bindingLabel(bindings[8])} to activate at 100% · {hud.multiplier}×
            multiplier
          </p>
          <p className="small">
            {config.mode === "strum"
              ? "Hold the frets, then strum."
              : "Tap each fret as it meets the line."}
          </p>
        </aside>
        <section
          className={`live-highway ${hud.power ? "powered" : ""}`}
          aria-label="Guitar note highway"
        >
          <div className="highway-topline">
            <span>{config.difficulty.toUpperCase()}</span>
            <span>{config.mode === "strum" ? "GUITAR" : "TAP"}</span>
          </div>
          <canvas
            ref={canvas}
            aria-label="Play the notes at the illuminated fret line"
          />
          <div className="judgment">
            {status === "playing" &&
              (hud.time < 0 ? Math.ceil(-hud.time) : hud.feedback)}
          </div>
          {[
            "loading",
            "ready",
            "paused",
            "buffering",
            "error",
            "finished",
          ].includes(status) && (
            <div className="stage-overlay">
              <span className="eyebrow">
                {status === "finished" ? "SET COMPLETE" : "VIBE HERO"}
              </span>
              <h2>
                {
                  {
                    loading: "Setting the stage…",
                    ready: "You’re up.",
                    paused: "Take a breath.",
                    buffering: "Waiting for the music…",
                    error: "Couldn’t load this set.",
                    finished: `${hud.accuracy}% hit`,
                  }[status]
                }
              </h2>
              {status === "finished" && (
                <p>
                  {hud.hits} notes hit · {hud.misses} missed
                  <br />
                  Best streak: {hud.best}
                </p>
              )}
              {["ready", "paused"].includes(status) && (
                <button
                  className="primary"
                  onClick={() => runtime.current?.toggle()}
                >
                  {status === "ready" ? "Play set" : "Resume"} ▷
                </button>
              )}
              {status === "finished" && (
                <button className="primary" onClick={onExit}>
                  Back to studio ↗
                </button>
              )}
              {error && <p role="alert">{error}</p>}
              {error && config.videoId && (
                <div>
                <a
                  className="error-video-link"
                  href={youtubeWatchHandoff(config.videoId, config)}
                  target="_blank"
                  rel="noopener"
                >
                  Play on YouTube with Vibe Hero ↗
                </a>
                <p style={{ fontSize: "0.85rem" }}>Requires the free local extension. <a href="/play-on-youtube.html" target="_blank" rel="noopener">One-time setup ↗</a>. Your BPM and timing carry over; import custom charts again.</p>
                </div>
              )}
            </div>
          )}
        </section>
        <aside className="stage-video">
          <span className="eyebrow">
            {config.videoId ? "LIVE BACKDROP" : "STUDIO SESSION"}
          </span>
          {!config.videoId && (
            <div className="vinyl-art" aria-hidden="true">
              <div>
                VH
                <br />
                <small>SIDE A</small>
              </div>
            </div>
          )}
          {videoError && (
            <p className="small" role="status">
              {videoError} Your local audio is still available.
            </p>
          )}
          <h3>{config.buffer ? "Follow the sound." : "Follow the beat."}</h3>
          <p>
            {config.buffer
              ? "The song clock drives every note. Pause the music, and the highway pauses with it."
              : "This grid follows the video clock. Set BPM and first beat in the studio, or import a chart for this exact recording."}
          </p>
          <div className="set-controls">
            <button
              disabled={
                !["playing", "paused", "buffering", "ready"].includes(status)
              }
              onClick={() => runtime.current?.toggle()}
            >
              {["playing", "buffering"].includes(status) ? "Pause Ⅱ" : "Play ▷"}
            </button>
            <span>{bindingLabel(bindings[7])}</span>
          </div>
          {error && !["error", "paused"].includes(status) && (
            <p role="alert">{error}</p>
          )}
        </aside>
      </div>
      <footer className="playback-footer">
        <span>{formatTime(hud.time)}</span>
        <progress
          value={Math.max(0, hud.time)}
          max={hud.duration || 1}
          aria-label="Song progress"
        />
        <span>{formatTime(hud.duration)}</span>
        <span className="small">
          {config.offset > 0 ? "+" : ""}
          {config.offset} ms calibration
        </span>
      </footer>
    </main>
  );
}

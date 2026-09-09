import { useEffect, useRef, useState } from "react";
import { analyzeBuffer, decodeFile } from "../game/audio";
import { captureTempoAudio } from "../game/capture";

export default function TempoDetection({ onDetected, videoId }) {
  const [status, setStatus] = useState(""),
    [working, setWorking] = useState(false);
  const task = useRef(null);
  useEffect(() => () => task.current?.abort(), []);
  async function detect(file) {
    task.current?.abort();
    const controller = new AbortController();
    task.current = controller;
    setWorking(true);
    setStatus(
      file
        ? "Analyzing the song…"
        : "Select the playing song tab and enable Share tab audio.",
    );
    try {
      const buffer = file
        ? await decodeFile(file)
        : await captureTempoAudio(controller.signal, (elapsed) =>
            setStatus(`Listening… ${Math.floor(elapsed)} / 20 sec`),
          );
      if (controller.signal.aborted) return;
      setStatus("Finding the pulse…");
      const result = await analyzeBuffer(buffer, "medium", controller.signal);
      if (controller.signal.aborted) return;
      if (!result.bpm) {
        setStatus(
          "No stable tempo found. Try a section with a clear beat, or tap the tempo.",
        );
        return;
      }
      onDetected(result.bpm);
      setStatus(
        `Applied ${result.bpm} BPM · ${result.confidence >= 0.6 ? "strong" : "tentative"} pulse. Check half/double tempo against the song.`,
      );
    } catch (error) {
      if (!controller.signal.aborted)
        setStatus(
          error.name === "NotAllowedError"
            ? "Sharing was not allowed. You can choose an audio file instead."
            : error.message,
        );
    } finally {
      if (!controller.signal.aborted) setWorking(false);
    }
  }
  return (
    <div className="tempo-detection">
      <strong>Auto-detect BPM</strong>
      <p className="small">
        Choose the song’s audio file, or play it in another tab and share 20
        seconds of tab audio. Analysis stays on your device. Shared video is not
        recorded.
      </p>
      <div className="chart-actions">
        <button disabled={working} onClick={() => detect()}>
          Listen to a song tab
        </button>
        <label className="file-button">
          Analyze an audio file
          <input
            type="file"
            accept="audio/*,.mp3,.wav,.m4a,.flac"
            disabled={working}
            onChange={(event) => {
              const file = event.target.files[0];
              if (file) detect(file);
              event.target.value = "";
            }}
          />
        </label>
        {working && (
          <button
            onClick={() => {
              task.current?.abort();
              setWorking(false);
              setStatus("Detection cancelled.");
            }}
          >
            Cancel
          </button>
        )}
      </div>
      <p className="small" role="status">
        {status ||
          "Tab audio sharing requires a supporting browser such as Chrome or Edge."}
      </p>
      <div className="file-note">
        {videoId && (
          <a
            href={`https://www.youtube.com/watch?v=${videoId}`}
            target="_blank"
            rel="noopener"
          >
            Open song on YouTube ↗
          </a>
        )}
        <a
          href="https://www.bpmdatabase.com/music/search/"
          target="_blank"
          rel="noreferrer"
        >
          Look up BPM Database ↗
        </a>
      </div>
    </div>
  );
}

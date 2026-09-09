// The user explicitly selects a tab in the browser picker. Only audio is
// recorded, in memory, for tempo analysis; nothing is uploaded or saved.
export async function captureTempoAudio(signal, onProgress, seconds = 20) {
  if (
    !navigator.mediaDevices?.getDisplayMedia ||
    typeof MediaRecorder === "undefined"
  )
    throw new Error(
      "Tab audio capture is unavailable here. Open Vibe Hero in Chrome/Edge, or choose an audio file below.",
    );
  let stream, recorder, timer, progressTimer;
  const stopTracks = () => stream?.getTracks().forEach((track) => track.stop());
  const abort = () => stopTracks();
  signal.addEventListener("abort", abort, { once: true });
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: { suppressLocalAudioPlayback: false },
      systemAudio: "exclude",
      selfBrowserSurface: "exclude",
    });
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
    const audioTracks = stream.getAudioTracks();
    if (!audioTracks.length)
      throw new Error(
        "No tab audio was shared. Select the playing song’s browser tab and enable “Share tab audio”, or use an audio file.",
      );
    const blob = await new Promise((resolve, reject) => {
      const chunks = [],
        started = performance.now();
      let complete = false;
      recorder = new MediaRecorder(new MediaStream(audioTracks));
      const cancel = () => {
        if (recorder.state !== "inactive") recorder.stop();
        reject(new DOMException("Cancelled", "AbortError"));
      };
      const ended = () => {
        if (!complete) {
          if (recorder.state !== "inactive") recorder.stop();
          reject(
            new Error(
              "Sharing stopped before the sample was complete. Try again or choose a file.",
            ),
          );
        }
      };
      signal.addEventListener("abort", cancel, { once: true });
      audioTracks.forEach((track) =>
        track.addEventListener("ended", ended, { once: true }),
      );
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onerror = () =>
        reject(
          new Error(
            "The browser could not capture audio. Try a local audio file.",
          ),
        );
      recorder.onstop = () => {
        signal.removeEventListener("abort", cancel);
        audioTracks.forEach((track) =>
          track.removeEventListener("ended", ended),
        );
        if (complete && !signal.aborted)
          resolve(new Blob(chunks, { type: recorder.mimeType }));
        else
          reject(
            signal.aborted
              ? new DOMException("Cancelled", "AbortError")
              : new Error(
                  "Audio capture stopped early. Try again or choose an audio file.",
                ),
          );
      };
      recorder.start();
      onProgress(0);
      progressTimer = setInterval(
        () =>
          onProgress(Math.min(seconds, (performance.now() - started) / 1000)),
        250,
      );
      timer = setTimeout(() => {
        complete = true;
        recorder.stop();
      }, seconds * 1000);
    });
    stopTracks();
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
    const context = new AudioContext();
    try {
      return await context.decodeAudioData(await blob.arrayBuffer());
    } catch {
      throw new Error(
        "This browser cannot decode the captured audio. Choose a local audio file instead.",
      );
    } finally {
      await context.close();
    }
  } finally {
    clearTimeout(timer);
    clearInterval(progressTimer);
    signal.removeEventListener("abort", abort);
    if (recorder && recorder.state !== "inactive") recorder.stop();
    stopTracks();
  }
}

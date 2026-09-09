import { BonusEcho } from "./echo.js";
export async function decodeFile(file) {
  if (file.size > 100 * 1024 * 1024)
    throw new Error("Choose an audio file smaller than 100 MB.");
  const context = new AudioContext();
  try {
    const buffer = await context.decodeAudioData(await file.arrayBuffer());
    if (buffer.duration > 1200)
      throw new Error("Choose a track under 20 minutes.");
    if (buffer.duration < 3)
      throw new Error("Choose a track at least 3 seconds long.");
    return buffer;
  } finally {
    await context.close();
  }
}

export async function analyzeBuffer(buffer, difficulty, signal) {
  // Resample and average channels off the UI thread before transferring to the worker.
  const offline = new OfflineAudioContext(
    1,
    Math.ceil(buffer.duration * 22050),
    22050,
  );
  const source = offline.createBufferSource();
  source.buffer = buffer;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();
  if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
  const samples = rendered.getChannelData(0);
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("./analysis.worker.js", import.meta.url),
      { type: "module" },
    );
    const cleanup = () => {
      worker.terminate();
      signal?.removeEventListener("abort", cancel);
    };
    const cancel = () => {
      cleanup();
      reject(new DOMException("Cancelled", "AbortError"));
    };
    signal?.addEventListener("abort", cancel, { once: true });
    worker.onmessage = ({ data }) => {
      cleanup();
      data.error ? reject(new Error(data.error)) : resolve(data.result);
    };
    worker.onerror = () => {
      cleanup();
      reject(new Error("Audio analysis failed. Try a different file."));
    };
    worker.postMessage({ samples, sampleRate: 22050, difficulty }, [
      samples.buffer,
    ]);
  });
}

export class AudioTransport {
  constructor(buffer) {
    this.buffer = buffer;
    this.context = new AudioContext();
    this.position = -4;
    this.playing = false;
    this.duration = buffer.duration;
    this.source = null;
    this.disposed = false;
  }
  getTime() {
    return this.playing
      ? this.position + this.context.currentTime - this.started
      : this.position;
  }
  async play() {
    await this.context.resume();
    if (this.playing || this.disposed) return;
    this.started = this.context.currentTime;
    this.source = this.context.createBufferSource();
    this.source.buffer = this.buffer;
    this.source.connect(this.context.destination);
    if (this.context.createDelay) this.echo = new BonusEcho(this.context, this.source);
    this.source.start(
      this.started + Math.max(0, -this.position),
      Math.max(0, this.position),
    );
    this.playing = true;
  }
  pause() {
    if (!this.playing) return;
    this.position = this.getTime();
    this.playing = false;
    this.echo?.destroy(); this.echo = null;
    this.source?.stop();
    this.source?.disconnect();
    this.source = null;
  }
  setBonus(active) { this.echo?.set(active); }
  destroy() {
    this.disposed = true;
    this.pause();
    this.context.close();
  }
}

// An original, generated 32-second test groove: no network or music rights needed.
export function demoBuffer() {
  const sampleRate = 22050,
    length = sampleRate * 32;
  const buffer = new AudioBuffer({ numberOfChannels: 1, length, sampleRate });
  const data = buffer.getChannelData(0),
    frequencies = [164.81, 196, 220, 196, 146.83, 196, 246.94, 220];
  for (let beat = 0; beat < 60; beat++) {
    const start = (1 + beat * 0.5) * sampleRate,
      frequency = frequencies[beat % frequencies.length];
    for (let i = 0; i < sampleRate * 0.38; i++) {
      const t = i / sampleRate;
      const pluck =
        (Math.sin(2 * Math.PI * frequency * t) +
          0.3 * Math.sin(4 * Math.PI * frequency * t)) *
        Math.exp(-t * 13);
      const kick =
        Math.sin(2 * Math.PI * (55 * t + 3 * (1 - Math.exp(-t * 30)))) *
        Math.exp(-t * 25);
      data[Math.floor(start) + i] += 0.25 * pluck + 0.2 * kick;
    }
  }
  return buffer;
}

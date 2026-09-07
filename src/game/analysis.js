import { estimateTempo } from "./tempo.js";
// Positive spectral flux over a Hann-windowed FFT. Runs in a worker in the app.
function spectrum(samples, start, size) {
  const real = new Float64Array(size),
    imag = new Float64Array(size);
  for (let i = 0, j = 0; i < size; i++) {
    real[j] =
      (samples[start + i] || 0) *
      (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1)));
    let bit = size >> 1;
    while (j & bit) {
      j ^= bit;
      bit >>= 1;
    }
    j ^= bit;
  }
  for (let length = 2; length <= size; length *= 2) {
    const angle = (-2 * Math.PI) / length;
    for (let start = 0; start < size; start += length) {
      for (let j = 0; j < length / 2; j++) {
        const a = start + j,
          b = a + length / 2;
        const c = Math.cos(angle * j),
          s = Math.sin(angle * j);
        const r = real[b] * c - imag[b] * s,
          im = real[b] * s + imag[b] * c;
        real[b] = real[a] - r;
        imag[b] = imag[a] - im;
        real[a] += r;
        imag[a] += im;
      }
    }
  }
  return real.slice(0, size / 2).map((r, i) => Math.hypot(r, imag[i]));
}

export function analyze(samples, sampleRate, difficulty = "medium") {
  const size = 1024,
    hop = 220,
    frames = [];
  let previous = new Float64Array(size / 2),
    maxFlux = 0;
  for (let start = 0; start + size <= samples.length; start += hop) {
    const bins = spectrum(samples, start, size);
    let flux = 0,
      weighted = 0,
      energy = 0;
    for (let b = 2; b < bins.length; b++) {
      const rise = Math.max(0, bins[b] - previous[b]);
      flux += rise;
      weighted += rise * b;
      energy += bins[b];
    }
    frames.push({
      time: (start + size / 2) / sampleRate,
      flux,
      tone: flux ? weighted / flux : 0,
      energy,
    });
    maxFlux = Math.max(maxFlux, flux);
    previous = bins;
  }
  if (maxFlux < 0.001) return { notes: [], bpm: null, confidence: 0 };
  const peaks = [];
  for (let i = 2; i < frames.length - 2; i++) {
    const frame = frames[i];
    const neighborhood = frames.slice(
      Math.max(0, i - 20),
      Math.min(frames.length, i + 21),
    );
    const mean =
      neighborhood.reduce((s, f) => s + f.flux, 0) / neighborhood.length;
    const threshold = Math.max(maxFlux * 0.035, mean * 1.45);
    if (
      frame.flux > threshold &&
      frame.flux >= frames[i - 1].flux &&
      frame.flux > frames[i + 1].flux &&
      frame.energy > 0.02
    )
      peaks.push(frame);
  }
  // Onsets are not quantized to an inferred tempo: expressive timing survives.
  const spacing = { easy: 0.36, medium: 0.2, expert: 0.12 }[difficulty] || 0.2;
  const selected = [];
  for (const peak of peaks) {
    const last = selected.at(-1);
    if (!last || peak.time - last.time >= spacing) selected.push(peak);
    else if (peak.flux > last.flux) selected[selected.length - 1] = peak;
  }
  const tones = selected.map((p) => p.tone).sort((a, b) => a - b);
  const boundaries = [0.2, 0.4, 0.6, 0.8].map(
    (q) => tones[Math.floor(q * (tones.length - 1))],
  );
  const notes = selected.map((p) => ({
    time: +Math.max(0, p.time - size / (sampleRate * 4)).toFixed(4),
    lanes: [boundaries.filter((b) => p.tone > b).length],
  }));
  return {
    notes,
    ...estimateTempo(
      frames.map((frame) => frame.flux),
      sampleRate / hop,
    ),
  };
}

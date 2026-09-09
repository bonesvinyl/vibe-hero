import { chartFromFrames } from "./chart-analysis.js";
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
  let previous = new Float64Array(size / 2);
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
    previous = bins;
  }
  return chartFromFrames(frames.map(frame => ({ ...frame, time: Math.max(0, frame.time - size / (sampleRate * 4)) })), difficulty);
}

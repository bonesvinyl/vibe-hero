import { estimateTempo } from './tempo.js';

// Musical attacks in the mix, not an instrument classifier or pitch transcription.
export function chartFromFrames(frames, difficulty = 'medium') {
  if (frames.length < 3) return { notes: [], bpm: null, confidence: 0 };
  let maxFlux = 0, maxEnergy = 0;
  for (const f of frames) { maxFlux = Math.max(maxFlux, f.flux); maxEnergy = Math.max(maxEnergy, f.energy); }
  if (maxFlux < 0.001) return { notes: [], bpm: null, confidence: 0 };
  const peaks = [], spacing = { easy: 0.36, medium: 0.2, hard: 0.12, expert: 0.09 }[difficulty] || 0.2;
  for (let i = 2; i < frames.length - 2; i++) {
    const f = frames[i], near = frames.slice(Math.max(0, i - 15), i + 16);
    const threshold = Math.max(maxFlux * 0.035, near.reduce((sum, x) => sum + x.flux, 0) / near.length * 1.45);
    if (f.energy < maxEnergy * 0.008 || f.flux <= threshold || f.flux < frames[i - 1].flux || f.flux <= frames[i + 1].flux) continue;
    const previous = peaks.at(-1), peak = { ...f, index: i };
    if (!previous || f.time - previous.time >= spacing) peaks.push(peak);
    else if (f.flux > previous.flux) peaks[peaks.length - 1] = peak;
  }
  const tones = peaks.map(p => p.tone).sort((a, b) => a - b);
  const boundaries = [0.2, 0.4, 0.6, 0.8].map(q => tones[Math.floor(q * (tones.length - 1))]);
  const notes = peaks.map((p, i) => {
    const lane = boundaries.filter(b => p.tone > b).length;
    // Strong attacks become playable chord accents, not inferred guitar fingerings.
    const lanes = ['hard','expert'].includes(difficulty) && p.flux > maxFlux * 0.8 ? [0, 2, 4] : difficulty !== 'easy' && p.flux > maxFlux * 0.55 ? [lane, (lane + 2) % 5].sort() : [lane];
    const limit = Math.min(peaks[i + 1]?.time - 0.07 || Infinity, p.time + 6);
    let end = p.time;
    for (let j = p.index + 1; j < frames.length && frames[j].time < limit; j++) {
      if (frames[j].energy < Math.max(maxEnergy * 0.008, p.energy * 0.3)) break;
      end = frames[j].time;
    }
    const duration = end - p.time;
    return { time: Math.max(0, p.time), lanes, ...(duration >= 0.4 ? { duration: +duration.toFixed(4) } : {}) };
  });
  // Put variable-rate capture frames on a uniform clock for autocorrelation.
  const envelope = Array(Math.ceil(frames.at(-1).time * 50) + 1).fill(0);
  for (const f of frames) { const i = Math.round(f.time * 50); envelope[i] = Math.max(envelope[i] || 0, f.flux); }
  return { notes, ...estimateTempo(envelope, 50) };
}

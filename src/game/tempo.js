// Autocorrelation tests repeating pulse periods across the onset envelope, not
// just adjacent attacks (which often include fills and offbeats).
export function estimateTempo(flux, frameRate) {
  if (flux.length < frameRate * 3) return { bpm: null, confidence: 0 };
  const prefix = [0];
  for (const value of flux) prefix.push(prefix.at(-1) + value);
  const envelope = flux.map((value, i) => {
    const a = Math.max(0, i - 20),
      b = Math.min(flux.length, i + 21);
    return Math.max(0, value - (prefix[b] - prefix[a]) / (b - a));
  });
  if (envelope.filter((v) => v > 0.001).length < 4)
    return { bpm: null, confidence: 0 };
  const candidates = [];
  for (let bpm = 60; bpm <= 200; bpm += 0.5) {
    const lag = (60 * frameRate) / bpm,
      whole = Math.floor(lag),
      fraction = lag - whole;
    let product = 0,
      left = 0,
      right = 0;
    for (let i = whole + 1; i < envelope.length; i++) {
      const a = envelope[i],
        b =
          envelope[i - whole] * (1 - fraction) +
          envelope[i - whole - 1] * fraction;
      product += a * b;
      left += a * a;
      right += b * b;
    }
    const score = product / Math.sqrt(left * right || 1);
    candidates.push({
      bpm,
      score,
      rank: score * (1 - 0.025 * Math.abs(Math.log2(bpm / 120))),
    });
  }
  candidates.sort((a, b) => b.rank - a.rank);
  let best = candidates[0];
  // A three-beat fill can make the bar repeat more strongly than a single
  // beat. Prefer the shorter, well-supported pulse over its long-period alias.
  const harmonics = candidates.filter((candidate) => {
    const ratio = candidate.bpm / best.bpm;
    return (
      ratio >= 1.9 &&
      ratio <= 3.1 &&
      Math.abs(ratio - Math.round(ratio)) < 0.015 &&
      candidate.score >= best.score * 0.85
    );
  });
  if (harmonics.length) best = harmonics.sort((a, b) => b.bpm - a.bpm)[0];
  return best.score < 0.18
    ? { bpm: null, confidence: best.score }
    : { bpm: best.bpm, confidence: Math.min(1, best.score) };
}

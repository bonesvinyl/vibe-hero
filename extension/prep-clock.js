// Use frequent native-player snapshots; never free-run through missing state.
export function prepTime(state, receivedAt, now) {
  if (!state || now - receivedAt > 350 || state.ad || state.paused || state.seeking || state.ready < 3 || state.rate !== 1) return null;
  return Math.min(state.duration, state.time + Math.max(0, now - receivedAt) / 1000);
}
export function capturedSongEnd(frames, duration) {
  return frames.length > 0 && frames.at(-1).time >= duration - 0.25;
}

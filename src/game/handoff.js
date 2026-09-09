export function nativeSettings(value = {}) {
  const number = (name, fallback, min, max) => Number.isFinite(value?.[name]) && value[name] >= min && value[name] <= max ? value[name] : fallback;
  return { triples: value?.triples !== false, chords: value?.chords !== false, bpm: number('bpm', 120, 40, 240), firstBeat: number('firstBeat', 2.5, 0, 120), offset: number('offset', 0, -500, 500), difficulty: ['easy', 'medium', 'hard', 'expert'].includes(value?.difficulty) ? value.difficulty : 'medium', mode: value?.mode === 'strum' ? 'strum' : 'tap' };
}
export function youtubeWatchHandoff(videoId, settings) {
  if (!/^[\w-]{11}$/.test(videoId)) return 'https://www.youtube.com/';
  return `https://www.youtube.com/watch?v=${videoId}#vibe-hero=${encodeURIComponent(JSON.stringify(nativeSettings(settings)))}`;
}
export function parseHandoff(hash) {
  try { return nativeSettings(JSON.parse(decodeURIComponent(hash.replace(/^#vibe-hero=/, '')))); }
  catch { return nativeSettings(); }
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { listenToSong } from '../extension/listen.js';

function environment({ deferred = false, audio = true } = {}) {
  const keys = ['navigator', 'AudioContext', 'setInterval', 'clearInterval'];
  const saved = keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  const tracks = [0, 1].map(() => ({ readyState: 'live', stop() { this.readyState = 'ended'; } }));
  const stream = { getTracks: () => tracks, getAudioTracks: () => audio ? [tracks[0]] : [] };
  let allow, tick, closed = false, ad = false;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getDisplayMedia: () => deferred ? new Promise(resolve => { allow = resolve; }) : Promise.resolve(stream) } } });
  globalThis.AudioContext = class {
    sampleRate = 48000;
    async resume() {}
    async close() { closed = true; }
    createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
    createAnalyser() { return { frequencyBinCount: 1024, fftSize: 2048, getFloatFrequencyData(bins) { bins.fill(-30); }, getFloatTimeDomainData(wave) { wave.fill(0.1); } }; }
  };
  globalThis.setInterval = callback => { tick = callback; return 1; };
  globalThis.clearInterval = () => { tick = null; };
  const video = { duration: 10, currentTime: 0, paused: false, playbackRate: 1, readyState: 4, pause() { this.paused = true; }, async play() { this.paused = false; } };
  const abort = new AbortController();
  return { tracks, video, abort, options: { signal: abort.signal, isAd: () => ad, onProgress() {} },
    allow: () => allow(stream), tick: () => tick?.(), setAd: value => { ad = value; }, closed: () => closed,
    restore() { for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } } };
}
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

test('pre-listen timestamps features with song time, excludes pauses/ads, and releases sharing on completion', async () => {
  const f = environment();
  try {
    const result = listenToSong(f.video, f.options); await settle();
    f.video.currentTime = 0.02; f.tick(); // analyzer warmup
    f.video.currentTime = 0.04; f.tick();
    f.video.paused = true; f.video.currentTime = 0.06; f.tick();
    f.setAd(true); f.video.currentTime = 8; f.tick();
    f.setAd(false); f.video.paused = false; f.video.currentTime = 0.08; f.tick();
    f.video.currentTime = 0.1; f.tick(); // post-ad warmup
    f.video.currentTime = 0.12; f.tick();
    f.video.ended = true; f.tick();
    const frames = await result;
    assert.deepEqual(frames.map(frame => frame.time), [0.04, 0.12]);
    assert.ok(f.tracks.every(track => track.readyState === 'ended'));
    assert.equal(f.closed(), true); assert.equal(f.video.paused, true);
  } finally { f.restore(); }
});

test('cancelling during the sharing picker releases late-granted tracks without starting playback', async () => {
  const f = environment({ deferred: true });
  try {
    let plays = 0; f.video.play = async () => { plays++; };
    const result = listenToSong(f.video, f.options);
    f.abort.abort(); f.allow();
    await assert.rejects(result, { name: 'AbortError' });
    assert.equal(plays, 0); assert.ok(f.tracks.every(track => track.readyState === 'ended'));
  } finally { f.restore(); }
});

test('seeking rejects an incomplete chart and active cancellation closes the audio context', async () => {
  for (const cancel of [false, true]) {
    const f = environment();
    try {
      const result = listenToSong(f.video, f.options); await settle();
      if (cancel) f.abort.abort(); else { f.video.currentTime = 5; f.tick(); }
      await assert.rejects(result, cancel ? { name: 'AbortError' } : /skipped/);
      assert.equal(f.closed(), true); assert.ok(f.tracks.every(track => track.readyState === 'ended'));
    } finally { f.restore(); }
  }
});

test('an immediate post-song ad cannot hide completion or replace the original song duration', async () => {
  const f = environment();
  try {
    const result = listenToSong(f.video, f.options); await settle();
    for (let i = 1; i <= 98; i++) { f.video.currentTime = i / 10; f.tick(); }
    f.setAd(true); f.video.duration = 30; f.video.currentTime = 0; f.video.ended = false; f.tick();
    const frames = await result;
    assert.ok(frames.at(-1).time >= 9.75);
    assert.ok(f.tracks.every(track => track.readyState === 'ended'));
  } finally { f.restore(); }
});

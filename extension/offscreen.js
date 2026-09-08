/* global chrome */
import { chartFromFrames } from '../src/game/chart-analysis.js';
import { saveChart } from './chart-store.js';
import { prepTime, capturedSongEnd } from './prep-clock.js';
let job = null;
const requestPlayer = async (task, action = 'state') => {
  let timeout;
  const response = await Promise.race([
    chrome.runtime.sendMessage({ target: 'background', type: 'player', tabId: task.tabId, videoId: task.videoId, action }),
    new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('The song tab stopped responding.')), 4000); }),
  ]).finally(() => clearTimeout(timeout));
  if (response?.error || !response) throw new Error(response?.error || 'Player is unavailable.');
  return response;
};
const storage = { async set(value) {
  const result = await chrome.runtime.sendMessage({ target: 'background', type: 'storage-set', value });
  if (result?.error || !result?.ok) throw new Error(result?.error || 'Could not save to the library.');
} };
const publish = value => storage.set({ 'vh.preparation': value });
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id || message.target !== 'offscreen' || sender.tab) return;
  if (message.type === 'status') { reply({ busy: !!job }); return; }
  if (message.type === 'cancel') { job?.controller.abort(); reply({ ok: true }); return; }
  if (message.type !== 'start') return;
  if (job) { reply({ error: 'Another song is already preparing.' }); return; }
  job = { ...message, beganAt: Date.now(), controller: new AbortController() };
  const task = job;
  run(task).finally(() => { if (job === task) job = null; });
  reply({ ok: true });
});
async function run(task) {
  let stream, context, source, timer, polling = false, state, receivedAt = 0, lastPoll = 0, lastPublish = 0, previous, lastTime = 0, wasAd = false, progressWrite = Promise.resolve();
  const frames = [], signal = task.controller.signal;
  const stopTracks = () => stream?.getTracks().forEach(track => track.stop());

  try {
    await publish({ videoId: task.videoId, title: task.title, status: 'preparing', progress: 0, updatedAt: Date.now() });
    stream = await navigator.mediaDevices.getUserMedia({ audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: task.streamId } }, video: false });
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    context = new AudioContext(); await context.resume();
    source = context.createMediaStreamSource(stream);
    const analyzer = context.createAnalyser(); analyzer.fftSize = 2048; analyzer.smoothingTimeConstant = 0; source.connect(analyzer);
    // No connection to destination: captured song audio stays inaudible.
    const bins = new Float32Array(analyzer.frequencyBinCount), wave = new Float32Array(analyzer.fftSize);
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    state = await requestPlayer(task, 'start'); receivedAt = performance.now();
    await new Promise((resolve, reject) => {
      let finished = false;
      const abort = () => done(new DOMException('Cancelled', 'AbortError'));
      const done = error => { if (finished) return; finished = true; clearInterval(timer); signal.removeEventListener('abort', abort); error ? reject(error) : resolve(); };
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) { abort(); return; }
      timer = setInterval(() => {
        const now = performance.now();
        if (capturedSongEnd(frames, task.duration)) { done(); return; }
        if (signal.aborted) { abort(); return; }
        if (Date.now() - task.beganAt > 45 * 60 * 1000) { done(new Error('Preparation timed out.')); return; }
        if (stream.getTracks().some(track => track.readyState === 'ended')) { done(new Error('Capture stopped before the chart was complete.')); return; }
        if (now - receivedAt > 3000) { done(new Error('Lost contact with the song tab. Keep it open while preparing.')); return; }
        if (!polling && now - lastPoll >= 100) {
          polling = true; lastPoll = now;
          requestPlayer(task).then(next => {
            if (finished) return;
            if (next.ad) { wasAd = true; previous = null; }
            else if (wasAd) { lastTime = next.time; wasAd = false; previous = null; }
            else if (!next.seeking && (next.time < state.time - 0.25 || next.time > state.time + (performance.now() - receivedAt) / 1000 + 0.75)) throw new Error('The song was skipped. Prepare again without seeking.');
            if (!next.ad && next.rate !== 1) throw new Error('Keep playback at normal speed while preparing.');
            state = next; receivedAt = performance.now();
          }).catch(error => done(error)).finally(() => { polling = false; });
        }
        const time = prepTime(state, receivedAt, now);
        if (time === null || time <= lastTime) return;
        analyzer.getFloatFrequencyData(bins); analyzer.getFloatTimeDomainData(wave);
        let flux = 0, weighted = 0, energy = 0;
        const next = new Float32Array(bins.length);
        for (const sample of wave) energy += sample * sample;
        for (let i = 0; i < bins.length; i++) {
          next[i] = Math.pow(10, bins[i] / 20);
          const hz = i * context.sampleRate / analyzer.fftSize;
          if (!previous || hz < 80 || hz > 5000) continue;
          const rise = Math.max(0, next[i] - previous[i]); flux += rise; weighted += rise * i;
        }
        if (previous) frames.push({ time, flux, tone: flux ? weighted / flux : 0, energy: Math.sqrt(energy / wave.length) });
        previous = next; lastTime = time;
        if (now - lastPublish > 1000) { lastPublish = now; progressWrite = publish({ videoId: task.videoId, title: task.title, status: 'preparing', progress: Math.min(99, Math.round(time / task.duration * 100)), updatedAt: Date.now() }).catch(error => done(error)); }
      }, 20);
    });
    await progressWrite;
    const result = chartFromFrames(frames, task.difficulty);
    if (!result.notes.length) throw new Error('No clear audio attacks were captured. No chart was saved.');
    await saveChart(storage, task.videoId, { version: 1, notes: result.notes }, task.duration, { bpm: result.bpm || 120, difficulty: task.difficulty }, task.title);
    await publish({ videoId: task.videoId, title: task.title, status: 'ready', progress: 100, notes: result.notes.length, updatedAt: Date.now() });
  } catch (error) {
    await progressWrite.catch(() => {});
    await publish({ videoId: task.videoId, title: task.title, status: signal.aborted ? 'cancelled' : 'error', error: error.message, updatedAt: Date.now() }).catch(() => {});
  } finally {
    clearInterval(timer); signal.removeEventListener('abort', stopTracks);
    // Pause before releasing capture so the song cannot suddenly become audible.
    await requestPlayer(task, 'stop').catch(() => {}); stopTracks(); source?.disconnect(); await context?.close();
  }
}

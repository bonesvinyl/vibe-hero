import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { saveChart } from '../extension/chart-store.js';
import { prepTime, capturedSongEnd } from '../extension/prep-clock.js';
const settle = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };

test('offscreen preparation saves before reporting ready and pauses before releasing quiet capture', async () => {
  for (const mode of ['success', 'cancel', 'quota']) {
    let listener, timer, now = 0, closed = false;
    const values = {}, events = [], track = { readyState: 'live', stop() { events.push('release'); this.readyState = 'ended'; } };
    const stream = { getTracks: () => [track] };
    const chrome = { runtime: { id: 'test', onMessage: { addListener(fn) { listener = fn; } }, async sendMessage(message) {
      if (message.type === 'storage-set') {
        if (mode === 'quota' && Object.keys(message.value).some(key => key.startsWith('vh.chart.'))) return { error: 'Storage full' };
        Object.assign(values, structuredClone(message.value)); return { ok: true };
      }
      if (message.action === 'stop') events.push('pause');
      return { time: message.action === 'start' ? 0 : now / 1000, duration: 3, ready: 4, rate: 1, paused: false, ad: false };
    } } };
    class AudioContext {
      sampleRate = 48000;
      async resume() {}
      async close() { closed = true; }
      createMediaStreamSource() { return { connect(node) { assert.ok(node.isAnalyzer); }, disconnect() {} }; }
      createAnalyser() { return { isAnalyzer: true, frequencyBinCount: 1024, fftSize: 2048, getFloatFrequencyData(bins) { bins.fill(-25); }, getFloatTimeDomainData(wave) { wave.fill(0.2); } }; }
    }
    const source = readFileSync(new URL('../extension/offscreen.js', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '');
    vm.runInNewContext(source, { chrome, AudioContext, navigator: { mediaDevices: { getUserMedia: async () => stream } }, AbortController, DOMException, Date, setTimeout, clearTimeout,
      performance: { now: () => now }, setInterval(fn) { timer = fn; return 1; }, clearInterval() { timer = null; },
      saveChart, prepTime, capturedSongEnd, chartFromFrames: frames => { assert.ok(frames.at(-1).time >= 2.75); return { notes: [{ time: 1, lanes: [0] }], bpm: 120 }; } });
    listener({ target: 'offscreen', type: 'start', tabId: 7, videoId: 'WtuoFv4dcwM', duration: 3, title: 'Song', difficulty: 'medium' }, { id: 'test' }, () => {});
    await settle();
    if (mode === 'cancel') listener({ target: 'offscreen', type: 'cancel' }, { id: 'test' }, () => {});
    for (let i = 0; i < 170 && timer; i++) { now += 20; timer(); await settle(); }
    await settle();
    assert.equal(values['vh.preparation'].status, mode === 'success' ? 'ready' : mode === 'cancel' ? 'cancelled' : 'error');
    assert.equal(!!values['vh.chart.WtuoFv4dcwM'], mode === 'success');
    assert.ok(events.indexOf('pause') < events.indexOf('release'));
    assert.equal(closed, true);
  }
});

test('gameplay audio restores dry output, accepts effects only from its tab, and releases on exit', async () => {
  let listener, timer, stopped=0, closed=0;
  const toggles=[], destination={}, connections=[];
  const source = readFileSync(new URL('../extension/offscreen.js', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '');
  const track={stop(){stopped++;}};
  class AudioContext {
    destination=destination;
    async resume(){} async close(){closed++;}
    createMediaStreamSource(){return {connect(target){connections.push(target);},disconnect(){}};}
  }
  class BonusEcho {set(active){toggles.push(active);} destroy(){toggles.push('destroy');}}
  const chrome={runtime:{id:'test',onMessage:{addListener(fn){listener=fn;}}}};
  vm.runInNewContext(source,{chrome,AudioContext,BonusEcho,Date,navigator:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[track]})}},setInterval(fn){timer=fn;return 1;},clearInterval(){timer=null;}});
  let started;
  listener({target:'offscreen',type:'start-effects',tabId:7,streamId:'capture'},{id:'test'},r=>{started=r;}); await settle();
  assert.equal(started.ok,true); assert.equal(connections[0],destination);
  listener({target:'offscreen',type:'effect-state',active:true},{id:'test',tab:{id:8}},()=>{});
  assert.equal(toggles.length,0);
  listener({target:'offscreen',type:'effect-state',active:true},{id:'test',tab:{id:7}},()=>{});
  assert.deepEqual(toggles,[true]);
  listener({target:'offscreen',type:'effect-close'},{id:'test',tab:{id:7}},()=>{}); await settle();
  assert.equal(stopped,1); assert.equal(closed,1); assert.equal(timer,null);
});

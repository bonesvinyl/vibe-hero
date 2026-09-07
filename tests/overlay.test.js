import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { Game, practiceChart, validateChart, KEYS } from '../src/game/chart.js';
import { nativeSettings, parseHandoff } from '../src/game/handoff.js';

// Synthetic DOM/media only. This exercises controller lifecycle, not a live
// YouTube page, extension installation, canvas rendering, or browser playback.
function fixture() {
  const listeners = new Map();
  const node = () => ({ value: '', hidden: false, textContent: '', style: { setProperty() {} }, classList: { toggle() {} },
    addEventListener(type, callback) { this[type] = callback; }, getContext: () => ({ drawImage() {} }) });
  const nodes = new Map();
  const root = { ...node(), querySelector(selector) { if (!nodes.has(selector)) nodes.set(selector, node()); return nodes.get(selector); } };
  const host = { ...node(), isConnected: true, attachShadow: () => root, remove() { this.isConnected = false; } };
  const video = { duration: 30, currentTime: 0, readyState: 4, videoWidth: 1920, videoHeight: 1080, paused: false, seeking: false,
    pause() { this.paused = true; }, async play() { this.paused = false; } };
  let frame, ad = false, drawnGame;
  const document = { createElement: () => host, getElementById: () => null, documentElement: { append() {} },
    querySelector(selector) { return selector.includes('ad-showing') ? (ad ? {} : null) : selector.includes('video') ? video : null; },
    addEventListener(type, callback) { listeners.set(type, callback); }, removeEventListener(type) { listeners.delete(type); }, title: 'Fixture - YouTube' };
  const window = { addEventListener(type, callback) { listeners.set(type, callback); }, removeEventListener(type) { listeners.delete(type); } };
  const source = readFileSync(new URL('../extension/overlay.js', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '');
  vm.runInNewContext(source, { Game, practiceChart, validateChart, KEYS, nativeSettings, parseHandoff, styles: '', document, window,
    location: { href: 'https://www.youtube.com/watch?v=WtuoFv4dcwM', hash: '' }, URL, Event, performance,
    requestAnimationFrame(callback) { frame = callback; return 1; }, cancelAnimationFrame() { frame = null; },
    innerWidth: 1200, innerHeight: 800, drawHighway(_canvas, game) { drawnGame = game; } });
  return { video, nodes, host, listeners, tick: time => frame?.(time), setAd: value => { ad = value; }, game: () => drawnGame,
    click(action) { root.click({ target: { closest: () => ({ dataset: { action } }) } }); },
    key(code) { listeners.get('keydown')?.({ code, composedPath: () => [{}], preventDefault() {}, stopImmediatePropagation() {} }); } };
}

test('native overlay follows media time, freezes on pause/ads, and cleans up on exit', async () => {
  const f = fixture();
  f.tick(0);
  assert.equal(f.video.paused, true);
  f.click('start');
  await Promise.resolve();
  f.tick(100);
  f.video.currentTime = 0.8; f.tick(200);
  f.video.currentTime = 1.6; f.tick(300);
  f.video.currentTime = 2.5; f.tick(400);
  f.key('KeyA');
  assert.ok(f.game().score > 0);
  f.key('Enter');
  assert.equal(f.video.paused, true);
  const misses = f.game().misses;
  f.tick(10000);
  assert.equal(f.game().misses, misses);
  f.setAd(true); f.video.paused = false; f.video.currentTime = 20; f.tick(11000);
  assert.equal(f.game().misses, misses);
  f.setAd(false); f.video.currentTime = 2.5; f.tick(12000);
  f.click('close');
  assert.equal(f.host.isConnected, false);
  assert.equal(f.listeners.size, 0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeSettings, youtubeWatchHandoff, parseHandoff } from '../src/game/handoff.js';

test('YouTube recovery preserves tempo and calibration without transferring local media or credentials', () => {
  const settings = { chords: true, bpm: 155, firstBeat: 3.15, offset: -75, difficulty: 'expert', mode: 'strum' };
  const url = new URL(youtubeWatchHandoff('WtuoFv4dcwM', { ...settings, apiKey: 'secret', buffer: 'private audio', title: 'private title' }));
  assert.equal(url.origin, 'https://www.youtube.com');
  assert.equal(url.searchParams.get('v'), 'WtuoFv4dcwM');
  assert.deepEqual(parseHandoff(url.hash), settings);
  assert.ok(!url.href.includes('secret'));
  assert.ok(!url.href.includes('private'));
});
test('malformed or out-of-range handoffs recover to usable defaults', () => {
  for (const hash of ['#vibe-hero=%broken', '#vibe-hero=null', '#unrelated']) assert.deepEqual(parseHandoff(hash), nativeSettings());
  assert.deepEqual(nativeSettings({ bpm: Infinity, firstBeat: -10, offset: 2000, difficulty: 'invalid', mode: 'invalid' }), nativeSettings());
  assert.equal(youtubeWatchHandoff('javascript:alert(1)', {}), 'https://www.youtube.com/');
});

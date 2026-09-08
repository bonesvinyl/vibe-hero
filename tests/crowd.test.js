import test from 'node:test';
import assert from 'node:assert/strict';
import { CrowdAudio, CrowdReactions } from '../src/game/crowd.js';

test('crowd cheers on streak milestones and bonus activation with a cooldown', () => {
  const crowd = new CrowdReactions(), game = { hits: 0, misses: 0, combo: 0, powerUntil: -1 };
  crowd.update(game, 0);
  for (let time = 1; time <= 10; time++) { game.hits++; game.combo++; assert.equal(crowd.update(game, time), time === 10 ? 'cheer' : null); }
  game.powerUntil = 19;
  assert.equal(crowd.update(game, 11), 'cheer');
  for (let time = 12; time <= 18; time++) crowd.update(game, time);
  game.powerUntil = 27;
  assert.equal(crowd.update(game, 19), 'cheer');
  assert.equal(crowd.update(game, 19), null);
});

test('crowd boos after five consecutive misses, never during silence or a seek', () => {
  const crowd = new CrowdReactions(), game = { hits: 0, misses: 0, combo: 0, powerUntil: -1 };
  crowd.update(game, 0);
  for (let time = 1; time <= 11; time++) { game.misses++; assert.equal(crowd.update(game, time), time === 5 ? 'boo' : null); }
  for (let time = 12; time <= 35; time++) assert.equal(crowd.update(game, time), null);
  game.misses++;
  assert.equal(crowd.update(game, 36), 'boo');
  assert.equal(crowd.update(game, 0), null);
});

test('pause, mute, and teardown prevent an asynchronously loaded sound from starting', async () => {
  const originalContext = globalThis.AudioContext, originalFetch = globalThis.fetch;
  try {
    for (const action of ['stop', 'mute', 'destroy']) {
      let deliver, starts = 0, closed = false;
      globalThis.AudioContext = class {
        state = 'running';
        async resume() {}
        async close() { closed = true; }
        async decodeAudioData() { return { duration: 4 }; }
        createBufferSource() { starts++; throw new Error('Must not start'); }
      };
      globalThis.fetch = () => new Promise(resolve => { deliver = () => resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) }); });
      const audio = new CrowdAudio(file => `/sounds/${file}`);
      audio.unlock();
      const pending = audio.play('cheer');
      if (action === 'mute') audio.setVolume(0); else audio[action]();
      deliver(); await pending;
      assert.equal(starts, 0);
      audio.destroy(); assert.equal(closed, true);
    }
  } finally {
    if (originalContext === undefined) delete globalThis.AudioContext; else globalThis.AudioContext = originalContext;
    globalThis.fetch = originalFetch;
  }
});

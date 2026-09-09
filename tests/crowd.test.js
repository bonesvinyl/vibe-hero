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

test('bonus cheer lasts the bonus window and is restarted for the remainder after pause', () => {
  const audio = new CrowdAudio(x=>x), calls=[];
  audio.play=(...args)=>calls.push(args); audio.arena=()=>{};
  const game={hits:0,misses:0,combo:0,powerUntil:16,rock:70};
  audio.update(game,0); audio.update(game,0.5);
  assert.equal(calls.length,1); assert.deepEqual(calls[0],['cheer',16,2.3,true]);
  audio.stop(); audio.update(game,1);
  assert.equal(calls[1][1],15);
  audio.update(game,16); assert.equal(audio.bonusPlaying,false);
});

test('preroll never starts bonus sound or interrupts the intro cue', () => {
  const audio=new CrowdAudio(x=>x), calls=[];
  audio.play=(...args)=>calls.push(args);
  audio.update({hits:0,misses:0,combo:0,powerUntil:-1},-4);
  assert.equal(calls.length,0);
});


test('third consecutive miss sounds even during bonus cheering, then hits reset the run', () => {
  const audio=new CrowdAudio(x=>x), cues=[];
  audio.play=()=>{}; audio.cue=(...args)=>cues.push(args);
  const game={hits:0,misses:0,combo:0,powerUntil:16,rock:70};
  audio.update(game,0); cues.length=0;
  game.misses=1; audio.update(game,.5); game.misses=2; audio.update(game,1);
  assert.equal(cues.length,0);
  game.misses=3; audio.update(game,1.5); assert.match(cues[0][0],/^miss[1-6]\.mp3$/);
  game.hits=1; audio.update(game,2); game.misses=4; audio.update(game,2.5);
  game.misses=5; audio.update(game,3); assert.equal(cues.length,1);
  game.misses=6; audio.update(game,3.5); assert.equal(cues.length,2);
  game.misses=10; audio.update(game,20); assert.equal(cues.length,2);
});

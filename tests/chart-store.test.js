import test from 'node:test';
import assert from 'node:assert/strict';
import { saveChart, loadChart } from '../extension/chart-store.js';
import { prepTime, capturedSongEnd } from '../extension/prep-clock.js';

test('saved charts survive a new reader and remain bound to their exact recording', async () => {
  const values = {}, storage = { set: async value => Object.assign(values, structuredClone(value)), get: async key => ({ [key]: structuredClone(values[key]) }) };
  const id = 'WtuoFv4dcwM', notes = [{ time: 1, lanes: [0, 2], duration: 1 }];
  await saveChart(storage, id, { version: 1, notes }, 10, { bpm: 155, difficulty: 'expert' }, 'Song');
  const restored = await loadChart(storage, id);
  assert.deepEqual(restored.notes, notes); assert.equal(restored.settings.bpm, 155);
  assert.equal(await loadChart(storage, 'HQmmM_qwG4k'), null);
  await assert.rejects(saveChart({ set: async () => { throw new Error('quota'); } }, id, restored, 10, {}, 'Song'), /quota/);
});

test('background clock freezes for stale snapshots, ads, pauses and seeking', () => {
  const state = { time: 10, duration: 100, rate: 1, ready: 4 };
  assert.equal(prepTime(state, 1000, 1100), 10.1);
  assert.equal(prepTime(state, 1000, 1500), null);
  for (const key of ['ad', 'paused', 'seeking']) assert.equal(prepTime({ ...state, [key]: true }, 1000, 1100), null);
  assert.equal(prepTime({ ...state, rate: 2 }, 1000, 1100), null);
  assert.equal(capturedSongEnd([{ time: 99.8 }], 100), true);
  assert.equal(capturedSongEnd([{ time: 50 }], 100), false);
});

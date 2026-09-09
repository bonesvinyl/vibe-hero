import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, validateChart, practiceChart } from '../src/game/chart.js';
import { chartFromFrames } from '../src/game/chart-analysis.js';

test('holds pay only once per elapsed tick, stop on release, and reset on seek', () => {
  const g = new Game([{ time: 1, lanes: [0, 2], duration: 1 }]);
  g.hit([0, 2], 1, true);
  const base = g.score;
  g.updateHolds(1.5, [true, false, true]);
  assert.equal(g.score, base + 25);
  g.updateHolds(1.5, [true, false, true]);
  assert.equal(g.score, base + 25);
  g.updateHolds(1.6, [true, false, false]);
  assert.equal(g.holds.size, 0);
  assert.equal(g.combo, 0);
  g.updateHolds(2, [true, false, true]);
  assert.equal(g.score, base + 25);
  g.update(0);
  assert.equal(g.holds.size, 0);
  assert.equal(g.score, 0);
});
test('hold completion permits release at its end; invalid and overlapping holds fail import', () => {
  const g = new Game([{ time: 1, lanes: [0], duration: 1 }]);
  g.hit([0], 1); g.updateHolds(2, [false]);
  assert.equal(g.combo, 1); assert.equal(g.holds.size, 0);
  for (const duration of [-1, Infinity, 10]) assert.throws(() => validateChart({ version: 1, notes: [{ time: 1, lanes: [0], duration }] }, 5));
  assert.throws(() => validateChart({ version: 1, notes: [{ time: 1, lanes: [0], duration: 2 }, { time: 2, lanes: [0] }] }, 5));
  const notes = practiceChart(30, 120, 0, 'expert');
  assert.ok(notes.some(n => n.lanes.length === 3));
  assert.ok(notes.some(n => n.duration));
  assert.deepEqual(validateChart({ version: 1, notes }, 30), notes);
});
test('audio chart places attacks on the signal, sustains stop before silence, and difficulty adds accents', () => {
  const frames = Array.from({ length: 600 }, (_, i) => ({ time: i / 50, flux: i === 50 || i === 250 ? 10 : 0, energy: (i >= 50 && i < 100) || (i >= 250 && i < 300) ? 1 : 0, tone: i < 200 ? 10 : 40 }));
  const hard = chartFromFrames(frames, 'expert').notes;
  assert.deepEqual(hard.map(n => n.time), [1, 5]);
  assert.ok(hard.every(n => n.duration >= 0.9 && n.duration < 1));
  assert.ok(hard.every(n => n.lanes.length === 3));
  assert.ok(chartFromFrames(frames, 'easy').notes.every(n => n.lanes.length === 1));
  assert.deepEqual(chartFromFrames(frames.map(f => ({ ...f, flux: 0, energy: 0 }))).notes, []);
});

test('single-note mode preserves timing and holds without mutating the original chord chart', () => {
  const notes = [{ time: 1, lanes: [0, 2, 4], duration: 1 }];
  const solo = new Game(notes, false), chords = new Game(notes, true);
  assert.deepEqual(solo.notes, [{ time: 1, lanes: [2], duration: 1 }]);
  assert.equal(chords.notes[0].lanes.length, 3);
  assert.equal(notes[0].lanes.length, 3);
});

test('streak milestones occur at 50 and 100 and expire quickly', () => {
  const game = new Game(Array.from({ length: 100 }, (_, i) => ({ time: i * 0.5, lanes: [0] })));
  for (let i = 0; i < 100; i++) {
    game.hit([0], i * 0.5);
    if (i === 49) { assert.equal(game.milestone, 50); assert.equal(game.milestoneUntil, 25.9); }
  }
  assert.equal(game.milestone, 100);
  game.reset(); assert.equal(game.milestone, 0);
});

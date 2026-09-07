import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Game,
  practiceChart,
  validateChart,
  youtubeId,
} from "../src/game/chart.js";
import { analyze } from "../src/game/analysis.js";
import { DEFAULT_BINDINGS, down, listenInput } from "../src/game/controller.js";

const single = [
  { time: 1, lanes: [0] },
  { time: 2, lanes: [1] },
];
test("YouTube URLs accept supported hosts and reject lookalikes", () => {
  for (const url of [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=12",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://m.youtube.com/shorts/dQw4w9WgXcQ",
  ])
    assert.equal(youtubeId(url), "dQw4w9WgXcQ");
  for (const url of [
    "https://evil.test/?v=dQw4w9WgXcQ",
    "https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ",
    "javascript:alert(1)",
    "abc",
    "https://youtu.be/short",
  ])
    assert.equal(youtubeId(url), null);
});
test("practice grids use absolute media times and are deterministic", () => {
  const chart = practiceChart(20, 120, 2.5);
  assert.deepEqual(chart, practiceChart(20, 120, 2.5));
  assert.equal(chart[0].time, 2.5);
  assert.equal(chart[1].time, 3);
  assert.ok(practiceChart(20, 120, 2.5, "easy").length < chart.length);
  assert.throws(() => practiceChart(Infinity, 120));
  assert.throws(() => practiceChart(120, 0));
});
test("validates sorted charts, chords, time bounds and hostile values", () => {
  assert.deepEqual(
    validateChart({ version: 1, notes: [{ time: 0, lanes: [4, 0] }] }, 10),
    [{ time: 0, lanes: [0, 4] }],
  );
  for (const notes of [
    [{ time: -1, lanes: [0] }],
    [{ time: 10, lanes: [0] }],
    [{ time: 0, lanes: [5] }],
    [{ time: 0, lanes: [0, 0] }],
    [{ time: NaN, lanes: [0] }],
    [
      { time: 1, lanes: [0] },
      { time: 0, lanes: [1] },
    ],
    [
      { time: 1, lanes: [0] },
      { time: 1.01, lanes: [1] },
    ],
  ])
    assert.throws(() => validateChart({ version: 1, notes }, 10));
});
test("judges on the hit line and never awards the same note twice", () => {
  const game = new Game(single);
  game.reset(0.8);
  assert.equal(game.hit([0], 1), true);
  assert.equal(game.score, 100);
  assert.equal(game.hits, 1);
  assert.equal(game.hit([0], 1.02), false);
  assert.equal(game.score, 100);
});
test("good and out-of-window judgments are distinct", () => {
  const game = new Game(single);
  game.reset(0.8);
  assert.equal(game.hit([0], 0.89), true);
  assert.equal(game.score, 60);
  const late = new Game(single);
  late.reset(0.8);
  assert.equal(late.hit([0], 1.15), false);
  assert.equal(late.misses, 1);
});
test("holding time steady during pause cannot expire a note", () => {
  const game = new Game(single);
  game.reset(0.9);
  for (let i = 0; i < 600; i++) game.update(0.9);
  assert.equal(game.misses, 0);
  assert.equal(game.hit([0], 1), true);
});
test("forward and backward seeks reset attempts without farming scores", () => {
  const game = new Game(single);
  game.reset(0.8);
  game.hit([0], 1);
  game.update(0.4);
  assert.equal(game.score, 0);
  assert.equal(game.hits, 0);
  game.update(5);
  assert.equal(game.results[0], "skipped");
  assert.equal(game.misses, 0);
});
test("chords require all frets; a strum rejects extra frets", () => {
  const chart = [{ time: 1, lanes: [0, 2] }];
  const game = new Game(chart);
  game.reset(0.8);
  assert.equal(game.hit([0], 1), false);
  assert.equal(game.hit([2], 1.02), true);
  assert.equal(game.hits, 1);
  const guitar = new Game(chart);
  guitar.reset(0.8);
  assert.equal(guitar.hit([0, 2, 3], 1, true), false);
  assert.equal(guitar.hit([0, 2], 1.02, true), true);
});
test("misses count once and break a streak", () => {
  const game = new Game(single);
  game.reset(0.8);
  game.hit([0], 1);
  game.update(1.9);
  game.update(2.2);
  game.update(2.3);
  assert.equal(game.misses, 1);
  assert.equal(game.combo, 0);
  assert.equal(game.accuracy, 50);
});
test("input bindings target exact gamepad devices and axis directions", () => {
  const pad = { id: "Wii guitar", buttons: [{ pressed: true }], axes: [-1] };
  assert.equal(
    down({ type: "button", device: pad.id, index: 0 }, new Set(), [pad]),
    true,
  );
  assert.equal(
    down({ type: "button", device: "other", index: 0 }, new Set(), [pad]),
    false,
  );
  assert.equal(
    down({ type: "axis", device: pad.id, index: 0, direction: -1 }, new Set(), [
      pad,
    ]),
    true,
  );
  assert.equal(
    down({ type: "axis", device: pad.id, index: 0, direction: 1 }, new Set(), [
      pad,
    ]),
    false,
  );
});
test("silence creates no fabricated notes", () =>
  assert.equal(analyze(new Float32Array(22050 * 3), 22050).notes.length, 0));
test("audio analysis finds attacks with silence gaps and repeatable lanes", () => {
  const rate = 22050,
    samples = new Float32Array(rate * 8),
    times = [1, 1.5, 2, 2.5, 5, 5.5, 6, 6.5];
  times.forEach((time, n) => {
    for (let i = 0; i < rate * 0.12; i++)
      samples[Math.floor(time * rate) + i] =
        Math.sin((2 * Math.PI * (150 + n * 80) * i) / rate) *
        Math.exp((-i / rate) * 30);
  });
  const result = analyze(samples, rate);
  assert.equal(result.notes.length, times.length);
  result.notes.forEach((note, i) =>
    assert.ok(
      Math.abs(note.time - times[i]) < 0.04,
      `Expected ${times[i]}, got ${note.time}`,
    ),
  );
  assert.deepEqual(result, analyze(samples, rate));
  assert.ok(Math.abs(result.bpm - 120) < 3);
  assert.equal(
    result.notes.some((n) => n.time > 2.7 && n.time < 4.9),
    false,
  );
});
test("keyboard edges are immediate, repeats suppressed, and disconnect pauses", () => {
  const listeners = new Map(),
    frames = new Map();
  let counter = 0,
    disconnects = 0,
    pads = [];
  const originals = Object.fromEntries(
    [
      "window",
      "navigator",
      "HTMLElement",
      "requestAnimationFrame",
      "cancelAnimationFrame",
    ].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      addEventListener: (key, callback) => listeners.set(key, callback),
      removeEventListener: (key) => listeners.delete(key),
    },
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { getGamepads: () => pads },
  });
  globalThis.HTMLElement = class {};
  globalThis.requestAnimationFrame = (callback) => {
    frames.set(++counter, callback);
    return counter;
  };
  globalThis.cancelAnimationFrame = (id) => frames.delete(id);
  try {
    const edges = [],
      stop = listenInput(
        DEFAULT_BINDINGS,
        (_held, changed) => {
          if (changed[0]) edges.push(0);
        },
        () => disconnects++,
      );
    const event = { target: null, code: "KeyA", preventDefault() {} };
    listeners.get("keydown")(event);
    listeners.get("keydown")(event);
    listeners.get("keyup")(event);
    assert.deepEqual(edges, [0]);
    const tick = () => {
      const [id, callback] = frames.entries().next().value;
      frames.delete(id);
      callback();
    };
    pads = [{ id: "test", buttons: [], axes: [] }];
    tick();
    pads = [];
    tick();
    assert.equal(disconnects, 1);
    stop();
    assert.equal(listeners.size, 0);
    assert.equal(frames.size, 0);
  } finally {
    for (const [key, descriptor] of Object.entries(originals)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});

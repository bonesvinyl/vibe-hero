import { test } from "node:test";
import assert from "node:assert/strict";
import { SampledMediaClock } from "../src/game/clock.js";

test("iframe clock smooths sparse samples, reanchors, and cannot free-run", () => {
  const clock = new SampledMediaClock();
  assert.equal(clock.read(5, true, 1000), 5);
  assert.equal(clock.read(5, true, 1100), 5.1);
  assert.equal(clock.read(5, true, 5000), 5.25);
  assert.equal(clock.read(5.3, true, 5100), 5.3);
  assert.equal(clock.read(5.3, false, 5200), 5.3);
  assert.equal(clock.read(5.3, false, 9000), 5.3);
  assert.equal(clock.read(5.3, true, 9500), 5.3);
});
test("iframe clock respects speed changes and seeks", () => {
  const clock = new SampledMediaClock();
  clock.read(5, true, 1000);
  assert.equal(clock.read(5, true, 1100, 0.5), 5);
  assert.equal(clock.read(5, true, 1300, 0.5), 5.1);
  assert.equal(clock.read(1, true, 1400, 0.5), 1);
});

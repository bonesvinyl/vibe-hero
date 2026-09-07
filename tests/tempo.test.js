import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateTempo } from "../src/game/tempo.js";
import { youtubePlaybackError } from "../src/game/youtube.js";

function pulseTrain(bpm, fills = false) {
  const rate = 100,
    samples = Array(2000).fill(0);
  for (let beat = 0; (beat * 60) / bpm < 20; beat++) {
    const start = Math.round(((beat * 60) / bpm) * rate);
    for (let i = 0; i < 4 && start + i < samples.length; i++)
      samples[start + i] += [1, 0.7, 0.3, 0.1][i];
    if (fills && beat % 3 === 0) {
      const fill = start + Math.round((60 / bpm) * rate * 0.375);
      if (fill < samples.length) samples[fill] += 0.35;
    }
  }
  return samples;
}
for (const bpm of [75, 90, 120, 155, 180])
  test(`tempo estimator resolves a ${bpm} BPM pulse with offbeat fills`, () => {
    const result = estimateTempo(pulseTrain(bpm, true), 100);
    assert.ok(Math.abs(result.bpm - bpm) < 1.5, JSON.stringify(result));
    assert.ok(result.confidence > 0.5);
  });
test("silence and insufficient samples do not fabricate a tempo", () => {
  assert.equal(estimateTempo(Array(2000).fill(0), 100).bpm, null);
  assert.equal(estimateTempo(Array(100).fill(1), 100).bpm, null);
});
test("YouTube 150 is an owner embedding restriction; 153 is a different configuration failure", () => {
  assert.match(
    youtubePlaybackError(150).message,
    /owner does not allow embedded playback/,
  );
  assert.match(youtubePlaybackError(153).message, /configuration issue/);
  assert.match(youtubePlaybackError(999).message, /cause is unknown/);
  assert.equal(youtubePlaybackError(150).code, 150);
});

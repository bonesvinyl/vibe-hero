import { test } from "node:test";
import assert from "node:assert/strict";
import { AudioTransport } from "../src/game/audio.js";

test("audio clock has a preroll, freezes on pause, and resumes from the exact offset", async () => {
  const original = globalThis.AudioContext;
  const sources = [];
  globalThis.AudioContext = class {
    currentTime = 10;
    destination = {};
    async resume() {}
    async close() {
      this.closed = true;
    }
    createBufferSource() {
      const source = {
        connect() {},
        disconnect() {},
        start(...args) {
          this.startArgs = args;
        },
        stop() {
          this.stopped = true;
        },
      };
      sources.push(source);
      return source;
    }
  };
  try {
    const transport = new AudioTransport({ duration: 20 });
    await transport.play();
    assert.deepEqual(sources[0].startArgs, [14, 0]);
    transport.context.currentTime = 11;
    assert.ok(Math.abs(transport.getTime() + 3) < 0.0001);
    transport.pause();
    assert.equal(sources[0].stopped, true);
    transport.context.currentTime = 100;
    assert.ok(Math.abs(transport.getTime() + 3) < 0.0001);
    await transport.play();
    assert.deepEqual(sources[1].startArgs, [103, 0]);
    transport.context.currentTime = 104;
    transport.pause();
    assert.ok(Math.abs(transport.getTime() - 1) < 0.0001);
    await transport.play();
    assert.ok(Math.abs(sources[2].startArgs[1] - 1) < 0.0001);
    transport.destroy();
    assert.equal(transport.context.closed, true);
    assert.equal(transport.playing, false);
  } finally {
    if (original) globalThis.AudioContext = original;
    else delete globalThis.AudioContext;
  }
});
test("leaving while audio permission resumes cannot start orphaned playback", async () => {
  const original = globalThis.AudioContext;
  let resume,
    created = false;
  globalThis.AudioContext = class {
    resume() {
      return new Promise((resolve) => {
        resume = resolve;
      });
    }
    close() {}
    createBufferSource() {
      created = true;
    }
  };
  try {
    const transport = new AudioTransport({ duration: 20 });
    const pending = transport.play();
    transport.destroy();
    resume();
    await pending;
    assert.equal(created, false);
    assert.equal(transport.playing, false);
  } finally {
    if (original) globalThis.AudioContext = original;
    else delete globalThis.AudioContext;
  }
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { captureTempoAudio } from "../src/game/capture.js";

function environment({ audio = true, deferred = false } = {}) {
  const keys = ["navigator", "MediaRecorder", "MediaStream", "AudioContext"];
  const saved = keys.map((key) => [
    key,
    Object.getOwnPropertyDescriptor(globalThis, key),
  ]);
  const audioTrack = Object.assign(new EventTarget(), {
    stop() {
      this.stopped = true;
    },
  });
  const videoTrack = {
    stop() {
      this.stopped = true;
    },
  };
  const stream = {
    getAudioTracks: () => (audio ? [audioTrack] : []),
    getTracks: () => (audio ? [audioTrack, videoTrack] : [videoTrack]),
  };
  let allow, received, recorder;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      mediaDevices: {
        getDisplayMedia: () =>
          deferred
            ? new Promise((resolve) => {
                allow = resolve;
              })
            : Promise.resolve(stream),
      },
    },
  });
  globalThis.MediaStream = class {
    constructor(tracks) {
      received = tracks;
    }
  };
  globalThis.MediaRecorder = class {
    state = "inactive";
    mimeType = "audio/webm";
    constructor() {
      recorder = this;
    }
    start() {
      this.state = "recording";
    }
    stop() {
      this.state = "inactive";
      queueMicrotask(() => {
        this.ondataavailable?.({ data: new Blob(["audio"]) });
        this.onstop?.();
      });
    }
  };
  globalThis.AudioContext = class {
    async decodeAudioData() {
      return { duration: 20 };
    }
    async close() {}
  };
  return {
    audioTrack,
    videoTrack,
    stream,
    allow: () => allow(stream),
    received: () => received,
    recorder: () => recorder,
    restore: () =>
      saved.forEach(([key, descriptor]) => {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete globalThis[key];
      }),
  };
}
test("BPM capture records only audio and stops every sharing track after completion", async () => {
  const env = environment();
  try {
    const result = await captureTempoAudio(
      new AbortController().signal,
      () => {},
      0.005,
    );
    assert.equal(result.duration, 20);
    assert.deepEqual(env.received(), [env.audioTrack]);
    assert.equal(env.audioTrack.stopped, true);
    assert.equal(env.videoTrack.stopped, true);
  } finally {
    env.restore();
  }
});
test("missing tab audio is actionable and releases the video share", async () => {
  const env = environment({ audio: false });
  try {
    await assert.rejects(
      captureTempoAudio(new AbortController().signal, () => {}),
      /No tab audio/,
    );
    assert.equal(env.videoTrack.stopped, true);
  } finally {
    env.restore();
  }
});
test("cancelling while the picker is open stops a subsequently granted stream", async () => {
  const env = environment({ deferred: true }),
    controller = new AbortController();
  try {
    const pending = captureTempoAudio(controller.signal, () => {});
    controller.abort();
    env.allow();
    await assert.rejects(pending, { name: "AbortError" });
    assert.equal(env.audioTrack.stopped, true);
    assert.equal(env.videoTrack.stopped, true);
    assert.equal(env.recorder(), undefined);
  } finally {
    env.restore();
  }
});
test("cancelling an active sample stops recorder and all tracks", async () => {
  const env = environment(),
    controller = new AbortController();
  try {
    const pending = captureTempoAudio(controller.signal, () => {});
    await Promise.resolve();
    controller.abort();
    await assert.rejects(pending, { name: "AbortError" });
    assert.equal(env.recorder().state, "inactive");
    assert.equal(env.audioTrack.stopped, true);
    assert.equal(env.videoTrack.stopped, true);
  } finally {
    env.restore();
  }
});

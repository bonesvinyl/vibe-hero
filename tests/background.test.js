import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

test('background preparation checks invocation and busy state before acquiring tab audio', async () => {
  let listener, captured = 0, created = 0, busy = true;
  const chrome = {
    runtime: { id: 'extension', getURL: path => `chrome-extension://extension/${path}`, onMessage: { addListener(fn) { listener = fn; } }, getContexts: async () => [], sendMessage: async message => message.type === 'status' ? { busy } : { ok: true } },
    tabs: { query: async () => [{ id: 7, url: 'https://www.youtube.com/watch?v=WtuoFv4dcwM' }], sendMessage: async () => ({ duration: 240, title: 'Song', ad: false }) },
    offscreen: { createDocument: async () => { created++; } }, scripting: { executeScript: async () => {} }, tabCapture: { getMediaStreamId: async () => { captured++; return 'stream'; } },
  };
  vm.runInNewContext(readFileSync(new URL('../extension/background.js', import.meta.url), 'utf8'), { chrome, URL });
  const send = sender => new Promise(resolve => listener({ target: 'background', type: 'prepare' }, sender, resolve));
  assert.match((await send({ id: 'extension', tab: { id: 7 }, url: 'https://www.youtube.com/' })).error, /Use the Vibe Hero extension/);
  const sender = { id: 'extension', url: 'chrome-extension://extension/popup.html' };
  assert.match((await send(sender)).error, /Another song/);
  assert.equal(captured, 0);
  busy = false;
  assert.equal((await send(sender)).ok, true);
  assert.equal(captured, 1); assert.ok(created > 0);
});

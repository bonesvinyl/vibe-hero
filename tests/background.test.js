import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

test('background preparation checks invocation and busy state before acquiring tab audio', async () => {
  let listener, captured = 0, created = 0, busy = true;
  const chrome = {
    runtime: { id: 'extension', getURL: path => `chrome-extension://extension/${path}`, onMessage: { addListener(fn) { listener = fn; } }, getContexts: async () => [], sendMessage: async message => message.type === 'status' ? { busy } : { ok: true } },
    tabs: { onUpdated: {addListener() {}}, onRemoved: {addListener() {}}, query: async () => [{ id: 7, url: 'https://www.youtube.com/watch?v=WtuoFv4dcwM' }], sendMessage: async () => ({ duration: 240, title: 'Song', ad: false }) },
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

test('next song requires an installed chart and resumes injection only in its originating tab',async()=>{
 let listener,updated,tabUrl='https://www.youtube.com/watch?v=abcdefghijk';const session={},injected=[];
 const chrome={runtime:{id:'extension',getURL:p=>'chrome-extension://extension/'+p,onMessage:{addListener:fn=>listener=fn}},storage:{local:{get:async()=>({'vh.chart.zyxwvutsrqp':{notes:[]}})},session:{set:async v=>Object.assign(session,v),get:async()=>session,remove:async k=>delete session[k]}},tabs:{onUpdated:{addListener:fn=>updated=fn},onRemoved:{addListener(){}},update:async(id,v)=>{assert.equal(id,7);tabUrl=v.url;},get:async()=>({url:tabUrl})},scripting:{executeScript:async v=>injected.push(v)}};
 vm.runInNewContext(readFileSync(new URL('../extension/background.js',import.meta.url),'utf8'),{chrome,URL});
 const sender={id:'extension',tab:{id:7},url:tabUrl};
 const send=videoId=>new Promise(resolve=>listener({target:'background',type:'next-song',videoId},sender,resolve));
 assert.match((await send('abcdefghijk')).error,/Prepare/);
 assert.equal((await send('zyxwvutsrqp')).ok,true);
 assert.match(tabUrl,/v=zyxwvutsrqp/);updated(7,{status:'complete'});
 await new Promise(resolve=>setTimeout(resolve,5));
 assert.equal(injected.length,2);assert.equal(injected[1].files[0],'overlay.js');assert.equal(Object.keys(session).length,0);
});

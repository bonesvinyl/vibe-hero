import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseQueue, prepareQueue } from '../scripts/prepare-queue.js';
import { importPack } from '../extension/import-pack.js';
const ids=['WtuoFv4dcwM','HQmmM_qwG4k'];
const chart=id=>({version:1,youtubeId:id,duration:10,title:'Song',notes:[{time:1,lanes:[0]}],settings:{difficulty:'medium'}});
test('queue parses exact YouTube IDs and deduplicates URL variants',()=>{
 assert.deepEqual(parseQueue(`https://youtu.be/${ids[0]}\nhttps://www.youtube.com/watch?v=${ids[0]}&t=12`),[ids[0]]);
 assert.throws(()=>parseQueue('https://youtube.com.evil.test/watch?v='+ids[0]));
});
test('queue continues after refusal, saves a valid pack, and resumes without repeating completed songs',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'vh-queue-test-'));
 try {
  const first=await prepareQueue(ids,dir,{prepare:async id=>{if(id===ids[1])throw new Error('Unavailable');return chart(id);}});
  assert.equal(first.status,'complete-with-errors');
  const calls=[];const second=await prepareQueue(ids,dir,{prepare:async id=>{calls.push(id);return chart(id);}});
  assert.equal(second.status,'complete');assert.deepEqual(calls,[ids[1]]);
  const pack=JSON.parse(await readFile(path.join(dir,'vibe-hero-song-pack.json'),'utf8')),saved={};
  assert.equal(await importPack(pack,{set:async value=>Object.assign(saved,value)}),2);
  assert.ok(saved['vh.chart.'+ids[0]]);assert.ok(saved['vh.chart.'+ids[1]]);
 } finally {await rm(dir,{recursive:true,force:true});}
});
test('invalid pack is rejected before any chart writes',async()=>{
 let writes=0;
 await assert.rejects(importPack({version:1,charts:[chart(ids[0]),{...chart(ids[1]),duration:NaN}]},{set:async()=>writes++}));
 assert.equal(writes,0);
});

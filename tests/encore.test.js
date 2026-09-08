import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, arrangeNotes } from '../src/game/chart.js';
import { scoreRecord, saveScore } from '../src/game/scores.js';
import { leaderboard } from '../server/leaderboard.js';

test('easy removes orange and chords, reduces density and preserves safe holds', () => {
  const notes = Array.from({length:30}, (_,i) => ({time:i*0.2, lanes:[3,4],duration:0.15}));
  const easy = new Game(notes,true,'easy'), medium = new Game(notes,true,'medium');
  assert.ok(easy.notes.length < medium.notes.length);
  assert.ok(easy.notes.every(n=>n.lanes.length===1 && n.lanes[0]<4));
  assert.ok(easy.approach > medium.approach && medium.approach > 2.4);
  const holds = arrangeNotes([{time:0,lanes:[4],duration:2},{time:1,lanes:[3]}],'easy');
  assert.ok(holds[0].duration < 1);
  assert.deepEqual(notes[0].lanes,[3,4]);
});
test('crowd failure stops scoring and power until restart; hits recover health', () => {
  const game = new Game(Array.from({length:40},(_,i)=>({time:i,lanes:[0]})),true,'medium');
  for(let t=0;t<13;t+=0.5) game.update(t);
  assert.equal(game.failed,true); assert.equal(game.rock,0);
  game.energy=100; game.activate(13); assert.equal(game.powerUntil,-1);
  assert.equal(game.hit([0],13),false);
  game.reset(0); game.hit([0],0); assert.equal(game.failed,false); assert.equal(game.rock,72);
  assert.ok(game.flames[0]>0);
});
test('saved results persist per attempt, isolate charts and label practice and failed runs', async () => {
  const game = new Game([{time:0,lanes:[0]}],true,'easy'); game.reset(0); game.hit([0],0);
  const settings={difficulty:'easy',chords:true,mode:'tap'};
  const record=await scoreRecord(game,settings,'WtuoFv4dcwM','Song','Player');
  const values={}; await saveScore(record,{set:async data=>Object.assign(values,data)});
  assert.equal(values[`vh.score.${record.id}`].score,100);
  game.update(10); assert.equal((await scoreRecord(game,settings,'WtuoFv4dcwM','Song','Player')).competitiveEligible,false);
  game.failed=true; assert.equal((await scoreRecord(game,settings,'WtuoFv4dcwM','Song','Player')).outcome,'failed');
});
test('leaderboard isolates exact videos and settings and validates incoming scores', async () => {
  const server=leaderboard(':memory:'); await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const base=`http://127.0.0.1:${server.address().port}/scores`;
    const game=new Game([{time:0,lanes:[0]}]); game.reset(0); game.hit([0],0);
    const r=await scoreRecord(game,{difficulty:'medium',chords:true,mode:'tap'},'WtuoFv4dcwM','Song','Player');
    const post=await fetch(base,{method:'POST',body:JSON.stringify(r)}); assert.equal(post.status,201);
    const {board}=await post.json();
    const get=await fetch(`${base}?videoId=${r.videoId}&board=${encodeURIComponent(board)}`); assert.equal((await get.json()).scores.length,1);
    const other=await fetch(`${base}?videoId=HQmmM_qwG4k&board=${encodeURIComponent(board)}`); assert.equal((await other.json()).scores.length,0);
    assert.equal((await fetch(base,{method:'POST',body:JSON.stringify({...r,score:-1})})).status,400);
    assert.equal((await fetch(base,{method:'POST',body:JSON.stringify(r)})).status,200);
  } finally { await new Promise(resolve=>server.close(resolve)); }
});

test('initial audio preroll remains score eligible while a later seek does not', () => {
  const game=new Game([{time:1,lanes:[0]}]);
  game.update(-2.4); assert.equal(game.eligible,true);
  for(let time=-2;time<=1;time+=0.5) game.update(time);
  game.update(-1); assert.equal(game.eligible,false);
});

test('only complete glowing phrases charge the meter, yielding four activations on a clean song', () => {
 const game=new Game(Array.from({length:480},(_,i)=>({time:i*.5,lanes:[0]})));
 game.reset(0);let activations=0;
 for(const note of game.notes){const prior=game.energy;game.hit(note.lanes,note.time);
  if(note.starPhrase===undefined)assert.equal(game.energy,prior);
  if(game.energy===100&&note.time>=game.powerUntil){game.activate(note.time);activations++;}
 }
 assert.equal(game.phrases.length,8);assert.equal(activations,4);
});

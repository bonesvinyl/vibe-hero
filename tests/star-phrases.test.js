import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,arrangeNotes} from '../src/game/chart.js';
const notes=()=>Array.from({length:200},(_,i)=>({time:i*.5,lanes:[0,2],duration:.2}));
test('missing a phrase note or releasing its hold prevents that phrase award',()=>{
 const game=new Game(notes());game.reset(0);const phrase=game.phrases[0];
 for(let i=0;i<=phrase.at(-1);i++){const n=game.notes[i];game.hit(n.lanes,n.time);game.updateHolds(n.time+.1,[false,false,false]);}
 assert.equal(game.energy,0);
});
test('Hard preserves prior approach and Expert is faster with optional triples',()=>{
 const hard=new Game(notes(),true,'hard'),expert=new Game(notes(),true,'expert');
 assert.equal(hard.approach,2.4);assert.ok(expert.approach<hard.approach);assert.ok(expert.window<hard.window);
 for(const difficulty of ['hard','expert']){
  assert.ok(arrangeNotes(notes(),difficulty,true,true).some(n=>n.lanes.length===3));
  assert.ok(arrangeNotes(notes(),difficulty,true,false).every(n=>n.lanes.length<=2));
  assert.ok(arrangeNotes(notes(),difficulty,false,true).every(n=>n.lanes.length===1));
 }
});
test('Expert keeps exact attack times and clamps holds before added chord frets',()=>{
 const source=notes(),before=JSON.stringify(source),chart=arrangeNotes(source,'expert');
 assert.deepEqual(chart.map(n=>n.time),source.map(n=>n.time));assert.equal(JSON.stringify(source),before);
 const ends=Array(5).fill(-1);for(const n of chart)for(const l of n.lanes){assert.ok(ends[l]<=n.time);ends[l]=n.time+(n.duration||0);}
});

test('one missed glowing note blocks a phrase and resets prevent farming',()=>{
 const game=new Game(notes().map(n=>({...n,duration:0})));game.reset(0);const phrase=game.phrases[0];
 for(let i=0;i<=phrase.at(-1);i++){const n=game.notes[i];if(i===phrase[1])game.update(n.time+.3);else game.hit(n.lanes,n.time);}
 assert.equal(game.energy,0);game.reset(0);assert.equal(game.awardedPhrases.size,0);
});

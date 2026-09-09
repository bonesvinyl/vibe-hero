import test from 'node:test';
import assert from 'node:assert/strict';
import {libraryView,filteredSongs,cleanTitle,addSongs,moveSong,preparationStamp,deleteCollection} from '../extension/library-model.js';
import {saveChart} from '../extension/chart-store.js';
const song=(id,title)=>({version:1,youtubeId:id,title,notes:[{time:1,lanes:[0]}],duration:30,settings:{},savedAt:'2026-09-08'});
test('existing charts recognize known packs and manual songs without modifying storage',()=>{
 const values={'vh.chart.ltYq-jalYm0':song('ltYq-jalYm0','Feist (Official Video)'), 'vh.chart.abcdefghijk':song('abcdefghijk','Manual')};
 const before=JSON.stringify(values),{songs,sets}=libraryView(values);
 assert.equal(songs[0].genre,'Indie rock');assert.equal(songs[0].title,'Feist');assert.equal(sets[0].name,'Indie Afterparty');
 assert.equal(filteredSongs(songs,sets,{collection:'manual'})[0].id,'abcdefghijk');assert.equal(JSON.stringify(values),before);
});
test('score histories join exact video IDs including orphaned score-only recordings',()=>{
 const {songs}=libraryView({'vh.chart.abcdefghijk':song('abcdefghijk','Same title'), 'vh.score.a':{videoId:'abcdefghijk',title:'Same title',score:10},'vh.score.b':{videoId:'zyxwvutsrqp',title:'Same title',score:20}});
 assert.equal(songs.length,2);assert.equal(songs[0].scores.length,1);assert.equal(songs[1].chart,null);assert.equal(songs[1].scores[0].score,20);
});
test('title and genre overrides survive chart reimport',async()=>{
 const values={'vh.song.abcdefghijk':{title:'My title',genre:'Soul'}};
 await saveChart({set:async data=>Object.assign(values,data)},'abcdefghijk',song('abcdefghijk','Original'),30,{},'New upload title');
 const {songs}=libraryView(values);assert.equal(songs[0].title,'My title');assert.equal(songs[0].genre,'Soul');
});
test('setlists deduplicate membership, reorder without altering source, and support filters',()=>{
 const set={id:'mix',songIds:['abcdefghijk','zyxwvutsrqp'],name:'Mix'};
 assert.deepEqual(addSongs(set,['abcdefghijk']).songIds,set.songIds);
 assert.deepEqual(moveSong(set,'zyxwvutsrqp','abcdefghijk').songIds,['zyxwvutsrqp','abcdefghijk']);
 assert.deepEqual(set.songIds,['abcdefghijk','zyxwvutsrqp']);
 const songs=[{id:'abcdefghijk',title:'B song',genre:'Soul',packs:[]},{id:'zyxwvutsrqp',title:'A song',genre:'Rock',packs:[]}];
 assert.equal(filteredSongs(songs,[set],{collection:'mix',genre:'Soul',query:'B song'})[0].id,'abcdefghijk');
 assert.equal(filteredSongs(songs,[set],{sort:'title'})[0].id,'zyxwvutsrqp');
});
test('title cleanup preserves recording version qualifiers',()=>{
 assert.equal(cleanTitle('(83) Band - Song (Official Music Video)'), 'Band - Song');
 assert.equal(cleanTitle('Band - Song (Live at Wembley) [Official Video]'),'Band - Song (Live at Wembley)');
});
test('dismissal identifies only the finished notice, not a later preparation',()=>{
 const job={videoId:'abcdefghijk',status:'ready',updatedAt:10};
 assert.notEqual(preparationStamp(job),preparationStamp({...job,status:'preparing',updatedAt:11}));
});

test('deleting built-in pack keeps songs and never resurrects the collection',()=>{
 const values={'vh.chart.ltYq-jalYm0':song('ltYq-jalYm0','Feist')};
 const id=libraryView(values).sets[0].id;
 const change=deleteCollection(values,id);
 Object.assign(values,change.updates);
 assert.equal(change.remove.length,0);assert.equal(libraryView(values).sets.length,0);
 assert.equal(libraryView(values).songs.length,1);
});
test('full deletion removes exact song records and shared memberships, preserving unrelated data',()=>{
 const values={'vh.setlist.mix':{id:'mix',name:'Mix',songIds:['abcdefghijk']},'vh.setlist.other':{id:'other',songIds:['abcdefghijk','zyxwvutsrqp']},'vh.chart.abcdefghijk':song('abcdefghijk','A'),'vh.song.abcdefghijk':{title:'A'},'vh.score.a':{videoId:'abcdefghijk'},'vh.score.b':{videoId:'zyxwvutsrqp'}};
 const change=deleteCollection(values,'mix',true);Object.assign(values,change.updates);change.remove.forEach(k=>delete values[k]);
 assert.equal(libraryView(values).sets.some(s=>s.id==='mix'),false);
 assert.deepEqual(values['vh.setlist.other'].songIds,['zyxwvutsrqp']);
 assert.equal(libraryView(values).songs.some(s=>s.id==='abcdefghijk'),false);
 assert.ok(values['vh.score.b']);
});

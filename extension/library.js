/* global chrome */
import { importPack, validatePack } from './import-pack.js';
import { META, SET, libraryView, filteredSongs, addSongs, moveSong, preparationStamp, deleteCollection } from './library-model.js';
const $=id=>document.getElementById(id),storage=chrome.storage.local;
let values={},model={songs:[],sets:[]},collection='all',page=0,selected=new Set(),detail=null,visible=[],pendingPack=null,editingSet=null,busy=false,refreshId=0;
const size=20;
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
function button(text,action){const b=el('button',text);b.type='button';b.onclick=()=>act(action);return b;}
function tell(text){$('message').textContent=text;}
async function act(action){try{await action();}catch(e){tell(`Could not save changes: ${e.message}`);}}
function download(value,name){const url=URL.createObjectURL(new Blob([JSON.stringify(value)],{type:'application/json'}));const a=el('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function currentSet(){return model.sets.find(s=>s.id===collection);}
async function saveSet(set){await storage.set({[SET+set.id]:set});await refresh();}
async function refresh(){if(busy)return;const id=++refreshId;try{const next=await storage.get(null);if(id!==refreshId)return;values=next;model=libraryView(values);render();}catch(e){tell(`Could not load your library: ${e.message}`);}}
function choose(id){collection=id;page=0;selected.clear();render();}
function render(){
  const nav=$('collections');nav.replaceChildren();
  function collectionButton(id,name,count,set){const b=button('',()=>choose(id));b.append(el('span',name),el('small',String(count)));b.setAttribute('aria-current',id===collection?'page':'false');
    if(set){b.ondragover=e=>{e.preventDefault();b.classList.add('drop-target');};b.ondragleave=()=>b.classList.remove('drop-target');b.ondrop=e=>{e.preventDefault();b.classList.remove('drop-target');const song=e.dataTransfer.getData('text/plain');if(model.songs.some(s=>s.id===song))act(async()=>{await saveSet(addSongs(set,[song]));tell(`Added song to ${set.name}.`);});};}
    nav.append(b);}
  collectionButton('all','All songs',model.songs.length);collectionButton('manual','Manual additions',model.songs.filter(s=>!s.packs.length).length);
  for(const kind of ['pack','custom']){nav.append(el('h2',kind==='pack'?'Song packs':'Your setlists'));for(const set of model.sets.filter(s=>(s.kind==='pack'?'pack':'custom')===kind))collectionButton(set.id,set.name,model.songs.filter(s=>set.songIds.includes(s.id)).length,set);}
  const genres=[...new Set(model.songs.map(s=>s.genre).filter(Boolean))].sort(),prior=$('genre').value;
  $('genre').replaceChildren(new Option('All genres',''),...genres.map(g=>new Option(g,g)));$('genre').value=genres.includes(prior)?prior:'';
  $('genres').replaceChildren(...genres.map(g=>new Option(g,g)));
  const target=$('target-set').value;$('target-set').replaceChildren(new Option('Choose a setlist',''),...model.sets.map(s=>new Option(s.name,s.id)));$('target-set').value=target;
  const set=currentSet();$('collection-title').textContent=set?.name||(collection==='manual'?'Manual additions':'All songs');$('rename-set').hidden=!set;$('delete-set').hidden=!set;$('remove-selected').hidden=!set;
  const filtered=filteredSongs(model.songs,model.sets,{collection,query:$('search').value,genre:$('genre').value,sort:$('sort').value});
  page=Math.max(0,Math.min(page,Math.ceil(filtered.length/size)-1));visible=filtered.slice(page*size,(page+1)*size);
  $('count').textContent=`${filtered.length} songs${set?.genre?' · '+set.genre:''}`;
  $('songs').replaceChildren();
  if(!visible.length)$('songs').append(el('p',model.songs.length?'No songs match. Try another collection or clear your filters.':'Import your first song pack, or prepare a song from the extension popup.','empty'));
  for(const song of visible){const row=el('article',undefined,'song-row');row.draggable=true;row.ondragstart=e=>e.dataTransfer.setData('text/plain',song.id);
    row.ondragover=e=>{if(set&&$('sort').value==='order'){e.preventDefault();row.classList.add('drop-target');}};row.ondragleave=()=>row.classList.remove('drop-target');
    row.ondrop=e=>{e.preventDefault();row.classList.remove('drop-target');const id=e.dataTransfer.getData('text/plain');if(set&&$('sort').value==='order'&&set.songIds.includes(id)&&id!==song.id)act(()=>saveSet(moveSong(set,id,song.id)));};
    const check=el('input');check.type='checkbox';check.checked=selected.has(song.id);check.setAttribute('aria-label',`Select ${song.title}`);check.onchange=()=>{check.checked?selected.add(song.id):selected.delete(song.id);updateSelection();};
    const info=button('',()=>openSong(song.id));info.className='song-info';info.append(el('strong',song.title),el('small',`${song.genre||'No genre'} · ${song.chart?Math.round(song.chart.settings?.bpm||120)+' BPM':'Chart not installed'} · ${song.scores.length} saved scores`));
    const play=el('a','Play ↗','play-link');play.href=`https://www.youtube.com/watch?v=${song.id}`;play.target='_blank';play.rel='noreferrer';play.setAttribute('aria-label',`Open ${song.title} on YouTube`);
    row.append(check,info,play);
    if(set&&$('sort').value==='order'){const i=set.songIds.indexOf(song.id);const up=button('↑',()=>saveSet(moveSong(set,song.id,set.songIds[i-1])));up.disabled=i<=0;up.setAttribute('aria-label',`Move ${song.title} up`);const down=button('↓',()=>saveSet(moveSong(set,song.id,set.songIds[i+2])));down.disabled=i>=set.songIds.length-1;down.setAttribute('aria-label',`Move ${song.title} down`);row.append(up,down);}
    $('songs').append(row);
  }
  $('page-label').textContent=filtered.length?`${page*size+1}–${Math.min((page+1)*size,filtered.length)} of ${filtered.length}`:'0 songs';$('previous').disabled=page===0;$('next').disabled=(page+1)*size>=filtered.length;updateSelection();renderJob();
}
function updateSelection(){$('selected-count').textContent=`${selected.size} selected`;$('select-page').checked=visible.length>0&&visible.every(s=>selected.has(s.id));$('select-page').indeterminate=visible.some(s=>selected.has(s.id))&&!$('select-page').checked;for(const id of ['add-selected','remove-selected','clear-selected'])$(id).disabled=!selected.size;}
function renderJob(){const job=values['vh.preparation'];$('preparation').hidden=!job||values['vh.dismissedPreparation']===preparationStamp(job);if(!job)return;const active=job.status==='preparing';const stale=active&&Date.now()-job.updatedAt>15000;
  $('status').textContent=`${job.title||job.videoId}: ${stale?'No recent progress. Check the song tab or cancel preparation.':job.status==='ready'?'Saved and ready to play.':active?`Preparing quietly · ${Math.round(job.progress||0)}%`:job.error||job.status}`;
  $('progress').hidden=!active;$('progress').value=job.progress||0;$('cancel').hidden=!active;$('dismiss').hidden=active;}
function openSong(id){detail=id;const song=model.songs.find(s=>s.id===id);if(!song)return;$('song-panel').hidden=false;$('detail-title').textContent=song.title;$('edit-title').value=song.title;$('edit-genre').value=song.genre;$('detail-play').href=`https://www.youtube.com/watch?v=${id}`;$('backup-song').disabled=!song.chart;
  $('memberships').replaceChildren();for(const set of model.sets){const label=el('label',undefined,'membership'),check=el('input');check.type='checkbox';check.checked=set.songIds.includes(id);check.onchange=()=>act(async()=>{const latest=libraryView(await storage.get(null)).sets.find(s=>s.id===set.id);await saveSet(check.checked?addSongs(latest,[id]):{...latest,songIds:latest.songIds.filter(x=>x!==id)});});label.append(check,document.createTextNode(set.name));$('memberships').append(label);}
  $('song-scores').replaceChildren();if(!song.scores.length)$('song-scores').append(el('p','No saved scores yet. Finish a run and save your result.','hint'));
  for(const score of song.scores){const item=el('article',undefined,'score-entry');item.append(el('strong',`${score.username||'Player'} · ${Number(score.score||0).toLocaleString()} pts`),el('p',`${score.difficulty} · ${score.chords?'Chords':'Single notes'} · ${score.accuracy}% hit · Best streak ${score.best}`),el('small',`${score.outcome==='failed'?'Failed attempt · ':score.competitiveEligible===false?'Practice · ':''}${new Date(score.date).toLocaleString()}`),button('Export score',()=>download(score,`vibe-hero-score-${score.id}.json`)));$('song-scores').append(item);}
}
$('close-panel').onclick=()=>{$('song-panel').hidden=true;detail=null;};
$('edit-song').onsubmit=e=>{e.preventDefault();act(async()=>{const title=$('edit-title').value.trim();if(!title)throw Error('Enter a song title.');const key=META+detail,prior=(await storage.get(key))[key]||{};await storage.set({[key]:{...prior,title,genre:$('edit-genre').value.trim()}});await refresh();openSong(detail);tell('Song details saved.');});};
$('backup-song').onclick=()=>{const song=model.songs.find(s=>s.id===detail);if(song?.chart)download({...song.chart,title:song.title},`vibe-hero-${detail}.json`);};
$('new-set').onsubmit=e=>{e.preventDefault();act(async()=>{const name=$('set-name').value.trim();if(!name)return;const set={id:crypto.randomUUID(),name,kind:'custom',genre:'',songIds:[]};await saveSet(set);$('set-name').value='';choose(set.id);tell('Setlist created. Drag songs here or use Add to setlist.');});};
$('search').oninput=()=>{page=0;render();};$('genre').onchange=$('sort').onchange=()=>{page=0;render();};
$('previous').onclick=()=>{page--;render();};$('next').onclick=()=>{page++;render();};
$('select-page').onchange=e=>{for(const song of visible)e.target.checked?selected.add(song.id):selected.delete(song.id);render();};$('clear-selected').onclick=()=>{selected.clear();render();};
$('add-selected').onclick=()=>act(async()=>{const set=model.sets.find(s=>s.id===$('target-set').value);if(!set)throw Error('Choose a destination setlist.');await saveSet(addSongs(set,[...selected]));tell(`Added ${selected.size} songs to ${set.name}.`);});
$('remove-selected').onclick=()=>act(async()=>{const set=currentSet();if(set){await saveSet({...set,songIds:set.songIds.filter(id=>!selected.has(id))});selected.clear();render();tell('Removed from this setlist. Songs and scores remain in All songs.');}});
$('export-set').onclick=()=>{const set=currentSet(),songs=filteredSongs(model.songs,model.sets,{collection,sort:'order'}),charts=songs.filter(s=>s.chart).map(s=>({...s.chart,title:s.title,genre:s.genre}));if(!charts.length){tell('This collection has no installed charts to export.');return;}download({version:1,name:set?.name||$('collection-title').textContent,genre:set?.genre||'',charts},'vibe-hero-setlist.json');};
$('cancel').onclick=()=>act(async()=>{const r=await chrome.runtime.sendMessage({target:'background',type:'cancel'});if(r?.error)throw Error(r.error);tell('Cancellation requested.');});
$('dismiss').onclick=()=>act(async()=>{const job=(await storage.get('vh.preparation'))['vh.preparation'];if(job?.status==='preparing')throw Error('Preparation is active. Cancel it before dismissing.');await storage.set({'vh.dismissedPreparation':preparationStamp(job)});await refresh();});
$('import-pack').onchange=async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;try{if(file.size>30*1024*1024)throw Error('Choose a pack smaller than 30 MB.');pendingPack=JSON.parse(await file.text());const charts=validatePack(pendingPack);editingSet=null;$('pack-heading').textContent='Import a song pack';$('pack-description').textContent=`${charts.length} charts. Existing charts for the same recordings will be replaced; your titles, setlists and scores are preserved.`;$('pack-name').value=pendingPack.name||file.name.replace(/\.json$/i,'').replace(/^Vibe Hero\s*[-–]?\s*/i,'');$('pack-genre').value=pendingPack.genre||(/yacht/i.test(file.name)?'Yacht rock':/indie/i.test(file.name)?'Indie rock':'');$('save-pack').textContent='Import pack';$('pack-error').textContent='';$('pack-dialog').showModal();}catch(error){tell(error.message);}};
$('rename-set').onclick=()=>{editingSet=currentSet();pendingPack=null;$('pack-heading').textContent='Edit setlist';$('pack-description').textContent='The genre applies to songs without their own genre override.';$('pack-name').value=editingSet.name;$('pack-genre').value=editingSet.genre||'';$('save-pack').textContent='Save setlist';$('pack-error').textContent='';$('pack-dialog').showModal();};
$('cancel-pack').onclick=()=>$('pack-dialog').close();
$('pack-form').onsubmit=async e=>{e.preventDefault();const name=$('pack-name').value.trim(),genre=$('pack-genre').value.trim();if(!name)return;busy=true;$('save-pack').disabled=true;$('cancel-pack').disabled=true;try{
  if(editingSet)await storage.set({[SET+editingSet.id]:{...editingSet,name,genre}});
  else{const charts=validatePack(pendingPack);await importPack(pendingPack,storage);const ids=charts.map(c=>c.youtubeId);const existing=model.sets.find(s=>s.kind==='pack'&&s.songIds.length===ids.length&&ids.every(id=>s.songIds.includes(id)));const id=existing?.id||crypto.randomUUID();await storage.set({[SET+id]:{id,name,genre,kind:'pack',songIds:ids}});collection=id;page=0;}
  $('pack-dialog').close();tell(editingSet?'Setlist updated.':'Song pack imported into your library.');
}catch(error){$('pack-error').textContent=error.message;}finally{busy=false;$('save-pack').disabled=false;$('cancel-pack').disabled=false;await refresh();}};
$('pack-dialog').addEventListener('cancel',e=>{if(busy)e.preventDefault();});
chrome.storage.onChanged.addListener(()=>refresh());refresh();setInterval(()=>{if(!busy)renderJob();},5000);

let deletingSet=null;
$('delete-set').onclick=()=>{deletingSet=currentSet()?.id;if(!deletingSet)return;$('delete-description').textContent=`Remove “${currentSet().name}”? By default, its songs and scores stay in All songs.`;$('delete-songs').checked=false;$('delete-error').textContent='';$('delete-dialog').showModal();};
$('cancel-delete').onclick=()=>$('delete-dialog').close();
$('delete-dialog').addEventListener('cancel',e=>{if(busy)e.preventDefault();});
$('delete-form').onsubmit=async e=>{
  e.preventDefault();if(busy)return;busy=true;$('confirm-delete').disabled=true;$('cancel-delete').disabled=true;
  try{
    const change=deleteCollection(await storage.get(null),deletingSet,$('delete-songs').checked);
    await storage.set(change.updates);
    if(change.remove.length)await storage.remove(change.remove);
    collection='all';page=0;selected.clear();detail=null;$('song-panel').hidden=true;
    $('delete-dialog').close();tell('Setlist deleted.');
  }catch(error){$('delete-error').textContent=error.message;}
  finally{busy=false;$('confirm-delete').disabled=false;$('cancel-delete').disabled=false;await refresh();}
};

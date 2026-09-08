import knownPacks from './known-packs.js';
export const META = 'vh.song.';
export const SET = 'vh.setlist.';
export function cleanTitle(title) {
  return String(title || '').replace(/^\(\d+\)\s*/, '').replace(/\s*[[(](?:official\s+)?(?:music\s+)?(?:video|audio|lyrics?|visuali[sz]er)(?:\s+(?:hd|4k))?[\])]/gi, '').replace(/\s*[-–]\s*official\s+(?:music\s+)?(?:video|audio)\s*$/i,'').trim();
}
export function libraryView(values) {
  const charts=Object.entries(values).filter(([k,v])=>k.startsWith('vh.chart.') && /^[\w-]{11}$/.test(v?.youtubeId||'') && Array.isArray(v.notes)).map(([,v])=>v);
  const scores=Object.entries(values).filter(([k,v])=>k.startsWith('vh.score.') && v?.videoId).map(([,v])=>v);
  // Metadata is separate from charts so re-preparation cannot erase organization.
  const custom=Object.entries(values).filter(([k,v])=>k.startsWith(SET) && v?.id && Array.isArray(v.songIds)).map(([,v])=>v);
  const sets=[...knownPacks.filter(p=>charts.some(c=>p.songIds.includes(c.youtubeId))).map(p=>({...p,...values[SET+p.id]})),...custom.filter(p=>!knownPacks.some(k=>k.id===p.id))];
  const songs=charts.map(chart=>{
    const id=chart.youtubeId,meta=values[META+id]||{},packs=sets.filter(p=>p.kind==='pack'&&p.songIds.includes(id));
    return {id,chart,title:meta.title || cleanTitle(chart.title) || id,genre:meta.genre ?? packs[0]?.genre ?? sets.find(s=>s.songIds.includes(id)&&s.genre)?.genre ?? '',packs,
      scores:scores.filter(s=>s.videoId===id).sort((a,b)=>String(b.date).localeCompare(String(a.date)))};
  });
  // Keep historical attempts reachable even if their chart is no longer present.
  for(const score of scores) if(!songs.some(s=>s.id===score.videoId)) {
    const id=score.videoId,meta=values[META+id]||{};
    songs.push({id,chart:null,title:meta.title||cleanTitle(score.title)||id,genre:meta.genre||'',packs:[],scores:scores.filter(s=>s.videoId===id).sort((a,b)=>String(b.date).localeCompare(String(a.date)))});
  }
  return {songs,sets};
}
export function filteredSongs(songs,sets,{collection='all',query='',genre='',sort='recent'}={}) {
  const set=sets.find(s=>s.id===collection),needle=query.toLowerCase().trim();
  const filtered=songs.filter(s=>(collection==='all'||collection==='manual'&&!s.packs.length||set?.songIds.includes(s.id))&&(!genre||s.genre===genre)&&(!needle||`${s.title} ${s.genre} ${s.id}`.toLowerCase().includes(needle)));
  return filtered.sort((a,b)=>sort==='title'?a.title.localeCompare(b.title):sort==='genre'?a.genre.localeCompare(b.genre)||a.title.localeCompare(b.title):sort==='order'&&set?set.songIds.indexOf(a.id)-set.songIds.indexOf(b.id):String(b.chart?.savedAt||'').localeCompare(String(a.chart?.savedAt||'')));
}
export function addSongs(set,ids){return {...set,songIds:[...new Set([...set.songIds,...ids])]};}
export function moveSong(set,id,before){const songIds=set.songIds.filter(x=>x!==id),index=songIds.indexOf(before);songIds.splice(index<0?songIds.length:index,0,id);return {...set,songIds};}
export const preparationStamp=job=>job?JSON.stringify([job.videoId,job.status,job.updatedAt,job.title,job.error]):'';

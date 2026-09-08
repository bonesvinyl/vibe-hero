/* global chrome */
let starting = false;
const player = async (tabId, videoId, action = 'state') => {
  const state = await chrome.tabs.sendMessage(tabId, { target: 'prep-player', videoId, action });
  if (state?.error) throw new Error(state.error);
  return state;
};
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id || message.target !== 'background') return;
  if(message.type==='next-song' && sender.tab && /^https:\/\/(www\.)?youtube\.com\//.test(sender.url||'')){
    (async()=>{
      if(!/^[\w-]{11}$/.test(message.videoId||''))throw Error('Invalid song.');
      const key='vh.chart.'+message.videoId;
      if(!(await chrome.storage.local.get(key))[key])throw Error('Prepare this song first.');
      const url=new URL(sender.url);url.pathname='/watch';url.search='?v='+message.videoId;url.hash='';
      await chrome.storage.session.set({['vh.next.'+sender.tab.id]:{videoId:message.videoId,settings:message.settings,setId:message.setId,at:Date.now()}});
      await chrome.tabs.update(sender.tab.id,{url:url.href});return {ok:true};
    })().then(reply).catch(error=>reply({error:error.message}));return true;
  }
  const internal = sender.url?.startsWith(chrome.runtime.getURL('')) || (!sender.tab && !sender.url);
  if (!internal) { reply({ error: 'Use the Vibe Hero extension to start preparation.' }); return; }
  (async () => {
    if (message.type === 'storage-set') { await chrome.storage.local.set(message.value); return { ok: true }; }
    if (message.type === 'player') return player(message.tabId, message.videoId, message.action);
    if (message.type === 'cancel') return chrome.runtime.sendMessage({ target: 'offscreen', type: 'cancel' });
    if (message.type !== 'prepare') throw new Error('Unknown request.');
    if (starting) throw new Error('Preparation is already starting.');
    starting = true;
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const url = new URL(tab?.url || '');
      const videoId = url.searchParams.get('v');
      if (!['www.youtube.com', 'youtube.com', 'm.youtube.com'].includes(url.hostname) || url.pathname !== '/watch' || !/^[\w-]{11}$/.test(videoId || '')) throw new Error('Open the song on YouTube, then click Prepare from that tab.');
      const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
      if (!contexts.length) await chrome.offscreen.createDocument({ url: 'offscreen.html', reasons: ['USER_MEDIA'], justification: 'Quiet, user-started audio analysis for a reusable song chart.' });
      const active = await chrome.runtime.sendMessage({ target: 'offscreen', type: 'status' });
      if (active?.busy) throw new Error('Another song is preparing. Wait or cancel it in your library.');
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['prep-bridge.js'] });
      const state = await player(tab.id, videoId);
      if (state.ad) throw new Error('Let the current ad finish, then click Prepare again.');
      if (!Number.isFinite(state.duration) || state.duration < 3 || state.duration > 1200) throw new Error('Wait for a song between 3 seconds and 20 minutes to load.');
      // Requires the user's invocation on this tab; never captures arbitrary queued tabs.
      const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });
      const result = await chrome.runtime.sendMessage({ target: 'offscreen', type: 'start', streamId, tabId: tab.id, videoId, title: state.title, duration: state.duration, difficulty: message.difficulty || 'medium' });
      if (result?.error) throw new Error(result.error);
      return { ok: true };
    } finally { starting = false; }
  })().then(result => reply(result)).catch(error => reply({ error: error.message }));
  return true;
});

chrome.tabs.onUpdated.addListener((tabId,change)=>{
  if(change.status!=='complete')return;
  (async()=>{
    const key='vh.next.'+tabId,pending=(await chrome.storage.session.get(key))[key];
    if(!pending)return;
    const tab=await chrome.tabs.get(tabId),url=new URL(tab.url||'');
    if(!['www.youtube.com','youtube.com'].includes(url.hostname)||url.protocol!=='https:'||Date.now()-pending.at>120000||url.searchParams.get('v')!==pending.videoId){await chrome.storage.session.remove(key);return;}
    await chrome.storage.session.remove(key);
    await chrome.scripting.executeScript({target:{tabId},func:value=>{window.__vibeHeroContinuation=value;},args:[pending]});
    await chrome.scripting.executeScript({target:{tabId},files:['overlay.js']});
  })().catch(()=>{});
});
chrome.tabs.onRemoved.addListener(tabId=>chrome.storage.session.remove('vh.next.'+tabId));

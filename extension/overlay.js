import { libraryView } from './library-model.js';
import { VideoBonusEcho } from '../src/game/echo.js';
import { scoreRecord, saveScore } from '../src/game/scores.js';
/* global chrome */
import { Game, practiceChart, validateChart, KEYS } from '../src/game/chart.js';
import { drawHighway } from '../src/game/draw.js';
import { nativeSettings, parseHandoff } from '../src/game/handoff.js';
import styles from './overlay.css?inline';
import { saveChart, loadChart } from './chart-store.js';
import { CrowdAudio } from '../src/game/crowd.js';
import { listenToSong } from './listen.js';
import { chartFromFrames } from '../src/game/chart-analysis.js';

const existing = document.getElementById('vibe-hero-native-overlay');
if (existing) existing.dispatchEvent(new Event('vibe-hero-close'));
else mount();

function mount() {
  const continuation=window.__vibeHeroContinuation;delete window.__vibeHeroContinuation;
  let continueWhenReady=false;
  const initialId = new URL(location.href).searchParams.get('v');
  const host = document.createElement('div'); host.id = 'vibe-hero-native-overlay';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>${styles.replaceAll('__FONT_URL__', chrome.runtime.getURL('fonts/Nightmare_Hero_Normal.ttf'))}</style><section class="stage"><canvas class="backdrop"></canvas><div class="shade"></div><header><strong>vibe<span>hero</span></strong><span class="native-label">ON YOUTUBE · NATIVE PLAYER</span><button data-action="minimize">YouTube controls</button><button data-action="fullscreen">Fullscreen</button><button data-action="close" aria-label="Close Vibe Hero">×</button></header><aside class="score"><span class="eyebrow">ON STAGE</span><h1></h1><strong class="points">0</strong><p class="stats">0 streak · 0% hit</p><p class="power">Star power: 0%</p><p class="hint">A S D F G · P / Enter pauses<br />Space activates star power</p></aside><aside class="meters"><div class="charge-tubes" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div><div class="multiplier">1×</div><span>COMBO MULTIPLIER</span><progress class="combo-meter" max="10" value="0"></progress><div class="streak-count">0 note streak</div><label class="rock-label">CROWD <progress class="rock-meter" max="100" value="70"></progress><span class="rock-status">Keep them with you</span></label><h3>STAR POWER</h3><progress class="energy-meter" max="100" value="0"></progress><button data-action="bonus" class="bonus" disabled>Build your streak</button><p class="bonus-help">Complete two glowing phrases to charge.<br>At 100%, press Space for<br>16 seconds of double points.</p></aside><canvas class="highway"></canvas><div class="feedback"></div><div class="streak-banner" aria-live="polite"></div><div class="setup"><h2>Play it where it plays.</h2><section class="next-songs" hidden></section><section class="result-save" hidden><label>Player name<input id="player-name" maxlength="24" autocomplete="nickname" /></label><button data-action="save-score">Save final score</button><p class="score-status" role="status"></p></section><p class="status" role="status">YouTube handles the video. Vibe Hero follows its playback clock.</p><div class="fields"><label>BPM<input id="bpm" type="number" min="40" max="240" /></label><label>First beat (sec)<input id="firstBeat" type="number" min="0" max="120" step="0.05" /></label><label>Timing (ms)<input id="offset" type="number" min="-500" max="500" step="5" /></label><label>Difficulty<select id="difficulty"><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option><option value="expert">Expert</option></select></label><label>Bar chords<select id="chords"><option value="true">On · chord accents</option><option value="false">Off · single notes</option></select></label><label>Three-note chords · Hard / Expert<select id="triples"><option value="true">On</option><option value="false">Off · two notes max</option></select></label><label>Play style<select id="mode"><option value="tap">Keyboard / tap</option><option value="strum">Frets + arrow strum</option></select></label></div><p class="echo-status"></p><div class="buttons"><button data-action="listen" class="primary">Listen &amp; build chart</button><button data-action="cancel-listen" hidden>Cancel listening</button><button data-action="export" disabled>Save chart</button><button data-action="download" disabled>Download JSON backup</button><p class="save-status" role="status" aria-live="polite">No saved chart loaded.</p></div><p class="listen-help">For quiet preparation, use the extension icon → Prepare quietly in background. This manual fallback shares the tab’s audio for one playthrough. Full-mix analysis, not guitar isolation.</p><div class="buttons"><button data-action="tap">Tap tempo</button><label class="file-label">Import chart<input type="file" accept=".json" id="chart" /></label><button class="primary" data-action="start">Play from beginning ▷</button></div><p class="chart-status">BPM practice grid · Bring detected BPM from the app or import an authored chart.</p></div><button class="resume" data-action="minimize">Return to fretboard ↗</button><footer><button data-action="pause">Pause / resume</button><span class="time">0:00</span><span>Music video stays behind the frets.</span><label>Crowd<input id="crowd-volume" aria-label="Crowd volume; zero mutes" type="range" min="0" max="40" value="18" /></label><label>Brightness<input id="brightness" type="range" min="25" max="100" value="75" /></label></footer></section>`;
  document.documentElement.append(host);
  if (typeof FontFace !== 'undefined' && document.fonts) {
    for (const [family, file, weight] of [['NightmareHero', 'Nightmare_Hero_Normal.ttf', '400'], ['BarlowCondensed', 'BarlowCondensed-Medium.ttf', '400 500'], ['BarlowCondensed', 'BarlowCondensed-SemiBold.ttf', '600 900']]) {
      if ([...document.fonts].some(face => face.family === family && face.weight === weight)) continue;
      const face = new FontFace(family, `url("${chrome.runtime.getURL(`fonts/${file}`)}")`, { weight });
      document.fonts.add(face); face.load().catch(() => {});
    }
  }
  const $ = selector => root.querySelector(selector);
  const stage = $('.stage'), canvas = $('.highway'), backdrop = $('.backdrop'), context = backdrop.getContext('2d');
  const status = $('.status'), setup = $('.setup');
  let settings = parseHandoff(location.hash), game = null, video = null, started = false, frame, minimized = false, closed = false, chart = null, taps = [], lastHud = 0, lastAd = false, backdropFailed = false, listening = null, audioFrames = null, chartDuration = null;
  let finalRun = null, savingScore = false, remoteEcho = false, echoMessageAt = 0, countdownEnd = 0, recordingDuration = 0, recordingTitle = "";
  const echo = new VideoBonusEcho();
  const held = new Set();
  const crowd = new CrowdAudio(file => chrome.runtime.getURL(`sounds/${file}`));
  for (const key of ['bpm', 'firstBeat', 'offset', 'difficulty', 'mode', 'chords', 'triples']) $(`#${key}`).value = settings[key];
  const onEnded = event => { if (event.target === video && started && !adPlaying()) complete(); };
  document.addEventListener('ended', onEnded, true);
  function getVideo() { return document.querySelector('#movie_player video') || document.querySelector('video.html5-main-video'); }
  function adPlaying() { return !!document.querySelector('#movie_player.ad-showing, #movie_player.ad-interrupting'); }
  function show(message) { status.textContent = message; setup.hidden = false; }
  function pause() { if (countdownEnd) { countdownEnd = 0; if (!started) show('Countdown cancelled. Play from beginning when ready.'); } chrome.runtime.sendMessage?.({ target: 'offscreen', type: 'effect-state', active: false })?.catch(() => {}); echo.set(false); video?.pause(); held.clear(); crowd.stop(); }
  function toggle() {
    if (countdownEnd) { pause(); return; }
    if (!started || !video || minimized || adPlaying() || listening) return;
    if (video.paused) { crowd.unlock(); setup.hidden = true; countdownEnd = performance.now() + 3000; } else pause();
  }
  function cleanup() {
    if (closed) return;
    closed = true; chrome.runtime.sendMessage?.({ target: 'offscreen', type: 'effect-close' })?.catch(() => {}); document.removeEventListener('ended', onEnded, true); echo.destroy(); crowd.destroy(); listening?.abort(); cancelAnimationFrame(frame); window.removeEventListener('keydown', keydown, true); window.removeEventListener('keyup', keyup, true); window.removeEventListener('blur', onBlur); document.removeEventListener('visibilitychange', visibility); host.remove();
  }
  async function start() {
    if (new URL(location.href).searchParams.get('v') !== initialId) { show('Your saved result is for the previous song. Close Vibe Hero and open it on this song to start a new set.'); return; }
    if (listening || countdownEnd) return;
    crowd.unlock(); crowd.reset(); finalRun = null; $('.result-save').hidden = true; if($('.next-songs'))$('.next-songs').hidden=true;
    video = getVideo();
    if (!video || adPlaying()) { show('Let YouTube finish loading or playing its ad, then start your set.'); return; }
    if (!Number.isFinite(video.duration) || video.duration < 3 || video.duration > 1200) { show('Wait for a playable song between 3 seconds and 20 minutes. Live streams are not supported.'); return; }
    try {
      const input = { bpm: Number($('#bpm').value), firstBeat: Number($('#firstBeat').value), offset: Number($('#offset').value), difficulty: $('#difficulty').value, mode: $('#mode').value, chords: $('#chords').value !== 'false', triples: $('#triples').value !== 'false' };
      const validated = nativeSettings(input);
      if (Object.keys(input).some(key => input[key] !== validated[key])) throw new Error('Check the BPM, first beat, and timing ranges.');
      settings = validated; recordingDuration = video.duration; recordingTitle = document.title.replace(/ - YouTube$/, "");
      $('.hint').textContent = `${settings.difficulty === 'easy' ? 'A S D F · Orange disabled' : 'A S D F G'} · P / Enter pauses · Space activates star power`;
      if (audioFrames) chart = { version: 1, ...chartFromFrames(audioFrames, settings.difficulty), youtubeId: initialId };
      game = new Game(chart ? validateChart(chart, video.duration) : practiceChart(video.duration, settings.bpm, settings.firstBeat, settings.difficulty), settings.chords, settings.difficulty, settings.triples);
      video.currentTime = 0; game.reset(-settings.offset / 1000); game.eligible = true; started = false; setup.hidden = true;
      video.pause(); countdownEnd = performance.now() + 4000; crowd.cue('intro.mp3', 2);
      const remote = await chrome.runtime.sendMessage?.({ target: 'offscreen', type: 'effect-state', active: false })?.catch(() => null);
      remoteEcho = remote?.ok === true;
      const echoReady = remoteEcho || await echo.attach(video);
      if (closed) { echo.destroy(); return; }
      $('.echo-status').textContent = echoReady ? "Music echo enabled during star power." : "Music echo unavailable for this player; star power still has full crowd sound and visual effects.";
    } catch (error) { started = false; pause(); show(error.message); }
  }
  const keydown = event => {
    const target = event.composedPath()[0];
    if (minimized || adPlaying() || listening) return;
    const editing = target?.matches?.('input:not([type=range]),select,textarea') || target?.isContentEditable;
    if (editing) return;
    if (![...KEYS, 'Enter', 'KeyP', 'Space', 'ArrowUp', 'ArrowDown', 'Escape'].includes(event.code)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (event.repeat) return;
    if (event.code === 'KeyG' && settings.difficulty === 'easy') return;
    if (event.code === 'Escape') { cleanup(); return; }
    if (event.code === 'Enter' || event.code === 'KeyP') { toggle(); return; }
    held.add(event.code);
    if (!started || !video || video.paused || video.seeking || video.readyState < 3) return;
    const time = video.currentTime - settings.offset / 1000;
    if (event.code === 'Space') game.activate(time);
    else if (settings.mode === 'strum' && ['ArrowUp', 'ArrowDown'].includes(event.code)) game.hit(KEYS.flatMap((key, lane) => held.has(key) ? [lane] : []), time, true);
    else if (settings.mode === 'tap' && KEYS.includes(event.code)) game.hit([KEYS.indexOf(event.code)], time);
  };
  const keyup = event => { if (event.code === 'Space' && !minimized && !adPlaying() && !listening && !event.composedPath?.()[0]?.matches?.('input:not([type=range]),select,textarea')) { event.preventDefault?.(); event.stopImmediatePropagation?.(); } held.delete(event.code); if (started && video && !video.paused && !adPlaying()) game.updateHolds(video.currentTime - settings.offset / 1000, KEYS.map(key => held.has(key))); };
  const onBlur = () => { if (!minimized && !adPlaying() && !listening) pause(); };
  const visibility = () => { if (document.hidden) onBlur(); };
  root.addEventListener('click', event => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'close') cleanup();
    if (action === 'listen') prepareChart();
    if (action === 'cancel-listen') listening?.abort();
    if (action === 'bonus' && started && video && !video.paused && !adPlaying()) game.activate(video.currentTime - settings.offset / 1000);
    if (action === 'export') persistChart();
    if (action === 'download' && chart) {
      const blob = new Blob([JSON.stringify({ ...chart, youtubeId: initialId, title: $('h1').textContent, bpm: Number($('#bpm').value) })], { type: 'application/json' });
      const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = `vibe-hero-${initialId}.json`; root.append(link); link.click(); link.remove(); $('.save-status').textContent = 'JSON download requested. Check your browser Downloads. Your library save is separate.'; setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    if (action === 'start') start();
    if (action === 'save-score' && finalRun && !savingScore) {
      const run = finalRun; savingScore = true; $('.score-status').textContent = 'Saving…';
      (async () => {
        run.record ??= await scoreRecord(run.game, run.settings, initialId, run.title, $('#player-name').value);
        await saveScore(run.record, chrome.storage.local);
        if (finalRun === run) $('.score-status').textContent = 'Saved to My song library on this browser.';
      })().catch(error => { if (finalRun === run) $('.score-status').textContent = `Could not save: ${error.message}`; }).finally(() => { savingScore = false; });
    }
    if (action === 'pause') toggle();
    if (action === 'minimize' && !listening) {
      minimized = !minimized; pause(); stage.classList.toggle('minimized', minimized);
      if (!minimized && game && video) game.update(video.currentTime - settings.offset / 1000);
    }
    if (action === 'fullscreen') { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(error => show(error.message)); else document.exitFullscreen?.(); }
    if (action === 'tap') {
      const now = performance.now(); taps = [...taps.filter(time => now - time < 4000), now].slice(-8);
      if (taps.length >= 3) $('#bpm').value = Math.max(40, Math.min(240, Math.round(60000 * (taps.length - 1) / (now - taps[0]))));
    }
  });
  $('#crowd-volume').addEventListener('input', event => crowd.setVolume(Number(event.target.value) / 100));
  $('#brightness').addEventListener('input', event => stage.style.setProperty('--brightness', event.target.value / 100));
  $('#chart').addEventListener('change', async event => {
    const file = event.target.files[0]; if (!file || listening) return;
    try { if (file.size > 2 * 1024 * 1024) throw new Error('Chart must be under 2 MB.'); const value = JSON.parse(await file.text()); if (closed) return; if (value.youtubeId && value.youtubeId !== initialId) throw new Error('This chart belongs to a different YouTube recording.'); validateChart(value, getVideo()?.duration || 1200); audioFrames = null; chart = value; chartDuration = getVideo()?.duration || 1200; $('[data-action=export]').disabled = false; $('[data-action=download]').disabled = false; $('.chart-status').textContent = `Custom chart · ${value.notes.length} notes`; $('.save-status').textContent = 'Imported chart is ready to play. Click Save chart to keep it in your library.'; }
    catch (error) { show(error.message); }
    finally { event.target.value = ''; }
  });
  function currentSettings() {
    return { bpm: Number($('#bpm').value), firstBeat: Number($('#firstBeat').value), offset: Number($('#offset').value), difficulty: $('#difficulty').value, mode: $('#mode').value, chords: $('#chords').value !== 'false', triples: $('#triples').value !== 'false' };
  }
  async function persistChart(title = $('h1').textContent) {
    if (!chart) { if (!closed) $('.save-status').textContent = 'No chart to save yet. Wait for “Chart ready” or import a chart.'; return; }
    if (!closed) $('.save-status').textContent = 'Saving to your Vibe Hero library…';
    try {
      await saveChart(chrome.storage.local, initialId, chart, chartDuration || video?.duration, currentSettings(), title);
      if (!closed) $('.save-status').textContent = `Saved on this browser · ${chart.notes.length} notes. Reopening this video restores your chart.`;
    } catch (error) {
      if (!closed) $('.save-status').textContent = `Could not save: ${error.message}. Your chart is still here; retry Save chart or download a JSON backup.`;
    }
  }
  loadChart(chrome.storage.local, initialId).then(record => {
    if (!record || closed || started || listening || chart) return;
    chart = record; chartDuration = record.duration;
    for (const key of ['bpm', 'firstBeat', 'offset', 'difficulty', 'mode', 'chords', 'triples']) $(`#${key}`).value = nativeSettings(record.settings)[key];
    $('[data-action=export]').disabled = false; $('[data-action=download]').disabled = false;
    $('.chart-status').textContent = `Saved audio/custom chart · ${record.notes.length} notes`;
    if(continuation?.videoId===initialId){const prefs=nativeSettings(continuation.settings);for(const key of ['difficulty','mode','chords','triples','offset'])$(`#${key}`).value=prefs[key];continueWhenReady=true;}
    $('.save-status').textContent = 'Loaded from your Vibe Hero library. Ready to play—no listening needed.';
  }).catch(error => { if (!closed) $('.save-status').textContent = `Could not load saved chart: ${error.message}`; });
  async function prepareChart() {
    if (listening) return;
    video = getVideo();
    if (!video) { show('Wait for YouTube to load the song.'); return; }
    started = false; pause();
    const recordingDuration = video.duration, recordingTitle = $('h1').textContent;
    const abort = new AbortController(); listening = abort;
    $('[data-action=listen]').disabled = true; $('[data-action=start]').disabled = true;
    $('[data-action=cancel-listen]').hidden = false;
    show('Choose THIS YouTube tab and enable Share tab audio.');
    try {
      const frames = await listenToSong(video, { signal: abort.signal, isAd: adPlaying, onProgress: fraction => show(`Listening… ${Math.round(fraction * 100)}%. Leave playback at normal speed; no seeking. Pauses and ads are excluded.`) });
      const result = chartFromFrames(frames, $('#difficulty').value);
      if (!result.notes.length) throw new Error('No clear musical attacks detected. Check that you shared this tab’s audio.');
      audioFrames = frames; chart = { version: 1, ...result, youtubeId: initialId }; chartDuration = recordingDuration;
      if (result.bpm) $('#bpm').value = Math.round(result.bpm);
      $('.chart-status').textContent = `Audio chart · ${result.notes.length} attacks · ${result.bpm ? Math.round(result.bpm) + ' BPM estimated' : 'tempo uncertain'} · full mix`;
      await persistChart(recordingTitle);
      if (!closed) { $('[data-action=export]').disabled = false; $('[data-action=download]').disabled = false; show('Chart ready. Play from beginning. Timing adjustment can compensate for capture delay.'); }
    } catch (error) { if (!closed) show(error.name === 'AbortError' ? 'Listening cancelled. Your previous chart is unchanged.' : error.message); }
    finally { listening = null; if (!closed) { $('[data-action=listen]').disabled = false; $('[data-action=start]').disabled = false; $('[data-action=cancel-listen]').hidden = true; } }
  }
  chrome.storage.local.get('vh.player').then(value => { if (!closed) $('#player-name').value = value['vh.player'] || ''; }).catch(() => {});
  function complete(outcome = 'completed') {
    if (!started || !game) return;
    if (outcome === 'completed' && !adPlaying() && (Math.abs(video.currentTime - settings.offset / 1000 - game.lastTime) > 1 || (video.playbackRate && video.playbackRate !== 1))) game.eligible = false;
    started = false; pause();
    finalRun = { game, settings: { ...settings }, title: recordingTitle };
    $('.result-save').hidden = false;
    $('.score-status').textContent = game.failed ? 'Save this attempt to your local history.' : game.eligible ? 'Enter your name and save this score.' : 'Practice run — you can still save it to local history.';
    show(`${outcome === 'failed' ? 'SET FAILED' : 'Set complete'}. ${game.score.toLocaleString()} points · ${game.accuracy}% hit · best streak ${game.best}.`);
    suggestNext();
    setup.scrollTop = 0;
    if (outcome === 'failed') { crowd.play('boo', 5, 2.5); crowd.missClang(); }
  }
  async function suggestNext(){
    const panel=$('.next-songs');if(!panel)return;
    try{
      const {songs,sets}=libraryView(await chrome.storage.local.get(null));
      if(closed||!finalRun)return;
      const available=songs.filter(s=>s.chart&&s.id!==initialId);
      const matching=sets.filter(s=>s.songIds.includes(initialId));
      const set=matching.find(s=>s.id===continuation?.setId)||matching[0];
      const index=set?.songIds.indexOf(initialId)??-1;
      const ids=set?[...set.songIds.slice(index+1),...set.songIds.slice(0,index)]:available.map(s=>s.id);
      const next=ids.map(id=>available.find(s=>s.id===id)).filter(Boolean).slice(0,5);
      panel.replaceChildren();panel.hidden=!next.length;
      const title=document.createElement('h3');title.textContent=set?`Keep playing · ${set.name}`:'Play another song';panel.append(title);
      const hint=document.createElement('p');hint.textContent='Save your score below before moving on. Your next song opens here with a countdown.';panel.append(hint);
      for(const song of next){const b=document.createElement('button');b.textContent=`Play next: ${song.title}`;
        b.onclick=async()=>{if(savingScore)return;b.disabled=true;try{const result=await chrome.runtime.sendMessage({target:'background',type:'next-song',videoId:song.id,setId:set?.id,settings});if(result?.error)throw Error(result.error);}catch(error){hint.textContent=error.message;b.disabled=false;}};panel.append(b);}
    }catch{panel.hidden=true;}
  }
  function tick(now) {
    if (closed) return;
    if (!host.isConnected || (!finalRun && new URL(location.href).searchParams.get('v') !== initialId)) { cleanup(); return; }
    const current = getVideo(), ad = adPlaying();
    if(continueWhenReady&&current&&!ad&&Number.isFinite(current.duration)&&current.duration>=3){continueWhenReady=false;start();}
    if (ad && started && !game?.failed && recordingDuration && game.lastTime >= recordingDuration - settings.offset / 1000 - 0.25) complete();
    if (countdownEnd) {
      if (ad || minimized || document.hidden) pause();
      else if (now >= countdownEnd) {
        countdownEnd = 0; crowd.stop(); started = true;
        video.play().catch(error => { started = false; show(error.message); });
      }
    }
    if (now - echoMessageAt > 300) {
      echoMessageAt = now;
      const active = !!(started && game && video && !video.paused && !video.seeking && video.readyState >= 3 && !ad && !minimized && video.currentTime - settings.offset / 1000 < game.powerUntil);
      chrome.runtime.sendMessage?.({ target: 'offscreen', type: 'effect-state', active })?.then(result => { remoteEcho = result?.ok === true; }).catch(() => { remoteEcho = false; });
    }
    if (ad || listening || minimized || !started || !video || video.paused || video.seeking || video.readyState < 3) { echo.set(false); if (!countdownEnd && (ad || listening || minimized || !game?.failed)) crowd.stop(); }
    stage.classList.toggle('advertisement', ad && !finalRun);
    if (ad) { $('.resume').textContent = 'Waiting for YouTube’s ad to finish…'; lastAd = true; }
    else {
      $('.resume').textContent = 'Return to fretboard ↗';
      if (lastAd) { held.clear(); lastAd = false; if (started && video) game.lastTime = video.currentTime - settings.offset / 1000; }
      if (current !== video && !finalRun) { listening?.abort(); const wasStarted = started; started = false; video = current; pause(); if (wasStarted) show('YouTube changed the video source. Start a fresh set.'); }
      const title = document.querySelector('h1.ytd-watch-metadata')?.textContent || document.title.replace(/ - YouTube$/, '');
      if (now - lastHud > 100) $('h1').textContent = finalRun ? finalRun.title : title;
      if (!minimized && video?.readyState >= 2 && !backdropFailed) {
        const width = Math.floor(innerWidth), height = Math.floor(innerHeight);
        if (backdrop.width !== width || backdrop.height !== height) { backdrop.width = width; backdrop.height = height; }
        try { const scale = Math.max(width / video.videoWidth, height / video.videoHeight), w = video.videoWidth * scale, h = video.videoHeight * scale; context.drawImage(video, (width - w) / 2, (height - h) / 2, w, h); }
        catch { backdropFailed = true; $('.hint').textContent = 'Video rendering unavailable. YouTube controls returns to the original player.'; }
      }
      if (game && video && !minimized) {
        const time = video.currentTime - settings.offset / 1000;
        if (started && video.playbackRate && video.playbackRate !== 1) game.eligible = false;
        if (started && !video.paused && !video.seeking && video.readyState >= 3) { game.update(time); game.updateHolds(time, KEYS.map(key => held.has(key))); crowd.update(game, time); echo.set(time < game.powerUntil);
          if (game.failed) complete('failed');
        }
        drawHighway(canvas, game, time, KEYS.map(key => held.has(key)), false, ['A', 'S', 'D', 'F', 'G'], 0.72);
        if (now - lastHud > 100) {
          const powered = started && time < game.powerUntil;
          $('.rock-meter').value = game.rock;
          $('.rock-status').textContent = game.failed ? 'SET FAILED' : game.rock < 30 ? 'DANGER · Hit notes to recover' : 'Keep them with you';
          stage.classList.toggle('danger', game.rock < 30);
          $('.multiplier').textContent = `${game.multiplier * (powered ? 2 : 1)}×`;
          $('.combo-meter').value = game.multiplier >= 4 ? 10 : game.combo % 10;
          $('.streak-count').textContent = `${game.combo} note streak`;
          $('.energy-meter').value = powered ? Math.max(0, (game.powerUntil - time) / 16 * 100) : game.energy;
          $('.bonus').disabled = game.energy < 100 || powered || time < game.nextPowerAt;
          $('.bonus').textContent = powered ? `BONUS · ${Math.ceil(game.powerUntil - time)}s` : time < game.nextPowerAt ? `Recharge · ${Math.ceil(game.nextPowerAt - time)}s` : game.energy >= 100 ? 'SPACE · Activate bonus' : `${Math.floor(game.energy)}% charged`;
          stage.classList.toggle('powered', powered);
          $('.points').textContent = game.score.toLocaleString(); $('.stats').textContent = `${game.combo} streak · ${game.accuracy}% hit`; $('.power').textContent = `Star power: ${Math.floor(game.energy)}% · ${game.multiplier}×`;
          $('.feedback').textContent = countdownEnd ? `${Math.max(1, Math.ceil((countdownEnd - now) / 1000))} · GET READY` : video.paused && started ? 'Paused · P / Enter to resume' : video.readyState < 3 ? 'Buffering…' : '';
          $('.streak-banner').textContent = time < game.milestoneUntil ? `${game.milestone} NOTE STREAK!` : '';
          $('.streak-banner').style.opacity = Math.min(1, Math.max(0, (game.milestoneUntil - time) / 0.6));
          stage.style.setProperty('--charge', `${powered ? Math.max(0, (game.powerUntil - time) / 16 * 100) : game.energy}%`);
          stage.style.setProperty('--combo', `${game.multiplier >= 4 ? 100 : (game.combo % 10) * 10}%`);
          $('.time').textContent = `${Math.floor(video.currentTime / 60)}:${String(Math.floor(video.currentTime % 60)).padStart(2, '0')}`;
        }
        if (started && (video.ended || video.currentTime >= video.duration - 0.1)) complete();
      }
      if (now - lastHud > 100) lastHud = now;
    }
    frame = requestAnimationFrame(tick);
  }
  host.addEventListener('vibe-hero-close', cleanup, { once: true });
  window.addEventListener('keydown', keydown, true); window.addEventListener('keyup', keyup, true); window.addEventListener('blur', onBlur); document.addEventListener('visibilitychange', visibility);
  frame = requestAnimationFrame(tick);
}

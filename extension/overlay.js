import { Game, practiceChart, validateChart, KEYS } from '../src/game/chart.js';
import { drawHighway } from '../src/game/draw.js';
import { nativeSettings, parseHandoff } from '../src/game/handoff.js';
import styles from './overlay.css?inline';

const existing = document.getElementById('vibe-hero-native-overlay');
if (existing) existing.dispatchEvent(new Event('vibe-hero-close'));
else mount();

function mount() {
  const initialId = new URL(location.href).searchParams.get('v');
  const host = document.createElement('div'); host.id = 'vibe-hero-native-overlay';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>${styles}</style><section class="stage"><canvas class="backdrop"></canvas><div class="shade"></div><header><strong>vibe<span>hero</span></strong><span class="native-label">ON YOUTUBE · NATIVE PLAYER</span><button data-action="minimize">YouTube controls</button><button data-action="fullscreen">Fullscreen</button><button data-action="close" aria-label="Close Vibe Hero">×</button></header><aside class="score"><span class="eyebrow">ON STAGE</span><h1></h1><strong class="points">0</strong><p class="stats">0 streak · 0% hit</p><p class="power">Star power: 0%</p><p class="hint">A S D F G · Enter pauses<br />Space activates star power</p></aside><canvas class="highway"></canvas><div class="feedback"></div><div class="setup"><h2>Play it where it plays.</h2><p class="status" role="status">YouTube handles the video. Vibe Hero follows its playback clock.</p><div class="fields"><label>BPM<input id="bpm" type="number" min="40" max="240" /></label><label>First beat (sec)<input id="firstBeat" type="number" min="0" max="120" step="0.05" /></label><label>Timing (ms)<input id="offset" type="number" min="-500" max="500" step="5" /></label><label>Difficulty<select id="difficulty"><option value="easy">Easy</option><option value="medium">Medium</option><option value="expert">Expert</option></select></label><label>Play style<select id="mode"><option value="tap">Keyboard / tap</option><option value="strum">Frets + arrow strum</option></select></label></div><div class="buttons"><button data-action="tap">Tap tempo</button><label class="file-label">Import chart<input type="file" accept=".json" id="chart" /></label><button class="primary" data-action="start">Play from beginning ▷</button></div><p class="chart-status">BPM practice grid · Bring detected BPM from the app or import an authored chart.</p></div><button class="resume" data-action="minimize">Return to fretboard ↗</button><footer><button data-action="pause">Pause / resume</button><span class="time">0:00</span><span>Music video stays behind the frets.</span><label>Brightness<input id="brightness" type="range" min="25" max="100" value="75" /></label></footer></section>`;
  document.documentElement.append(host);
  const $ = selector => root.querySelector(selector);
  const stage = $('.stage'), canvas = $('.highway'), backdrop = $('.backdrop'), context = backdrop.getContext('2d');
  const status = $('.status'), setup = $('.setup');
  let settings = parseHandoff(location.hash), game = null, video = null, started = false, frame, minimized = false, closed = false, chart = null, taps = [], lastHud = 0, lastAd = false, backdropFailed = false;
  const held = new Set();
  for (const key of ['bpm', 'firstBeat', 'offset', 'difficulty', 'mode']) $(`#${key}`).value = settings[key];
  function getVideo() { return document.querySelector('#movie_player video') || document.querySelector('video.html5-main-video'); }
  function adPlaying() { return !!document.querySelector('#movie_player.ad-showing, #movie_player.ad-interrupting'); }
  function show(message) { status.textContent = message; setup.hidden = false; }
  function pause() { video?.pause(); held.clear(); }
  function toggle() {
    if (!started || !video || minimized || adPlaying()) return;
    if (video.paused) video.play().catch(error => show(error.message)); else pause();
  }
  function cleanup() {
    if (closed) return;
    closed = true; cancelAnimationFrame(frame); window.removeEventListener('keydown', keydown, true); window.removeEventListener('keyup', keyup, true); window.removeEventListener('blur', onBlur); document.removeEventListener('visibilitychange', visibility); document.removeEventListener('yt-navigate-start', cleanup); host.remove();
  }
  async function start() {
    video = getVideo();
    if (!video || adPlaying()) { show('Let YouTube finish loading or playing its ad, then start your set.'); return; }
    if (!Number.isFinite(video.duration) || video.duration < 3 || video.duration > 1200) { show('Wait for a playable song between 3 seconds and 20 minutes. Live streams are not supported.'); return; }
    try {
      const input = { bpm: Number($('#bpm').value), firstBeat: Number($('#firstBeat').value), offset: Number($('#offset').value), difficulty: $('#difficulty').value, mode: $('#mode').value };
      const validated = nativeSettings(input);
      if (Object.keys(input).some(key => input[key] !== validated[key])) throw new Error('Check the BPM, first beat, and timing ranges.');
      settings = validated;
      game = new Game(chart ? validateChart(chart, video.duration) : practiceChart(video.duration, settings.bpm, settings.firstBeat, settings.difficulty));
      video.currentTime = 0; game.reset(-settings.offset / 1000); started = true; setup.hidden = true;
      await video.play();
    } catch (error) { started = false; pause(); show(error.message); }
  }
  const keydown = event => {
    const target = event.composedPath()[0];
    if (target?.matches?.('input,select,textarea') || target?.isContentEditable || minimized || adPlaying()) return;
    if (![...KEYS, 'Enter', 'Space', 'ArrowUp', 'ArrowDown', 'Escape'].includes(event.code)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (event.repeat) return;
    if (event.code === 'Escape') { cleanup(); return; }
    if (event.code === 'Enter') { toggle(); return; }
    held.add(event.code);
    if (!started || !video || video.paused || video.seeking || video.readyState < 3) return;
    const time = video.currentTime - settings.offset / 1000;
    if (event.code === 'Space') game.activate(time);
    else if (settings.mode === 'strum' && ['ArrowUp', 'ArrowDown'].includes(event.code)) game.hit(KEYS.flatMap((key, lane) => held.has(key) ? [lane] : []), time, true);
    else if (settings.mode === 'tap' && KEYS.includes(event.code)) game.hit([KEYS.indexOf(event.code)], time);
  };
  const keyup = event => { held.delete(event.code); };
  const onBlur = () => { if (!minimized && !adPlaying()) pause(); };
  const visibility = () => { if (document.hidden) onBlur(); };
  root.addEventListener('click', event => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'close') cleanup();
    if (action === 'start') start();
    if (action === 'pause') toggle();
    if (action === 'minimize') {
      minimized = !minimized; pause(); stage.classList.toggle('minimized', minimized);
      if (!minimized && game && video) game.update(video.currentTime - settings.offset / 1000);
    }
    if (action === 'fullscreen') { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(error => show(error.message)); else document.exitFullscreen?.(); }
    if (action === 'tap') {
      const now = performance.now(); taps = [...taps.filter(time => now - time < 4000), now].slice(-8);
      if (taps.length >= 3) $('#bpm').value = Math.max(40, Math.min(240, Math.round(60000 * (taps.length - 1) / (now - taps[0]))));
    }
  });
  $('#brightness').addEventListener('input', event => stage.style.setProperty('--brightness', event.target.value / 100));
  $('#chart').addEventListener('change', async event => {
    const file = event.target.files[0]; if (!file) return;
    try { if (file.size > 2 * 1024 * 1024) throw new Error('Chart must be under 2 MB.'); const value = JSON.parse(await file.text()); if (closed) return; validateChart(value, getVideo()?.duration || 1200); chart = value; $('.chart-status').textContent = `Custom chart · ${value.notes.length} notes`; }
    catch (error) { show(error.message); }
    finally { event.target.value = ''; }
  });
  function tick(now) {
    if (closed) return;
    if (!host.isConnected || new URL(location.href).searchParams.get('v') !== initialId) { cleanup(); return; }
    const current = getVideo(), ad = adPlaying();
    stage.classList.toggle('advertisement', ad);
    if (ad) { $('.resume').textContent = 'Waiting for YouTube’s ad to finish…'; lastAd = true; }
    else {
      $('.resume').textContent = 'Return to fretboard ↗';
      if (lastAd) { held.clear(); lastAd = false; if (started && video) game.lastTime = video.currentTime - settings.offset / 1000; }
      if (current !== video) { const wasStarted = started; started = false; video = current; pause(); if (wasStarted) show('YouTube changed the video source. Start a fresh set.'); }
      const title = document.querySelector('h1.ytd-watch-metadata')?.textContent || document.title.replace(/ - YouTube$/, '');
      if (now - lastHud > 100) $('h1').textContent = title;
      if (!minimized && video?.readyState >= 2 && !backdropFailed) {
        const width = Math.floor(innerWidth), height = Math.floor(innerHeight);
        if (backdrop.width !== width || backdrop.height !== height) { backdrop.width = width; backdrop.height = height; }
        try { const scale = Math.max(width / video.videoWidth, height / video.videoHeight), w = video.videoWidth * scale, h = video.videoHeight * scale; context.drawImage(video, (width - w) / 2, (height - h) / 2, w, h); }
        catch { backdropFailed = true; $('.hint').textContent = 'Video rendering unavailable. YouTube controls returns to the original player.'; }
      }
      if (game && video && !minimized) {
        const time = video.currentTime - settings.offset / 1000;
        if (started && !video.paused && !video.seeking && video.readyState >= 3) game.update(time);
        drawHighway(canvas, game, time, KEYS.map(key => held.has(key)), false, ['A', 'S', 'D', 'F', 'G'], 0.72);
        if (now - lastHud > 100) {
          $('.points').textContent = game.score.toLocaleString(); $('.stats').textContent = `${game.combo} streak · ${game.accuracy}% hit`; $('.power').textContent = `Star power: ${game.energy}% · ${game.multiplier}×`;
          $('.feedback').textContent = video.paused && started ? 'Paused · Enter to resume' : video.readyState < 3 ? 'Buffering…' : time < game.feedbackUntil ? game.feedback : '';
          $('.time').textContent = `${Math.floor(video.currentTime / 60)}:${String(Math.floor(video.currentTime % 60)).padStart(2, '0')}`;
        }
        if (started && video.ended) { game.lastTime = video.duration + 0.15; game.update(game.lastTime); started = false; show(`Set complete. ${game.score.toLocaleString()} points · ${game.accuracy}% hit · best streak ${game.best}.`); }
      }
      if (now - lastHud > 100) lastHud = now;
    }
    frame = requestAnimationFrame(tick);
  }
  host.addEventListener('vibe-hero-close', cleanup, { once: true });
  window.addEventListener('keydown', keydown, true); window.addEventListener('keyup', keyup, true); window.addEventListener('blur', onBlur); document.addEventListener('visibilitychange', visibility); document.addEventListener('yt-navigate-start', cleanup);
  frame = requestAnimationFrame(tick);
}

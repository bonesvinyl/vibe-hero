import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, rename, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { analyze } from '../src/game/analysis.js';
import { youtubeId, validateChart } from '../src/game/chart.js';

export function parseQueue(text) {
  const ids = [], invalid = [];
  for (const line of text.split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#'))) {
    const id = youtubeId(line);
    if (!id) invalid.push(line); else if (!ids.includes(id)) ids.push(id);
  }
  if (invalid.length) throw new Error(`Invalid YouTube URLs: ${invalid.join(', ')}`);
  if (!ids.length || ids.length > 200) throw new Error('Provide between 1 and 200 YouTube song URLs, one per line.');
  return ids;
}
async function atomicJSON(file, value) {
  await writeFile(`${file}.tmp`, JSON.stringify(value, null, 2)); await rename(`${file}.tmp`, file);
}
function run(command, args, timeout, signal) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], signal });
    let output = '', error = '';
    const timer = setTimeout(() => child.kill('SIGTERM'), timeout);
    child.stdout.on('data', chunk => { output = (output + chunk).slice(-200000); });
    child.stderr.on('data', chunk => { error = (error + chunk).slice(-4000); });
    child.on('error', cause => { clearTimeout(timer); reject(cause); });
    child.on('close', code => { clearTimeout(timer); code === 0 ? resolve(output) : reject(new Error(error.trim() || 'Process failed or timed out')); });
  });
}
export async function prepareSong(id, { downloader = existsSync('.audio-tools/bin/yt-dlp') ? path.resolve('.audio-tools/bin/yt-dlp') : 'yt-dlp', ffmpeg = 'ffmpeg', signal } = {}) {
  const scratch = await mkdtemp(path.join(tmpdir(), 'vibe-chart-'));
  try {
    // Arguments are separate values, never executable shell text. No cookies or account login.
    const output = await run(downloader, ['--js-runtimes', 'node', '--no-playlist', '--no-progress', '--no-warnings', '--socket-timeout', '30', '--retries', '2', '--max-filesize', '150M', '--match-filter', 'duration >= 3 & duration <= 1200 & !is_live', '-f', 'bestaudio', '--write-info-json', '--print', 'after_move:filepath', '-o', path.join(scratch, 'audio.%(ext)s'), `https://www.youtube.com/watch?v=${id}`], 300000, signal);
    const media = output.trim().split('\n').at(-1);
    if (!media || !media.startsWith(scratch + path.sep)) throw new Error('No audio returned for this recording.');
    const info = JSON.parse(await readFile(path.join(scratch, 'audio.info.json'), 'utf8'));
    if (info.id !== id) throw new Error('The retrieved recording does not match the requested video.');
    const pcm = path.join(scratch, 'audio.f32');
    await run(ffmpeg, ['-v', 'error', '-y', '-i', media, '-t', '1200', '-vn', '-ac', '1', '-ar', '22050', '-f', 'f32le', pcm], 120000, signal);
    const bytes = await readFile(pcm);
    const samples = new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    const duration = samples.length / 22050;
    if (duration < 3 || duration > 1200 || Math.abs(duration - info.duration) > 2) throw new Error('Audio duration does not match this recording.');
    const result = analyze(samples, 22050, 'expert');
    // Keep the densest detected source; gameplay reduces it for Easy/Medium.
    const notes = validateChart({ version: 1, notes: result.notes }, duration);
    return { version: 1, youtubeId: id, title: String(info.title || id).slice(0, 300), notes, duration,
      settings: { difficulty: 'medium', bpm: result.bpm || 120, firstBeat: 0, offset: 0, mode: 'tap', chords: true },
      savedAt: new Date().toISOString(), analysis: 'full-mix-offline', tempoConfidence: result.confidence };
  } finally { await rm(scratch, { recursive: true, force: true }); }
}
export async function prepareQueue(ids, directory, options = {}) {
  if (!ids.length || ids.length > 200 || ids.some(id => !/^[\w-]{11}$/.test(id)) || new Set(ids).size !== ids.length) throw new Error('Queue requires unique valid video IDs.');
  await mkdir(directory, { recursive: true });
  const statusFile = path.join(directory, 'queue-status.json');
  let previous = {};
  try { previous = JSON.parse(await readFile(statusFile, 'utf8')); } catch { /* New queue. */ }
  const state = { status: 'running', updatedAt: new Date().toISOString(), songs: ids.map(id => ({ id, status: previous.songs?.find(song => song.id === id)?.status === 'ready' ? 'ready' : 'queued' })) };
  const charts = [];
  const persist = async () => { state.updatedAt = new Date().toISOString(); await atomicJSON(statusFile, state); await atomicJSON(path.join(directory, 'vibe-hero-song-pack.json'), { version: 1, charts }); };
  // Restore only files that still validate; interrupted or deleted files are prepared again.
  for (const item of state.songs) {
    if (item.status !== 'ready') continue;
    try { const chart = JSON.parse(await readFile(path.join(directory, `${item.id}.json`), 'utf8')); if (chart.youtubeId !== item.id || !Number.isFinite(chart.duration) || chart.duration < 3 || chart.duration > 1200) throw new Error(); validateChart(chart, chart.duration); charts.push(chart); } catch { item.status = 'queued'; }
  }
  await persist();
  for (const item of state.songs) {
    if (options.signal?.aborted) break;
    if (item.status === 'ready') continue;
    item.status = 'preparing'; await persist(); options.onProgress?.(state);
    try {
      const chart = await (options.prepare || prepareSong)(item.id, options);
      await atomicJSON(path.join(directory, `${item.id}.json`), chart);
      charts.push(chart); item.status = 'ready'; item.title = chart.title;
    } catch (error) { item.status = options.signal?.aborted ? 'queued' : 'failed'; item.error = error.message.slice(0, 2000); }
    await persist(); options.onProgress?.(state);
  }
  state.status = options.signal?.aborted ? 'paused' : state.songs.some(item => item.status === 'failed') ? 'complete-with-errors' : 'complete';
  await persist(); return state;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [input, directory = 'prepared-songs'] = process.argv.slice(2), controller = new AbortController();
  process.on('SIGINT', () => controller.abort()); process.on('SIGTERM', () => controller.abort());
  if (!input) { console.error('Usage: node scripts/prepare-queue.js songs.txt [output-directory]'); process.exitCode = 1; }
  else {
    try {
      const ids = parseQueue(await readFile(input, 'utf8'));
      const state = await prepareQueue(ids, directory, { downloader: process.env.VIBE_DOWNLOADER || undefined, signal: controller.signal,
        onProgress: state => console.log(`${state.songs.filter(s => s.status === 'ready').length}/${ids.length} ready · ${state.songs.find(s => s.status === 'preparing')?.id || 'saved checkpoint'}`) });
      console.log(`${state.status}: ${path.resolve(directory, 'vibe-hero-song-pack.json')}`);
      if (state.status !== 'complete') process.exitCode = 1;
    } catch (error) { console.error(error.message); process.exitCode = 1; }
  }
}

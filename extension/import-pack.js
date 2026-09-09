import { validateChart } from '../src/game/chart.js';
import { saveChart } from './chart-store.js';
export function validatePack(value) {
  if (value?.version !== 1 || !Array.isArray(value.charts) || !value.charts.length || value.charts.length > 200) throw new Error('Choose a Vibe Hero song pack with 1–200 charts.');
  const ids = new Set();
  return value.charts.map(record => {
    if (!/^[\w-]{11}$/.test(record.youtubeId || '') || ids.has(record.youtubeId) || !Number.isFinite(record.duration) || record.duration < 3 || record.duration > 1200) throw new Error('Song pack contains an invalid or duplicate recording.');
    ids.add(record.youtubeId);
    return { ...record, notes: validateChart(record, record.duration) };
  });
}
export async function importPack(value, storage) {
  const records = validatePack(value), saved = [];
  for (const record of records) {
    try { await saveChart(storage, record.youtubeId, record, record.duration, record.settings, record.title); saved.push(record.youtubeId); }
    catch (error) { throw new Error(`Imported ${saved.length} of ${records.length} songs. ${error.message} You can retry this pack.`); }
  }
  return saved.length;
}

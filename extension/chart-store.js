import { validateChart } from '../src/game/chart.js';
import { nativeSettings } from '../src/game/handoff.js';
const keyFor = id => {
  if (!/^[\w-]{11}$/.test(id)) throw new Error('Invalid recording ID.');
  return `vh.chart.${id}`;
};
export async function saveChart(storage, id, chart, duration, settings, title) {
  const key = keyFor(id);
  if (!Number.isFinite(duration) || duration < 3 || duration > 1200) throw new Error('The song duration is unavailable. Try saving after the song loads.');
  const record = { version: 1, youtubeId: id, notes: validateChart(chart, duration), duration, settings: nativeSettings(settings), title: String(title || '').slice(0, 300), savedAt: new Date().toISOString() };
  if (JSON.stringify(record).length > 2 * 1024 * 1024) throw new Error('This chart is too large to save.');
  await storage.set({ [key]: record });
  return record;
}
export async function loadChart(storage, id) {
  const key = keyFor(id), record = (await storage.get(key))[key];
  if (!record) return null;
  if (record.youtubeId !== id || !Number.isFinite(record.duration) || record.duration < 3 || record.duration > 1200) throw new Error('Saved chart is invalid. Import a backup or generate it again.');
  return { ...record, notes: validateChart(record, record.duration), settings: nativeSettings(record.settings) };
}

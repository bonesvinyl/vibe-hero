export const RULESET = 'encore-0.7';
export async function scoreRecord(game, settings, videoId, title, username) {
  username = String(username || '').trim().slice(0, 24);
  if (!username) throw new Error('Enter a player name first.');
  if (game.failed || !game.eligible) throw new Error('Only a complete run from the beginning can be saved.');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(game.notes)));
  const chart = [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2, '0')).join('');
  return { id: crypto.randomUUID(), ruleset: RULESET, videoId, title: String(title).slice(0, 200), username,
    score: game.score, accuracy: game.accuracy, best: game.best, notes: game.notes.length,
    difficulty: settings.difficulty, chords: settings.chords !== false, mode: settings.mode,
    chart, date: new Date().toISOString() };
}
export async function saveScore(record, storage) {
  // One key per result avoids lost writes from simultaneous song tabs.
  await storage.set({ [`vh.score.${record.id}`]: record, 'vh.player': record.username });
  return record;
}

import process from 'node:process';
import { Buffer } from 'node:buffer';
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';

// A community board: client-submitted scores are explicitly unverified.
// Isolate rankings by exact recording, arrangement hash and gameplay settings.
export function leaderboard(database = 'leaderboard.sqlite') {
  const db = new DatabaseSync(database);
  db.exec(`CREATE TABLE IF NOT EXISTS scores (id TEXT PRIMARY KEY, video TEXT NOT NULL, board TEXT NOT NULL, username TEXT NOT NULL, score INTEGER NOT NULL, data TEXT NOT NULL, created INTEGER NOT NULL)`);
  db.exec('CREATE INDEX IF NOT EXISTS scores_board ON scores(video, board, score DESC)');
  const limits = new Map();
  const boardKey = r => [r.ruleset, r.chart, r.difficulty, r.mode, r.chords ? 'chords' : 'single'].join(':');
  const server = createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    const send = (status, body) => { res.writeHead(status); res.end(JSON.stringify(body)); };
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname !== '/scores') return send(404, { error: 'Not found' });
      if (req.method === 'GET') {
        const video = url.searchParams.get('videoId'), board = url.searchParams.get('board');
        if (!/^[\w-]{11}$/.test(video || '') || !board || board.length > 160) return send(400, { error: 'Exact videoId and board are required' });
        const rows = db.prepare('SELECT data FROM scores WHERE video=? AND board=? ORDER BY score DESC, created ASC LIMIT 100').all(video, board);
        return send(200, { verified: false, scores: rows.map(row => JSON.parse(row.data)) });
      }
      if (req.method !== 'POST') return send(405, { error: 'Method not allowed' });
      const now = Date.now(), ip = req.socket.remoteAddress;
      for (const [key, value] of limits) if (value.until < now) limits.delete(key);
      const limit = limits.get(ip) || { count: 0, until: now + 60000 };
      if (++limit.count > 10 || limits.size > 10000) return send(429, { error: 'Try again in a minute' });
      limits.set(ip, limit);
      let body = '';
      for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 4096) return send(413, { error: 'Result too large' }); }
      const r = JSON.parse(body);
      if (!/^[\w-]{11}$/.test(r.videoId || '') || !/^[a-f0-9]{64}$/.test(r.chart || '') || !/^[a-f0-9-]{36}$/.test(r.id || '') || !['encore-0.7', 'encore-0.8'].includes(r.ruleset) || !['easy','medium','expert'].includes(r.difficulty) || !['tap','strum'].includes(r.mode) || typeof r.chords !== 'boolean' || typeof r.username !== 'string' || !r.username.trim() || r.username.length > 24 || [...r.username].some(c => c.charCodeAt(0) < 32) || !Number.isInteger(r.score) || r.score < 0 || r.score > 100000000 || !Number.isInteger(r.accuracy) || r.accuracy < 0 || r.accuracy > 100 || !Number.isInteger(r.best) || !Number.isInteger(r.notes) || r.notes < 1 || r.notes > 20000 || r.best < 0 || r.best > r.notes) return send(400, { error: 'Invalid score' });
      const record = { id:r.id, videoId:r.videoId, chart:r.chart, ruleset:r.ruleset, difficulty:r.difficulty, mode:r.mode, chords:r.chords, username:r.username.trim(), score:r.score, accuracy:r.accuracy, best:r.best, notes:r.notes, date:new Date(now).toISOString() };
      const board = boardKey(record);
      const prior = db.prepare('SELECT data FROM scores WHERE id=?').get(r.id);
      if (prior) return send(200, { saved: true, board });
      db.prepare('INSERT INTO scores VALUES (?,?,?,?,?,?,?)').run(r.id, r.videoId, board, record.username, r.score, JSON.stringify(record), now);
      return send(201, { saved: true, verified: false, board });
    } catch { if (!res.headersSent) send(400, { error: 'Invalid request' }); }
  });
  server.on('close', () => db.close());
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  leaderboard(process.env.VIBE_SCORE_DB || 'leaderboard.sqlite').listen(Number(process.env.PORT || 8787), process.env.HOST || '127.0.0.1', () => console.log('Vibe Hero community leaderboard listening'));
}

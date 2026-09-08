// Reactions use the song clock, so pauses and musical rests cannot count as misses.
export class CrowdReactions {
  reset() { this.time = null; this.hits = 0; this.misses = 0; this.bucket = 0; this.power = -1; this.missStart = null; this.lastMiss = -Infinity; this.lastSound = -Infinity; }
  constructor() { this.reset(); }
  update(game, time) {
    if (this.time !== null && (time < this.time - 0.25 || time > this.time + 1 || game.hits < this.hits || game.misses < this.misses)) this.reset();
    const hit = game.hits > this.hits, missed = game.misses > this.misses;
    const bucket = Math.floor(game.combo / 10);
    const cheer = (hit && bucket > this.bucket) || (game.powerUntil > this.power && game.powerUntil > time);
    if (hit || time - this.lastMiss > 2) this.missStart = null;
    if (missed && !hit) { this.missStart ??= time; this.lastMiss = time; }
    const boo = missed && !hit && this.missStart !== null && time - this.missStart >= 10;
    this.time = time; this.hits = game.hits; this.misses = game.misses; this.bucket = bucket; this.power = game.powerUntil;
    if (time >= 0 && (cheer || boo) && time - this.lastSound >= 8) {
      this.lastSound = time;
      if (boo) this.missStart = time;
      return cheer ? 'cheer' : 'boo';
    }
    return null;
  }
}

export class CrowdAudio {
  constructor(assetURL) {
    this.assetURL = assetURL; this.reactions = new CrowdReactions(); this.volume = 0.18;
    this.buffers = new Map(); this.epoch = 0; this.closed = false;
  }
  unlock() {
    if (this.closed) return;
    try { this.context ??= new AudioContext(); this.context.resume().catch(() => {}); } catch { /* Audio feedback is optional. */ }
  }
  setVolume(value) { this.volume = Number.isFinite(value) ? Math.max(0, Math.min(0.4, value)) : 0; if (!this.volume) this.stop(); else if (this.gain) this.gain.gain.setValueAtTime(this.volume, this.context.currentTime); }
  reset() { this.stop(); this.reactions.reset(); }
  update(game, time) { const reaction = this.reactions.update(game, time); if (reaction) this.play(reaction); }
  stop() { this.epoch++; if (this.source) { this.source.stop(); this.source.disconnect(); this.source = null; } this.gain?.disconnect(); this.gain = null; }
  async play(type) {
    if (!this.volume || this.closed || this.context?.state !== 'running') return;
    this.stop(); const epoch = this.epoch;
    const file = `${type}${Math.random() < 0.5 ? 1 : 2}.mp3`;
    try {
      if (!this.buffers.has(file)) this.buffers.set(file, fetch(this.assetURL(file)).then(response => { if (!response.ok) throw new Error('Sound unavailable'); return response.arrayBuffer(); }).then(bytes => this.context.decodeAudioData(bytes)));
      const buffer = await this.buffers.get(file);
      if (this.closed || epoch !== this.epoch || !this.volume || this.context.state !== 'running') return;
      const source = this.context.createBufferSource(), gain = this.context.createGain();
      source.buffer = buffer; source.connect(gain); gain.connect(this.context.destination);
      const now = this.context.currentTime, length = Math.min(3.5, buffer.duration);
      gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(this.volume, now + Math.min(0.15, length / 3));
      gain.gain.setValueAtTime(this.volume, now + Math.max(0.15, length - 0.6)); gain.gain.linearRampToValueAtTime(0, now + length);
      source.start(now); source.stop(now + length);
      this.source = source; this.gain = gain;
      source.onended = () => { source.disconnect(); gain.disconnect(); if (this.source === source) { this.source = null; this.gain = null; } };
    } catch { this.buffers.delete(file); /* Missing/blocked audio must not interrupt gameplay. */ }
  }
  destroy() { this.closed = true; this.stop(); this.buffers.clear(); this.context?.close().catch(() => {}); }
}

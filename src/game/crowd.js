// Reactions use the song clock, so pauses and musical rests cannot count as misses.
export class CrowdReactions {
  reset() { this.time = null; this.hits = 0; this.misses = 0; this.bucket = 0; this.power = -1; this.lastSound = -Infinity; this.consecutiveMisses = 0; this.justBonus = false; this.missRun = 0; this.lastMissCue = -Infinity; this.justMissCue = false; }
  constructor() { this.reset(); }
  update(game, time) {
    if (this.time !== null && (time < this.time - 0.25 || time > this.time + 1 || game.hits < this.hits || game.misses < this.misses)) { this.reset(); this.time = time; this.hits = game.hits; this.misses = game.misses; this.bucket = Math.floor(game.combo / 10); this.power = game.powerUntil; return null; }
    const hit = game.hits > this.hits, missed = game.misses > this.misses;
    this.justMissCue = false;
    this.missRun = hit ? 0 : this.missRun + (game.misses - this.misses);
    if (missed && !hit && this.missRun >= 3 && time >= 0 && time - this.lastMissCue >= 1.25) { this.justMissCue = true; this.lastMissCue = time; }
    const bucket = Math.floor(game.combo / 10);
    this.justBonus = game.powerUntil > this.power && game.powerUntil > time;
    const cheer = (hit && bucket > this.bucket) || this.justBonus;
    if (hit) this.consecutiveMisses = 0;
    else if (missed) this.consecutiveMisses += game.misses - this.misses;
    const boo = missed && !hit && this.consecutiveMisses >= 5;
    this.time = time; this.hits = game.hits; this.misses = game.misses; this.bucket = bucket; this.power = game.powerUntil;
    if (time >= 0 && (cheer || boo) && (this.justBonus || time - this.lastSound >= (game.rock < 30 ? 3 : 8))) {
      this.lastSound = time;
      if (boo) this.consecutiveMisses = 0;
      return cheer ? 'cheer' : 'boo';
    }
    return null;
  }
}

export class CrowdAudio {
  constructor(assetURL) {
    this.assetURL = assetURL; this.reactions = new CrowdReactions(); this.volume = 0.18;
    this.voices = []; this.buffers = new Map(); this.epoch = 0; this.closed = false;
  }
  unlock() {
    if (this.closed) return;
    try { this.context ??= new AudioContext(); this.context.resume().catch(() => {}); } catch { /* Audio feedback is optional. */ }
  }
  setVolume(value) { this.volume = Number.isFinite(value) ? Math.max(0, Math.min(0.4, value)) : 0; if (!this.volume) this.stop(); else if (this.gain) this.gain.gain.setValueAtTime(Math.min(0.65, this.volume * (this.boost || 1)), this.context.currentTime); }
  reset() { this.stop(); this.reactions.reset(); }
  update(game, time) {
    const reaction = this.reactions.update(game, time), remaining = time >= 0 && game.powerUntil > 0 ? game.powerUntil - time : 0;
    if (remaining > 0 && (!this.bonusPlaying || this.reactions.justBonus)) {
      this.play('cheer', remaining, 2.3, true); this.bonusPlaying = true; if (this.reactions.justBonus) this.cue(`star${1 + Math.floor(Math.random() * 5)}.mp3`, 1.6);
    } else if (remaining <= 0) {
      if (this.bonusPlaying) this.stop();
      if (reaction) { this.play(reaction, reaction === 'boo' ? 4 : 3.5, reaction === 'boo' ? 1 + (100 - (game.rock ?? 70)) / 65 : 1); }
    }
    if (this.reactions.justMissCue) this.missClang();
  }
  stop() { for (const voice of this.voices) { voice.source.stop(); voice.source.disconnect(); voice.gain.disconnect(); } this.voices = []; this.bonusPlaying = false; this.epoch++; if (this.source) { this.source.stop(); this.source.disconnect(); this.source = null; } this.gain?.disconnect(); this.gain = null; }
  load(file) {
    if (!this.buffers.has(file)) this.buffers.set(file, fetch(this.assetURL(file)).then(response => { if (!response.ok) throw new Error('Sound unavailable'); return response.arrayBuffer(); }).then(bytes => this.context.decodeAudioData(bytes)).catch(error => { this.buffers.delete(file); throw error; }));
    return this.buffers.get(file);
  }
  async cue(file, boost = 1.5) {
    if (!this.volume || this.closed || this.context?.state !== 'running') return;
    const epoch = this.epoch;
    try {
      const buffer = await this.load(file);
      if (this.closed || this.epoch !== epoch || !this.volume) return;
      const source = this.context.createBufferSource(), gain = this.context.createGain();
      source.buffer = buffer; gain.gain.value = Math.min(0.65, this.volume * boost);
      source.connect(gain); gain.connect(this.context.destination);
      const voice = { source, gain }; this.voices.push(voice);
      source.onended = () => { source.disconnect(); gain.disconnect(); this.voices = this.voices.filter(v => v !== voice); };
      source.start();
    } catch { /* Optional cue must never prevent gameplay. */ }
  }
  missClang() { this.cue(`miss${1 + Math.floor(Math.random() * 6)}.mp3`, 2.4); }
  async play(type, duration = 3.5, boost = 1, loop = false) {
    if (!this.volume || this.closed || this.context?.state !== 'running') return;
    this.stop(); this.boost = boost; const epoch = this.epoch;
    const file = type === 'cheer' ? 'crowd-live.mp3' : `${type}${Math.random() < 0.5 ? 1 : 2}.mp3`;
    try {
      const buffer = await this.load(file);
      if (this.closed || epoch !== this.epoch || !this.volume || this.context.state !== 'running') return;
      const source = this.context.createBufferSource(), gain = this.context.createGain();
      source.buffer = buffer; source.connect(gain); gain.connect(this.context.destination);
      const now = this.context.currentTime, length = loop ? duration : Math.min(duration, buffer.duration);
      source.loop = loop;
      const level = Math.min(0.65, this.volume * boost);
      gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(level, now + Math.min(0.15, length / 3));
      gain.gain.setValueAtTime(level, now + Math.max(0.15, length - 0.6)); gain.gain.linearRampToValueAtTime(0, now + length);
      source.start(now); source.stop(now + length);
      this.source = source; this.gain = gain;
      source.onended = () => { source.disconnect(); gain.disconnect(); if (this.source === source) { this.source = null; this.gain = null; } };
    } catch { this.buffers.delete(file); /* Missing/blocked audio must not interrupt gameplay. */ }
  }
  destroy() { this.closed = true; this.stop(); this.buffers.clear(); this.context?.close().catch(() => {}); }
}

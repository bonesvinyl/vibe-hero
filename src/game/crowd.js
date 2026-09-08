// Reactions use the song clock, so pauses and musical rests cannot count as misses.
export class CrowdReactions {
  reset() { this.time = null; this.hits = 0; this.misses = 0; this.bucket = 0; this.power = -1; this.lastSound = -Infinity; this.consecutiveMisses = 0; this.justBonus = false; }
  constructor() { this.reset(); }
  update(game, time) {
    if (this.time !== null && (time < this.time - 0.25 || time > this.time + 1 || game.hits < this.hits || game.misses < this.misses)) { this.reset(); this.time = time; this.hits = game.hits; this.misses = game.misses; this.bucket = Math.floor(game.combo / 10); this.power = game.powerUntil; return null; }
    const hit = game.hits > this.hits, missed = game.misses > this.misses;
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
    this.effects = []; this.buffers = new Map(); this.epoch = 0; this.closed = false;
  }
  unlock() {
    if (this.closed) return;
    try { this.context ??= new AudioContext(); this.context.resume().catch(() => {}); } catch { /* Audio feedback is optional. */ }
  }
  setVolume(value) { this.volume = Number.isFinite(value) ? Math.max(0, Math.min(0.4, value)) : 0; if (!this.volume) this.stop(); else if (this.gain) this.gain.gain.setValueAtTime(this.volume, this.context.currentTime); }
  reset() { this.stop(); this.reactions.reset(); }
  update(game, time) {
    const reaction = this.reactions.update(game, time), remaining = game.powerUntil - time;
    if (remaining > 0 && (!this.bonusPlaying || this.reactions.justBonus)) {
      this.play('cheer', remaining, 1.45, true); this.bonusPlaying = true; this.arena(remaining);
    } else if (remaining <= 0) {
      if (this.bonusPlaying) this.stop();
      if (reaction) { this.play(reaction, reaction === 'boo' ? 4 : 3.5, reaction === 'boo' ? 1 + (100 - (game.rock ?? 70)) / 65 : 1); if (reaction === 'boo') this.missClang(); }
    }
  }
  stop() { this.bonusPlaying = false; for (const effect of this.effects) { effect.osc.stop(); effect.nodes.forEach(node => node.disconnect()); } this.effects = []; this.epoch++; if (this.source) { this.source.stop(); this.source.disconnect(); this.source = null; } this.gain?.disconnect(); this.gain = null; }
  missClang() {
    if (!this.volume || this.context?.state !== 'running') return;
    const ctx = this.context, now = ctx.currentTime;
    for (const frequency of [73, 109]) {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = 'sawtooth'; osc.frequency.setValueAtTime(frequency, now); osc.frequency.exponentialRampToValueAtTime(frequency * 0.55, now + 0.28);
      gain.gain.setValueAtTime(this.volume * 0.45, now); gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
      osc.connect(gain); gain.connect(ctx.destination);
      const effect = { osc, nodes: [osc, gain] }; this.effects.push(effect);
      osc.onended = () => { effect.nodes.forEach(n => n.disconnect()); this.effects = this.effects.filter(e => e !== effect); };
      osc.start(now); osc.stop(now + 0.33);
    }
  }
  arena(duration = 8) {
    if (!this.volume || this.closed || this.context?.state !== 'running') return;
    const ctx = this.context, now = ctx.currentTime;
    for (const [frequency, type, level] of [[110, 'sine', 0.4], [220, 'triangle', 0.25], [55, 'sawtooth', 0.3]]) {
      const osc = ctx.createOscillator(), gain = ctx.createGain(), filter = ctx.createBiquadFilter();
      osc.type = type; osc.frequency.setValueAtTime(frequency, now);
      filter.type = 'lowpass'; filter.frequency.setValueAtTime(800, now); filter.frequency.exponentialRampToValueAtTime(200, now + 5);
      gain.gain.setValueAtTime(this.volume * level * 1.6, now); gain.gain.setValueAtTime(this.volume * level * 1.6, now + Math.max(0, duration - 0.5)); gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
      const effect = { osc, nodes: [osc, filter, gain] }; this.effects.push(effect);
      osc.onended = () => { effect.nodes.forEach(node => node.disconnect()); this.effects = this.effects.filter(value => value !== effect); };
      osc.start(now); osc.stop(now + duration);
    }
  }
  async play(type, duration = 3.5, boost = 1, loop = false) {
    if (!this.volume || this.closed || this.context?.state !== 'running') return;
    this.stop(); const epoch = this.epoch;
    const file = `${type}${Math.random() < 0.5 ? 1 : 2}.mp3`;
    try {
      if (!this.buffers.has(file)) this.buffers.set(file, fetch(this.assetURL(file)).then(response => { if (!response.ok) throw new Error('Sound unavailable'); return response.arrayBuffer(); }).then(bytes => this.context.decodeAudioData(bytes)));
      const buffer = await this.buffers.get(file);
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

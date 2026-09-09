// Wet-only parallel path: the original music remains connected and unchanged.
export class BonusEcho {
  constructor(context, source) {
    this.context = context; this.source = source;
    this.input = context.createGain(); this.delay = context.createDelay(1);
    this.feedback = context.createGain(); this.filter = context.createBiquadFilter(); this.output = context.createGain();
    this.input.gain.value = 0; this.output.gain.value = 0;
    this.delay.delayTime.value = 0.19; this.feedback.gain.value = 0.38;
    this.filter.type = 'lowpass'; this.filter.frequency.value = 3200;
    source.connect(this.input); this.input.connect(this.delay); this.delay.connect(this.filter);
    this.filter.connect(this.feedback); this.feedback.connect(this.delay);
    this.filter.connect(this.output); this.output.connect(context.destination);
    this.reverbNodes = [];
    if (context.createConvolver && context.createBuffer) {
      const convolver = context.createConvolver(), gain = context.createGain();
      const impulse = context.createBuffer(2, Math.ceil(context.sampleRate * 2.6), context.sampleRate);
      let seed = 71;
      for (let channel = 0; channel < 2; channel++) {
        const data = impulse.getChannelData(channel);
        for (let i = 0; i < data.length; i++) { seed = (seed * 16807) % 2147483647; data[i] = (seed / 1073741823.5 - 1) * Math.pow(1 - i / data.length, 2.4); }
      }
      convolver.buffer = impulse; gain.gain.value = 0.65;
      this.input.connect(convolver); convolver.connect(gain); gain.connect(this.output);
      this.reverbNodes = [convolver, gain];
    }
    this.active = false;
  }
  set(active) {
    if (this.active === active) return;
    this.active = active;
    for (const [param, value] of [[this.input.gain, active ? 1 : 0], [this.output.gain, active ? 0.42 : 0]]) {
      param.cancelScheduledValues(this.context.currentTime);
      param.setTargetAtTime(value, this.context.currentTime, active ? 0.08 : 0.025);
    }
  }
  destroy() { this.source.disconnect(this.input); for (const node of [this.input, this.delay, this.feedback, this.filter, this.output, ...this.reverbNodes]) node.disconnect(); }
}

export class VideoBonusEcho {
  async attach(video) {
    this.destroy();
    const generation = this.generation;
    try {
      this.stream = video.captureStream();
      if (!this.stream.getAudioTracks().length) throw new Error('No audio track available');
      this.context = new AudioContext(); await this.context.resume();
      if (generation !== this.generation) return false;
      this.effect = new BonusEcho(this.context, this.context.createMediaStreamSource(this.stream));
      return true;
    } catch { this.destroy(); return false; }
  }
  set(active) { this.effect?.set(active); }
  destroy() { this.generation = (this.generation || 0) + 1; this.effect?.destroy(); this.effect = null; this.stream?.getTracks().forEach(track => track.stop()); this.stream = null; this.context?.close().catch(() => {}); this.context = null; }
}

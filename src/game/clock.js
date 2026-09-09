// Smooth short gaps between iframe time samples. Always re-anchor to the media
// clock; never extrapolate beyond 250 ms or advance while paused/buffering.
export class SampledMediaClock {
  constructor() {
    this.sample = null;
    this.at = 0;
    this.playing = false;
    this.rate = 1;
  }
  read(sample, playing, now, rate = 1) {
    if (!Number.isFinite(sample)) return this.sample ?? 0;
    if (
      sample !== this.sample ||
      playing !== this.playing ||
      rate !== this.rate ||
      !playing
    ) {
      this.sample = sample;
      this.at = now;
    }
    this.playing = playing;
    this.rate = rate;
    return (
      sample +
      (playing ? Math.min(0.25, Math.max(0, (now - this.at) / 1000)) * rate : 0)
    );
  }
}

// Explicit tab sharing. Extract features in memory, never upload or save audio.
export async function listenToSong(video, { signal, isAd, onProgress }) {
  let stream, context, source, timer;
  const frames = [];
  const stop = () => stream?.getTracks().forEach(track => track.stop());
  signal.addEventListener('abort', stop, { once: true });
  try {
    if (!navigator.mediaDevices?.getDisplayMedia) throw new Error('Tab audio sharing is unavailable. Use Chrome or Edge.');
    stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: { suppressLocalAudioPlayback: false }, selfBrowserSurface: 'include', systemAudio: 'exclude' });
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    if (!stream.getAudioTracks().length) throw new Error('Select this YouTube tab and enable Share tab audio.');
    if (isAd()) throw new Error('Let the ad finish, then start listening again.');
    if (!Number.isFinite(video.duration) || video.duration < 3 || video.duration > 1200) throw new Error('Choose a song between 3 seconds and 20 minutes.');
    context = new AudioContext();
    await context.resume();
    source = context.createMediaStreamSource(stream);
    const analyzer = context.createAnalyser(); analyzer.fftSize = 2048; analyzer.smoothingTimeConstant = 0;
    source.connect(analyzer);
    const bins = new Float32Array(analyzer.frequencyBinCount), wave = new Float32Array(analyzer.fftSize);
    let previous = new Float32Array(bins.length), lastTime = 0, wasAd = false, warmup = true;
    video.pause(); video.currentTime = 0; video.playbackRate = 1;
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
    await video.play();
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
    return await new Promise((resolve, reject) => {
      const fail = error => { clearInterval(timer); reject(error); };
      const abort = () => { signal.removeEventListener('abort', abort); fail(new DOMException('Cancelled', 'AbortError')); };
      signal.addEventListener('abort', abort, { once: true });
      const finish = () => { signal.removeEventListener('abort', abort); clearInterval(timer); };
      timer = setInterval(() => {
        try {
          if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
          if (stream.getTracks().some(track => track.readyState === 'ended')) throw new Error('Sharing stopped. Listen again to generate a complete chart.');
          if (isAd()) { wasAd = true; return; }
          if (wasAd) { previous.fill(0); warmup = true; lastTime = video.currentTime; wasAd = false; }
          if (video.error) throw new Error('YouTube playback failed during analysis.');
          if (video.playbackRate !== 1 || video.currentTime < lastTime - 0.1 || video.currentTime > lastTime + 1) throw new Error('The song was skipped or its speed changed. Listen again without seeking.');
          if (video.ended) { finish(); resolve(frames); return; }
          if (video.paused || video.seeking || video.readyState < 3 || video.currentTime <= lastTime) return;
          analyzer.getFloatFrequencyData(bins); analyzer.getFloatTimeDomainData(wave);
          let flux = 0, weighted = 0, energy = 0;
          for (const sample of wave) energy += sample * sample;
          const next = new Float32Array(bins.length);
          for (let i = 0; i < bins.length; i++) {
            const frequency = i * context.sampleRate / analyzer.fftSize;
            next[i] = Math.pow(10, bins[i] / 20);
            if (frequency < 80 || frequency > 5000) continue;
            const rise = Math.max(0, next[i] - previous[i]); flux += rise; weighted += rise * i;
          }
          if (warmup) { previous = next; lastTime = video.currentTime; warmup = false; return; }
          frames.push({ time: video.currentTime, flux, tone: flux ? weighted / flux : 0, energy: Math.sqrt(energy / wave.length) });
          previous = next; lastTime = video.currentTime;
          onProgress(video.currentTime / video.duration);
        } catch (error) { finish(); fail(error); }
      }, 20);
    });
  } finally {
    clearInterval(timer); signal.removeEventListener('abort', stop); stop(); source?.disconnect(); await context?.close(); video.pause();
  }
}

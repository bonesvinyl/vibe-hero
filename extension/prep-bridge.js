/* global chrome */
// Runs only after the user invokes Prepare on this YouTube tab.
if (!globalThis.vibeHeroPrepBridge) {
  globalThis.vibeHeroPrepBridge = true;
  chrome.runtime.onMessage.addListener((message, _sender, reply) => {
    if (_sender.id !== chrome.runtime.id || message.target !== 'prep-player') return;
    const id = new URL(location.href).searchParams.get('v');
    const video = document.querySelector('#movie_player video') || document.querySelector('video.html5-main-video');
    if (!video || id !== message.videoId) { reply({ error: 'The song tab was closed, navigated, or its player is unavailable.' }); return; }
    const ad = !!document.querySelector('#movie_player.ad-showing, #movie_player.ad-interrupting');
    const snapshot = () => ({ time: video.currentTime, duration: video.duration, paused: video.paused, ended: video.ended, seeking: video.seeking, ready: video.readyState, rate: video.playbackRate, ad, title: document.title.replace(/ - YouTube$/, ''), error: video.error ? 'YouTube playback failed.' : null });
    if (message.action === 'start') {
      if (ad) { reply({ error: 'Let the current ad finish, then click Prepare again.' }); return; }
      document.getElementById('vibe-hero-native-overlay')?.dispatchEvent(new Event('vibe-hero-close'));
      video.pause(); video.currentTime = 0; video.playbackRate = 1; video.muted = false; video.volume = 1;
      video.play().then(() => reply(snapshot())).catch(error => reply({ error: error.message }));
      return true;
    }
    if (message.action === 'stop') video.pause();
    reply(snapshot());
  });
}

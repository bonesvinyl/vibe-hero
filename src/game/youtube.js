let apiPromise;
export function youtubePlaybackError(code) {
  const messages = {
    2: "The YouTube video link is invalid (error 2). Check the URL and try again.",
    5: "The browser could not play this YouTube video (error 5). Try a regular browser or another recording.",
    100: "YouTube reports that this video was removed or is private (error 100). Choose another recording.",
    101: "YouTube refused embedded playback (error 101). Try playing on YouTube with the Vibe Hero extension below. If every song fails here, the cause needs investigation; this message alone does not establish why your whole library fails.",
    150: "YouTube refused embedded playback (error 150). Try playing on YouTube with the Vibe Hero extension below. If every song fails here, the cause needs investigation; this message alone does not establish why your whole library fails.",
    153: "YouTube could not identify this embedded player (error 153). This is a browser/referrer configuration issue, not an owner embedding restriction. Try opening Vibe Hero in a regular browser.",
  };
  const error = new Error(
    messages[code] ||
      `YouTube playback failed (error ${code}). The cause is unknown; try another recording or local audio.`,
  );
  error.code = code;
  return error;
}
export function youtubeAPI() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const timeout = setTimeout(() => {
      script.remove();
      apiPromise = null;
      reject(
        new Error(
          "YouTube did not load. Check your connection or use a local file.",
        ),
      );
    }, 15000);
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timeout);
      previous?.();
      resolve(window.YT);
    };
    script.src = "https://www.youtube.com/iframe_api";
    script.onerror = () => {
      clearTimeout(timeout);
      script.remove();
      apiPromise = null;
      reject(new Error("YouTube is unavailable. Local audio still works."));
    };
    document.head.append(script);
  });
  return apiPromise;
}

export async function createVideo(element, id, handlers = {}) {
  const YT = await youtubeAPI();
  if (handlers.signal?.aborted)
    throw new DOMException("Cancelled", "AbortError");
  return new Promise((resolve, reject) => {
    let player;
    const cancel = () => {
      clearTimeout(timeout);
      player?.destroy();
      reject(new DOMException("Cancelled", "AbortError"));
    };
    const cleanup = () => {
      clearTimeout(timeout);
      handlers.signal?.removeEventListener("abort", cancel);
    };
    const timeout = setTimeout(() => {
      cleanup();
      player?.destroy();
      reject(
        new Error(
          "This video could not load. Try another video or local audio.",
        ),
      );
    }, 15000);
    handlers.signal?.addEventListener("abort", cancel, { once: true });
    player = new YT.Player(element, {
      videoId: id,
      playerVars: {
        autoplay: 0,
        controls: 1,
        playsinline: 1,
        origin: window.location.origin,
        disablekb: 1,
      },
      events: {
        onReady: () => {
          cleanup();
          resolve(player);
        },
        onStateChange: (event) => handlers.onState?.(event.data),
        onError: (event) => {
          cleanup();
          const error = youtubePlaybackError(event.data);
          reject(error);
          handlers.onError?.(error);
        },
        onAutoplayBlocked: () => handlers.onBlocked?.(),
      },
    });
  });
}

export async function videoMetadata(id, signal) {
  const response = await fetch(
    `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`,
    { signal },
  );
  if (!response.ok) throw new Error("Video title unavailable");
  return response.json();
}

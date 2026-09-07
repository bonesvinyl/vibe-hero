let apiPromise;
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
          const error = new Error(
            `YouTube cannot play this video (${event.data}). It may be restricted or unavailable.`,
          );
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

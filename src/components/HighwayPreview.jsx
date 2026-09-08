import { useEffect, useRef } from "react";
import { drawHighway } from "../game/draw";

export default function HighwayPreview({ animated = false }) {
  const canvas = useRef(null);
  useEffect(() => {
    const game = {
      cursor: 0,
      results: [],
      notes: [0.3, 0.6, 0.9, 1.1, 1.4, 1.6, 1.8, 2.1].map((time, i) => ({
        time,
        lanes: [[2], [0], [1], [3], [2], [4], [1], [2]][i],
      })),
    };
    let frame;
    const motion = animated && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const render = (now = 0) => {
      drawHighway(canvas.current, game, motion ? (now / 1000) % 2.4 : 0, [], true);
    };
    const animate = now => { render(now); frame = requestAnimationFrame(animate); };
    const observer = new ResizeObserver(() => render());
    observer.observe(canvas.current);
    render();
    if (motion) frame = requestAnimationFrame(animate);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [animated]);
  return (
    <canvas
      ref={canvas}
      className="highway-preview"
      aria-label="Five-lane guitar highway preview"
    />
  );
}

import { useEffect, useRef } from "react";
import { drawHighway } from "../game/draw";

export default function HighwayPreview() {
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
    const render = () => drawHighway(canvas.current, game, 0, [], true);
    const observer = new ResizeObserver(render);
    observer.observe(canvas.current);
    render();
    return () => observer.disconnect();
  }, []);
  return (
    <canvas
      ref={canvas}
      className="highway-preview"
      aria-label="Five-lane guitar highway preview"
    />
  );
}

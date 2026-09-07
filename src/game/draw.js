import { APPROACH, COLORS } from "./chart";

// A single perspective transform for frets and notes keeps the judgment line exact.
export function drawHighway(
  canvas,
  game,
  time,
  held = [],
  preview = false,
  labels = ["A", "S", "D", "F", "G"],
  highwayOpacity = 1,
) {
  const width = canvas.clientWidth,
    height = canvas.clientHeight,
    dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (
    canvas.width !== Math.round(width * dpr) ||
    canvas.height !== Math.round(height * dpr)
  ) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const top = height * 0.08,
    bottom = height * 0.9,
    center = width / 2;
  const project = (lane, p) => {
    const depth = 0.23 + 0.77 * p * p;
    return {
      x: center + (lane / 5 - 0.5) * width * 0.82 * depth,
      y: top + (bottom - top) * p * p,
      depth,
    };
  };
  const line = (a, b, color, thickness = 1) => {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = thickness;
    ctx.stroke();
  };
  const left = project(0, 0),
    right = project(5, 0),
    lowerLeft = project(0, 1.09),
    lowerRight = project(5, 1.09);
  const fill = ctx.createLinearGradient(0, top, 0, height);
  fill.addColorStop(0, "#13171b00");
  fill.addColorStop(0.3, "#14181cef");
  fill.addColorStop(1, "#1b2026");
  ctx.beginPath();
  ctx.moveTo(left.x, left.y);
  ctx.lineTo(right.x, right.y);
  ctx.lineTo(lowerRight.x, lowerRight.y);
  ctx.lineTo(lowerLeft.x, lowerLeft.y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.globalAlpha = highwayOpacity;
  ctx.fill();
  ctx.globalAlpha = 1;
  for (let lane = 0; lane <= 5; lane++)
    line(
      project(lane, 0),
      project(lane, 1.09),
      lane === 0 || lane === 5 ? "#b5b5b84d" : "#b5b5b818",
      lane === 0 || lane === 5 ? 2 : 1,
    );
  for (let i = 0; i < 14; i++) {
    const p = (i / 14 + Math.max(0, time) / 5) % 1;
    line(project(0, p), project(5, p), "#c9c8ba18");
  }
  line(project(0, 1), project(5, 1), "#eee8d5", 2);
  for (let i = game.cursor; i < game.notes.length; i++) {
    const note = game.notes[i],
      delta = note.time - time;
    if (delta > APPROACH) break;
    if (delta < -0.2 || game.results[i]) continue;
    const p = 1 - delta / APPROACH;
    for (const lane of note.lanes) {
      const point = project(lane + 0.5, p),
        w = width * 0.108 * point.depth,
        h = Math.max(3, 12 * point.depth);
      ctx.shadowColor = COLORS[lane];
      ctx.shadowBlur = preview ? 8 : 14;
      ctx.fillStyle = COLORS[lane];
      ctx.beginPath();
      ctx.roundRect(point.x - w / 2, point.y - h / 2, w, h, h / 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#fff8";
      ctx.fillRect(
        point.x - w * 0.3,
        point.y - h / 3,
        w * 0.6,
        Math.max(1, h / 5),
      );
    }
  }
  for (let lane = 0; lane < 5; lane++) {
    const point = project(lane + 0.5, 1),
      radius = Math.min(width * 0.04, 23);
    ctx.beginPath();
    ctx.ellipse(point.x, point.y, radius, radius * 0.52, 0, 0, Math.PI * 2);
    ctx.fillStyle = held[lane] ? COLORS[lane] : "#13191e";
    ctx.fill();
    ctx.strokeStyle = COLORS[lane];
    ctx.lineWidth = held[lane] ? 4 : 2;
    ctx.stroke();
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "#aaa";
    ctx.fillText(labels[lane], point.x, point.y + 39, width * 0.13);
  }
}

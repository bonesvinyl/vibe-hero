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
  const approach = game.approach || APPROACH;
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
  const gem = (point, lane, active = false) => {
    const r = width * 0.047 * point.depth;
    const ellipse = (y, rx, ry, color) => {
      ctx.beginPath(); ctx.ellipse(point.x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
    };
    ctx.shadowColor = active ? "#90f5ff" : COLORS[lane];
    ctx.shadowBlur = active ? 24 : preview ? 6 : 10;
    ellipse(point.y + r * 0.22, r * 1.12, r * 0.52, "#090d13");
    ellipse(point.y + r * 0.12, r * 1.04, r * 0.5, "#c2cad3");
    const shine = ctx.createLinearGradient(0, point.y - r * 0.6, 0, point.y + r * 0.35);
    shine.addColorStop(0, "#ffffff"); shine.addColorStop(0.28, active ? "#65eaff" : COLORS[lane]); shine.addColorStop(1, "#101620");
    ellipse(point.y - r * 0.12, r * 0.88, r * 0.55, shine);
    ctx.shadowBlur = 0;
    ellipse(point.y - r * 0.38, r * 0.45, r * 0.16, "#fff4de");
  };
  // Include scored sustains whose heads have already passed the cursor.
  const visible = new Set([...game.holds?.keys() || []]);
  for (let i = game.cursor; i < game.notes.length && game.notes[i].time - time <= approach; i++) visible.add(i);
  for (const i of [...visible].sort((a, b) => b - a)) {
    const note = game.notes[i], active = game.holds?.has(i), delta = note.time - time;
    if (!active && (delta < -0.2 || game.results[i])) continue;
    const p = active ? 1 : 1 - delta / approach;
    for (const lane of note.lanes) {
      if (note.duration > 0) {
        const tail = Math.max(0, Math.min(1, 1 - (note.time + note.duration - time) / approach));
        line(project(lane + 0.5, tail), project(lane + 0.5, p), active ? "#b8faff" : COLORS[lane], Math.max(3, width * 0.013));
        line(project(lane + 0.5, tail), project(lane + 0.5, p), "#ffffff99", 2);
      }
      gem(project(lane + 0.5, p), lane, active || time >= 0 && time < game.powerUntil);
    }
  }
  const sustaining = new Set([...game.holds?.keys() || []].flatMap(i => game.notes[i].lanes));
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  for (let lane = 0; lane < 5; lane++) {
    if (lane === 4 && game.difficulty === "easy") continue;
    const point = project(lane + 0.5, 1),
      radius = Math.min(width * 0.04, 23);
    ctx.beginPath();
    ctx.ellipse(point.x, point.y, radius, radius * 0.52, 0, 0, Math.PI * 2);
    ctx.fillStyle = held[lane] ? COLORS[lane] : "#13191e";
    ctx.fill();
    ctx.strokeStyle = COLORS[lane];
    ctx.lineWidth = held[lane] ? 4 : 2;
    ctx.stroke();
    if (held[lane]) gem(point, lane, true);
    const flame = sustaining.has(lane) ? 1 : Math.max(0, ((game.flames?.[lane] || -1) - time) / 0.32);
    if (flame > 0) {
      const powered = time >= 0 && time < game.powerUntil, h = radius * (reduced ? 1.3 : 3.2) * (0.65 + flame * 0.35);
      ctx.save(); ctx.globalAlpha = Math.min(1, flame); ctx.shadowColor = powered ? '#6ef4ff' : '#ffb62c'; ctx.shadowBlur = 22;
      const glow = ctx.createLinearGradient(0, point.y, 0, point.y - h);
      glow.addColorStop(0, '#fffce9'); glow.addColorStop(0.35, powered ? '#8bffff' : '#fff465'); glow.addColorStop(1, powered ? '#1facff00' : '#ff670000');
      ctx.fillStyle = glow;
      for (let tongue = -1; tongue <= 1; tongue++) {
        const sway = reduced ? 0 : Math.sin(time * 23 + lane * 2 + tongue) * radius * 0.22;
        const x = point.x + tongue * radius * 0.45, tip = h * (tongue ? 0.7 : 1);
        ctx.beginPath(); ctx.moveTo(x - radius * 0.6, point.y);
        ctx.quadraticCurveTo(x - radius, point.y - tip * 0.6, x + sway, point.y - tip);
        ctx.quadraticCurveTo(x + radius, point.y - tip * 0.45, x + radius * 0.6, point.y);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
    ctx.font = "14px BarlowCondensed, monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "#aaa";
    ctx.fillText(labels[lane], point.x, point.y + 39, width * 0.13);
  }
}

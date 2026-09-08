export const COLORS = ["#86e5a3", "#ef777c", "#f5d776", "#76b8f5", "#eda367"];
export const KEYS = ["KeyA", "KeyS", "KeyD", "KeyF", "KeyG"];
export const WINDOW = 0.14;
export const PERFECT = 0.055;
export const APPROACH = 2.4;

export function youtubeId(value) {
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol)) return null;
    const host = url.hostname.replace(/^www\./, "");
    let id;
    if (host === "youtu.be") id = url.pathname.slice(1);
    else if (
      ["youtube.com", "m.youtube.com", "youtube-nocookie.com"].includes(host)
    ) {
      id =
        url.pathname === "/watch"
          ? url.searchParams.get("v")
          : /^\/(?:embed|shorts|live)\/([^/]+)$/.exec(url.pathname)?.[1];
    }
    return /^[\w-]{11}$/.test(id || "") ? id : null;
  } catch {
    return null;
  }
}

// Explicitly a practice grid: a YouTube iframe does not expose decoded audio.
export function practiceChart(
  duration,
  bpm,
  firstBeat = 0,
  difficulty = "medium",
) {
  if (
    ![duration, bpm, firstBeat].every(Number.isFinite) ||
    bpm < 40 ||
    bpm > 240 ||
    duration <= 0 ||
    duration > 1200
  )
    throw new Error("Use 40–240 BPM and a track under 20 minutes.");
  const step =
    (60 / bpm) *
    (difficulty === "easy" ? 2 : difficulty === "expert" ? 0.5 : 1);
  const pattern = [0, 1, 2, 1, 3, 2, 4, 2, 0, 2, 3, 4, 3, 1, 2, 1];
  const notes = [];
  for (
    let t = Math.max(0, firstBeat), i = 0;
    t < duration - 0.15;
    t += step, i++
  )
    {
      const lane = pattern[i % pattern.length];
      const lanes = difficulty === "expert" && i % 8 === 4 ? [0, 2, 4] : difficulty !== "easy" && i % 4 === 3 ? [lane, (lane + 2) % 5].sort() : [lane];
      notes.push({ time: +t.toFixed(4), lanes, ...(i % 8 === 6 ? { duration: Math.min(step * 0.7, duration - t - 0.15) } : {}) });
    }
  return notes;
}

export function validateChart(value, duration) {
  if (
    value?.version !== 1 ||
    !Array.isArray(value.notes) ||
    !value.notes.length ||
    value.notes.length > 20000
  )
    throw new Error("Expected a version 1 chart with 1–20,000 notes.");
  let previous = -1;
  const ends = Array(5).fill(-1);
  return value.notes.map((note) => {
    if (
      !Number.isFinite(note.time) ||
      note.time < 0 ||
      note.time >= duration ||
      note.time - previous < 0.04
    )
      throw new Error(
        "Chart times must increase, be at least 40 ms apart, and fit this track.",
      );
    if (
      !Array.isArray(note.lanes) ||
      !note.lanes.length ||
      note.lanes.length > 5 ||
      new Set(note.lanes).size !== note.lanes.length ||
      note.lanes.some((l) => !Number.isInteger(l) || l < 0 || l > 4)
    )
      throw new Error("Each note needs unique lanes from 0 through 4.");
    if (note.duration !== undefined && (!Number.isFinite(note.duration) || note.duration < 0 || note.time + note.duration > duration))
      throw new Error("Hold duration must be nonnegative and fit this track.");
    if (note.lanes.some(lane => ends[lane] > note.time)) throw new Error("A fret cannot overlap its previous hold.");
    for (const lane of note.lanes) ends[lane] = note.time + (note.duration || 0);
    previous = note.time;
    return { time: note.time, lanes: [...note.lanes].sort(), ...(note.duration > 0 ? { duration: note.duration } : {}) };
  });
}

// Apply accessibility/difficulty to every source, including older saved charts.
export function arrangeNotes(notes, difficulty, chords = true) {
  const spacing = { easy: 0.8, medium: 0.42, expert: 0 }[difficulty] ?? 0;
  const arranged = [];
  for (const note of notes) {
    if (arranged.length && note.time - arranged.at(-1).time < spacing) continue;
    let lanes = [...new Set(note.lanes.map(lane => difficulty === 'easy' ? Math.min(3, lane) : lane))];
    if (!chords || difficulty === 'easy') lanes = [lanes[Math.floor(lanes.length / 2)]];
    else if (difficulty === 'medium') lanes = lanes.slice(0, 2);
    arranged.push({ ...note, lanes });
  }
  // Remapping orange to blue must not create overlapping held frets.
  const nextTimes = Array(5).fill(Infinity);
  for (let i = arranged.length - 1; i >= 0; i--) {
    const note = arranged[i];
    if (note.duration) note.duration = Math.max(0, Math.min(note.duration, ...note.lanes.map(l => nextTimes[l] - note.time - 0.04)));
    note.lanes.forEach(l => { nextTimes[l] = note.time; });
  }
  return arranged;
}

export class Game {
  constructor(notes, chords = true, difficulty = null) {
    this.difficulty = difficulty;
    this.approach = { easy: 4.5, medium: 3.4, expert: 2.4 }[difficulty] || APPROACH;
    this.window = difficulty === "easy" ? 0.22 : difficulty === "medium" ? 0.18 : WINDOW;
    this.notes = arrangeNotes(notes, difficulty, chords);
    this.reset();
  }
  reset(time = -2) {
    this.results = this.notes.map((n) =>
      n.time < time - this.window ? "skipped" : null,
    );
    this.flames = Array(5).fill(-1);
    this.partial = new Map();
    this.holds = new Map();
    this.score = 0;
    this.combo = 0;
    this.best = 0;
    this.hits = 0;
    this.misses = 0;
    this.feedback = "";
    this.milestone = 0; this.milestoneUntil = -1;
    this.feedbackUntil = 0;
    this.lastTime = time;
    this.cursor = 0;
    this.rock = 70; this.failed = false; this.eligible = time <= 0;
    this.energy = 0;
    this.powerUntil = -1;
  }
  update(time) {
    if (this.failed) return;
    // Seeking starts a fresh attempt; rewinding can never farm a scored note.
    if (time < this.lastTime - 0.25 || time > this.lastTime + 1)
      { const wasStarted = this.lastTime >= 0; this.reset(time); this.eligible = !wasStarted && time <= 0; }
    this.lastTime = time;
    while (
      this.cursor < this.notes.length &&
      this.notes[this.cursor].time < time - this.window
    ) {
      if (!this.results[this.cursor]) {
        this.results[this.cursor] = "miss";
        this.misses++;
        this.rock = Math.max(0, this.rock - (this.difficulty === "easy" ? 5 : 7));
        if (!this.rock) { this.failed = true; this.holds.clear(); this.powerUntil = -1; }
        this.combo = 0;
        this.feedback = "Miss";
        this.feedbackUntil = time + 0.5;
      }
      this.partial.delete(this.cursor++);
    }
  }
  hit(lanes, time, strum = false) {
    this.update(time);
    if (this.failed) return false;
    const candidates = [];
    for (
      let i = this.cursor;
      i < this.notes.length && this.notes[i].time <= time + this.window;
      i++
    ) {
      if (
        !this.results[i] &&
        (strum || lanes.some((l) => this.notes[i].lanes.includes(l)))
      )
        candidates.push(i);
    }
    candidates.sort(
      (a, b) =>
        Math.abs(this.notes[a].time - time) -
        Math.abs(this.notes[b].time - time),
    );
    const index = candidates[0];
    if (index === undefined) {
      if (strum && time >= 0) this.combo = 0;
      return false;
    }
    const note = this.notes[index];
    if (
      strum &&
      (lanes.length !== note.lanes.length ||
        !note.lanes.every((l) => lanes.includes(l)))
    ) {
      this.combo = 0;
      return false;
    }
    const held = this.partial.get(index) || new Set();
    lanes.filter((l) => note.lanes.includes(l)).forEach((l) => held.add(l));
    this.partial.set(index, held);
    if (!note.lanes.every((l) => held.has(l))) return false;
    const perfect = Math.abs(note.time - time) <= PERFECT;
    this.results[index] = perfect ? "perfect" : "good";
    this.partial.delete(index);
    if (note.duration > 0) this.holds.set(index, { until: note.time + note.duration, last: Math.max(time, note.time) });
    this.combo++;
    this.best = Math.max(this.best, this.combo);
    if (this.combo % 50 === 0) { this.milestone = this.combo; this.milestoneUntil = time + 1.4; }
    for (const lane of note.lanes) this.flames[lane] = time + 0.32;
    this.hits++;
    this.rock = Math.min(100, this.rock + 2);
    this.score +=
      (perfect ? 100 : 60) * this.multiplier * (time < this.powerUntil ? 2 : 1);
    this.energy = Math.min(100, this.energy + 4);
    this.feedback = perfect ? "Perfect" : "Good";
    this.feedbackUntil = time + 0.5;
    return true;
  }
  updateHolds(time, held) {
    if (this.failed) return;
    for (const partial of this.partial.values()) for (const lane of partial) if (!held[lane]) partial.delete(lane);
    for (const [index, hold] of this.holds) {
      if (time < hold.until && !this.notes[index].lanes.every(lane => held[lane])) {
        this.holds.delete(index);
        this.combo = 0;
        this.feedback = "Hold released";
        this.feedbackUntil = time + 0.5;
        continue;
      }
      const end = Math.min(time, hold.until);
      const ticks = Math.max(0, Math.floor((end - hold.last + 1e-8) / 0.1));
      this.score += ticks * 5 * this.multiplier * (time < this.powerUntil ? 2 : 1);
      hold.last += ticks * 0.1;
      if (time >= hold.until) this.holds.delete(index);
    }
  }
  activate(time) {
    if (!this.failed && this.energy >= 100 && time >= 0 && time >= this.powerUntil) {
      this.energy = 0;
      this.powerUntil = time + 8;
    }
  }
  get multiplier() {
    return Math.min(4, 1 + Math.floor(this.combo / 10));
  }
  get accuracy() {
    return this.hits + this.misses
      ? Math.round((100 * this.hits) / (this.hits + this.misses))
      : 0;
  }
}

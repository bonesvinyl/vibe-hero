import { KEYS } from "./chart.js";
export const ACTIONS = [
  "Green",
  "Red",
  "Yellow",
  "Blue",
  "Orange",
  "Strum up",
  "Strum down",
  "Pause",
  "Star power",
];
export const DEFAULT_BINDINGS = [
  ...KEYS.map((code) => ({ type: "key", code })),
  { type: "key", code: "ArrowUp" },
  { type: "key", code: "ArrowDown" },
  { type: "key", code: "Enter" },
  { type: "key", code: "Space" },
];
export function readStored(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
export function writeStored(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
export function loadBindings() {
  const saved = readStored("vh.bindings.v2", null);
  return Array.isArray(saved) &&
    saved.length === 9 &&
    saved.every(
      (b) =>
        b &&
        (b.type === "key"
          ? typeof b.code === "string"
          : ["button", "axis"].includes(b.type) &&
            Number.isInteger(b.index) &&
            b.index >= 0 &&
            typeof b.device === "string" &&
            (b.type !== "axis" || [-1, 1].includes(b.direction))),
    )
    ? saved
    : DEFAULT_BINDINGS;
}
export function bindingLabel(binding) {
  if (binding.type === "key")
    return binding.code.replace("Key", "").replace("Arrow", "");
  return binding.type === "button"
    ? `Button ${binding.index}`
    : `Axis ${binding.index} ${binding.direction > 0 ? "+" : "−"}`;
}
export function down(binding, keys, pads) {
  if (binding.type === "key") return keys.has(binding.code);
  const pad = pads.find((p) => p.id === binding.device);
  if (!pad) return false;
  return binding.type === "button"
    ? !!pad.buttons[binding.index]?.pressed
    : (pad.axes[binding.index] || 0) * binding.direction > 0.65;
}
export function gamepads() {
  try {
    return Array.from(navigator.getGamepads?.() || []).filter(Boolean);
  } catch {
    return [];
  }
}

export function listenInput(bindings, onInput, onDisconnect) {
  const keys = new Set();
  let previous = [],
    previousDevices = [],
    frame;
  const emit = () => {
    const pads = gamepads();
    const current = bindings.map((b) => down(b, keys, pads));
    onInput(
      current,
      current.map((value, i) => value && !previous[i]),
    );
    previous = current;
    return pads;
  };
  // Keyboard edges are judged immediately, including taps shorter than one frame.
  const keydown = (event) => {
    if (
      event.target instanceof HTMLElement &&
      /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)
    )
      return;
    if (bindings.some((b) => b.type === "key" && b.code === event.code))
      event.preventDefault();
    if (!keys.has(event.code)) {
      keys.add(event.code);
      emit();
    }
  };
  const keyup = (event) => {
    keys.delete(event.code);
    emit();
  };
  const blur = () => {
    keys.clear();
    previous = [];
    onDisconnect?.();
  };
  const poll = () => {
    const pads = emit(),
      devices = pads.map((p) => p.id);
    if (previousDevices.some((id) => !devices.includes(id))) onDisconnect?.();
    previousDevices = devices;
    frame = requestAnimationFrame(poll);
  };
  window.addEventListener("keydown", keydown);
  window.addEventListener("keyup", keyup);
  window.addEventListener("blur", blur);
  frame = requestAnimationFrame(poll);
  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener("keydown", keydown);
    window.removeEventListener("keyup", keyup);
    window.removeEventListener("blur", blur);
  };
}

import { useEffect, useRef, useState } from "react";
import {
  ACTIONS,
  DEFAULT_BINDINGS,
  bindingLabel,
  gamepads,
  listenInput,
  writeStored,
} from "../game/controller";
import { COLORS } from "../game/chart";

export default function Controllers({ bindings, onChange, onClose }) {
  const [active, setActive] = useState([]),
    [devices, setDevices] = useState([]),
    [learning, setLearning] = useState(null),
    [notice, setNotice] = useState("");
  const dialog = useRef(null);
  useEffect(() => {
    const node = dialog.current;
    node.showModal();
    return () => node.close();
  }, []);
  useEffect(
    () =>
      listenInput(bindings, (values) =>
        setActive((old) => (old.join() === values.join() ? old : values)),
      ),
    [bindings],
  );
  useEffect(() => {
    const timer = setInterval(
      () => setDevices(gamepads().map((p) => p.id)),
      500,
    );
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (learning === null) return;
    let previous = new Set(),
      initialized = false,
      done = false,
      frame;
    const save = (binding) => {
      if (done) return;
      done = true;
      const next = bindings.map((b, i) => (i === learning ? binding : b));
      const duplicate = next.findIndex(
        (b, i) =>
          i !== learning && JSON.stringify(b) === JSON.stringify(binding),
      );
      if (duplicate >= 0) {
        setNotice(
          `Already assigned to ${ACTIONS[duplicate]}. Choose a different input.`,
        );
        setLearning(null);
        return;
      }
      onChange(next);
      setLearning(null);
      setNotice(
        writeStored("vh.bindings.v2", next)
          ? "Mapping saved on this Mac."
          : "Mapped for this session. Browser storage is unavailable.",
      );
    };
    const key = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.code === "Escape") setLearning(null);
      else if (!event.repeat) save({ type: "key", code: event.code });
    };
    const poll = () => {
      const now = new Set();
      for (const pad of gamepads()) {
        pad.buttons.forEach((button, index) => {
          if (button.pressed)
            now.add(JSON.stringify({ type: "button", device: pad.id, index }));
        });
        pad.axes.forEach((value, index) => {
          if (Math.abs(value) > 0.65 && Math.abs(value) <= 1.01)
            now.add(
              JSON.stringify({
                type: "axis",
                device: pad.id,
                index,
                direction: Math.sign(value),
              }),
            );
        });
      }
      if (initialized)
        for (const value of now)
          if (!previous.has(value)) {
            save(JSON.parse(value));
            break;
          }
      initialized = true;
      previous = now;
      frame = requestAnimationFrame(poll);
    };
    window.addEventListener("keydown", key, true);
    frame = requestAnimationFrame(poll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", key, true);
    };
  }, [learning, bindings, onChange]);

  return (
    <dialog
      ref={dialog}
      className="setup-dialog"
      onCancel={onClose}
      aria-labelledby="controller-title"
    >
      <div className="section-heading">
        <span className="eyebrow">SOUNDCHECK / INPUT</span>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close controller setup"
        >
          ×
        </button>
      </div>
      <h2 id="controller-title">Plug in. Tune up.</h2>
      <p>
        Map your guitar, gamepad, or keyboard. Select a control, release it,
        then press the input you want to use.
      </p>
      <div className="device-status">
        <i
          className={devices.length ? "status-light connected" : "status-light"}
        />
        <span>
          {devices.length
            ? devices.join(" · ")
            : "No gamepad detected. Press a button on your connected controller."}
        </span>
      </div>
      <div className="mapping-grid">
        {ACTIONS.map((action, index) => (
          <button
            className={`mapping ${active[index] ? "pressed" : ""} ${learning === index ? "learning" : ""}`}
            key={action}
            onClick={() => {
              setNotice("");
              setLearning(index);
            }}
            style={{ "--lane": COLORS[index] || "#d5d0bf" }}
          >
            <span>{action}</span>
            <kbd>
              {learning === index
                ? "Press an input…"
                : bindingLabel(bindings[index])}
            </kbd>
          </button>
        ))}
      </div>
      <p className="small" role="status">
        {learning !== null
          ? "Listening. Escape cancels. Release analog controls before mapping."
          : notice ||
            "The controls above light up when their mapped input is held."}
      </p>
      <details open>
        <summary>Your Wii Remote + guitar</summary>
        <p>
          The browser needs the guitar exposed as a gamepad.{" "}
          <a
            href="https://github.com/WiiController/WiiController"
            target="_blank"
            rel="noreferrer"
          >
            WiiController
          </a>{" "}
          advertises wireless Guitar Hero 3 support, but its latest release was
          tested only through macOS 11.4. Compatibility with newer macOS is
          unverified.
        </p>
        <p>
          With a compatible helper running, connect the guitar to the Wii
          Remote, pair through the helper, then return here and press a fret.
          Map all five frets and both strum directions. Choose{" "}
          <strong>Guitar / strum</strong> in the song setup.
        </p>
        <p className="small">
          If wireless pairing fails, a compatible Wii-to-USB adapter is an
          alternative. This page cannot pair a Wii Remote through the browser
          alone.
        </p>
      </details>
      <div className="dialog-footer">
        <button
          onClick={() => {
            onChange(DEFAULT_BINDINGS);
            writeStored("vh.bindings.v2", DEFAULT_BINDINGS);
            setLearning(null);
          }}
        >
          Reset to keyboard
        </button>
        <button className="primary" onClick={onClose}>
          Done ↗
        </button>
      </div>
    </dialog>
  );
}

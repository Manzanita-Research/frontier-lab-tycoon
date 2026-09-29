import { useEffect } from "react";
import { eventById } from "../content/events";
import { fillTemplate } from "../sim/format";
import { useStore } from "../store";

const TONE_LABEL = { bad: "Breaking", joke: "Developing", good: "Good news", neutral: "Update" } as const;

/** A modal event card. The game is paused while it is open; keys 1 to 3 pick a choice. */
export function EventCard() {
  const open = useStore((s) => s.snap.event);
  const labName = useStore((s) => s.snap.labName);
  const choose = useStore((s) => s.chooseEvent);
  const def = open ? eventById(open.id) : undefined;

  useEffect(() => {
    if (!def) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= def.choices.length) {
        e.preventDefault();
        choose(n - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [def, choose]);

  if (!open || !def) return null;
  return (
    <div className="modal-backdrop">
      <div className={`modal-card event-card tone-${def.tone}`} role="dialog" aria-modal="true" aria-label={def.title}>
        <div className="card-stripe">
          <span>{TONE_LABEL[def.tone]}</span>
          <span className="paused">Paused</span>
        </div>
        <div className="card-body">
          <h2>{def.title}</h2>
          <p>{fillTemplate(def.body, { lab: labName })}</p>
          <div className="choices">
            {def.choices.map((c, i) => (
              <button key={c.label} className="choice" onClick={() => choose(i)}>
                <span className="choice-key">{i + 1}</span>
                <span className="choice-text">
                  <b>{c.label}</b>
                  <span className="choice-hint">{c.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

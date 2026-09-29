import { useEffect } from "react";
import { ERAS } from "../../content/eras";
import type { EventDef } from "../../content/events";
import { fillTemplate } from "../../sim/format";
import { send } from "../../app/game";

/**
 * The era title card: the whole screen, a slam-in number and name, one line, and what changes. It is an ordinary
 * event card underneath (the game is paused until you press the button; 1, Enter and Space all work).
 */
export function EraCard({ def, vars }: { def: EventDef; vars: Record<string, string> }) {
  const n = Number(def.id.replace("era", ""));
  const era = ERAS[n - 1]!;
  const go = () => send({ type: "CHOOSE", choiceIndex: 0 });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // (the plain event card already answers to 1)
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        go();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className={`modal-backdrop era-backdrop era-${n}`}>
      <div className="era-rays" aria-hidden="true" />
      <div className="era-card" role="dialog" aria-modal="true" aria-label={def.title}>
        <div className="era-kicker">{def.stripe}</div>
        <div className="era-num" aria-hidden="true">
          {n}
        </div>
        <h2 className="era-title">
          {era.name.split(" ").map((word, i) => (
            <span key={i} style={{ animationDelay: `${0.35 + i * 0.12}s` }}>
              {word}
            </span>
          ))}
        </h2>
        <p className="era-line">{fillTemplate(def.body, vars)}</p>
        <ul className="era-changes">
          {era.changes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <div className="era-dots" aria-label={`Era ${n} of 4`}>
          {ERAS.map((e) => (
            <i key={e.n} className={e.n <= n ? "on" : ""} />
          ))}
        </div>
        <button className="era-go" onClick={go}>
          {def.choices[0]!.label} <span className="era-key">1</span>
        </button>
      </div>
    </div>
  );
}

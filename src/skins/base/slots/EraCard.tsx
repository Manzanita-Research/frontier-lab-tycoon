import type { SlotPropsMap } from "../../types";

/**
 * The era title card: the whole screen, a slam-in number and name, one line, and what changes. It is an ordinary
 * event card underneath (the game is paused until you press the button; the game handles Enter, Space and 1).
 */
export function EraCard({ era, actions }: SlotPropsMap["EraCard"]) {
  return (
    <div className={`modal-backdrop era-backdrop era-${era.n}`}>
      <div className="era-rays" aria-hidden="true" />
      <div className="era-card" role="dialog" aria-modal="true" aria-label={era.name}>
        <div className="era-kicker">{era.kicker}</div>
        <div className="era-num" aria-hidden="true">
          {era.n}
        </div>
        <h2 className="era-title">
          {era.name.split(" ").map((word, i) => (
            <span key={i} style={{ animationDelay: `${0.35 + i * 0.12}s` }}>
              {word}
            </span>
          ))}
        </h2>
        <p className="era-line">{era.line}</p>
        <ul className="era-changes">
          {era.changes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <div className="era-dots" aria-label={`Era ${era.n} of ${era.total}`}>
          {Array.from({ length: era.total }, (_, i) => (
            <i key={i} className={i + 1 <= era.n ? "on" : ""} />
          ))}
        </div>
        <button className="era-go" onClick={() => actions.continueEra()}>
          {era.continueLabel} <span className="era-key">1</span>
        </button>
      </div>
    </div>
  );
}

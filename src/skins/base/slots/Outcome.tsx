import { useT } from "../../context";
import type { SlotPropsMap } from "../../types";

/** The win / loss card: a parody headline, the stats, and the way on. */
export function Outcome({ outcome, actions }: SlotPropsMap["Outcome"]) {
  const t = useT();
  return (
    <div className="modal-backdrop">
      <div className={`modal-card outcome-card ${outcome.won ? "tone-good" : "tone-bad"}`} role="dialog" aria-modal="true" aria-label={outcome.won ? "You won" : "Game over"}>
        <div className="card-stripe">
          <span>{outcome.stripe}</span>
          <span className="paused">{outcome.date}</span>
        </div>
        <div className="card-body">
          <h2>{outcome.headline}</h2>
          <dl className="stats">
            {outcome.stats.map((s) => (
              <div key={s.label}>
                <dt>{s.label}</dt>
                <dd className={s.bad ? "bad" : ""}>{s.text}</dd>
              </div>
            ))}
          </dl>
          <p className="outcome-note">{outcome.note}</p>
          <div className="outcome-buttons">
            {outcome.won && (
              <button className="choice plain" onClick={() => actions.keepPlaying()}>
                <b>{t("outcome.keepPlaying")}</b>
              </button>
            )}
            <button className="choice plain primary" onClick={() => actions.newLab()}>
              <b>{t("outcome.newLab")}</b>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

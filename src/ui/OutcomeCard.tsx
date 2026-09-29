import { SCENARIO } from "../content/goals";
import { fillTemplate, formatDate, formatMoney } from "../sim/format";
import { useStore } from "../store";

/** The win / loss card: a parody headline, the stats, and the way on. */
export function OutcomeCard() {
  const s = useStore((st) => st.snap);
  const dismissed = useStore((st) => st.outcomeDismissed);
  const keepPlaying = useStore((st) => st.keepPlaying);
  const newLab = useStore((st) => st.newLab);
  if (s.outcome === "playing" || dismissed) return null;
  const won = s.outcome === "won";
  const headline = fillTemplate(won ? SCENARIO.winHeadline : SCENARIO.loseHeadline, { lab: s.labName });
  const met = s.goals.filter((g) => g.met).length;
  return (
    <div className="modal-backdrop">
      <div className={`modal-card outcome-card ${won ? "tone-good" : "tone-bad"}`} role="dialog" aria-modal="true" aria-label={won ? "You won" : "Game over"}>
        <div className="card-stripe">
          <span>{won ? "Scenario complete" : "Game over"}</span>
          <span className="paused">{formatDate(s.day)}</span>
        </div>
        <div className="card-body">
          <h2>{headline}</h2>
          <dl className="stats">
            <div>
              <dt>Day</dt>
              <dd>{s.day}</dd>
            </div>
            <div>
              <dt>Cash</dt>
              <dd className={s.cash < 0 ? "bad" : ""}>{formatMoney(s.cash)}</dd>
            </div>
            <div>
              <dt>Revenue</dt>
              <dd>{formatMoney(s.income)}/day</dd>
            </div>
            <div>
              <dt>Capability</dt>
              <dd>{Math.round(s.capability)}</dd>
            </div>
            <div>
              <dt>Hype</dt>
              <dd>{Math.round(s.hype)}</dd>
            </div>
            <div>
              <dt>Models</dt>
              <dd>{s.models}</dd>
            </div>
          </dl>
          <p className="outcome-note">{won ? "All three milestones met." : `${met} of ${s.goals.length} milestones met.`}</p>
          <div className="outcome-buttons">
            {won && (
              <button className="choice plain" onClick={keepPlaying}>
                <b>Keep playing</b>
              </button>
            )}
            <button className="choice plain primary" onClick={newLab}>
              <b>New lab</b>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

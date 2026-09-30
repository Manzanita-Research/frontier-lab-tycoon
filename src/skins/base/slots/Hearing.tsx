import { Senator, useT } from "../../kit";
import type { HearingVM } from "../../../ui/hud/types";
import type { SlotPropsMap } from "../../types";

/** Trust and Capture, side by side: two bars and their numbers. */
export function HearingMeters({ hearing }: { hearing: HearingVM }) {
  return (
    <div className="hearing-meters">
      {[hearing.trust, hearing.capture].map((m, i) => (
        <div key={m.label} className={`hearing-meter ${i === 0 ? "trust" : "capture"}`}>
          <span className="hm-label">{m.label}</span>
          <span className="hm-bar" role="meter" aria-label={m.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(m.value)}>
            <i style={{ width: `${Math.max(0, Math.min(100, m.value))}%` }} />
          </span>
          <b className="hm-num">{m.text}</b>
        </div>
      ))}
    </div>
  );
}

/** The dais: three capsule portraits behind their name plates; the one asking leans in, the ones answered get a sticker. */
export function Dais({ hearing }: { hearing: HearingVM }) {
  return (
    <div className="hearing-dais">
      {hearing.senators.map((s) => (
        <figure key={s.id} className={`senator ${s.asking ? "asking" : ""}`}>
          <Senator who={s} className="senator-portrait" />
          {s.answered && <span className={`senator-sticker a-${s.answered}`}>{s.answered}</span>}
          <figcaption className="nameplate">
            <b>{s.name}</b>
            <small>{s.seat}</small>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

/** A senate hearing: the question is on the table, the answers say what they would move. At the end, the gavel. */
export function Hearing({ event, hearing, actions }: SlotPropsMap["Hearing"]) {
  const t = useT();
  return (
    <div className="modal-backdrop">
      <div className={`modal-card event-card hearing-card ${hearing.verdict ? `verdict-${hearing.verdict.id}` : ""}`} role="dialog" aria-modal="true" aria-label={event.title}>
        <div className="card-stripe">
          <span>{event.stripe}</span>
          <span className="hearing-progress">{hearing.progressText}</span>
          <span className="paused">{t("event.paused")}</span>
        </div>
        <div className="card-body">
          {hearing.topic && <p className="hearing-topic">{hearing.topic}</p>}
          <Dais hearing={hearing} />
          {hearing.verdict ? (
            <div className="hearing-verdict">
              <span className="gavel" aria-hidden>
                🔨
              </span>
              <h2>{hearing.verdict.title}</h2>
              <p>{hearing.verdict.line}</p>
            </div>
          ) : (
            <div className="hearing-question">
              {hearing.asking && <span className="asker">{hearing.asking.name}:</span>}
              <h2>{event.title}</h2>
              <p>{event.body}</p>
            </div>
          )}
          <HearingMeters hearing={hearing} />
          <div className="choices">
            {event.choices.map((c, i) => {
              const a = hearing.answers[i];
              return (
                <button key={c.label} className={`choice hearing-answer ${a ? `a-${a.style}` : ""}`} onClick={() => actions.choose(event.id, i)}>
                  <span className="choice-key">{c.key}</span>
                  <span className="choice-text">
                    <b>{c.label}</b>
                    <span className="choice-hint">
                      {c.hint}
                      {a?.moves.map((m) => (
                        <span key={m.meter} className={`move ${m.good === null ? "sly" : m.good ? "up" : "down"}`}>
                          {m.label} {m.arrows}
                        </span>
                      ))}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

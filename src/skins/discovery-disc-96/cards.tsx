// The full-screen cards: the news card as a worksheet with a red ribbon title and "circle one answer", the new-era
// card as a certificate with a gold medal, and the win / lose card as a diploma.
import { useT } from "../context";
import type { SlotPropsMap } from "../types";
import { burstPoints, Icon, Robot, StarIcon } from "./art";

const MEDAL = burstPoints(16, 49, 41);

function Ribbon({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`dd-rtitle ${className}`}>
      <h2>{children}</h2>
    </div>
  );
}

export function EventCard({ event, actions }: SlotPropsMap["EventCard"]) {
  const t = useT();
  return (
    <div className="dd-backdrop">
      <div className={`dd-worksheet tone-${event.tone}`} role="dialog" aria-modal="true" aria-label={event.title}>
        <div className="dd-ws-head">
          <span className="dd-stripe">{event.stripe}</span>
          <span className="dd-paused">{t("event.paused")}</span>
        </div>
        <Ribbon>{event.title}</Ribbon>
        <div className="dd-ws-body">
          <p>{event.body}</p>
          {event.kind === "auction" && (
            <ul className="dd-paddles" aria-label="Bidders">
              {event.paddles.map((p) => (
                <li key={p.id} style={{ ["--paddle" as string]: p.color }}>
                  <span className="num">{p.number}</span>
                  {p.name}
                </li>
              ))}
            </ul>
          )}
          <div className="dd-circle-one">Circle one answer:</div>
          <div className="dd-answers">
            {event.choices.map((c, i) => (
              <button key={c.label} type="button" className={`dd-answer a${i % 3}`} onClick={() => actions.choose(event.id, i)}>
                <span className="dd-letter">{c.key}</span>
                <span className="dd-answer-text">
                  <b>{c.label}</b>
                  <small>{c.hint}</small>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function EraCard({ era, actions }: SlotPropsMap["EraCard"]) {
  return (
    <div className={`dd-backdrop dd-era dd-era-${era.n}`}>
      <div className="dd-rays" aria-hidden />
      <div className="dd-cert" role="dialog" aria-modal="true" aria-label={era.name}>
        <div className="dd-kicker">{era.kicker}</div>
        <div className="dd-medal" aria-hidden>
          <svg viewBox="-2 -2 104 104">
            <polygon points={MEDAL} />
          </svg>
          <span>{era.n}</span>
        </div>
        <Ribbon className="era">{era.name}</Ribbon>
        <p className="dd-era-line">{era.line}</p>
        <ul className="dd-unlocks">
          {era.changes.map((c) => (
            <li key={c}>
              <StarIcon on size={22} /> {c}
            </li>
          ))}
        </ul>
        <div className="dd-levels" aria-label={`Era ${era.n} of ${era.total}`}>
          {Array.from({ length: era.total }, (_, i) => (
            <StarIcon key={i} on={i + 1 <= era.n} size={26} />
          ))}
        </div>
        <button type="button" className="dd-continue" onClick={() => actions.continueEra()}>
          {era.continueLabel} <span className="dd-key">1</span>
        </button>
      </div>
    </div>
  );
}

export function Outcome({ outcome, actions }: SlotPropsMap["Outcome"]) {
  const t = useT();
  return (
    <div className="dd-backdrop">
      <div className={`dd-cert dd-outcome ${outcome.won ? "won" : "lost"}`} role="dialog" aria-modal="true" aria-label={outcome.won ? "You won" : "Game over"}>
        <div className="dd-ws-head">
          <span className="dd-stripe">{outcome.stripe}</span>
          <span className="dd-paused">{outcome.date}</span>
        </div>
        <div className="dd-outcome-stars" aria-hidden>
          {[0, 1, 2].map((i) => (
            <StarIcon key={i} on={outcome.won} size={i === 1 ? 64 : 46} />
          ))}
        </div>
        <Ribbon className={outcome.won ? "won" : "lost"}>{outcome.headline}</Ribbon>
        <dl className="dd-report">
          {outcome.stats.map((s) => (
            <div key={s.label}>
              <dt>{s.label}</dt>
              <dd className={s.bad ? "bad" : ""}>{s.text}</dd>
            </div>
          ))}
        </dl>
        <p className="dd-note">
          <Robot mood={outcome.won ? "cheer" : "oops"} className="dd-note-bot" />
          <span>{outcome.note}</span>
        </p>
        <div className="dd-outcome-buttons">
          {outcome.won && (
            <button type="button" className="dd-continue plain" onClick={() => actions.keepPlaying()}>
              {t("outcome.keepPlaying")}
            </button>
          )}
          <button type="button" className="dd-continue" onClick={() => actions.newLab()}>
            <Icon name="play" size={16} /> {t("outcome.newLab")}
          </button>
        </div>
      </div>
    </div>
  );
}

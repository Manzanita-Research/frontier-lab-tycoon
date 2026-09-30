// The full-screen cards: the news card (a screen in a plastic frame, the answers as round arcade buttons), the new-era
// card (the stage lights come up on a big number) and the win / lose card (the scoreboard).
import { Fragment } from "react";
import { useT } from "../context";
import type { SlotPropsMap } from "../types";
import { D, Note, Notes, Star, Tape } from "./art";

const KEY_COLOURS = ["#FF5FA2", "#4FE3FF", "#FFE45C"];

export function EventCard({ event, actions }: SlotPropsMap["EventCard"]) {
  const t = useT();
  return (
    <div className="kn-backdrop">
      <div className={`kn-event kn-plastic tone-${event.tone}`} role="dialog" aria-modal="true" aria-label={event.title}>
        <div className="kn-screen">
          <div className="kn-event-head">
            <span className="kn-stripe">
              <Notes /> {event.stripe}
            </span>
            <span className="kn-paused">{t("event.paused")}</span>
          </div>
          <h2 className="kn-event-title">
            <D>{event.title}</D>
          </h2>
          <p className="kn-event-body">{event.body}</p>
          {event.kind === "auction" && (
            <ul className="kn-paddles" aria-label="Bidders">
              {event.paddles.map((p) => (
                <li key={p.id} style={{ ["--paddle" as string]: p.color }}>
                  <span className="kn-paddle-n">
                    <D>{String(p.number)}</D>
                  </span>
                  {p.name}
                </li>
              ))}
            </ul>
          )}
          <div className="kn-choices">
            {event.choices.map((c, i) => (
              <button key={c.label} type="button" className="kn-choice" style={{ ["--c" as string]: KEY_COLOURS[i % KEY_COLOURS.length] }} onClick={() => actions.choose(event.id, i)}>
                <span className="kn-choice-key">{c.key}</span>
                <span className="kn-choice-text">
                  <b>{c.label}</b>
                  <small>
                    <D>{c.hint}</D>
                  </small>
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
    <div className={`kn-backdrop kn-era kn-era-${era.n}`}>
      <div className="kn-beams" aria-hidden />
      <div className="kn-era-card kn-plastic" role="dialog" aria-modal="true" aria-label={era.name}>
        <div className="kn-screen">
          <div className="kn-era-kicker">
            <Star /> {era.kicker} <Star />
          </div>
          <div className="kn-era-num" aria-hidden>
            {era.n}
          </div>
          <h2 className="kn-era-title">
            {era.name.split(" ").map((word, i) => (
              <Fragment key={i}>
                {i > 0 && " "}
                <span style={{ animationDelay: `${0.3 + i * 0.12}s` }}>
                  <D>{word}</D>
                </span>
              </Fragment>
            ))}
          </h2>
          <p className="kn-era-line">{era.line}</p>
          <ul className="kn-era-list">
            {era.changes.map((c) => (
              <li key={c}>
                <Note /> {c}
              </li>
            ))}
          </ul>
          <div className="kn-era-stars" aria-label={`Era ${era.n} of ${era.total}`}>
            {Array.from({ length: era.total }, (_, i) => (
              <span key={i} className={i + 1 <= era.n ? "on" : ""}>
                <Star />
              </span>
            ))}
          </div>
          <button type="button" className="kn-encore" onClick={() => actions.continueEra()}>
            <Tape n={1} /> {era.continueLabel} <span className="kn-chip">1</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export function Outcome({ outcome, actions }: SlotPropsMap["Outcome"]) {
  const t = useT();
  return (
    <div className="kn-backdrop">
      <div className={`kn-event kn-outcome kn-plastic ${outcome.won ? "won" : "lost"}`} role="dialog" aria-modal="true" aria-label={outcome.won ? "You won" : "Game over"}>
        <div className="kn-screen">
          <div className="kn-event-head">
            <span className="kn-stripe">
              <Star /> {outcome.stripe}
            </span>
            <span className="kn-paused">
              <D>{outcome.date}</D>
            </span>
          </div>
          <h2 className="kn-event-title">
            <D>{outcome.headline}</D>
          </h2>
          <dl className="kn-score-board">
            {outcome.stats.map((s) => (
              <div key={s.label} className={s.bad ? "bad" : ""}>
                <dt>{s.label}</dt>
                <dd>
                  <D>{s.text}</D>
                </dd>
              </div>
            ))}
          </dl>
          <p className="kn-event-body">{outcome.note}</p>
          <div className="kn-outcome-buttons">
            {outcome.won && (
              <button type="button" className="kn-encore plain" onClick={() => actions.keepPlaying()}>
                {t("outcome.keepPlaying")}
              </button>
            )}
            <button type="button" className="kn-encore" onClick={() => actions.newLab()}>
              <Tape n={1} /> {t("outcome.newLab")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

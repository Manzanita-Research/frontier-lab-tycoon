// The full-screen cards: the news card (a screen in a plastic frame, the answers as round arcade buttons), the new-era
// card (the stage lights come up on a big number) and the win / lose card (the scoreboard).
import { Fragment } from "react";
import { useT } from "../context";
import type { SlotPropsMap } from "../types";
import type { EventVM, HudActions, ResponseVM } from "../../ui/hud/types";
import { Note, Notes, Scene, Star, Tape } from "./art";

const KEY_COLOURS = ["#FF5FA2", "#4FE3FF", "#FFE45C"];
const GAUGE_SEGMENTS = 16;

/** The answers, as round arcade keys in three colours; the game also handles the 1-3 keys. */
function Choices({ event, actions }: { event: EventVM; actions: HudActions }) {
  return (
    <div className="kn-choices">
      {event.choices.map((c, i) => (
        <button key={c.label} type="button" className="kn-choice" style={{ ["--c" as string]: KEY_COLOURS[i % KEY_COLOURS.length] }} onClick={() => actions.choose(event.id, i)}>
          <span className="kn-choice-key">{c.key}</span>
          <span className="kn-choice-text">
            <b>{c.label}</b>
            <small>{c.hint}</small>
          </span>
        </button>
      ))}
    </div>
  );
}

/** The numbers behind "Ship now at 94% ready": how baked the run is, what shipping adds, and the odds of a launch bug. */
function Gauges({ response }: { response: ResponseVM }) {
  const t = useT();
  const lit = Math.round(response.ready * GAUGE_SEGMENTS);
  return (
    <div className="kn-gauges" aria-label={`${response.rival} launched ${response.rivalModel}`}>
      <div className="kn-rg wide">
        <span className="kn-l">{t("response.ready")}</span>
        <b className="kn-rg-big mint">{response.readyText}</b>
        <span className="kn-pbar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(response.ready * 100)} aria-label={t("response.ready")}>
          {Array.from({ length: GAUGE_SEGMENTS }, (_, i) => (
            <i key={i} className={i < lit ? "on" : ""} />
          ))}
        </span>
      </div>
      <div className="kn-rg">
        <span className="kn-l">{t("response.ship")}</span>
        <b className="kn-rg-big gold">{response.shipText}</b>
        <small>
          {t("response.full")} {response.holdText}
        </small>
      </div>
      <div className={`kn-rg ${response.bug >= 0.3 ? "risky" : ""}`}>
        <span className="kn-l">{t("response.bug")}</span>
        <b className={`kn-rg-big ${response.bug >= 0.3 ? "hot" : "cyan"}`}>{response.bugText}</b>
        <small>{response.rivalModel}</small>
      </div>
    </div>
  );
}

function Head({ stripe, tag }: { stripe: string; tag: string }) {
  return (
    <div className="kn-event-head">
      <span className="kn-stripe">
        <Notes /> {stripe}
      </span>
      <span className="kn-paused">{tag}</span>
    </div>
  );
}

export function EventCard({ event, actions }: SlotPropsMap["EventCard"]) {
  const t = useT();
  return (
    <div className="kn-backdrop">
      <div className={`kn-event kn-plastic tone-${event.tone}`} role="dialog" aria-modal="true" aria-label={event.title}>
        <div className="kn-screen">
          <Head stripe={event.stripe} tag={t("event.paused")} />
          <h2 className="kn-event-title">{event.title}</h2>
          <p className="kn-event-body">{event.body}</p>
          {event.kind === "auction" && (
            <ul className="kn-paddles" aria-label="Bidders">
              {event.paddles.map((p) => (
                <li key={p.id} style={{ ["--paddle" as string]: p.color }}>
                  <span className="kn-paddle-n">{p.number}</span>
                  {p.name}
                </li>
              ))}
            </ul>
          )}
          {event.response && <Gauges response={event.response} />}
          <Choices event={event} actions={actions} />
        </div>
      </div>
    </div>
  );
}

/** The launch livestream mishap: the karaoke video with what went wrong on it, the requests scrolling beside it, and three ways to spin it. */
export function Livestream({ event, stream, actions }: SlotPropsMap["Livestream"]) {
  const t = useT();
  return (
    <div className="kn-backdrop">
      <div className={`kn-event kn-stream kn-plastic tone-${event.tone}`} role="dialog" aria-modal="true" aria-label={event.title}>
        <div className="kn-screen">
          <Head stripe={event.stripe} tag={t("event.paused")} />
          <div className="kn-video">
            <div className="kn-video-bar">
              <b className="kn-onair">{t("stream.live")}</b>
              <span>{t("stream.watching", { n: stream.viewersText })}</span>
              <span className="kn-video-model">{stream.model}</span>
            </div>
            <div className="kn-video-stage">
              <div className="kn-video-screen">
                <Scene mishap={stream.mishap} />
                <b className="kn-caption">{stream.caption}</b>
              </div>
              <ul className="kn-requests" aria-label={t("stream.chat")}>
                {stream.chat.slice(-5).map((c) => (
                  <li key={c.who + c.text}>
                    <b>{c.who}</b> {c.text}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <h2 className="kn-event-title">{event.title}</h2>
          <p className="kn-event-body">{event.body}</p>
          <Choices event={event} actions={actions} />
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
                  {word}
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
              {outcome.date}
            </span>
          </div>
          <h2 className="kn-event-title">
            {outcome.headline}
          </h2>
          <dl className="kn-score-board">
            {outcome.stats.map((s) => (
              <div key={s.label} className={s.bad ? "bad" : ""}>
                <dt>{s.label}</dt>
                <dd>
                  {s.text}
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

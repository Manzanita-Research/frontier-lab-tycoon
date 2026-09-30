// Paper and stickers: thought bubbles, toasts, the terminal ticker, and the event card as a memo with a rubber stamp.
import { Marquee, useT } from "../kit";
import type { ToneVM } from "../../ui/hud/types";
import type { SlotPropsMap } from "../types";
import { Glyph, GLYPHS } from "./icons";

/** A paper bubble with a coloured spine and the speaker's name on the first line. The root keeps the `bubble` class so photo mode can copy it. */
export function Bubble({ bubble }: SlotPropsMap["Bubble"]) {
  return (
    <div className={`bubble sd-bubble bubble-${bubble.kind}`}>
      <b>{bubble.speaker || bubble.kind}</b>
      {bubble.text}
    </div>
  );
}

const TONE_GLYPH: Record<ToneVM | "hint" | "warn", keyof typeof GLYPHS> = {
  good: "star",
  bad: "warn",
  joke: "laugh",
  neutral: "info",
  hint: "tip",
  warn: "warn",
};

/** A toast as a sticker: a die-cut white edge round a coloured pill. A tap peels it off (a hint stays until it comes true). */
export function Toast({ toast, actions }: SlotPropsMap["Toast"]) {
  const inner = (
    <span className="in">
      <Glyph name={TONE_GLYPH[toast.tone]} />
      <span className="tx">{toast.text}</span>
    </span>
  );
  if (toast.tone === "hint") {
    return (
      <div className="sd-sticker hint" role="status">
        {inner}
      </div>
    );
  }
  return (
    <button type="button" className={`sd-sticker ${toast.tone}`} onClick={() => actions.dismissToast(toast.id)}>
      {inner}
    </button>
  );
}

/** The news tape as a terminal: a prompt, then one log line per headline, each with its own level. */
export function Ticker({ items }: SlotPropsMap["Ticker"]) {
  const t = useT();
  return (
    <div className="ticker sd-term" aria-label={t("ticker.aria")}>
      <div className="ticker-tag sd-prompt">
        {t("ticker.label")}
        <i className="cursor" aria-hidden />
      </div>
      <div className="ticker-view">
        <Marquee items={items} className="ticker-track" />
      </div>
    </div>
  );
}

/** What the rubber stamp says, by the card's tone. */
const STAMP: Record<ToneVM, string> = {
  bad: "URGENT",
  good: "APPROVED",
  joke: "FYI (LOL)",
  neutral: "CONFIDENTIAL",
};

/** The event card as an internal memo on letterhead, with a rubber stamp that lands on it. The game handles the 1-3 keys. */
export function EventCard({ event, actions }: SlotPropsMap["EventCard"]) {
  const t = useT();
  return (
    <div className="sd-backdrop">
      <article className={`sd-memo tone-${event.tone}`} role="dialog" aria-modal="true" aria-label={event.title}>
        <div className="sd-sheet">
          <header className="sd-letterhead">
            <svg className="logo" viewBox="0 0 32 32" aria-hidden>
              <rect x="2" y="2" width="28" height="28" rx="7" />
              <path d="M9 22 16 8l7 14M12 17.5h8" />
            </svg>
            <span className="org">
              <b>Frontier Lab</b>
              <small>Office of Vibes and Compliance</small>
            </span>
          </header>
          <dl className="sd-fields">
            <div>
              <dt>To</dt>
              <dd>All hands</dd>
            </div>
            <div>
              <dt>Priority</dt>
              <dd>{event.stripe}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{t("event.paused")}</dd>
            </div>
          </dl>
          <h2>{event.title}</h2>
          <p>{event.body}</p>
          {event.kind === "auction" && (
            <div className="sd-paddles" aria-hidden>
              {event.paddles.map((r, i) => (
                <div key={r.id} className="sd-paddle" style={{ animationDelay: `${i * 0.35}s` }}>
                  <span className="board" style={{ background: r.color }}>
                    {r.number}
                  </span>
                  <span className="stick" />
                  <span className="nm">{r.name}</span>
                </div>
              ))}
            </div>
          )}
          <div className="sd-choices">
            {event.choices.map((c, i) => (
              <button key={c.label} type="button" className="sd-choice" onClick={() => actions.choose(event.id, i)}>
                <span className="sd-keycap">{c.key}</span>
                <span className="txt">
                  <b>{c.label}</b>
                  <span>{c.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
        <span className={`sd-stamp ${event.tone}`} aria-hidden>
          {STAMP[event.tone]}
        </span>
      </article>
    </div>
  );
}

/** The era title card as an all-hands slide: a big enamel medal, the name, one line, and what changes as sticky notes. */
export function EraCard({ era, actions }: SlotPropsMap["EraCard"]) {
  return (
    <div className="sd-backdrop sd-era-backdrop">
      <article className={`sd-era era-${era.n}`} role="dialog" aria-modal="true" aria-label={era.name}>
        <div className="sd-era-head">
          <span className="sd-era-medal" aria-hidden>
            <b>{era.n}</b>
          </span>
          <span className="kicker">{era.kicker}</span>
        </div>
        <h2>{era.name}</h2>
        <p className="line">{era.line}</p>
        <ul className="sd-era-changes">
          {era.changes.map((c, i) => (
            <li key={c} className={`c${i % 3}`}>
              {c}
            </li>
          ))}
        </ul>
        <div className="sd-era-dots" role="img" aria-label={`Era ${era.n} of ${era.total}`}>
          {Array.from({ length: era.total }, (_, i) => (
            <i key={i} className={i + 1 <= era.n ? "on" : ""} />
          ))}
        </div>
        <button type="button" className="sd-key wide sd-follow sd-go" onClick={() => actions.continueEra()}>
          <span className="face">
            {era.continueLabel} <span className="sd-keycap">1</span>
          </span>
          <span className="band" />
        </button>
      </article>
    </div>
  );
}

/** The win or lose card as a memo: the stats as a till receipt, and a stamp for the verdict. */
export function Outcome({ outcome, actions }: SlotPropsMap["Outcome"]) {
  const t = useT();
  return (
    <div className="sd-backdrop">
      <article className={`sd-memo ${outcome.won ? "tone-good" : "tone-bad"}`} role="dialog" aria-modal="true" aria-label={outcome.won ? "You won" : "Game over"}>
        <div className="sd-sheet">
          <header className="sd-letterhead">
            <svg className="logo" viewBox="0 0 32 32" aria-hidden>
              <rect x="2" y="2" width="28" height="28" rx="7" />
              <path d="M9 22 16 8l7 14M12 17.5h8" />
            </svg>
            <span className="org">
              <b>{outcome.stripe}</b>
              <small>{outcome.date}</small>
            </span>
          </header>
          <h2>{outcome.headline}</h2>
          <dl className="sd-tally">
            {outcome.stats.map((s) => (
              <div key={s.label}>
                <dt>{s.label}</dt>
                <dd className={s.bad ? "bad" : ""}>{s.text}</dd>
              </div>
            ))}
          </dl>
          <p>{outcome.note}</p>
          <div className="sd-choices row">
            {outcome.won && (
              <button type="button" className="sd-choice" onClick={() => actions.keepPlaying()}>
                <span className="txt">
                  <b>{t("outcome.keepPlaying")}</b>
                </span>
              </button>
            )}
            <button type="button" className="sd-choice primary" onClick={() => actions.newLab()}>
              <span className="txt">
                <b>{t("outcome.newLab")}</b>
              </span>
            </button>
          </div>
        </div>
        <span className={`sd-stamp ${outcome.won ? "good" : "bad"}`} aria-hidden>
          {outcome.won ? "PROMOTED" : "REDUNDANT"}
        </span>
      </article>
    </div>
  );
}

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

const TONE_GLYPH: Record<ToneVM | "hint", keyof typeof GLYPHS> = {
  good: "star",
  bad: "warn",
  joke: "laugh",
  neutral: "info",
  hint: "tip",
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
            <span className="memo-tag">MEMO</span>
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

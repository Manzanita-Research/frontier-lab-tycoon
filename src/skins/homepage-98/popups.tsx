// Everything that interrupts you: guestbook entries over people's heads, toasts as pop-up windows ("Click here!!!"),
// the event card, the era card as a prize notification, the win/lose card and "you've got mail".
import { useT } from "../context";
import type { SlotPropsMap } from "../types";
import { New, Pop } from "./parts";
import { Spark } from "./icons";

/** One guestbook entry, pinned to whoever is thinking it. The root keeps the `bubble` class (the game and photo mode look for it). */
export function Bubble({ bubble }: SlotPropsMap["Bubble"]) {
  return (
    <div className={`bubble gc-gb bubble-${bubble.kind}`}>
      <b>{bubble.speaker || bubble.kind} wrote:</b>
      {bubble.text}
    </div>
  );
}

const TITLE = { good: "Congratulations!!!", bad: "WARNING!!!", joke: "Hey, you!", neutral: "You've got mail!", hint: "Tip of the Day!", warn: "Heads up!!!" } as const;

/** A toast is a pop-up window. Clicking the link (or the box) makes it go away, as promised. */
export function Toast({ toast, actions }: SlotPropsMap["Toast"]) {
  // A hint is a standing tip and a warning a standing problem: neither can be closed, they go when it comes true / is fixed.
  if (toast.tone === "hint" || toast.tone === "warn") {
    return (
      <Pop title={TITLE[toast.tone]} className={`gc-toast ${toast.tone === "warn" ? "bad" : "hint"}`} role="status">
        {toast.text}
      </Pop>
    );
  }
  const close = () => actions.dismissToast(toast.id);
  return (
    <Pop title={TITLE[toast.tone]} className={`gc-toast ${toast.tone}`} role="status" onClose={close}>
      <div>{toast.text}</div>
      <button type="button" className="gc-link" onClick={close}>
        Click here!!!
      </button>
    </Pop>
  );
}

/** "You've got mail!": the paper (or the chat) has arrived. */
export function NewsArrival({ arrival, actions }: SlotPropsMap["NewsArrival"]) {
  return (
    <aside className="gc-arrival">
      <Pop title="You've got mail!" role="status" onClose={() => actions.skipNews()} closeLabel="Skip">
        <div>{arrival.text}</div>
        <div className="gc-btns">
          <button type="button" className="gc-fb" onClick={() => actions.viewNews(arrival.id)}>
            Read it!
          </button>
          <button type="button" className="gc-fb" onClick={() => actions.skipNews()}>
            Later
          </button>
        </div>
      </Pop>
    </aside>
  );
}

/** The card that pauses the game: a pop-up window with the news, and the choices as grey buttons. */
export function EventCard({ event, actions }: SlotPropsMap["EventCard"]) {
  const t = useT();
  return (
    <div className="modal-backdrop gc-backdrop">
      <Pop title={`${event.stripe}!!!`} extra={<span className="gc-paused">{t("event.paused")}</span>} className={`gc-event tone-${event.tone}`} role="dialog" modal label={event.title}>
        <h2>
          <Spark /> {event.title} <Spark />
        </h2>
        <p>{event.body}</p>
        {event.kind === "auction" && (
          <table className="gc-t gc-paddles" aria-hidden>
            <tbody>
              <tr>
                {event.paddles.map((p) => (
                  <td key={p.id}>
                    <span className="sw" style={{ background: p.color }}>
                      {p.number}
                    </span>
                    {p.name}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        )}
        <div className="gc-choices">
          {event.choices.map((c, i) => (
            <button key={c.label} type="button" className="gc-fb gc-choice" disabled={!!c.disabled} title={c.disabled} onClick={() => actions.choose(event.id, i)}>
              <span className="gc-key">{c.key}</span>
              <span className="tx">
                <b>{c.label}</b>
                <small>{c.hint}</small>
              </span>
            </button>
          ))}
        </div>
      </Pop>
    </div>
  );
}

/** A new era arrives as the prize notification every home page had: you are visitor number one million. */
export function EraCard({ era, actions }: SlotPropsMap["EraCard"]) {
  return (
    <div className={`modal-backdrop gc-backdrop gc-erabg era-${era.n}`}>
      <div className="gc-era-card" role="dialog" aria-modal="true" aria-label={era.name}>
        <div className="gc-kicker">
          <Spark /> {era.kicker} <Spark />
        </div>
        <div className="gc-eranum" aria-hidden>
          ERA {era.n}
        </div>
        <h2 className="gc-eratitle">{era.name}</h2>
        <p className="gc-eraline">{era.line}</p>
        <ul className="gc-erachanges">
          {era.changes.map((c) => (
            <li key={c}>
              <New>NEW!</New> {c}
            </li>
          ))}
        </ul>
        <div className="gc-eradots" aria-label={`Era ${era.n} of ${era.total}`}>
          {Array.from({ length: era.total }, (_, i) => (
            <i key={i} className={i + 1 <= era.n ? "on" : ""} />
          ))}
        </div>
        <button type="button" className="gc-fb big" onClick={() => actions.continueEra()}>
          {era.continueLabel}!!! <span className="gc-key">1</span>
        </button>
      </div>
    </div>
  );
}

/** The last page: a headline, the guest counter's final numbers, and the two buttons. */
export function Outcome({ outcome, actions }: SlotPropsMap["Outcome"]) {
  const t = useT();
  return (
    <div className="modal-backdrop gc-backdrop">
      <Pop title={outcome.stripe} extra={<span className="gc-paused">{outcome.date}</span>} className={`gc-event gc-outcome ${outcome.won ? "tone-good" : "tone-bad"}`} role="dialog" modal label={outcome.won ? "You won" : "Game over"}>
        <h2>
          <Spark /> {outcome.headline} <Spark />
        </h2>
        <table className="gc-t gc-final">
          <tbody>
            {outcome.stats.map((s) => (
              <tr key={s.label}>
                <td className="k">{s.label}</td>
                <td className={s.bad ? "bad" : ""}>{s.text}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>{outcome.note}</p>
        <div className="gc-choices row">
          {outcome.won && (
            <button type="button" className="gc-fb" onClick={() => actions.keepPlaying()}>
              {t("outcome.keepPlaying")}
            </button>
          )}
          <button type="button" className="gc-fb big" onClick={() => actions.newLab()}>
            {t("outcome.newLab")}
          </button>
        </div>
      </Pop>
    </div>
  );
}

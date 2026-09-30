import { useT } from "../../context";
import type { SlotPropsMap } from "../../types";
import { AuctionStrip } from "./AuctionStrip";

/** A modal event card. The game is paused while it is open; the game handles the 1-3 keys. */
export function EventCard({ event, actions }: SlotPropsMap["EventCard"]) {
  const t = useT();
  return (
    <div className="modal-backdrop">
      <div className={`modal-card event-card tone-${event.tone}`} role="dialog" aria-modal="true" aria-label={event.title}>
        <div className="card-stripe">
          <span>{event.stripe}</span>
          <span className="paused">{t("event.paused")}</span>
        </div>
        <div className="card-body">
          <h2>{event.title}</h2>
          <p>{event.body}</p>
          {event.kind === "auction" && <AuctionStrip paddles={event.paddles} />}
          <div className="choices">
            {event.choices.map((c, i) => (
              <button key={c.label} className="choice" onClick={() => actions.choose(event.id, i)}>
                <span className="choice-key">{c.key}</span>
                <span className="choice-text">
                  <b>{c.label}</b>
                  <span className="choice-hint">{c.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

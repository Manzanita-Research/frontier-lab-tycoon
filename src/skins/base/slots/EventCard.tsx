import { useT } from "../../context";
import type { EventVM, HudActions, ResponseVM } from "../../../ui/hud/types";
import type { SlotPropsMap } from "../../types";
import { AuctionStrip } from "./AuctionStrip";
import { Evidence } from "../../kit";

/** The numbers behind "Ship now at 94% ready": how baked the run is, what shipping now adds, the odds of a launch bug. */
export function ResponseGauges({ response }: { response: ResponseVM }) {
  const t = useT();
  return (
    <div className="response-gauges" aria-label={`${response.rival} launched ${response.rivalModel}`}>
      <div className="rg rg-ready">
        <span className="rg-label">{t("response.ready")}</span>
        <b className="rg-big">{response.readyText}</b>
        <span className="rg-meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(response.ready * 100)}>
          <i style={{ width: `${Math.round(response.ready * 100)}%` }} />
        </span>
      </div>
      <div className="rg rg-gain">
        <span className="rg-label">{t("response.ship")}</span>
        <b className="rg-big">{response.shipText}</b>
        <span className="rg-sub">
          {t("response.full")} {response.holdText}
        </span>
      </div>
      <div className={`rg rg-bug ${response.bug >= 0.3 ? "risky" : ""}`}>
        <span className="rg-label">{t("response.bug")}</span>
        <b className="rg-big">{response.bugText}</b>
        <span className="rg-sub">{response.rivalModel}</span>
      </div>
    </div>
  );
}

/** The choices of a card, as buttons; the game also handles the 1-3 keys. */
export function Choices({ event, actions }: { event: EventVM; actions: HudActions }) {
  return (
    <div className="choices">
      {event.choices.map((c, i) => (
        <button key={c.label} className="choice" disabled={!!c.disabled} title={c.disabled} onClick={() => actions.choose(event.id, i)}>
          <span className="choice-key">{c.key}</span>
          <span className="choice-text">
            <b>{c.label}</b>
            <span className="choice-hint">{c.hint}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

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
          {event.response && <ResponseGauges response={event.response} />}
          {event.investigation && <Evidence investigation={event.investigation} />}
          <Choices event={event} actions={actions} />
        </div>
      </div>
    </div>
  );
}

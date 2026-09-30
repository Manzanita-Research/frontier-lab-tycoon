import { useT } from "../../kit";
import type { LeakVM } from "../../../ui/hud/types";
import type { SlotPropsMap } from "../../types";
import { Choices } from "./EventCard";

/** The group chat itself, as a phone screenshot would show it: the group's name, then the bubbles. */
export function LeakThread({ leak }: { leak: LeakVM }) {
  return (
    <div className="leak-phone">
      <header className="leak-head">
        <b>{leak.groupName}</b>
        <small>{leak.members}</small>
      </header>
      <ol className="leak-thread">
        {leak.messages.map((m, i) =>
          m.system ? (
            <li key={i} className="leak-system">
              {m.text}
            </li>
          ) : (
            <li key={i} className={`leak-msg ${m.you ? "you" : ""}`}>
              <span className="leak-name" style={{ color: m.color }}>
                {m.name}
              </span>
              <span className="leak-text">{m.text}</span>
              <time>{m.time}</time>
            </li>
          ),
        )}
      </ol>
      <span className="leak-stamp" aria-hidden>
        LEAKED
      </span>
    </div>
  );
}

/** The yacht summit's group chat, screenshotted and everywhere. Three ways to handle it. */
export function LeakedChat({ event, leak, actions }: SlotPropsMap["LeakedChat"]) {
  const t = useT();
  return (
    <div className="modal-backdrop">
      <div className={`modal-card event-card leak-card tone-${event.tone}`} role="dialog" aria-modal="true" aria-label={event.title}>
        <div className="card-stripe">
          <span>{event.stripe}</span>
          <span className="paused">{t("event.paused")}</span>
        </div>
        <div className="card-body">
          <LeakThread leak={leak} />
          <h2>{event.title}</h2>
          <p>{event.body}</p>
          <Choices event={event} actions={actions} />
        </div>
      </div>
    </div>
  );
}

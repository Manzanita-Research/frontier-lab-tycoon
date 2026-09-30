import { useT } from "../../context";
import type { SlotPropsMap } from "../../types";
import { Choices } from "./EventCard";

/** The launch livestream mishap: a "video" with what went wrong across it, chat scrolling beside it, and three ways to spin it. */
export function Livestream({ event, stream, actions }: SlotPropsMap["Livestream"]) {
  const t = useT();
  return (
    <div className="modal-backdrop">
      <div className={`modal-card event-card stream-card tone-${event.tone}`} role="dialog" aria-modal="true" aria-label={event.title}>
        <div className="card-stripe">
          <span>{event.stripe}</span>
          <span className="paused">{t("event.paused")}</span>
        </div>
        <div className="card-body">
          <div className="stream-frame">
            <div className="stream-bar">
              <b className="stream-live">● {t("stream.live")}</b>
              <span>{t("stream.watching", { n: stream.viewersText })}</span>
              <span className="stream-model">{stream.model}</span>
            </div>
            <div className="stream-stage">
              <div className="stream-screen">
                <b>{stream.caption}</b>
              </div>
              <ul className="stream-chat" aria-label={t("stream.chat")}>
                {stream.chat.slice(-5).map((c) => (
                  <li key={c.who + c.text}>
                    <b>{c.who}</b> {c.text}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <h2>{event.title}</h2>
          <p>{event.body}</p>
          <Choices event={event} actions={actions} />
        </div>
      </div>
    </div>
  );
}

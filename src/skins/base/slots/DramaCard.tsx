import { useT } from "../../context";
import type { DramaDocVM } from "../../../ui/hud/types";
import type { SlotPropsMap } from "../../types";
import { Choices } from "./EventCard";

/** The document on a drama card: a letter on paper, an email with its headers, or a manifesto in big type. */
export function DramaDoc({ drama }: { drama: DramaDocVM }) {
  return (
    <div className={`drama-doc drama-${drama.style}`} aria-label={drama.file}>
      <div className="drama-file">{drama.file}</div>
      {drama.style === "email" && (
        <dl className="drama-headers">
          <dt>From</dt>
          <dd>{drama.from}</dd>
          <dt>To</dt>
          <dd>{drama.to}</dd>
          <dt>Subject</dt>
          <dd>
            <b>{drama.subject}</b>
          </dd>
        </dl>
      )}
      {drama.style === "letter" && <div className="drama-subject">{drama.subject}</div>}
      {drama.lines.map((l, i) => (drama.style === "manifesto" && i === 0 ? <h3 key={l}>{l}</h3> : <p key={`${i}:${l}`}>{l}</p>))}
      <p className="drama-sign">{drama.sign}</p>
    </div>
  );
}

/** Defection's resignation letter and manifesto, the Poaching War's recruiter email: the document first, then the card. */
export function DramaCard({ event, drama, actions }: SlotPropsMap["DramaCard"]) {
  const t = useT();
  return (
    <div className="modal-backdrop">
      <div className={`modal-card event-card drama-doc-card tone-${event.tone}`} role="dialog" aria-modal="true" aria-label={event.title}>
        <div className="card-stripe">
          <span>{event.stripe}</span>
          <span className="paused">{t("event.paused")}</span>
        </div>
        <div className="card-body">
          <DramaDoc drama={drama} />
          <h2>{event.title}</h2>
          <p>{event.body}</p>
          <Choices event={event} actions={actions} />
        </div>
      </div>
    </div>
  );
}

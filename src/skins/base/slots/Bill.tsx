import { useT } from "../../kit";
import type { BillVM, HudActions } from "../../../ui/hud/types";
import type { SlotPropsMap } from "../../types";
import { Choices } from "./EventCard";

/** The clauses: tick boxes on the draft (up to `bill.pick`), the ones that made it in afterwards, legalese first and what it means under it. */
export function BillClauses({ bill, actions }: { bill: BillVM; actions: HudActions }) {
  const shown = bill.editable ? bill.clauses : bill.clauses.filter((c) => c.on);
  if (shown.length === 0) return <p className="bill-empty">(This page intentionally left blank.)</p>;
  return (
    <ol className="bill-clauses">
      {shown.map((c) => {
        const full = bill.editable && !c.on && bill.picked >= bill.pick;
        return (
          <li key={c.id} className={`bill-clause ${c.on ? "on" : ""} shame-${c.shame}`}>
            <label>
              {bill.editable && <input type="checkbox" checked={c.on} disabled={full} onChange={(e) => actions.draftClause(c.id, e.currentTarget.checked)} />}
              <span className="bill-clause-text">
                <b>{c.title}</b>
                <span className="bill-legal">{c.legal}</span>
                <span className="bill-plain">{c.plain}</span>
                <span className="bill-effect">{c.effect}</span>
              </span>
            </label>
          </li>
        );
      })}
    </ol>
  );
}

/** What the law does to each rival while it stands. */
export function BillRivals({ bill }: { bill: BillVM }) {
  const hit = bill.rivals.filter((r) => r.tags.length > 0);
  if (hit.length === 0) return null;
  return (
    <ul className="bill-rivals">
      {hit.map((r) => (
        <li key={r.id}>
          <b>{r.name}</b> {r.tags.join(" · ")}
        </li>
      ))}
    </ul>
  );
}

/** The bill a Senate staffer asked the lab to "take a first pass" at, and the day someone read its file properties. */
export function Bill({ event, bill, actions }: SlotPropsMap["Bill"]) {
  const t = useT();
  const exposed = bill.stage === "exposed";
  return (
    <div className="modal-backdrop">
      <div className={`modal-card event-card bill-card tone-${event.tone} ${exposed ? "exposed" : ""}`} role="dialog" aria-modal="true" aria-label={event.title}>
        <div className="card-stripe">
          <span>{event.stripe}</span>
          <span className="bill-status">{bill.editable ? bill.pickText : bill.status}</span>
          <span className="paused">{t("event.paused")}</span>
        </div>
        <div className="card-body">
          <h2>{event.title}</h2>
          <p>{event.body}</p>
          <div className="bill-doc">
            <header className="bill-doc-head">
              <span className="bill-file">{bill.fileName}</span>
              <b className="bill-act">{bill.act}</b>
            </header>
            <BillClauses bill={bill} actions={actions} />
            {exposed && (
              <dl className="bill-props">
                <dt>Author</dt>
                <dd>{bill.author}</dd>
                <dt>Read by</dt>
                <dd>{bill.reporter}</dd>
              </dl>
            )}
          </div>
          <Choices event={event} actions={actions} />
        </div>
      </div>
    </div>
  );
}

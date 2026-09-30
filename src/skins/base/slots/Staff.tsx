import { useHighlight, useT } from "../../context";
import type { SlotPropsMap } from "../../types";

/** The payroll: hire and fire, and paint patrol zones. It opens from the palette and never lives in the right-hand column. */
export function Staff({ staff, actions }: SlotPropsMap["Staff"]) {
  const t = useT();
  const hl = useHighlight();
  const painting = staff.painting;
  if (painting) {
    return (
      <aside className="staff panel painting" aria-label={t("staff.painting")}>
        <div className="staff-paint">
          <b>{painting.name}</b>
          <span>
            Drag on the map to paint their patrol zone; drag from a painted tile to erase. {painting.zone > 0 ? `${painting.zone} tiles.` : "Empty means the whole campus."}
          </span>
        </div>
        <div className="staff-paint-buttons">
          {painting.zone > 0 && (
            <button className="mini" onClick={() => actions.clearZone(painting.id)}>
              Clear
            </button>
          )}
          <button className="mini primary" onClick={() => actions.paintZone(null)}>
            Done
          </button>
        </div>
      </aside>
    );
  }
  return (
    <aside className="staff panel" aria-label={t("staff.title")}>
      <div className="staff-head">
        <span className="staff-title">{t("staff.title")}</span>
        <span className="staff-pay">{staff.payrollText}</span>
        <button className="staff-x" onClick={() => actions.closeStaff()} aria-label={t("inspector.close")}>
          ×
        </button>
      </div>
      <ul className="staff-hire">
        {staff.jobs.map((j) => (
          <li key={j.job}>
            <span className="swatch" style={{ background: j.color }} aria-hidden />
            <span className="hire-text">
              <b>{j.title}</b> <span className="dim">{j.salaryText}</span>
              <span className="blurb" title={j.blurb}>
                {j.blurb}
              </span>
            </span>
            <button className={`mini primary ${j.starter && j.canHire && hl("staff:hire") ? "flt-hl" : ""}`} disabled={!j.canHire} title={j.reason} onClick={() => actions.hire(j.job)}>
              {t("staff.hire")}
              {j.count > 0 ? ` (${j.count})` : ""}
            </button>
          </li>
        ))}
      </ul>
      {staff.roster.length > 0 && (
        <ul className="staff-roster">
          {staff.roster.map((s) => (
            <li key={s.id} className={s.leaving ? "leaving" : ""}>
              <span className="swatch" style={{ background: s.color }} aria-hidden />
              <span className="roster-text">
                <b>{s.name}</b>
                <span className="blurb" title={`${s.title} · ${s.status}`}>
                  {s.title} · {s.status}
                </span>
                <span className="blurb zonetag">{s.zone > 0 ? `patrol zone: ${s.zone} tiles` : "patrols the whole campus"}</span>
              </span>
              <button className="mini" disabled={s.leaving} onClick={() => actions.paintZone(s.id)} title="Paint a patrol zone on the map">
                {t("staff.zone")}
              </button>
              <button className="mini danger" disabled={s.leaving} onClick={() => actions.fire(s.id)}>
                {t("staff.fire")}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="staff-foot">
        The campus is <b className={staff.slopPct > 20 ? "bad" : ""}>{staff.slopPct}% slop</b>
        {staff.broken > 0 ? (
          <>
            {" "}
            · <b className="bad">{staff.broken} out of order</b>
          </>
        ) : null}
        .
      </div>
    </aside>
  );
}

import { useState } from "react";
import { useT } from "../../context";
import type { SlotPropsMap } from "../../types";

/**
 * The delivery tracker for the lab's late lunch (FLT-109): a toast-sized card that stays up while the order is out,
 * the ETA slipping (the old ones struck through) and the courier's dot wandering along the route. It stays after the
 * bowls come until it is closed, so at 10× the story doesn't go by in a blink. Frontier 95 draws it as a window.
 */
export function OrderTracker({ lunch }: SlotPropsMap["OrderTracker"]) {
  const t = useT();
  const [closed, setClosed] = useState<number | null>(null);
  if (closed === lunch.id) return null;
  return (
    <section className={`panel lunch-tracker stage-${lunch.stage}`} role="status" aria-label={lunch.app}>
      <header className="lunch-head">
        <span className="lunch-app">🥗 {lunch.app}</span>
        <span className="lunch-order">{lunch.order}</span>
        <button type="button" className="lunch-close" aria-label={t("lunch.close")} onClick={() => setClosed(lunch.id)}>
          ×
        </button>
      </header>
      <div className="lunch-place">{lunch.place}</div>
      <div className="lunch-route" aria-hidden="true">
        <i style={{ left: `${Math.round(lunch.route * 100)}%` }} />
      </div>
      <div className="lunch-eta">
        {lunch.slipped.map((s) => (
          <s key={s}>{s}</s>
        ))}
        <b>{lunch.eta}</b>
      </div>
      <div className="lunch-status">{lunch.status}</div>
      {lunch.stage !== "arriving" && !lunch.delivered && <div className="lunch-day">{lunch.dayLine}</div>}
      {lunch.backwards && <div className="lunch-warn">{t("lunch.backwards")}</div>}
    </section>
  );
}

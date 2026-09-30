// The Star Chart: what the lab is researching now, and the three scenario goals as stars that fill in when they're met.
// The Layout wraps both in one sheet of graph paper.
import { useState } from "react";
import { useT } from "../context";
import type { SlotPropsMap } from "../types";
import { Icon, StarIcon } from "./art";

/** A purple candy-stripe progress bar. `value` is 0 to 1. */
export function StripeBar({ value, label }: { value: number; label: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <span className="dd-bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <i style={{ width: `${pct}%` }} />
    </span>
  );
}

export function Training({ training }: SlotPropsMap["Training"]) {
  const t = useT();
  if (!training.hasHall) {
    return (
      <section className="dd-training empty" aria-label={t("training.title")}>
        <h4>
          <Icon name="flask" size={26} /> {t("training.title")}
        </h4>
        <p className="dd-empty">{t("training.noHall")}</p>
      </section>
    );
  }
  return (
    <section className="dd-training" aria-label={t("training.title")}>
      <h4>
        <Icon name="flask" size={26} /> {t("training.title")}
      </h4>
      <div className="dd-model">{training.name}</div>
      <StripeBar value={training.pct} label={training.name} />
      <div className="dd-trainfoot">
        <span>{training.pctText} done!</span>
        <span>{training.computePerDay > 0 ? t("training.compute", { n: training.computePerDay }) : t("training.noCompute")}</span>
      </div>
      {training.etaDays !== null && <div className="dd-eta">{t("training.eta", { n: training.etaDays })}</div>}
      {training.justShipped && <span className="dd-shipped">{t("training.shipped")}</span>}
    </section>
  );
}

export function Objectives({ objectives, layout }: SlotPropsMap["Objectives"]) {
  const t = useT();
  const [open, setOpen] = useState(() => !layout.compact);
  return (
    <section className={`dd-goals ${open ? "open" : ""}`}>
      <button type="button" className="dd-goals-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <StarIcon on size={26} />
        <h4>{t("objectives.title")}</h4>
        <span className="dd-count">
          {objectives.done}/{objectives.total}
        </span>
        <span className={`dd-days ${objectives.urgent ? "urgent" : ""}`}>
          {objectives.daysLeft} {t("objectives.daysLeft")}
        </span>
      </button>
      {open && (
        <div className="dd-goal-body">
          <ul className="dd-goal-list">
            {objectives.items.map((g) => (
              <li key={g.id} className={g.met ? "met" : ""}>
                <span className="dd-goal-text">
                  <b>{g.label}</b>
                  <small>{g.progress}</small>
                  <StripeBar value={g.ratio} label={g.label} />
                </span>
                <StarIcon on={g.met} size={34} />
              </li>
            ))}
          </ul>
          <div className="dd-due">{t("objectives.by", { date: objectives.deadline })}</div>
        </div>
      )}
    </section>
  );
}

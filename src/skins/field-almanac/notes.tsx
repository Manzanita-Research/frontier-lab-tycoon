import { useState } from "react";
import { useT } from "../kit";
import type { SlotPropsMap } from "../types";
import { CheckIcon, ClipboardIcon } from "./icons";
import { almanacDate, roman } from "./lore";

/** The run under observation: its name in italics, a hairline that fills, and how much compute it eats a day. */
export function Training({ training }: SlotPropsMap["Training"]) {
  const t = useT();
  if (!training.hasHall) {
    return (
      <section className="fa-training idle" aria-label={t("training.title")}>
        <div className="fa-sc">{t("training.title")}</div>
        <p className="fa-quiet">{t("training.noHall")}</p>
      </section>
    );
  }
  const pct = Math.floor(training.pct * 100);
  return (
    <section className="fa-training" aria-label={t("training.title")}>
      <div className="fa-sc">
        {t("training.title")} · training run {roman(training.run)}
      </div>
      <h3 className="fa-h3">
        {training.name}
        {training.justShipped && <span className="fa-shipped">{t("training.shipped")}</span>}
      </h3>
      <div className="fa-prog" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} title={training.etaDays !== null ? t("training.eta", { n: Math.max(1, Math.round(training.etaDays)) }) : undefined}>
        <i style={{ width: `${pct}%` }} />
      </div>
      <div className="fa-meta">
        <span>{training.pctText} complete</span>
        <span>{training.computePerDay > 0 ? t("training.compute", { n: training.computePerDay }) : t("training.noCompute")}</span>
      </div>
    </section>
  );
}

/**
 * This year's objectives as a checklist with a hand-ticked box each. On a phone it starts as a small clipboard button
 * (with the tally) and opens over the map.
 */
export function Objectives({ objectives, layout }: SlotPropsMap["Objectives"]) {
  const t = useT();
  const [open, setOpen] = useState(() => !layout.compact);
  const compact = layout.compact;
  return (
    <section className={`fa-objectives ${open ? "open" : ""} ${compact ? "compact" : ""}`} aria-label={t("objectives.title")}>
      {compact && !open && (
        <button className="fa-obj-pill" onClick={() => setOpen(true)} aria-expanded={false} aria-label={`${t("objectives.title")}, ${objectives.done} of ${objectives.total} done, ${objectives.daysLeft} ${t("objectives.daysLeft")}`}>
          <ClipboardIcon />
          <b>
            {objectives.done}/{objectives.total}
          </b>
        </button>
      )}
      {(!compact || open) && (
        <>
          <div className="fa-obj-head">
            <span className="fa-sc">
              {t("objectives.title")} · <span className={objectives.urgent ? "bad" : ""}>{objectives.daysLeft} days</span>
            </span>
            {compact && (
              <button className="fa-x" onClick={() => setOpen(false)} aria-label={t("inspector.close")}>
                ×
              </button>
            )}
          </div>
          <ul className="fa-checks">
            {objectives.items.map((g) => (
              <li key={g.id} className={`fa-check ${g.met ? "done" : ""}`}>
                <span className="fa-box" aria-hidden>
                  {g.met && <CheckIcon />}
                </span>
                <span className="fa-check-text">
                  <span className="fa-check-label">{g.label}</span>
                  {!g.met && <small>{g.progress}</small>}
                </span>
              </li>
            ))}
          </ul>
          <div className="fa-deadline">{t("objectives.by", { date: almanacDate(objectives.deadline) })}</div>
        </>
      )}
    </section>
  );
}

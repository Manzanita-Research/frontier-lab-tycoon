import { useState } from "react";
import { useT } from "../../context";
import type { SlotPropsMap } from "../../types";

/** The scenario checklist, collapsible so it can get out of the way of the campus (and start folded on a phone). */
export function Objectives({ objectives, layout }: SlotPropsMap["Objectives"]) {
  const t = useT();
  const [open, setOpen] = useState(() => !layout.compact);
  return (
    <div className={`objectives panel ${open ? "open" : ""}`}>
      <button className="obj-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="caret" aria-hidden="true" />
        <span className="obj-title">{t("objectives.title")}</span>
        <span className="obj-count">
          {objectives.done}/{objectives.total}
        </span>
        <span className={`obj-left ${objectives.urgent ? "bad" : ""}`}>
          {objectives.daysLeft}
          <span className="long"> {t("objectives.daysLeft")}</span>
          <span className="short">d</span>
        </span>
      </button>
      {open && (
        <>
          <ul className="obj-list">
            {objectives.items.map((g) => (
              <li key={g.id} className={g.met ? "met" : ""}>
                <span className="checkbox" aria-hidden="true">
                  {g.met ? "✓" : ""}
                </span>
                <span className="obj-text">
                  <b>{g.label}</b>
                  <span className="obj-progress">{g.progress}</span>
                  <span className="obj-bar">
                    <span style={{ width: `${g.ratio * 100}%` }} />
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <div className="obj-deadline">{t("objectives.by", { date: objectives.deadline })}</div>
        </>
      )}
    </div>
  );
}

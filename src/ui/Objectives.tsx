import { useState } from "react";
import { GOALS, SCENARIO, type GoalDef } from "../content/goals";
import { formatDate, formatMoney } from "../sim/format";
import { useStore } from "../store";

const defs = new Map(GOALS.map((g) => [g.id, g]));

/** "Revenue $140K / $250K per day", "Runs 2 / 3", "Hype 47 / 60". */
function progressText(def: GoalDef, value: number): string {
  const shown = Math.min(value, def.target);
  switch (def.unit) {
    case "money":
      return `Revenue ${formatMoney(shown)} / ${formatMoney(def.target)} per day`;
    case "runs":
      return `Training runs ${Math.floor(shown)} / ${def.target}`;
    case "points":
      return `Hype ${Math.floor(shown)} / ${def.target}`;
  }
}

/** The scenario checklist, collapsible so it can get out of the way of the campus (and start folded on a phone). */
export function Objectives() {
  const goals = useStore((s) => s.snap.goals);
  const day = useStore((s) => s.snap.day);
  const [open, setOpen] = useState(() => window.innerWidth > 640);
  const done = goals.filter((g) => g.met).length;
  const left = Math.max(0, SCENARIO.deadlineDay - day);
  return (
    <div className={`objectives panel ${open ? "open" : ""}`}>
      <button className="obj-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="caret" aria-hidden="true" />
        <span className="obj-title">Objectives</span>
        <span className="obj-count">
          {done}/{goals.length}
        </span>
        <span className={`obj-left ${left <= 60 ? "bad" : ""}`}>
          {left}
          <span className="long"> days left</span>
          <span className="short">d</span>
        </span>
      </button>
      {open && (
        <>
          <ul className="obj-list">
            {goals.map((g) => {
              const def = defs.get(g.id)!;
              return (
                <li key={g.id} className={g.met ? "met" : ""}>
                  <span className="checkbox" aria-hidden="true">
                    {g.met ? "✓" : ""}
                  </span>
                  <span className="obj-text">
                    <b>{def.label}</b>
                    <span className="obj-progress">{progressText(def, g.value)}</span>
                    <span className="obj-bar">
                      <span style={{ width: `${Math.min(100, (g.value / g.target) * 100)}%` }} />
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="obj-deadline">By {formatDate(SCENARIO.deadlineDay)}</div>
        </>
      )}
    </div>
  );
}

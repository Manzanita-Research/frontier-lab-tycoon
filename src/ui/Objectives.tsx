import { useState } from "react";
import { GOALS, SCENARIO, type GoalDef } from "../content/goals";
import { ARENA_SIZE } from "../content/rivals";
import { formatDate, formatMoney } from "../sim/format";
import { atoms } from "../app/game";
import { useApp } from "../app/hooks";
import { useCompact } from "./useCompact";

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
    case "era":
      return `Era ${Math.floor(shown)} / ${def.target}`;
    case "rank":
      if (value <= 0) return "Counts from Era 3";
      return value >= def.target ? `Arena #${ARENA_SIZE + 1 - Math.floor(value)} (top ${ARENA_SIZE + 1 - def.target} reached)` : `Arena #${ARENA_SIZE + 1 - Math.floor(value)}, need top ${ARENA_SIZE + 1 - def.target}`;
  }
}

/** The scenario checklist, collapsible so it can get out of the way of the campus (and start folded on a phone). */
export function Objectives() {
  const goals = useApp(atoms.goals);
  const day = useApp(atoms.day);
  const compact = useCompact();
  const [open, setOpen] = useState(() => window.innerWidth > 640);
  const done = goals.filter((g) => g.met).length;
  const left = Math.max(0, SCENARIO.deadlineDay - day);
  // On a phone the checklist is an icon button (with how many are done) and opens over the map when tapped.
  return (
    <div className={`objectives panel ${open ? "open" : ""} ${compact ? "compact" : ""}`}>
      {compact && (
        <button className="icon-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={`Objectives, ${done} of ${goals.length} done, ${left} days left`}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3a2a1c" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="4" y="3" width="16" height="18" rx="3" fill="#fff" />
            <path d="M8 9l2 2 3.5-3.5M8 16h8" />
          </svg>
          <span className="icon-badge">
            {done}/{goals.length}
          </span>
        </button>
      )}
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

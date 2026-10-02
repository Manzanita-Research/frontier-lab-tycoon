import { useState } from "react";
import { useCoach, useT } from "../../context";
import { ALL_VISIBLE, useAutoPause, useWhere } from "../../kit";
import type { SlotPropsMap } from "../../types";

/**
 * The goal in front of you, on one line ("Ship your first model · 0/1"), and, once the race is on, the scenario checklist behind
 * a fold (which starts shut on a phone). A game that sends no ladder gets the checklist alone, as it always was.
 */
export function Objectives({ objectives, progress, visible = ALL_VISIBLE, layout, actions }: SlotPropsMap["Objectives"]) {
  const t = useT();
  const coach = useCoach();
  const where = useWhere();
  const goal = progress?.goal.line ? progress.goal : null;
  const next = goal?.showMe;
  const nextWhere = next ? where(next.anchor) : null;
  const list = !goal || visible.arena;
  const [open, setOpen] = useState(() => !layout.compact);
  useAutoPause(actions, "objectives", list && layout.compact && open);
  return (
    <>
      {goal && (
        <div className="goal panel" {...coach.attrs("goals")} role="status">
          <span className="goal-icon" aria-hidden>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="8.5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="12" cy="12" r="0.8" fill="currentColor" />
            </svg>
          </span>
          <span className="goal-text">
            <small>{t("objectives.goal")}</small>
            <b>{goal.line}</b>
            {next && (
              <span className="goal-next">
                <span>
                  {next.label}
                  {nextWhere && <i> · {t("showMe.where", { where: nextWhere })}</i>}
                </span>
                <button type="button" className="show-me" data-showme={next.anchor} onClick={() => actions.showMe(next.anchor)}>
                  {t("showMe")}
                </button>
              </span>
            )}
          </span>
          <span className="goal-bar" aria-hidden>
            <span style={{ width: `${goal.ratio * 100}%` }} />
          </span>
        </div>
      )}
      {list && (
        <div className={`objectives panel ${open ? "open" : ""} ${layout.compact ? "compact" : ""}`}>
          {layout.compact && (
            <button className="icon-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={`${t("objectives.title")}, ${objectives.done} of ${objectives.total} done, ${objectives.daysLeft} ${t("objectives.daysLeft")}`}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="4" y="3" width="16" height="18" rx="3" fill="var(--flt-color-inset)" />
                <path d="M8 9l2 2 3.5-3.5M8 16h8" />
              </svg>
              <span className="icon-badge">
                {objectives.done}/{objectives.total}
              </span>
            </button>
          )}
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
                      {g.progress && <span className="obj-progress">{g.progress}</span>}
                      {g.showMe && (
                        <button type="button" className="show-me link" data-showme={g.showMe.anchor} onClick={() => actions.showMe(g.showMe!.anchor)}>
                          {t("showMe")}
                        </button>
                      )}
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
      )}
    </>
  );
}

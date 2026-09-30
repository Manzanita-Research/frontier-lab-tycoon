import { useCoach, ALL_VISIBLE } from "../kit";
// Things stuck to the wall: the OKRs as sticky notes and the Thoughts as a corkboard with push-pins.
import { useState } from "react";
import { useT } from "../kit";
import type { SlotPropsMap } from "../types";
import { Glyph } from "./icons";

/** The scenario checklist as three sticky notes. Folds to a tab (and starts folded on a phone) so the campus stays visible. */
export function Objectives({ objectives, layout, progress, visible = ALL_VISIBLE }: SlotPropsMap["Objectives"]) {
  const coachApi = useCoach();
  const t = useT();
  const [open, setOpen] = useState(() => !layout.compact);
  if (progress?.goal.text && !visible.arena) return <div className="sd-okrs" {...coachApi.attrs("goals")}><div>{progress.goal.line}</div></div>;
  return (
    <div className={`sd-okrs ${open ? "open" : ""} ${layout.compact ? "compact" : ""}`} {...coachApi.attrs("goals")}>
      <button
        type="button"
        className="sd-okr-head"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`${t("objectives.title")}, ${objectives.done} of ${objectives.total} done, ${objectives.daysLeft} ${t("objectives.daysLeft")}`}
      >
        <span className="k">{t("objectives.title")}</span>
        <span className="n">
          {objectives.done}/{objectives.total}
        </span>
        <span className={`left ${objectives.urgent ? "bad" : ""}`}>
          {objectives.daysLeft}
          <span className="long"> {t("objectives.daysLeft")}</span>
          <span className="short">d</span>
        </span>
        <span className={`sd-caret ${open ? "open" : ""}`} aria-hidden />
      </button>
      {open && (
        <>
          <ul className="sd-notes">
            {objectives.items.map((g, i) => (
              <li key={g.id} className={`sd-sticky c${i % 3} ${g.met ? "met" : ""}`}>
                <span className="box" aria-hidden>
                  {g.met && <Glyph name="check" />}
                </span>
                <b>{g.label}</b>
                <small>{g.progress}</small>
                <span className="prog" aria-hidden>
                  <span style={{ width: `${Math.round(g.ratio * 100)}%` }} />
                </span>
              </li>
            ))}
          </ul>
          <div className="sd-deadline">{t("objectives.by", { date: objectives.deadline })}</div>
        </>
      )}
    </div>
  );
}

/** Everybody's thoughts, counted, as index cards on a corkboard. The count sits on the push-pin; tap a card to light up who thinks it. */
export function ThoughtsPanel({ rows, layout, actions }: SlotPropsMap["ThoughtsPanel"]) {
  const t = useT();
  const [open, setOpen] = useState(() => !layout.compact);
  const total = rows.reduce((n, r) => n + r.count, 0);
  return (
    <section className={`sd-cork ${open ? "open" : ""} ${layout.compact ? "compact" : ""}`} aria-label={t("thoughts.title")}>
      <button type="button" className="sd-cork-head" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={layout.compact ? `${t("thoughts.title")}, ${rows.length} kinds` : undefined}>
        <span className="sd-strip">{t("thoughts.title")}</span>
        {layout.compact && <span className="n">{total}</span>}
        <span className={`sd-caret ${open ? "open" : ""}`} aria-hidden />
      </button>
      {open && (
        <ul className="sd-cork-list">
          {rows.map((r) => (
            <li key={r.key}>
              <button type="button" className={`sd-note kind-${r.kind} ${r.highlighted ? "on" : ""}`} onClick={() => actions.highlight(r.key)} aria-pressed={r.highlighted}>
                <span className="sd-pushpin">{r.count}</span>
                <span className="body">
                  <b>{r.noun}</b> <q>{r.text}</q>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

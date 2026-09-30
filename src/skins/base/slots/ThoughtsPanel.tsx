import { useState } from "react";
import { useT } from "../../context";
import { useAutoPause, useWidget } from "../../kit";
import type { SlotPropsMap } from "../../types";

/** RCT's guest thoughts window: everybody's thought, counted, most common first. Tap a row to light up who thinks it. */
export function ThoughtsPanel({ rows, layout, actions }: SlotPropsMap["ThoughtsPanel"]) {
  const t = useT();
  const [open, setOpen] = useState(() => !layout.compact);
  useWidget("thoughts", () => setOpen(true));
  useAutoPause(actions, "thoughts", layout.compact && open);
  return (
    <section className={`thoughts panel ${open ? "open" : ""} ${layout.compact ? "compact" : ""}`} aria-label={t("thoughts.title")}>
      <button className="thoughts-head" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={layout.compact ? `${t("thoughts.title")}, ${rows.length} kinds` : undefined}>
        <span className="thoughts-icon" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <span className="thoughts-title">{t("thoughts.title")}</span>
        {layout.compact && <span className="icon-badge">{rows.reduce((n, r) => n + r.count, 0)}</span>}
        <span className={`thoughts-caret ${open ? "open" : ""}`} aria-hidden />
      </button>
      {open && (
        <ul className="thoughts-list">
          {rows.map((r) => (
            <li key={r.key}>
              <button className={`thought-row kind-${r.kind} ${r.highlighted ? "on" : ""}`} onClick={() => actions.highlight(r.key)} aria-pressed={r.highlighted}>
                <span className="thought-count">{r.count}</span>
                <span className="thought-body">
                  <span className="thought-who">{r.noun}</span> <q>{r.text}</q>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

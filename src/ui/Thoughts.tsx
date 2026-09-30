import { useState } from "react";
import { atoms, send } from "../app/game";
import { useApp } from "../app/hooks";
import { useCompact } from "./useCompact";
import type { ThoughtRow } from "../sim/mind";
import type { WalkerKind } from "../sim/types";

const NOUN: Record<WalkerKind, [string, string]> = {
  researcher: ["researcher", "researchers"],
  agent: ["agent", "agents"],
  visitor: ["visitor", "visitors"],
  protester: ["protester", "protesters"],
};

const noun = (r: ThoughtRow) => NOUN[r.kind][r.count === 1 ? 0 : 1];

/** RCT's guest thoughts window: everybody's thought, counted, most common first. Tap a row to light up who thinks it. */
export function Thoughts() {
  const board = useApp(atoms.board);
  const highlight = useApp(atoms.highlight);
  const compact = useCompact();
  // On a phone it starts shut, as an icon button; the list opens over the map.
  const [open, setOpen] = useState(() => typeof window === "undefined" || window.innerWidth > 640);
  return (
    <section className={`thoughts panel ${open ? "open" : ""} ${compact ? "compact" : ""}`} aria-label="Thoughts">
      <button className="thoughts-head" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={compact ? `Thoughts, ${board.length} kinds` : undefined}>
        <span className="thoughts-icon" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <span className="thoughts-title">Thoughts</span>
        {compact && <span className="icon-badge">{board.reduce((n, r) => n + r.count, 0)}</span>}
        <span className={`thoughts-caret ${open ? "open" : ""}`} aria-hidden />
      </button>
      {open && (
        <ul className="thoughts-list">
          {board.map((r) => (
            <li key={r.key}>
              <button className={`thought-row kind-${r.kind} ${highlight === r.key ? "on" : ""}`} onClick={() => send({ type: "HIGHLIGHT", key: r.key })} aria-pressed={highlight === r.key}>
                <span className="thought-count">{r.count}</span>
                <span className="thought-body">
                  <span className="thought-who">{noun(r)}</span> <q>{r.text}</q>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

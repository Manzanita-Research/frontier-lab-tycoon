import { useEffect, useRef, useState } from "react";
import { atoms } from "../app/game";
import { useApp } from "../app/hooks";
import { trendOf, VIBES_MAX, WEIGHTS } from "../sim/vibes";

const ARROW = { up: "▲", down: "▼", flat: "▬" } as const;
const pts = (n: number) => Math.round(n * VIBES_MAX);

interface Row {
  label: string;
  note?: string;
  /** 0 to 1, for the mini bar. */
  fill: number;
  /** Signed points toward the total. */
  points: number;
}

/** The park rating, big, with a trend arrow and a tooltip that shows where every point came from. */
export function Vibes() {
  const v = useApp(atoms.vibes);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trend = trendOf(v);

  // Tap elsewhere to close (the tooltip opens on hover with a mouse and on tap with a finger).
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", away);
    return () => window.removeEventListener("pointerdown", away);
  }, [open]);

  const rows: Row[] = [
    { label: "Happiness", note: `${Math.round(WEIGHTS.happiness * 100)}%`, fill: v.happiness, points: pts(WEIGHTS.happiness * v.happiness) },
    { label: "Visitors impressed", note: `${Math.round(WEIGHTS.impressed * 100)}%`, fill: v.impressed, points: pts(WEIGHTS.impressed * v.impressed) },
    { label: "Cleanliness", note: `${Math.round(WEIGHTS.cleanliness * 100)}%, spotless for now`, fill: v.cleanliness, points: pts(WEIGHTS.cleanliness * v.cleanliness) },
    { label: "Hype", note: `${Math.round(WEIGHTS.hype * 100)}%`, fill: v.hype, points: pts(WEIGHTS.hype * v.hype) },
    { label: "Calm baseline", note: "10%", fill: 1, points: pts(WEIGHTS.penalties) },
    { label: "Incidents", note: "quits, flops, bailouts", fill: v.incident, points: -pts((WEIGHTS.penalties * v.incident) / 2) },
    { label: "Protesters at the gate", fill: v.protest, points: -pts((WEIGHTS.penalties * v.protest) / 2) },
  ];

  return (
    <div className="vibes" ref={root} onPointerEnter={(e) => e.pointerType === "mouse" && setOpen(true)} onPointerLeave={(e) => e.pointerType === "mouse" && setOpen(false)}>
      <button className={`vibes-btn trend-${trend}`} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={`Vibes ${Math.round(v.value)}, ${trend === "flat" ? "steady" : trend === "up" ? "rising" : "falling"}`}>
        <span className="vibes-label">Vibes</span>
        <span className="vibes-value">{Math.round(v.value)}</span>
        <span className="vibes-arrow" aria-hidden>
          {ARROW[trend]}
        </span>
      </button>
      {open && (
        <div className="vibes-tip panel" role="tooltip">
          <div className="vibes-tip-title">
            Where the vibes come from <span className="dim">{Math.round(v.value)} of {VIBES_MAX}</span>
          </div>
          {rows.map((r) => (
            <div key={r.label} className="vrow">
              <span className="vrow-label">
                {r.label} {r.note && <span className="dim">{r.note}</span>}
              </span>
              <span className="vrow-bar">
                <span className={r.points < 0 ? "neg" : ""} style={{ width: `${Math.round(r.fill * 100)}%` }} />
              </span>
              <span className={`vrow-pts ${r.points < 0 ? "bad" : ""}`}>{r.points > 0 ? "+" : ""}{r.points}</span>
            </div>
          ))}
          <div className="vibes-tip-foot">
            Vibes ease toward <b>{Math.round(v.target)}</b> a quarter of the gap a day. They bring visitors, applicants and investors.
          </div>
        </div>
      )}
    </div>
  );
}

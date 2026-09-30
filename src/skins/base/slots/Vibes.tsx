import { useEffect, useRef, useState } from "react";
import { useT } from "../../context";
import type { StatsVM } from "../../../ui/hud/types";

const ARROW = { up: "▲", down: "▼", flat: "▬" } as const;

/** The park rating, big, with a trend arrow and a tooltip that shows where every point came from. */
export function Vibes({ vibes }: { vibes: StatsVM["vibes"] }) {
  const t = useT();
  // Open while hovered (a mouse) or after a tap (a finger); a tap outside closes it.
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hover || pinned;
  const root = useRef<HTMLDivElement>(null);
  const trend = vibes.trend;

  // Tap elsewhere to close (the tooltip opens on hover with a mouse and on tap with a finger).
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) {
        setHover(false);
        setPinned(false);
      }
    };
    window.addEventListener("pointerdown", away);
    return () => window.removeEventListener("pointerdown", away);
  }, [open]);

  return (
    <div className="vibes" ref={root} onPointerEnter={(e) => e.pointerType === "mouse" && setHover(true)} onPointerLeave={(e) => e.pointerType === "mouse" && setHover(false)}>
      <button className={`vibes-btn trend-${trend}`} onClick={() => setPinned((p) => !p)} aria-expanded={open} aria-label={`${t("stats.vibes")} ${vibes.value}, ${trend === "flat" ? "steady" : trend === "up" ? "rising" : "falling"}`}>
        <span className="vibes-label">{t("stats.vibes")}</span>
        <span className="vibes-value">{vibes.value}</span>
        <span className="vibes-arrow" aria-hidden>
          {ARROW[trend]}
        </span>
      </button>
      {open && (
        <div className="vibes-tip panel" role="tooltip">
          <div className="vibes-tip-title">
            {t("vibes.tipTitle")} <span className="dim">{vibes.value} of {vibes.max}</span>
          </div>
          {vibes.rows.map((r) => (
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
          <div className="vibes-tip-foot">{t("vibes.tipFoot", { target: vibes.target })}</div>
        </div>
      )}
    </div>
  );
}

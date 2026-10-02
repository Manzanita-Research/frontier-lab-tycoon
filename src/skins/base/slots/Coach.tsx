import { useLayoutEffect, useRef, useState } from "react";
import { useT } from "../../context";
import { placeBalloon } from "../../kit";
import type { SlotPropsMap } from "../../types";

/** A friendly little robot head: the base skin's coach. */
function Buddy() {
  return (
    <svg viewBox="0 0 40 40" width="38" height="38" aria-hidden>
      <path d="M20 4v6" stroke="var(--flt-color-line)" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="20" cy="4" r="2.8" fill="var(--flt-color-accent)" stroke="var(--flt-color-line)" strokeWidth="2" />
      <rect x="6" y="10" width="28" height="24" rx="9" fill="var(--flt-color-inset)" stroke="var(--flt-color-line)" strokeWidth="2.6" />
      <circle cx="14.5" cy="21" r="3.4" fill="var(--flt-color-panel)" stroke="var(--flt-color-line)" strokeWidth="2" />
      <circle cx="25.5" cy="21" r="3.4" fill="var(--flt-color-panel)" stroke="var(--flt-color-line)" strokeWidth="2" />
      <circle cx="15.4" cy="21.4" r="1.4" fill="var(--flt-color-line)" />
      <circle cx="26.4" cy="21.4" r="1.4" fill="var(--flt-color-line)" />
      <path d="M14 28.5q6 3.2 12 0" fill="none" stroke="var(--flt-color-line)" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

/**
 * The coach mark's balloon: one line of copy, "3 of 7", and a way out. It sits beside the thing the host has lit (never on it),
 * clear of the ticker and the top bar; on a phone it docks to the top or the bottom, whichever is away from the target.
 * No Continue button: the line waits for you to do the thing.
 */
export function Coach({ coach, anchor, panel, avoid, layout, actions }: SlotPropsMap["Coach"]) {
  const t = useT();
  const ref = useRef<HTMLElement>(null);
  const [size, setSize] = useState({ w: 340, h: 104 });
  useLayoutEffect(() => {
    const b = ref.current?.getBoundingClientRect();
    if (b && (Math.abs(b.width - size.w) > 1 || Math.abs(b.height - size.h) > 1)) setSize({ w: b.width, h: b.height });
  }, [coach.id, layout.width, layout.height, size.w, size.h]);
  const view = { w: layout.width, h: layout.height };
  const place = layout.compact ? placeBalloon(anchor, size, view, { gap: 12, panel, avoid, prefer: ["top", "bottom"], margin: { top: 56, bottom: 8, left: 8, right: 8 } }) : placeBalloon(anchor, size, view, { gap: 20, panel, avoid, margin: { top: 76, bottom: 48, left: 12, right: 12 } });
  return (
    <aside
      key={coach.id}
      ref={ref}
      className={`coach panel ${layout.compact ? "docked" : ""} ${place ? `side-${place.side}` : ""}`}
      style={layout.compact ? { top: place.y } : { left: place.x, top: place.y }}
      role="status"
      aria-live="polite"
      aria-label={t("assistant.title")}
    >
      <div className="coach-face">
        <Buddy />
      </div>
      <div className="coach-body">
        {coach.guide && coach.ask && <p className="coach-ask">{t("coach.ask", { ask: coach.ask })}</p>}
        <p className="coach-say">{coach.text}</p>
        <div className="coach-foot">
          {coach.guide ? (
            <button type="button" className="coach-skip" onClick={() => actions.endShowMe()}>
              {t("coach.gotIt")}
            </button>
          ) : (
            <span className="coach-step">{t("coach.step", { n: coach.step, total: coach.of })}</span>
          )}
          {coach.canSkip && (
            <button type="button" className="coach-skip" onClick={() => actions.coachSkip()}>
              {t("coach.skip")}
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

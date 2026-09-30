import { useRef, useState } from "react";
import { FactionChip, Portrait } from "../../kit";
import { useT } from "../../context";
import type { SlotPropsMap } from "../../types";

/** Swipe distance (px) that counts as a swipe on the phone sheet. */
const SWIPE = 28;

/**
 * The card that opens when you tap a walker. On a phone it is a short bottom sheet (name, their most urgent need, what
 * they are thinking) so the map stays in view; swipe it up (or tap the handle) for the rest, swipe it down to fold it
 * again, and once more to close it.
 */
export function Inspector({ inspector: who, layout, actions }: SlotPropsMap["Inspector"]) {
  const t = useT();
  const compact = layout.compact;
  const [more, setMore] = useState(false);
  const drag = useRef<number | null>(null);
  const sheet = compact && !more;
  const worst = who.needs.length > 0 ? who.needs.reduce((a, b) => (b.urgency > a.urgency ? b : a)) : null;
  const shown = sheet && worst ? [worst] : who.needs;
  const onDown = (e: React.PointerEvent) => {
    drag.current = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onUp = (e: React.PointerEvent) => {
    const from = drag.current;
    drag.current = null;
    if (from === null) return;
    const dy = e.clientY - from;
    if (dy < -SWIPE) setMore(true);
    else if (dy > SWIPE) {
      if (more) setMore(false);
      else actions.closeInspector();
    } else setMore((m) => !m);
  };
  return (
    <aside className={`inspector panel ${compact ? "sheet" : ""} ${more ? "more" : ""}`} aria-label={`${who.name}, ${who.role}`}>
      {compact && (
        <div className="sheet-handle" onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => (drag.current = null)} role="button" aria-label={more ? t("inspector.fold") : t("inspector.more")} aria-expanded={more}>
          <i />
        </div>
      )}
      <div className="insp-head">
        <Portrait who={who.portrait} className="portrait" />
        <div className="insp-title">
          <div className="insp-name">{who.name}</div>
          <div className="insp-role">{who.role}</div>
          <div className="insp-tags">
            <span className={`tag mood-${who.mood}`}>{who.moodLabel}</span>
            <span className="tag kind">{who.kindLabel}</span>
            {who.faction && <FactionChip faction={who.faction} />}
          </div>
        </div>
        <button className="insp-x" onClick={() => actions.closeInspector()} aria-label={t("inspector.close")}>
          ×
        </button>
      </div>
      <div className="insp-status">{who.status}</div>
      {shown.length > 0 && (
        <div className="insp-needs">
          {shown.map((n) => (
            <div key={n.key} className="need">
              <span className="need-label">{n.label}</span>
              <span className={`need-bar ${n.tone}`}>
                <span style={{ width: `${n.pct}%` }} />
              </span>
              <span className="need-pct">{n.pct}%</span>
            </div>
          ))}
        </div>
      )}
      <div className="insp-thought">
        <span className="insp-thought-label">{t("inspector.thinking")}</span> <q>{who.thought}</q>
      </div>
      {!sheet && (
        <>
          <ul className="insp-history">
            {who.history.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
          <button className={`follow ${who.following ? "on" : ""}`} onClick={() => actions.follow(who.id, !who.following)} aria-pressed={who.following}>
            {who.following ? t("inspector.following") : t("inspector.follow")}
          </button>
        </>
      )}
    </aside>
  );
}

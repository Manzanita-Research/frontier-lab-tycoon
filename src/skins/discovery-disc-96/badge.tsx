// The Field Trip Badge: tap someone and their badge hangs off the corner of the screen. Thermometer meters for needs,
// a fact box for what they're thinking, and a big FOLLOW button. On a phone it is a short sheet you can swipe up.
import { useRef, useState } from "react";
import { FactionChip, Portrait } from "../kit";
import { useT } from "../context";
import type { SlotPropsMap } from "../types";
import { Icon } from "./art";

const SWIPE = 28;
const MOOD_ICON = { content: "happy", slumped: "slumped", miserable: "miserable", resigned: "resigned" } as const;

/** "Dr. Ada Gradient" and "Ada Gradient" are both "Ada"; "Agent-0042" stays whole. */
export function firstName(name: string): string {
  const words = name.replace(/^(dr|prof|mr|ms|mx)\.?\s+/i, "").split(/\s+/);
  return words[0] || name;
}

export function Inspector({ inspector: who, layout, actions }: SlotPropsMap["Inspector"]) {
  const t = useT();
  const compact = layout.compact;
  const [more, setMore] = useState(false);
  const drag = useRef<number | null>(null);
  const sheet = compact && !more;
  const first = firstName(who.name);
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
    <aside className={`dd-badge ${compact ? "sheet" : ""} ${more ? "more" : ""} kind-${who.kind}`} aria-label={`${who.name}, ${who.role}`}>
      <span className="dd-hole" aria-hidden />
      <div className="dd-badge-top">
        {compact && (
          <div className="dd-handle" onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => (drag.current = null)} role="button" aria-label={more ? t("inspector.fold") : t("inspector.more")} aria-expanded={more}>
            <i />
          </div>
        )}
        <h4>FIELD TRIP BADGE</h4>
        <small>
          {who.lab} · please return to front desk
        </small>
        <button type="button" className="dd-x" onClick={() => actions.closeInspector()} aria-label={t("inspector.close")}>
          <Icon name="close" size={22} />
        </button>
      </div>
      <div className="dd-badge-in">
        <div className="dd-who">
          <div className="dd-photo">
            <Portrait who={who.portrait} className="dd-portrait" />
            <span className="dd-id">#{who.badge}</span>
          </div>
          <div className="dd-who-text">
            <div className="dd-name">{who.name}</div>
            <div className="dd-role">{who.role}</div>
            <div className={`dd-mood mood-${who.mood}`}>
              <Icon name={MOOD_ICON[who.mood]} size={20} /> {who.moodLabel.toLowerCase()}
              <span className="dd-kind">{who.kindLabel}</span>
              {who.faction && <FactionChip faction={who.faction} className="dd-faction" />}
            </div>
          </div>
        </div>
        <div className="dd-status">{who.status}</div>
        {shown.length > 0 && (
          <div className="dd-therms">
            {shown.map((n) => (
              <div key={n.key} className="dd-therm">
                <span className="dd-tl">{n.label}</span>
                <span className={`dd-th ${n.tone}`} role="meter" aria-label={n.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={n.pct}>
                  <i style={{ width: `${n.pct}%` }} />
                </span>
                <span className="dd-tp">{n.pct}%</span>
              </div>
            ))}
          </div>
        )}
        <div className="dd-fact">
          <b>
            {first} {t("inspector.thinking")}
          </b>
          <q>{who.thought}</q>
        </div>
        {!sheet && (
          <ul className="dd-log" aria-label="Trip log">
            {who.history.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        )}
        <button type="button" className={`dd-go ${who.following ? "on" : ""}`} onClick={() => actions.follow(who.id, !who.following)} aria-pressed={who.following}>
          {who.following ? (
            t("inspector.following")
          ) : (
            <>
              <Icon name="play" size={18} /> {t("inspector.follow")} {first}
            </>
          )}
        </button>
      </div>
    </aside>
  );
}

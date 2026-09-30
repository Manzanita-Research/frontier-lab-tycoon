// The contestant card: whoever you tap steps up to the mic. A pixel portrait, their name in lights, needs as rows of
// little hearts, what they are thinking as the lyric on screen, and a big pink FOLLOW button.
// On a phone it is a short bottom sheet (swipe up for the rest, down to fold it, once more to close it), like the base.
import { useRef, useState } from "react";
import { useT } from "../context";
import type { SlotPropsMap } from "../types";
import { D, Face, Heart, Note, Tape } from "./art";

/** Swipe distance (px) that counts as a swipe on the phone sheet. */
const SWIPE = 28;
const HEARTS = 8;

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
    <aside className={`kn-card kn-plastic ${compact ? "sheet" : ""} ${more ? "more" : ""}`} aria-label={`${who.name}, ${who.role}`}>
      {compact && (
        <div className="kn-handle" onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => (drag.current = null)} role="button" aria-label={more ? t("inspector.fold") : t("inspector.more")} aria-expanded={more}>
          <i />
        </div>
      )}
      <div className="kn-screen">
        <div className="kn-p2">
          <span>
            <Heart /> <D>{`CONTESTANT #${who.badge}`}</D>
          </span>
          <button type="button" className="kn-x" onClick={() => actions.closeInspector()} aria-label={t("inspector.close")}>
            ×
          </button>
        </div>
        <div className="kn-who">
          <div className="kn-ava">
            <Face who={who.portrait} />
          </div>
          <div className="kn-who-text">
            <h2 className="kn-name">
              <D>{who.name}</D>
            </h2>
            <div className="kn-role">{who.role}</div>
            <div className="kn-tags">
              <span className={`kn-tag kn-mood ${who.mood}`}>{who.moodLabel}</span>
              <span className="kn-tag">{who.kindLabel}</span>
            </div>
          </div>
        </div>
        {!sheet && <div className="kn-status">{who.status}</div>}
        {shown.length > 0 && (
          <div className="kn-meters">
            {shown.map((n) => {
              const lit = n.pct > 0 ? Math.max(1, Math.round(n.value * HEARTS)) : 0;
              return (
                <div key={n.key} className={`kn-meter ${n.tone}`}>
                  <span className="kn-ml">{n.label}</span>
                  <span className="kn-hearts" role="img" aria-label={`${n.label} ${n.pct}%`}>
                    {Array.from({ length: HEARTS }, (_, i) => (
                      <i key={i} className={i < lit ? "on" : ""} />
                    ))}
                  </span>
                  <span className="kn-mp">
                    <D>{`${n.pct}%`}</D>
                  </span>
                </div>
              );
            })}
          </div>
        )}
        <div className="kn-lyric">
          <span className="kn-lyric-h">
            <Note /> {t("inspector.thinking")}
          </span>
          <q>{who.thought}</q>
        </div>
        {!sheet && (
          <>
            <details className="kn-liner">
              <summary>Liner notes</summary>
              <ul>
                {who.history.map((h) => (
                  <li key={h}>
                    <D>{h}</D>
                  </li>
                ))}
              </ul>
            </details>
            <button type="button" className={`kn-follow ${who.following ? "on" : ""}`} onClick={() => actions.follow(who.id, !who.following)} aria-pressed={who.following} aria-label={who.following ? t("inspector.following") : t("inspector.follow")}>
              <Tape n={who.following ? 0 : 1} /> {who.following ? "FOLLOWING" : t("inspector.follow").toUpperCase()}
            </button>
          </>
        )}
      </div>
    </aside>
  );
}

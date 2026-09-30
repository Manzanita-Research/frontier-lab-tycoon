import { useRef, useState } from "react";
import { atoms, send } from "../app/game";
import { useApp } from "../app/hooks";
import type { Inspect, NeedBar } from "../sim/inspect";
import { Portrait } from "./Portrait";
import { useCompact } from "./useCompact";

/** How a bar reads: green when the need is fine, amber when it is nagging, red when it is shouting. */
function barTone(n: NeedBar): "ok" | "warn" | "bad" {
  const urgency = n.goodWhenHigh ? 1 - n.value : n.value;
  return urgency < 0.4 ? "ok" : urgency < 0.7 ? "warn" : "bad";
}

const MOOD: Record<Inspect["mood"], string> = { content: "Content", slumped: "Slumped", miserable: "Miserable", resigned: "Resigned" };
const KIND: Record<Inspect["kind"], string> = { researcher: "Researcher", agent: "Agent", visitor: "Visitor", protester: "Protester" };

/** How much a bar is shouting, 0 (fine) to 1 (desperate). */
const urgency = (n: NeedBar) => (n.goodWhenHigh ? 1 - n.value : n.value);

/** Swipe distance (px) that counts as a swipe on the phone sheet. */
const SWIPE = 28;

/**
 * The card that opens when you tap a walker. On a phone it is a short bottom sheet (name, their most urgent need, what
 * they are thinking) so the map stays in view; swipe it up (or tap the handle) for the rest, swipe it down to fold it
 * again, and once more to close it.
 */
export function Inspector() {
  const who = useApp(atoms.inspect);
  const following = useApp(atoms.follow);
  const compact = useCompact();
  const [more, setMore] = useState(false);
  const drag = useRef<number | null>(null);
  if (!who) return null;
  const drift = who.kind === "agent" ? (who.needs.find((n) => n.key === "drift")?.value ?? 0) : 0;
  const sheet = compact && !more;
  const worst = who.needs.length > 0 ? who.needs.reduce((a, b) => (urgency(b) > urgency(a) ? b : a)) : null;
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
      else send({ type: "SELECT", id: null });
    } else setMore((m) => !m);
  };
  return (
    <aside className={`inspector panel ${compact ? "sheet" : ""} ${more ? "more" : ""}`} aria-label={`${who.name}, ${who.role}`}>
      {compact && (
        <div className="sheet-handle" onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => (drag.current = null)} role="button" aria-label={more ? "Fold the card" : "Show more"} aria-expanded={more}>
          <i />
        </div>
      )}
      <div className="insp-head">
        <Portrait who={who} drift={drift} />
        <div className="insp-title">
          <div className="insp-name">{who.name}</div>
          <div className="insp-role">{who.role}</div>
          <div className="insp-tags">
            <span className={`tag mood-${who.mood}`}>{MOOD[who.mood]}</span>
            <span className="tag kind">{KIND[who.kind]}</span>
          </div>
        </div>
        <button className="insp-x" onClick={() => send({ type: "SELECT", id: null })} aria-label="Close">
          ×
        </button>
      </div>
      <div className="insp-status">{who.status}</div>
      {shown.length > 0 && (
        <div className="insp-needs">
          {shown.map((n) => (
            <div key={n.key} className="need">
              <span className="need-label">{n.label}</span>
              <span className={`need-bar ${barTone(n)}`}>
                <span style={{ width: `${Math.round(n.value * 100)}%` }} />
              </span>
              <span className="need-pct">{Math.round(n.value * 100)}%</span>
            </div>
          ))}
        </div>
      )}
      <div className="insp-thought">
        <span className="insp-thought-label">Thinking</span> <q>{who.thought}</q>
      </div>
      {!sheet && (
        <>
          <ul className="insp-history">
            {who.history.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
          <button className={`follow ${following ? "on" : ""}`} onClick={() => send({ type: "SET_FOLLOW", follow: !following })} aria-pressed={following}>
            {following ? "Following. Tap to let go" : "Follow"}
          </button>
        </>
      )}
    </aside>
  );
}

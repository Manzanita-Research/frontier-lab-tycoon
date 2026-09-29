import { atoms, send } from "../app/game";
import { useApp } from "../app/hooks";
import type { Inspect, NeedBar } from "../sim/inspect";
import { Portrait } from "./Portrait";

/** How a bar reads: green when the need is fine, amber when it is nagging, red when it is shouting. */
function barTone(n: NeedBar): "ok" | "warn" | "bad" {
  const urgency = n.goodWhenHigh ? 1 - n.value : n.value;
  return urgency < 0.4 ? "ok" : urgency < 0.7 ? "warn" : "bad";
}

const MOOD: Record<Inspect["mood"], string> = { content: "Content", slumped: "Slumped", miserable: "Miserable", resigned: "Resigned" };
const KIND: Record<Inspect["kind"], string> = { researcher: "Researcher", agent: "Agent", visitor: "Visitor", protester: "Protester" };

/** The card that opens when you tap a walker. */
export function Inspector() {
  const who = useApp(atoms.inspect);
  const following = useApp(atoms.follow);
  if (!who) return null;
  const drift = who.kind === "agent" ? (who.needs.find((n) => n.key === "drift")?.value ?? 0) : 0;
  return (
    <aside className="inspector panel" aria-label={`${who.name}, ${who.role}`}>
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
      {who.needs.length > 0 && (
        <div className="insp-needs">
          {who.needs.map((n) => (
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
      <ul className="insp-history">
        {who.history.map((h) => (
          <li key={h}>{h}</li>
        ))}
      </ul>
      <button className={`follow ${following ? "on" : ""}`} onClick={() => send({ type: "SET_FOLLOW", follow: !following })} aria-pressed={following}>
        {following ? "Following. Tap to let go" : "Follow"}
      </button>
    </aside>
  );
}

import { useRef, useState } from "react";
import { useT } from "../kit";
import type { SlotPropsMap } from "../types";
import type { InspectorVM, PortraitVM } from "../../ui/hud/types";
import { binomial, shortName, specimenNo } from "./lore";

/** Swipe distance (px) that counts as a swipe on the phone sheet. */
const SWIPE = 28;

/** Who is standing on the plate: a person in the colours of their 3D model, or an agent with a visor that glows by how far it has drifted. */
function Figure({ who }: { who: PortraitVM }) {
  if (who.kind === "agent") {
    const glow = who.drift > 0.65 ? "#C8505A" : who.drift > 0.3 ? "#8A6BB8" : "#2A9FB3";
    return (
      <g>
        <path d="M130 20v9" stroke="#22313A" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="130" cy="18" r="3.2" fill={glow} />
        <rect x="108" y="29" width="44" height="40" rx="12" fill="#F6F1E4" stroke="#22313A" strokeWidth="1.4" />
        <rect x="116" y="40" width="28" height="10" rx="5" fill={glow} />
        <path d="M122 59h16" stroke="#22313A" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M112 69v22h36V69" fill="#DDD3BD" stroke="#22313A" strokeWidth="1.4" strokeLinejoin="round" />
      </g>
    );
  }
  return (
    <g>
      <circle cx="130" cy="38" r="17" fill={who.head} />
      <path d="M96 96q2-32 34-34t34 34Z" fill={who.body} />
      {who.kind === "visitor" && <rect x="139" y="72" width="13" height="9" rx="1.5" fill="#FBF7EE" stroke="#22313A" strokeWidth="1" />}
      {who.kind === "protester" && (
        <g stroke="#22313A" strokeWidth="1.4" strokeLinecap="round">
          <path d="M174 92V44" />
          <rect x="160" y="30" width="30" height="20" rx="2" fill="#FBF7EE" />
          <path d="M165 37h20M165 43h13" />
        </g>
      )}
    </g>
  );
}

/** The plate of the specimen card: a figure on a tan ground with a scale bar, and its caption underneath like a printed figure. */
function Plate({ who, caption }: { who: InspectorVM; caption: string }) {
  return (
    <figure className="fa-figure">
      <div className="fa-plate" role="img" aria-label={`Plate: ${who.name}, ${caption}`}>
        <svg viewBox="0 0 260 92" preserveAspectRatio="xMidYMax slice" aria-hidden>
          <ellipse cx="130" cy="92" rx="52" ry="5" fill="#22313A" opacity=".10" />
          <Figure who={who.portrait} />
          <g stroke="#22313A" strokeOpacity=".45" strokeWidth="1" strokeLinecap="round">
            <path d="M206 84h30M206 81v6M236 81v6" />
          </g>
          <text x="221" y="76" textAnchor="middle" fontSize="9" fontStyle="italic" fill="#5D6B6F" fontFamily="Fraunces, Georgia, serif">
            1 intern
          </text>
        </svg>
      </div>
      <figcaption className="fa-fig">fig. 1: {caption}</figcaption>
    </figure>
  );
}

/**
 * The specimen card: what you get when you tap somebody. A specimen number, their name in serif with the Latin
 * underneath, a plate, hairline needs and a pull-quote of what they are thinking. On a phone it is a short bottom sheet
 * (swipe up for the plate and the rest, down to fold it, once more to close).
 */
export function Inspector({ inspector: who, layout, actions }: SlotPropsMap["Inspector"]) {
  const t = useT();
  const compact = layout.compact;
  const [more, setMore] = useState(false);
  const drag = useRef<number | null>(null);
  const sheet = compact && !more;
  const worst = who.needs.length > 0 ? who.needs.reduce((a, b) => (b.urgency > a.urgency ? b : a)) : null;
  const shown = sheet && worst ? [worst] : who.needs;
  const first = shortName(who.name);
  const caption = `observed ${who.status.charAt(0).toLowerCase()}${who.status.slice(1)}`;
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
    <aside className={`fa-spec fa-paper ${compact ? "sheet" : ""} ${more ? "more" : ""}`} aria-label={`${who.name}, ${who.role}`}>
      {compact && (
        <div className="fa-handle" onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => (drag.current = null)} role="button" aria-label={more ? t("inspector.fold") : t("inspector.more")} aria-expanded={more}>
          <i />
        </div>
      )}
      <button className="fa-x" onClick={() => actions.closeInspector()} aria-label={t("inspector.close")}>
        ×
      </button>
      <div className="fa-sc">
        Specimen no. {specimenNo(who.badge)} · {who.kindLabel}
      </div>
      <h2 className="fa-spec-name">{who.name}</h2>
      <div className="fa-latin">{binomial(who)}</div>
      <div className="fa-role">
        {who.role} · <span className={`fa-mood mood-${who.mood}`}>{who.moodLabel.toLowerCase()}</span>
      </div>
      {!sheet && <Plate who={who} caption={caption} />}
      {shown.length > 0 && (
        <div className="fa-needs">
          {shown.map((n) => (
            <div key={n.key} className="fa-need">
              <span>{n.label}</span>
              <span className="fa-line" aria-hidden>
                <i className={n.tone} style={{ width: `${n.pct}%` }} />
              </span>
              <span className="fa-need-v">{n.pct}%</span>
            </div>
          ))}
        </div>
      )}
      <blockquote className="fa-quote">
        <span className="fa-sr">{t("inspector.thinking")}: </span>“{who.thought}”
      </blockquote>
      {!sheet && (
        <>
          <ul className="fa-history">
            {who.history.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
          <button className={`fa-follow ${who.following ? "on" : ""}`} onClick={() => actions.follow(who.id, !who.following)} aria-pressed={who.following}>
            {who.following ? t("inspector.following") : `${t("inspector.follow")} ${first}`}
          </button>
        </>
      )}
    </aside>
  );
}

const KIND_NOUN = { researcher: "Researcher", agent: "Agent", visitor: "Visitor", protester: "Protester" } as const;

/**
 * One thought, in an italic serif bubble with the thinker's name in small capitals above. The game pins it to the
 * walker and measures it, so it keeps to the box it draws. The name is a `::before` (from `data-who`) so the thought
 * stays the bubble's first text node, which is what photo mode reads to paint it onto the picture.
 */
export function Bubble({ bubble }: SlotPropsMap["Bubble"]) {
  const who = bubble.kind === "agent" ? bubble.speaker : `${KIND_NOUN[bubble.kind]} · ${bubble.speaker}`;
  return (
    <div className={`bubble bubble-${bubble.kind} fa-bubble`} data-who={who}>
      {bubble.text}
    </div>
  );
}

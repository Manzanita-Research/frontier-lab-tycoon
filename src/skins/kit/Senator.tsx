import type { SenatorVM } from "../../ui/hud/types";

const ink = "#2b2233";

/**
 * A senator as a capsule portrait (The Hearing, FLT-21): a tall pill with the face, the hair, the suit and the tie in the
 * senator's own colours. `asking` opens the mouth. Any skin may use it; `className` lets a skin size and frame it.
 */
export function Senator({ who, className = "senator-portrait" }: { who: Pick<SenatorVM, "id" | "look" | "asking">; className?: string }) {
  const { skin, suit, hair, tie, glasses } = who.look;
  const clip = `senator-${who.id}`;
  return (
    <svg className={className} viewBox="0 0 56 76" aria-hidden>
      <defs>
        <clipPath id={clip}>
          <rect x="2" y="2" width="52" height="72" rx="26" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect x="0" y="0" width="56" height="76" fill="#e9e1cf" />
        <path d="M0 20 H56 M0 34 H56" stroke="#d8ccb2" strokeWidth="2" />
        <path d="M4 78 Q6 52 28 52 Q50 52 52 78 Z" fill={suit} stroke={ink} strokeWidth="2.4" />
        <path d="M22 52 L28 60 L34 52 Z" fill="#fbfbf7" stroke={ink} strokeWidth="1.6" />
        <path d="M28 57 L25 62 L28 76 L31 62 Z" fill={tie} stroke={ink} strokeWidth="1.6" />
        <rect x="23" y="44" width="10" height="9" fill={skin} stroke={ink} strokeWidth="2" />
        <ellipse cx="28" cy="33" rx="13" ry="14.5" fill={skin} stroke={ink} strokeWidth="2.4" />
        <path d="M14.5 31 Q14 17 28 17 Q42 17 41.5 31 Q37 23 28 23.5 Q19 23 14.5 31 Z" fill={hair} stroke={ink} strokeWidth="2" />
        <circle cx="23" cy="33" r="1.8" fill={ink} />
        <circle cx="33" cy="33" r="1.8" fill={ink} />
        {glasses && (
          <g fill="none" stroke={ink} strokeWidth="1.6">
            <circle cx="23" cy="33" r="4.4" />
            <circle cx="33" cy="33" r="4.4" />
            <path d="M27.4 33 H28.6" />
          </g>
        )}
        {who.asking ? <ellipse cx="28" cy="41" rx="3.2" ry="2.4" fill={ink} /> : <path d="M24 41 H32" stroke={ink} strokeWidth="2" strokeLinecap="round" />}
      </g>
      <rect x="2" y="2" width="52" height="72" rx="26" fill="none" stroke={ink} strokeWidth="2.6" />
    </svg>
  );
}

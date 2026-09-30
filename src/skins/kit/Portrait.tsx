import type { PortraitVM } from "../../ui/hud/types";

const ink = "#3a2a1c";

/** A little chip of the walker you tapped, in the colours of the 3D one, with a face that matches their mood. */
export function Portrait({ who, className = "portrait" }: { who: PortraitVM; className?: string }) {
  const mouth = who.happiness > 0.62 ? "M22 34 Q28 40 34 34" : who.happiness > 0.38 ? "M23 36 H33" : "M22 38 Q28 32 34 38";
  if (who.kind === "agent") {
    const glow = who.drift > 0.65 ? "#ff4f8a" : who.drift > 0.3 ? "#a07cff" : "#3ff0ff";
    return (
      <svg className={className} viewBox="0 0 56 56" aria-hidden>
        <circle cx="28" cy="28" r="27" fill="#eaf6ff" stroke={ink} strokeWidth="2.5" />
        <rect x="11" y="15" width="34" height="30" rx="9" fill="#f7fbff" stroke={ink} strokeWidth="2.5" />
        <rect x="16" y="24" width="24" height="8" rx="4" fill={glow} stroke={ink} strokeWidth="1.8" />
        <circle cx="28" cy="11" r="3.4" fill={glow} stroke={ink} strokeWidth="1.8" />
        <path d="M22 39 H34" stroke={ink} strokeWidth="2.2" fill="none" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 56 56" aria-hidden>
      <circle cx="28" cy="28" r="27" fill="#fff0c8" stroke={ink} strokeWidth="2.5" />
      <path d="M8 52 Q10 40 28 40 Q46 40 48 52 Z" fill={who.body} stroke={ink} strokeWidth="2.5" />
      <circle cx="28" cy="25" r="12" fill={who.head} stroke={ink} strokeWidth="2.5" />
      <circle cx="23.5" cy="23" r="1.9" fill={ink} />
      <circle cx="32.5" cy="23" r="1.9" fill={ink} />
      <path d={mouth} transform="translate(0 -2)" stroke={ink} strokeWidth="2.2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

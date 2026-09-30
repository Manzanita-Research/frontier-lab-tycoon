// Discovery Disc '96's clip art: the globe, the robot guide, stickers and the little icons every slot borrows.
// Everything is inline SVG with a thick black outline (no emoji, no font glyphs) so it looks the same on every machine.
import type { ReactNode } from "react";

/** The five-point star of the Vibes sticker, in a 100 x 96 box. */
export const STAR_POINTS = "50,0 61,34 98,35 68,56 79,92 50,70 21,92 32,56 2,35 39,34";

/** A spiky "NEW!" burst around (50, 50): `spikes` points, alternating outer and inner radius. */
export function burstPoints(spikes = 14, outer = 48, inner = 38): string {
  const pts: string[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / spikes - Math.PI / 2;
    pts.push(`${(50 + r * Math.cos(a)).toFixed(1)},${(50 + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(" ");
}

const INK = "#111";

/** A star with a black outline: filled gold when `on`, an empty dashed outline when not. */
export function StarIcon({ on, size = 30, className = "" }: { on: boolean; size?: number; className?: string }) {
  return (
    <svg className={`dd-staricon ${on ? "on" : ""} ${className}`} width={size} height={size} viewBox="-4 -4 108 104" aria-hidden focusable="false">
      <polygon points={STAR_POINTS} fill={on ? "#FFD400" : "#fff"} stroke={INK} strokeWidth={on ? 6 : 5} strokeLinejoin="round" strokeDasharray={on ? undefined : "8 7"} />
      {on && <path d="M50 14l6 18M30 40l-8 4" stroke="#fff" strokeWidth="5" strokeLinecap="round" fill="none" opacity=".75" />}
    </svg>
  );
}

export function Globe({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 60 60" aria-hidden focusable="false">
      <circle cx="30" cy="30" r="26" fill="#1A5BD6" stroke={INK} strokeWidth="3" />
      <path d="M14 18c6 2 8 8 14 6s4 10 10 10 6 8 2 12M36 8c-2 6 6 8 12 6M8 34c6-2 10 4 8 10" fill="#1FA24A" stroke={INK} strokeWidth="2.5" />
      <path d="M4 30h52M30 4c-9 8-9 44 0 52M30 4c9 8 9 44 0 52" fill="none" stroke={INK} strokeWidth="1.5" opacity=".35" />
      <path d="M17 13c3-3 7-5 11-5" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none" opacity=".7" />
    </svg>
  );
}

export type RobotMood = "happy" | "cheer" | "oops" | "think";

/** Chip, the guide bot. The mood changes the mouth, the arms and (in CSS) how it bounces. */
export function Robot({ mood = "happy", className = "" }: { mood?: RobotMood; className?: string }) {
  const mouth = { happy: "M18 27q5 3 10 0", cheer: "M17 26q6 6 12 0", oops: "M18 30q5 -4 10 0", think: "M19 28h8" }[mood];
  const arms = { happy: "M12 38l-8 6M34 38l8-6", cheer: "M12 38l-8-9M34 38l8-9", oops: "M12 38l-6 4M34 38l6 4", think: "M12 38l-8 6M34 38l4-8" }[mood];
  return (
    <svg className={`dd-robot ${className}`} data-mood={mood} viewBox="0 0 46 56" aria-hidden focusable="false">
      <ellipse cx="23" cy="54" rx="14" ry="2" fill={INK} opacity=".2" />
      <g className="dd-robot-body">
        <rect x="8" y="10" width="30" height="22" rx="4" fill="#bfc6d6" stroke={INK} strokeWidth="2.5" />
        <circle cx="17" cy="21" r={mood === "oops" ? 4.6 : 4} fill="#fff" stroke={INK} strokeWidth="2" />
        <circle cx="29" cy="21" r={mood === "oops" ? 4.6 : 4} fill="#fff" stroke={INK} strokeWidth="2" />
        <circle cx="17" cy={mood === "think" ? 19.6 : 21} r="1.6" fill={INK} />
        <circle cx="29" cy={mood === "think" ? 19.6 : 21} r="1.6" fill={INK} />
        <path d={mouth} stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M23 10V4" stroke={INK} strokeWidth="2.5" />
        <circle className="dd-bulb" cx="23" cy="3" r="3" fill="#E4222B" stroke={INK} strokeWidth="2" />
        <rect x="12" y="34" width="22" height="16" rx="3" fill="#1A5BD6" stroke={INK} strokeWidth="2.5" />
        <path d={arms} stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none" />
        <rect x="18" y="38" width="10" height="6" fill="#FFD400" stroke={INK} strokeWidth="1.5" />
        {mood === "oops" && <path d="M40 12c2 3 3 5 0 7-3-2-2-4 0-7z" fill="#7fd0ff" stroke={INK} strokeWidth="1.4" />}
        {mood === "cheer" && <path d="M4 22l1.6 3.4 3.6.5-2.6 2.6.6 3.6L4 30.3 .8 32.1l.6-3.6L-1.2 26l3.6-.5z" fill="#FFD400" stroke={INK} strokeWidth="1.2" transform="translate(2 -18)" />}
      </g>
    </svg>
  );
}

export function Trend({ trend }: { trend: "up" | "down" | "flat" }) {
  return (
    <svg className={`dd-trend ${trend}`} width="14" height="12" viewBox="0 0 14 12" aria-hidden focusable="false">
      {trend === "up" && <path d="M7 1l6 10H1z" />}
      {trend === "down" && <path d="M7 11L1 1h12z" />}
      {trend === "flat" && <path d="M1 4h12v4H1z" />}
    </svg>
  );
}

const line = { fill: "none", stroke: INK, strokeWidth: 2.4, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** Small sticker-style icons for buttons and headings. All are 24 x 24. */
export function Icon({ name, size = 24 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    close: <path d="M6 6l12 12M18 6L6 18" {...line} strokeWidth={3.4} stroke="currentColor" />,
    pause: (
      <>
        <rect x="6" y="5" width="4" height="14" fill="currentColor" />
        <rect x="14" y="5" width="4" height="14" fill="currentColor" />
      </>
    ),
    play: <path d="M7 4l13 8-13 8z" fill="currentColor" />,
    clock: (
      <>
        <circle cx="12" cy="13" r="8" fill="#fff" stroke={INK} strokeWidth="2.4" />
        <path d="M12 8v5l3 2" {...line} />
        <path d="M5 4l3 2M19 4l-3 2" {...line} />
      </>
    ),
    megaphone: (
      <>
        <path d="M3 10h5l9-5v14l-9-5H3z" fill="#fff" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M6 15l1 5h3l-1-5" fill="#fff" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
        <path d="M20 9c1.5 2 1.5 4 0 6" {...line} />
      </>
    ),
    news: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="1.5" fill="#fff" stroke={INK} strokeWidth="2.2" />
        <rect x="6" y="7" width="12" height="4" fill={INK} />
        <path d="M6 14h5M6 17h5M13 14h5M13 17h5" {...line} strokeWidth={1.8} />
      </>
    ),
    sound: (
      <>
        <path d="M3 9h4l5-4v14l-5-4H3z" fill="#fff" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M15 9c2 2 2 4 0 6M18 6c4 4 4 8 0 12" {...line} />
      </>
    ),
    mute: (
      <>
        <path d="M3 9h4l5-4v14l-5-4H3z" fill="#fff" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M15 9l6 6M21 9l-6 6" stroke="#D9171F" strokeWidth="3" strokeLinecap="round" />
      </>
    ),
    sliders: (
      <>
        <path d="M4 7h16M4 12h16M4 17h16" {...line} />
        <rect x="14" y="4.5" width="4" height="5" rx="1" fill="#FFD400" stroke={INK} strokeWidth="2" />
        <rect x="6" y="9.5" width="4" height="5" rx="1" fill="#E4222B" stroke={INK} strokeWidth="2" />
        <rect x="12" y="14.5" width="4" height="5" rx="1" fill="#1A5BD6" stroke={INK} strokeWidth="2" />
      </>
    ),
    palette: (
      <>
        <path d="M12 3C6.5 3 3 7 3 11.5S6.5 20 10.5 20c2 0 2.5-1.5 1.5-3s0-3 2-3h3c2.5 0 4-1.5 4-3.5C21 6.5 17 3 12 3z" fill="#fff" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
        <circle cx="8" cy="10" r="1.7" fill="#E4222B" stroke={INK} strokeWidth="1.2" />
        <circle cx="12" cy="7.5" r="1.7" fill="#FFD400" stroke={INK} strokeWidth="1.2" />
        <circle cx="16" cy="10" r="1.7" fill="#1FA24A" stroke={INK} strokeWidth="1.2" />
      </>
    ),
    camera: (
      <>
        <path d="M2 8h5l2-3h6l2 3h5v12H2z" fill="#fff" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
        <circle cx="12" cy="13.5" r="4" fill="#7fd0ff" stroke={INK} strokeWidth="2.2" />
        <circle cx="10.8" cy="12.2" r="1" fill="#fff" />
      </>
    ),
    flask: (
      <>
        <path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3" fill="#fff" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        <path d="M7.5 15h9l2 3.5a1 1 0 0 1-.9 1.5H6.4a1 1 0 0 1-.9-1.5z" fill="#7B3FC4" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
      </>
    ),
    wagon: (
      <>
        <path d="M4 14V9a8 6 0 0 1 16 0v5" fill="#fff" stroke={INK} strokeWidth="2.2" />
        <path d="M2 14h20l-2 3H4z" fill="#E4222B" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
        <circle cx="8" cy="19" r="2.5" fill="#fff" stroke={INK} strokeWidth="2.2" />
        <circle cx="17" cy="19" r="2.5" fill="#fff" stroke={INK} strokeWidth="2.2" />
      </>
    ),
    bolt: <path d="M13 2L4 14h6l-1 8 9-12h-6z" fill="#FFD400" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />,
    trophy: (
      <>
        <path d="M7 3h10v6a5 5 0 0 1-10 0z" fill="#FFD400" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M7 5H3c0 4 1.5 5 4 5M17 5h4c0 4-1.5 5-4 5" fill="none" stroke={INK} strokeWidth="2.2" />
        <path d="M12 14v4M8 21h8l-1-3H9z" fill="#FFD400" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
      </>
    ),
    balloon: (
      <path d="M4 5h16v10h-8l-5 5v-5H4z" fill="#fff" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
    ),
    list: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="2" fill="#fff" stroke={INK} strokeWidth="2.2" />
        <path d="M8 9l2 2 3.5-3.5M8 16h8" {...line} />
      </>
    ),
    happy: (
      <>
        <circle cx="12" cy="12" r="9" fill="#FFD400" stroke={INK} strokeWidth="2.2" />
        <circle cx="9" cy="10" r="1.2" fill={INK} />
        <circle cx="15" cy="10" r="1.2" fill={INK} />
        <path d="M8 14q4 4 8 0" {...line} strokeWidth={2} />
      </>
    ),
    slumped: (
      <>
        <circle cx="12" cy="12" r="9" fill="#FFD400" stroke={INK} strokeWidth="2.2" />
        <path d="M7.5 10.5h3M13.5 10.5h3M9 16h6" {...line} strokeWidth={2} />
        <path d="M18 3h3l-3 3h3" {...line} strokeWidth={1.6} />
      </>
    ),
    miserable: (
      <>
        <circle cx="12" cy="12" r="9" fill="#FFD400" stroke={INK} strokeWidth="2.2" />
        <circle cx="9" cy="10" r="1.2" fill={INK} />
        <circle cx="15" cy="10" r="1.2" fill={INK} />
        <path d="M8 17q4-4 8 0" {...line} strokeWidth={2} />
        <path d="M17.5 12.5c1 1.5 1.5 2.5 0 3.5-1.5-1-1-2 0-3.5z" fill="#7fd0ff" stroke={INK} strokeWidth="1.2" />
      </>
    ),
    resigned: (
      <>
        <circle cx="12" cy="12" r="9" fill="#e6e6e6" stroke={INK} strokeWidth="2.2" />
        <path d="M7.5 10h3M13.5 10h3M8.5 16h7" {...line} strokeWidth={2} />
      </>
    ),
    chevron: <path d="M6 9l6 6 6-6" {...line} strokeWidth={3.4} stroke="currentColor" />,
    more: (
      <>
        <circle cx="6" cy="12" r="2" fill="currentColor" />
        <circle cx="12" cy="12" r="2" fill="currentColor" />
        <circle cx="18" cy="12" r="2" fill="currentColor" />
      </>
    ),
  };
  return (
    <svg className="dd-icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable="false">
      {paths[name]}
    </svg>
  );
}

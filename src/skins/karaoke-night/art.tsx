// Karaoke Night's little pictures: music notes, stars and hearts, the tape-deck symbols, the arcade buttons' icons and the
// contestant's pixel face. All inline SVG (no emoji, no font glyphs: the pixel faces have no notes or stars, and a
// headless machine would show empty boxes).
import type { ReactNode } from "react";
import type { PortraitVM } from "../../ui/hud/types";

type GlyphProps = { className?: string };
const G = { "aria-hidden": true, focusable: false } as const;

export function Note({ className = "" }: GlyphProps) {
  return (
    <svg className={`kn-glyph ${className}`} viewBox="0 0 12 12" shapeRendering="crispEdges" {...G}>
      <path d="M6 1h4v2H8v7H7v1H4v-1H3V8h1V7h2z" fill="currentColor" />
    </svg>
  );
}

export function Notes({ className = "" }: GlyphProps) {
  return (
    <svg className={`kn-glyph ${className}`} viewBox="0 0 12 12" shapeRendering="crispEdges" {...G}>
      <path d="M4 2h7v7H10v1H8V9H9V4H6v5H5v1H3V9H4z" fill="currentColor" />
    </svg>
  );
}

export function Star({ className = "" }: GlyphProps) {
  return (
    <svg className={`kn-glyph ${className}`} viewBox="0 0 12 12" {...G}>
      <polygon points="6,0.4 7.7,4.2 11.8,4.6 8.7,7.3 9.6,11.4 6,9.3 2.4,11.4 3.3,7.3 0.2,4.6 4.3,4.2" fill="currentColor" />
    </svg>
  );
}

export function Heart({ className = "" }: GlyphProps) {
  return (
    <svg className={`kn-glyph ${className}`} viewBox="0 0 8 8" shapeRendering="crispEdges" {...G}>
      <polygon points="0,2 2,0 4,2 6,0 8,2 8,4 4,8 0,4" fill="currentColor" />
    </svg>
  );
}

export function Check({ className = "" }: GlyphProps) {
  return (
    <svg className={`kn-glyph ${className}`} viewBox="0 0 12 12" shapeRendering="crispEdges" {...G}>
      <path d="M1 6h2v2h2v2h1V8h1V6h1V4h1V2h2v2h-1v2H9v2H8v2H7v1H4V10H3V8H1z" fill="currentColor" />
    </svg>
  );
}

/** A little triangle for trends: up, down or a level dash. */
export function Trend({ trend, className = "" }: { trend: "up" | "down" | "flat"; className?: string }) {
  return (
    <svg className={`kn-glyph kn-trend ${trend} ${className}`} viewBox="0 0 8 8" shapeRendering="crispEdges" {...G}>
      {trend === "up" && <polygon points="4,1 8,7 0,7" fill="currentColor" />}
      {trend === "down" && <polygon points="0,1 8,1 4,7" fill="currentColor" />}
      {trend === "flat" && <rect x="0" y="3" width="8" height="2" fill="currentColor" />}
    </svg>
  );
}

// ---------- the tape deck ----------

/** Pause (two bars) or play (one, two or three triangles: play, fast forward, encore). */
export function Tape({ n }: { n: number }) {
  if (n === 0) {
    return (
      <svg className="kn-tape" viewBox="0 0 20 16" shapeRendering="crispEdges" {...G}>
        <rect x="4" y="1" width="4" height="14" fill="currentColor" />
        <rect x="12" y="1" width="4" height="14" fill="currentColor" />
      </svg>
    );
  }
  const count = n >= 10 ? 3 : n >= 3 ? 2 : 1;
  return (
    <svg className="kn-tape" viewBox={`0 0 ${6 + count * 7} 16`} shapeRendering="crispEdges" {...G}>
      {Array.from({ length: count }, (_, i) => (
        <polygon key={i} points={`${3 + i * 7},1 ${3 + i * 7 + 8},8 ${3 + i * 7},15`} fill="currentColor" />
      ))}
    </svg>
  );
}

export type ToolIconName = "news" | "sound" | "mute" | "mixer" | "skins" | "record" | "more";

/** The small keys on the deck: news, sound, mixer, skins, the record button, and "more". */
export function ToolIcon({ name }: { name: ToolIconName }) {
  switch (name) {
    case "news":
      return (
        <svg className="kn-tool-ic" viewBox="0 0 24 24" shapeRendering="crispEdges" {...G}>
          <path d="M3 4h15v14a2 2 0 0 0 2 2H5a2 2 0 0 1-2-2z" fill="currentColor" />
          <path d="M18 8h3v10a2 2 0 0 1-3 2z" fill="currentColor" opacity=".6" />
          <path d="M6 7h9v3H6zM6 12h4v1H6zM6 15h4v1H6zM12 12h3v1h-3zM12 15h3v1h-3z" fill="#F4EEFF" />
        </svg>
      );
    case "sound":
    case "mute":
      return (
        <svg className="kn-tool-ic" viewBox="0 0 24 24" shapeRendering="crispEdges" {...G}>
          <path d="M3 9h4l5-4v14l-5-4H3z" fill="currentColor" />
          {name === "sound" ? <path d="M15 9h2v6h-2zM18 6h2v12h-2z" fill="currentColor" /> : <path d="M15 9h2v2h2V9h2v2h-2v2h2v2h-2v-2h-2v2h-2v-2h2v-2h-2z" fill="currentColor" />}
        </svg>
      );
    case "mixer":
      return (
        <svg className="kn-tool-ic" viewBox="0 0 24 24" shapeRendering="crispEdges" {...G}>
          <path d="M5 3h2v18H5zM11 3h2v18h-2zM17 3h2v18h-2z" fill="currentColor" opacity=".55" />
          <rect x="3" y="12" width="6" height="4" fill="currentColor" />
          <rect x="9" y="5" width="6" height="4" fill="currentColor" />
          <rect x="15" y="15" width="6" height="4" fill="currentColor" />
        </svg>
      );
    case "skins":
      return (
        <svg className="kn-tool-ic" viewBox="0 0 24 24" shapeRendering="crispEdges" {...G}>
          <path d="M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" fill="currentColor" />
        </svg>
      );
    case "record":
      return (
        <svg className="kn-tool-ic" viewBox="0 0 24 24" shapeRendering="crispEdges" {...G}>
          <path d="M2 8h5l2-3h6l2 3h5v12H2z" fill="currentColor" />
          <rect x="8" y="10" width="8" height="8" fill="#170C27" />
          <rect x="10" y="12" width="4" height="4" fill="#FF5FA2" />
        </svg>
      );
    case "more":
      return (
        <svg className="kn-tool-ic" viewBox="0 0 24 24" shapeRendering="crispEdges" {...G}>
          <rect x="3" y="10" width="4" height="4" fill="currentColor" />
          <rect x="10" y="10" width="4" height="4" fill="currentColor" />
          <rect x="17" y="10" width="4" height="4" fill="currentColor" />
        </svg>
      );
  }
}

// ---------- arcade buttons ----------

/** Each build tool's button colour: the face and the darker rim. */
export const BUTTON_COLOURS: Record<string, [face: string, rim: string]> = {
  path: ["#8F78E8", "#5D45B8"],
  cluster: ["#4FC3FF", "#1F86C2"],
  hall: ["#FF5FA2", "#C22A6D"],
  gateway: ["#FF9A5C", "#C9632A"],
  kombucha: ["#FFD84D", "#C9A21C"],
  nap: ["#5CF2C9", "#1FB58C"],
  snack: ["#FF7A6B", "#C2453A"],
  demo: ["#FF7BAC", "#C24A78"],
  datacenter: ["#7F9BFF", "#4A63C9"],
  gas: ["#C79BFF", "#8B5FCF"],
  solar: ["#FFE87A", "#C9B03A"],
  staff: ["#6FE3FF", "#2A9FC2"],
  senate: ["#FFD36F", "#C2902A"],
  bulldoze: ["#B9B0C9", "#7D728F"],
};
const FALLBACK: [string, string] = ["#B9A4FF", "#7F62DB"];
export const buttonColours = (kind: string) => BUTTON_COLOURS[kind] ?? FALLBACK;

const W = "#fff";
const INK = "#170C27";

/** The white glyph on an arcade button, one per build tool (a plain disc for one the skin doesn't know). */
export function BuildIcon({ kind }: { kind: string }) {
  let art: ReactNode;
  switch (kind) {
    case "path":
      art = (
        <>
          <path d="M4 20 16 26 28 20 16 14Z" fill={W} opacity=".6" />
          <path d="M4 14 16 20 28 14 16 8Z" fill={W} />
        </>
      );
      break;
    case "cluster":
      art = (
        <>
          <rect x="5" y="8" width="10" height="18" rx="2" fill={W} />
          <rect x="17" y="12" width="10" height="14" rx="2" fill={W} />
          <path d="M8 13h4M8 17h4M20 17h4M20 21h4" stroke={INK} strokeWidth="2" />
        </>
      );
      break;
    case "hall":
      art = (
        <>
          <path d="M5 24a11 11 0 0 1 22 0Z" fill={W} />
          <rect x="3" y="24" width="26" height="3" fill={W} />
          <rect x="15" y="6" width="2" height="7" fill={W} />
        </>
      );
      break;
    case "gateway":
      art = <path d="M7 27V14a9 9 0 0 1 18 0v13h-5V15a4 4 0 0 0-8 0v12Z" fill={W} />;
      break;
    case "kombucha":
      art = (
        <>
          <path d="M13 4h6v5l3 4v14H10V13l3-4Z" fill={W} />
          <rect x="12" y="17" width="8" height="5" fill={INK} opacity=".35" />
        </>
      );
      break;
    case "nap":
      art = (
        <>
          <rect x="4" y="12" width="24" height="12" rx="6" fill={W} />
          <path d="M20 5h5l-5 5h5" stroke={W} strokeWidth="2.4" fill="none" />
        </>
      );
      break;
    case "snack":
      art = (
        <>
          <rect x="5" y="5" width="22" height="22" rx="2" fill={W} />
          <path d="M5 12h22M5 20h22M12 5v22M20 5v22" stroke={INK} strokeWidth="2" opacity=".45" />
          <rect x="13" y="13" width="6" height="6" fill={INK} />
        </>
      );
      break;
    case "demo":
      art = (
        <>
          <rect x="5" y="6" width="22" height="14" rx="2" fill={W} />
          <path d="M14 10v6l5-3Z" fill="#FF5FA2" />
          <rect x="15" y="20" width="2" height="6" fill={W} />
          <rect x="10" y="25" width="12" height="2" fill={W} />
        </>
      );
      break;
    case "datacenter":
      art = (
        <>
          <rect x="4" y="5" width="24" height="7" rx="1.5" fill={W} />
          <rect x="4" y="14" width="24" height="7" rx="1.5" fill={W} />
          <rect x="4" y="23" width="24" height="5" rx="1.5" fill={W} />
          <path d="M8 8.5h4M8 17.5h4M8 25.5h4" stroke={INK} strokeWidth="2" />
        </>
      );
      break;
    case "gas":
      art = (
        <>
          <rect x="6" y="14" width="20" height="13" rx="2" fill={W} />
          <path d="M10 14V5h5v9M18 14V8h4v6" fill={W} />
          <path d="M10 21h12" stroke={INK} strokeWidth="2" opacity=".5" />
        </>
      );
      break;
    case "solar":
      art = (
        <>
          <path d="M4 25l4-13h16l4 13z" fill={W} />
          <path d="M8 18h16M13 12l-1 13M19 12l1 13" stroke={INK} strokeWidth="1.6" opacity=".45" />
          <circle cx="25" cy="7" r="3.5" fill={W} />
        </>
      );
      break;
    case "senate":
      art = (
        <>
          <path d="M9 15a7 6.5 0 0 1 14 0Z" fill={W} />
          <path d="M6 15h20v3H6ZM4 25h24v3H4ZM8 18h2v7H8ZM12.5 18h2v7h-2ZM17.5 18h2v7h-2ZM22 18h2v7h-2Z" fill={W} />
        </>
      );
      break;
    case "staff":
      art = (
        <>
          <circle cx="16" cy="10" r="5" fill={W} />
          <path d="M5 27c0-6 5-10 11-10s11 4 11 10z" fill={W} />
        </>
      );
      break;
    case "bulldoze":
      art = (
        <>
          <rect x="9" y="10" width="14" height="10" rx="2" fill={W} />
          <circle cx="11" cy="24" r="3" fill={W} />
          <circle cx="21" cy="24" r="3" fill={W} />
          <rect x="4" y="16" width="6" height="3" fill={W} />
        </>
      );
      break;
    default:
      art = <circle cx="16" cy="16" r="9" fill={W} />;
  }
  return (
    <svg className="kn-bicon" viewBox="0 0 32 32" {...G}>
      {art}
    </svg>
  );
}

// ---------- the contestant's pixel face ----------

/**
 * A 16x16 pixel portrait of whoever you tapped, in the colours of the 3D walker: hair, face, a mouth that follows their
 * mood, a jumper. Agents get a little robot whose visor colour is how far they have drifted.
 */
export function Face({ who }: { who: PortraitVM }) {
  if (who.kind === "agent") {
    const glow = who.drift > 0.65 ? "#FF4F8A" : who.drift > 0.3 ? "#B49CFF" : "#3FF0FF";
    return (
      <svg className="kn-face" viewBox="0 0 16 16" shapeRendering="crispEdges" {...G}>
        <rect width="16" height="16" fill="#1E2B4A" />
        <rect x="7" y="1" width="2" height="2" fill={glow} />
        <rect x="7" y="3" width="2" height="1" fill="#8FA0C8" />
        <rect x="3" y="4" width="10" height="8" fill="#DCE8FF" />
        <rect x="4" y="6" width="8" height="3" fill={glow} />
        <rect x="6" y="10" width="4" height="1" fill="#5A6B94" />
        <rect x="2" y="7" width="1" height="3" fill="#8FA0C8" />
        <rect x="13" y="7" width="1" height="3" fill="#8FA0C8" />
        <rect x="4" y="12" width="8" height="4" fill="#5A79C8" />
        <rect x="7" y="13" width="2" height="1" fill={glow} />
      </svg>
    );
  }
  const mouth = who.happiness > 0.62 ? (
    <>
      <rect x="6" y="9" width="4" height="1" fill="#7A3B2E" />
      <rect x="5" y="8" width="1" height="1" fill="#7A3B2E" />
      <rect x="10" y="8" width="1" height="1" fill="#7A3B2E" />
    </>
  ) : who.happiness > 0.38 ? (
    <rect x="6" y="9" width="4" height="1" fill="#7A3B2E" />
  ) : (
    <>
      <rect x="6" y="8" width="4" height="1" fill="#7A3B2E" />
      <rect x="5" y="9" width="1" height="1" fill="#7A3B2E" />
      <rect x="10" y="9" width="1" height="1" fill="#7A3B2E" />
    </>
  );
  return (
    <svg className="kn-face" viewBox="0 0 16 16" shapeRendering="crispEdges" {...G}>
      <rect width="16" height="16" fill="#FFD9C7" />
      <rect x="4" y="2" width="8" height="3" fill="#3B2415" />
      <rect x="3" y="3" width="1" height="4" fill="#3B2415" />
      <rect x="12" y="3" width="1" height="4" fill="#3B2415" />
      <rect x="4" y="5" width="8" height="5" fill={who.head} />
      <rect x="5" y="6" width="2" height="1" fill="#2A1740" />
      <rect x="9" y="6" width="2" height="1" fill="#2A1740" />
      {mouth}
      <rect x="3" y="11" width="10" height="5" fill={who.body} />
      <rect x="6" y="10" width="4" height="1" fill={who.head} />
    </svg>
  );
}

// ---------- what is on the karaoke video when the launch livestream goes wrong ----------

/** The monitor's picture: a golden retriever walking on, last quarter's chart, a frozen spinner, or no signal. */
export function Scene({ mishap }: { mishap: string }) {
  if (mishap === "dog") {
    return (
      <svg className="kn-scene" viewBox="0 0 24 14" shapeRendering="crispEdges" {...G}>
        <rect x="1" y="3" width="4" height="2" fill="#E0A030" />
        <rect x="0" y="2" width="2" height="2" fill="#F0C060" />
        <rect x="4" y="5" width="13" height="5" fill="#E0A030" />
        <rect x="5" y="9" width="11" height="1" fill="#C88820" />
        <rect x="16" y="2" width="6" height="5" fill="#E8B040" />
        <rect x="16" y="2" width="2" height="4" fill="#B87820" />
        <rect x="21" y="4" width="3" height="3" fill="#F0C060" />
        <rect x="23" y="4" width="1" height="1" fill="#170C27" />
        <rect x="19" y="3" width="1" height="1" fill="#170C27" />
        <rect x="21" y="7" width="2" height="2" fill="#FF6080" />
        <rect x="5" y="10" width="2" height="4" fill="#C88820" />
        <rect x="9" y="10" width="2" height="4" fill="#E0A030" />
        <rect x="13" y="10" width="2" height="4" fill="#C88820" />
        <rect x="16" y="10" width="2" height="4" fill="#E0A030" />
      </svg>
    );
  }
  if (mishap === "wrongChart") {
    return (
      <svg className="kn-scene" viewBox="0 0 60 36" shapeRendering="crispEdges" {...G}>
        <rect width="60" height="36" fill="#FFF6FB" />
        <rect x="6" y="14" width="9" height="20" fill="#8F78E8" />
        <rect x="20" y="20" width="9" height="14" fill="#8F78E8" />
        <rect x="34" y="6" width="9" height="28" fill="#2FD9A8" />
        <rect x="48" y="24" width="9" height="10" fill="#8F78E8" />
        <path d="M3 34h56M3 2v32" stroke="#2A1740" />
      </svg>
    );
  }
  if (mishap === "frozen") {
    return (
      <svg className="kn-scene kn-spinner" viewBox="0 0 16 16" shapeRendering="crispEdges" {...G}>
        {[[6, 0], [11, 2], [12, 6], [11, 11], [6, 12], [1, 11], [0, 6], [1, 2]].map(([x, y], i) => (
          <rect key={i} x={x} y={y} width="4" height="4" fill="#FFF6FB" opacity={0.25 + (i % 4) * 0.25} />
        ))}
      </svg>
    );
  }
  return (
    <svg className="kn-scene" viewBox="0 0 24 14" shapeRendering="crispEdges" {...G}>
      {[0, 4, 8, 12, 16, 20].map((x, i) => (
        <rect key={x} x={x} y={0} width="4" height="14" fill={["#FFF6FB", "#FFE45C", "#4FE3FF", "#5CF2C9", "#FF5FA2", "#8F78E8"][i]} />
      ))}
    </svg>
  );
}

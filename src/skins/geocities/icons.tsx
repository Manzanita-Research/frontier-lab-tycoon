// GeoCities' clip art: 24×24 pixel icons as one SVG sprite (rendered once, by the Layout), the digging worker, and the
// pixel mugshot for the About Me page. Flat colours and 1px black outlines, the way a 1998 hobbyist drew them.
import type { PortraitVM } from "../../ui/hud/types";

const S = { shapeRendering: "crispEdges" } as const;

export function GcSprite() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden focusable="false">
      <defs>
        <symbol id="gci-path" viewBox="0 0 24 24" {...S}><path d="M2 14 12 19 22 14 12 9Z" fill="#e8c37a" stroke="#000" /></symbol>
        <symbol id="gci-cluster" viewBox="0 0 24 24" {...S}><rect x="3" y="4" width="8" height="17" fill="#39f" stroke="#000" /><rect x="13" y="8" width="8" height="13" fill="#39f" stroke="#000" /><path d="M5 8h4M5 12h4M15 12h4" stroke="#0f0" /></symbol>
        <symbol id="gci-hall" viewBox="0 0 24 24" {...S}><path d="M3 19a9 9 0 0 1 18 0z" fill="#fff" stroke="#000" /><rect x="1" y="19" width="22" height="3" fill="#a0f" stroke="#000" /></symbol>
        <symbol id="gci-gateway" viewBox="0 0 24 24" {...S}><path d="M4 22V10a8 8 0 0 1 16 0v12h-4V11a4 4 0 0 0-8 0v11z" fill="#f80" stroke="#000" /></symbol>
        <symbol id="gci-kombucha" viewBox="0 0 24 24" {...S}><path d="M9 2h6v4l3 3v13H6V9l3-3z" fill="#fd0" stroke="#000" /></symbol>
        <symbol id="gci-nap" viewBox="0 0 24 24" {...S}><rect x="2" y="10" width="20" height="9" rx="4" fill="#8cf" stroke="#000" /><path d="M15 3h5l-5 5h5" stroke="#fff" fill="none" /></symbol>
        <symbol id="gci-snack" viewBox="0 0 24 24" {...S}><rect x="3" y="3" width="18" height="18" fill="#fd0" stroke="#000" /><path d="M3 9h18M3 15h18M9 3v18M15 3v18" stroke="#000" /><rect x="10" y="10" width="4" height="4" fill="#e00" /></symbol>
        <symbol id="gci-demo" viewBox="0 0 24 24" {...S}><rect x="3" y="3" width="18" height="12" fill="#f4a" stroke="#000" /><path d="M10 6v6l5-3z" fill="#fff" /></symbol>
        <symbol id="gci-datacenter" viewBox="0 0 24 24" {...S}><rect x="2" y="3" width="20" height="6" fill="#aab" stroke="#000" /><rect x="2" y="10" width="20" height="6" fill="#aab" stroke="#000" /><rect x="2" y="17" width="20" height="5" fill="#aab" stroke="#000" /><path d="M5 6h3M5 13h3M5 19.5h3" stroke="#0a0" /></symbol>
        <symbol id="gci-gas" viewBox="0 0 24 24" {...S}><rect x="4" y="9" width="16" height="12" fill="#ddd" stroke="#000" /><path d="M8 9V3h4v6M14 9V5h3v4" fill="#fff" stroke="#000" /><path d="M8 15h8" stroke="#000" /></symbol>
        <symbol id="gci-solar" viewBox="0 0 24 24" {...S}><path d="M3 18l3-10h12l3 10z" fill="#06c" stroke="#000" /><path d="M6 13h12M10 8l-1 10M14 8l1 10" stroke="#9cf" /><circle cx="19" cy="5" r="2.5" fill="#fd0" stroke="#000" /></symbol>
        <symbol id="gci-bulldoze" viewBox="0 0 24 24" {...S}><rect x="6" y="7" width="11" height="8" fill="#fd0" stroke="#000" /><circle cx="8" cy="19" r="2.5" fill="#fff" stroke="#000" /><circle cx="16" cy="19" r="2.5" fill="#fff" stroke="#000" /></symbol>
        <symbol id="gci-staff" viewBox="0 0 24 24" {...S}><circle cx="12" cy="14" r="5" fill="#fc9" stroke="#000" /><path d="M6 12a6 6 0 0 1 12 0z" fill="#fd0" stroke="#000" /><rect x="4" y="11" width="16" height="2" fill="#fd0" stroke="#000" /><path d="M6 23q6-6 12 0" fill="#f80" stroke="#000" /></symbol>
        <symbol id="gci-coin" viewBox="0 0 24 24" {...S}><circle cx="12" cy="12" r="9" fill="#fd0" stroke="#000" /><path d="M12 6v12M9 9h5v3h-4v3h5" stroke="#000" fill="none" /></symbol>
        <symbol id="gci-hourglass" viewBox="0 0 24 24" {...S}><path d="M6 3h12v3l-4 6 4 6v3H6v-3l4-6-4-6z" fill="#fff" stroke="#000" /><path d="M8 5h8l-3 5h-2zM9 19h6l-2-4h-2z" fill="#f80" /></symbol>
        <symbol id="gci-brain" viewBox="0 0 24 24" {...S}><path d="M12 4C9 2 5 4 5 8c-2 1-2 5 0 6 0 3 4 5 7 5s7-2 7-5c2-1 2-5 0-6 0-4-4-6-7-4z" fill="#f9a" stroke="#000" /><path d="M12 5v13M8 10h3M13 12h3" stroke="#000" fill="none" /></symbol>
        <symbol id="gci-megaphone" viewBox="0 0 24 24" {...S}><path d="M3 9h5l8-4v14l-8-4H3z" fill="#f80" stroke="#000" /><path d="M6 15l2 6h3l-2-6" fill="#ccc" stroke="#000" /></symbol>
        <symbol id="gci-trophy" viewBox="0 0 24 24" {...S}><path d="M7 3h10v6a5 5 0 0 1-10 0z" fill="#fd0" stroke="#000" /><path d="M7 5H3v2a4 4 0 0 0 4 4M17 5h4v2a4 4 0 0 1-4 4" fill="none" stroke="#000" /><path d="M12 14v4M8 21h8v-3H8z" fill="#fd0" stroke="#000" /></symbol>
        <symbol id="gci-chip" viewBox="0 0 24 24" {...S}><rect x="6" y="6" width="12" height="12" fill="#39f" stroke="#000" /><path d="M9 3v3M12 3v3M15 3v3M9 18v3M12 18v3M15 18v3M3 9h3M3 12h3M3 15h3M18 9h3M18 12h3M18 15h3" stroke="#000" /><rect x="9" y="9" width="6" height="6" fill="#0f0" /></symbol>
        <symbol id="gci-star" viewBox="0 0 16 16" {...S}><path d="M8 0 9.4 6.6 16 8 9.4 9.4 8 16 6.6 9.4 0 8 6.6 6.6Z" fill="currentColor" /></symbol>
        <symbol id="gci-mail" viewBox="0 0 24 24" {...S}><rect x="2" y="5" width="20" height="14" fill="#fff" stroke="#000" /><path d="M2 5l10 8 10-8" fill="none" stroke="#000" /></symbol>
        <symbol id="gci-note" viewBox="0 0 24 24" {...S}><rect x="3" y="4" width="18" height="16" fill="#fff" stroke="#000" /><rect x="5" y="6" width="14" height="4" fill="#000" /><path d="M5 13h6M5 16h6M13 13h6M13 16h6" stroke="#000" /></symbol>
        <symbol id="gci-speaker" viewBox="0 0 24 24" {...S}><path d="M3 9h4l5-4v14l-5-4H3z" fill="#fff" stroke="#000" /><path d="M15 9c2 2 2 4 0 6M18 6c4 4 4 8 0 12" fill="none" stroke="#000" /></symbol>
        <symbol id="gci-muted" viewBox="0 0 24 24" {...S}><path d="M3 9h4l5-4v14l-5-4H3z" fill="#fff" stroke="#000" /><path d="M15 9l6 6M21 9l-6 6" stroke="#c00" strokeWidth="2" /></symbol>
        <symbol id="gci-camera" viewBox="0 0 24 24" {...S}><path d="M2 8h5l2-3h6l2 3h5v12H2z" fill="#ccc" stroke="#000" /><circle cx="12" cy="13" r="4" fill="#8cf" stroke="#000" /></symbol>
        <symbol id="gci-palette" viewBox="0 0 24 24" {...S}><path d="M12 3C6 3 2 7 2 12s4 9 9 9c2 0 2-2 1-3s0-3 2-3h3c3 0 5-2 5-4 0-4-4-8-10-8z" fill="#fd0" stroke="#000" /><circle cx="7" cy="11" r="1.6" fill="#f00" /><circle cx="11" cy="7" r="1.6" fill="#00f" /><circle cx="16" cy="8" r="1.6" fill="#0a0" /></symbol>
        <symbol id="gci-mixer" viewBox="0 0 24 24" {...S}><rect x="3" y="3" width="18" height="18" fill="#ccc" stroke="#000" /><path d="M8 6v12M12 6v12M16 6v12" stroke="#000" /><rect x="6" y="9" width="4" height="3" fill="#f00" stroke="#000" /><rect x="10" y="14" width="4" height="3" fill="#f00" stroke="#000" /><rect x="14" y="8" width="4" height="3" fill="#f00" stroke="#000" /></symbol>
      </defs>
    </svg>
  );
}

/** A sprite icon. Unknown names draw nothing. */
export function Gci({ name, size = 24, className = "" }: { name: string; size?: number; className?: string }) {
  return (
    <svg className={`gc-ico ${className}`} width={size} height={size} aria-hidden focusable="false">
      <use href={`#gci-${name}`} />
    </svg>
  );
}

/** A four-point sparkle, in whatever colour the text around it is. */
export function Spark({ className = "" }: { className?: string }) {
  return (
    <svg className={`gc-spark ${className}`} viewBox="0 0 16 16" aria-hidden focusable="false">
      <use href="#gci-star" />
    </svg>
  );
}

/** The construction worker from the Under Construction sign: a hard hat, a shovel, and a lot of dirt to move. */
export function Worker() {
  return (
    <svg className="gc-worker" viewBox="0 0 17 17" shapeRendering="crispEdges" aria-hidden focusable="false">
      <rect x="5" y="1" width="7" height="3" fill="#fd0" stroke="#000" strokeWidth=".6" />
      <rect x="6" y="4" width="5" height="4" fill="#fc9" />
      <rect x="5" y="8" width="7" height="6" fill="#f80" />
      <rect x="3" y="9" width="2" height="5" fill="#fc9" />
      <g className="gc-shovel">
        <rect x="12" y="6" width="1" height="9" fill="#840" />
        <rect x="11" y="5" width="4" height="2" fill="#999" />
      </g>
      <rect x="1" y="15" width="15" height="2" fill="#a60" />
    </svg>
  );
}

const MOODS = { content: "#0a0", slumped: "#f80", miserable: "#f00", resigned: "#777" } as const;

/** A tiny face for the "current mood" line. */
export function MoodFace({ mood }: { mood: keyof typeof MOODS }) {
  const c = MOODS[mood];
  const mouth =
    mood === "content" ? <path d="M4 9h1v1h4V9h1" fill="none" stroke="#000" /> : mood === "slumped" ? <path d="M4 10h6" stroke="#000" /> : <path d="M4 10h1V9h4v1h1" fill="none" stroke="#000" />;
  return (
    <svg className="gc-face" viewBox="0 0 14 14" shapeRendering="crispEdges" aria-hidden focusable="false">
      <rect x="1" y="1" width="12" height="12" fill="#fd0" stroke="#000" />
      <rect x="4" y="5" width="2" height="2" fill="#000" />
      <rect x="8" y="5" width="2" height="2" fill="#000" />
      {mouth}
      <rect x="0" y="12" width="14" height="2" fill={c} />
    </svg>
  );
}

/** The photo on the About Me page: a pixel mugshot in the walker's own colours, or a robot for an agent. */
export function Mugshot({ who }: { who: PortraitVM }) {
  const mouth = who.happiness > 0.62 ? (
    <>
      <rect x="9" y="12" width="1" height="1" fill="#803020" />
      <rect x="10" y="13" width="5" height="1" fill="#803020" />
      <rect x="15" y="12" width="1" height="1" fill="#803020" />
    </>
  ) : who.happiness > 0.38 ? (
    <rect x="10" y="13" width="5" height="1" fill="#803020" />
  ) : (
    <>
      <rect x="10" y="12" width="5" height="1" fill="#803020" />
      <rect x="9" y="13" width="1" height="1" fill="#803020" />
      <rect x="15" y="13" width="1" height="1" fill="#803020" />
    </>
  );
  if (who.kind === "agent") {
    const glow = who.drift > 0.65 ? "#ff4f8a" : who.drift > 0.3 ? "#a07cff" : "#3ff0ff";
    return (
      <svg className="gc-photo" viewBox="0 0 25 30" shapeRendering="crispEdges" role="img" aria-label="Photo of me">
        <rect width="25" height="30" fill="#ffd9b0" />
        <rect x="12" y="2" width="1" height="3" fill="#000" />
        <rect x="11" y="1" width="3" height="2" fill={glow} />
        <rect x="6" y="5" width="13" height="11" fill="#e8f0f8" />
        <rect x="6" y="5" width="13" height="1" fill="#000" />
        <rect x="6" y="15" width="13" height="1" fill="#000" />
        <rect x="6" y="5" width="1" height="11" fill="#000" />
        <rect x="18" y="5" width="1" height="11" fill="#000" />
        <rect x="8" y="8" width="9" height="3" fill={glow} />
        <rect x="9" y="13" width="7" height="1" fill="#000" />
        <rect x="4" y="18" width="17" height="12" fill="#c8d4e0" />
        <rect x="11" y="21" width="3" height="3" fill={glow} />
      </svg>
    );
  }
  return (
    <svg className="gc-photo" viewBox="0 0 25 30" shapeRendering="crispEdges" role="img" aria-label="Photo of me">
      <rect width="25" height="30" fill="#ffd9b0" />
      <rect x="7" y="3" width="11" height="4" fill="#3b2415" />
      <rect x="7" y="7" width="11" height="8" fill={who.head} />
      <rect x="9" y="10" width="2" height="1" fill="#000" />
      <rect x="14" y="10" width="2" height="1" fill="#000" />
      {mouth}
      <rect x="4" y="17" width="17" height="13" fill={who.body} />
    </svg>
  );
}

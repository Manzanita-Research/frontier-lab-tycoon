// 24×24 pixel-art icons as one SVG sprite (rendered once by the Layout) and a tiny component to use them.
// Flat colours, 1px black outlines, no gradients: the look rules of Frontier 95.
import { useId, type CSSProperties } from "react";

const S = { shapeRendering: "crispEdges" } as const;

export function IconSprite() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden focusable="false">
      <defs>
        <symbol id="f95i-path" viewBox="0 0 24 24" {...S}><path d="M2 15h20v4H2z" fill="#c8a060" /><path d="M4 11h16v4H4z" fill="#e8d8a8" /><path d="M2 15h20M4 11h16" stroke="#000" /></symbol>
        <symbol id="f95i-cluster" viewBox="0 0 24 24" {...S}><rect x="3" y="4" width="8" height="17" fill="#0000c0" stroke="#000" /><rect x="13" y="8" width="8" height="13" fill="#0000c0" stroke="#000" /><path d="M5 8h4M5 12h4M15 12h4M15 16h4" stroke="#0f0" /></symbol>
        <symbol id="f95i-hall" viewBox="0 0 24 24" {...S}><path d="M3 19a9 9 0 0 1 18 0z" fill="#fff" stroke="#000" /><rect x="1" y="19" width="22" height="3" fill="#8000ff" stroke="#000" /></symbol>
        <symbol id="f95i-gateway" viewBox="0 0 24 24" {...S}><path d="M4 22V10a8 8 0 0 1 16 0v12h-4V11a4 4 0 0 0-8 0v11z" fill="#ff8000" stroke="#000" /></symbol>
        <symbol id="f95i-kombucha" viewBox="0 0 24 24" {...S}><path d="M9 2h6v4l3 3v13H6V9l3-3z" fill="#ffc000" stroke="#000" /><rect x="8" y="12" width="8" height="5" fill="#fff" stroke="#000" /></symbol>
        <symbol id="f95i-nap" viewBox="0 0 24 24" {...S}><rect x="2" y="10" width="20" height="9" rx="4" fill="#80c0ff" stroke="#000" /><path d="M15 3h5l-5 5h5" stroke="#000" fill="none" /></symbol>
        <symbol id="f95i-snack" viewBox="0 0 24 24" {...S}><rect x="3" y="3" width="18" height="18" fill="#ffe000" stroke="#000" /><path d="M3 9h18M3 15h18M9 3v18M15 3v18" stroke="#000" /><rect x="10" y="10" width="4" height="4" fill="#e00000" /></symbol>
        <symbol id="f95i-demo" viewBox="0 0 24 24" {...S}><rect x="3" y="3" width="18" height="12" fill="#ff40a0" stroke="#000" /><path d="M10 6v6l5-3z" fill="#fff" /><path d="M12 15v5M7 21h10" stroke="#000" /></symbol>
        <symbol id="f95i-datacenter" viewBox="0 0 24 24" {...S}><rect x="2" y="3" width="20" height="6" fill="#808080" stroke="#000" /><rect x="2" y="10" width="20" height="6" fill="#808080" stroke="#000" /><rect x="2" y="17" width="20" height="5" fill="#808080" stroke="#000" /><path d="M5 6h3M5 13h3M5 19.5h3" stroke="#0f0" /></symbol>
        <symbol id="f95i-gas" viewBox="0 0 24 24" {...S}><rect x="4" y="9" width="16" height="12" fill="#c0c0c0" stroke="#000" /><path d="M8 9V3h4v6M14 9V5h3v4" fill="#fff" stroke="#000" /><path d="M8 15h8" stroke="#000" /></symbol>
        <symbol id="f95i-solar" viewBox="0 0 24 24" {...S}><path d="M3 18l3-10h12l3 10z" fill="#0040c0" stroke="#000" /><path d="M6 13h12M10 8l-1 10M14 8l1 10" stroke="#80c0ff" /><circle cx="19" cy="5" r="2.5" fill="#ffe000" stroke="#000" /></symbol>
        <symbol id="f95i-security" viewBox="0 0 24 24" {...S}><rect x="2" y="10" width="20" height="12" fill="#c0c0c0" stroke="#000" /><path d="M12 2l7 3v5c0 5-3 8-7 9-4-1-7-4-7-9V5z" fill="#0000c0" stroke="#000" /><path d="M9 10l2 2 4-4" fill="none" stroke="#ffe000" strokeWidth="2" /></symbol>
        <symbol id="f95i-sandbox" viewBox="0 0 24 24" {...S}><path d="M1 14h22v7H1z" fill="#e8d8a8" stroke="#000" /><path d="M1 14h22" stroke="#c8a060" strokeWidth="2" /><path d="M4 8h6l-1 6H5z" fill="#e00000" stroke="#000" /><path d="M5 8c0-3 4-3 4 0" fill="none" stroke="#000" /><path d="M17 3v9" stroke="#000" strokeWidth="2" /><path d="M15 12h4v3h-4z" fill="#0000c0" stroke="#000" /></symbol>
        <symbol id="f95i-honeypot" viewBox="0 0 24 24" {...S}><path d="M12 12v10" stroke="#000" strokeWidth="2" /><rect x="2" y="3" width="20" height="9" fill="#008000" stroke="#000" /><path d="M5 7h10M13 5l3 2-3 2" fill="none" stroke="#fff" strokeWidth="2" /></symbol>
        <symbol id="f95i-siren" viewBox="0 0 24 24" {...S}><path d="M6 20v-8a6 6 0 0 1 12 0v8z" fill="#e00000" stroke="#000" /><rect x="3" y="20" width="18" height="3" fill="#808080" stroke="#000" /><path d="M10 11v5" stroke="#fff" strokeWidth="2" /><path d="M2 6l3 2M22 6l-3 2M12 1v3" stroke="#000" /></symbol>
        <symbol id="f95i-dz-rogueSwarm" viewBox="0 0 24 24" {...S}><rect x="8" y="7" width="8" height="12" rx="3" fill="#00c000" stroke="#000" /><path d="M8 11H3M8 15H3M16 11h5M16 15h5M10 7l-2-4M14 7l2-4" stroke="#000" /><path d="M8 13h8" stroke="#000" /><rect x="10" y="9" width="1" height="1" fill="#fff" /><rect x="13" y="9" width="1" height="1" fill="#fff" /></symbol>
        <symbol id="f95i-dz-gpuFire" viewBox="0 0 24 24" {...S}><rect x="3" y="15" width="18" height="7" fill="#0000c0" stroke="#000" /><path d="M12 2c3 4 6 6 6 10a6 6 0 0 1-12 0c0-3 2-4 3-6 1 2 1 3 2 3 0-3 0-5 1-7z" fill="#ff8000" stroke="#000" /><path d="M12 9c1 2 3 3 3 5a3 3 0 0 1-6 0c0-2 2-3 3-5z" fill="#ffe000" /></symbol>
        <symbol id="f95i-dz-weightsLeak" viewBox="0 0 24 24" {...S}><rect x="3" y="2" width="16" height="16" fill="#0000c0" stroke="#000" /><rect x="6" y="2" width="10" height="6" fill="#fff" stroke="#000" /><rect x="6" y="11" width="10" height="7" fill="#c0c0c0" stroke="#000" /><path d="M20 14c1 2 2 3 2 5a2 2 0 0 1-4 0c0-2 1-3 2-5z" fill="#00c0ff" stroke="#000" /></symbol>
        <symbol id="f95i-dz-viralJailbreak" viewBox="0 0 24 24" {...S}><rect x="4" y="11" width="16" height="11" fill="#ffe000" stroke="#000" /><path d="M8 11V7a4 4 0 0 1 8 0" fill="none" stroke="#000" strokeWidth="2" /><rect x="11" y="14" width="2" height="4" fill="#000" /></symbol>
        <symbol id="f95i-dz-gridBrownout" viewBox="0 0 24 24" {...S}><path d="M13 1L4 14h7l-2 9 11-14h-7z" fill="#ffe000" stroke="#000" /></symbol>
        <symbol id="f95i-bulldoze" viewBox="0 0 24 24" {...S}><rect x="6" y="7" width="11" height="8" fill="#ffe000" stroke="#000" /><circle cx="8" cy="19" r="2.5" fill="#fff" stroke="#000" /><circle cx="16" cy="19" r="2.5" fill="#fff" stroke="#000" /></symbol>
        <symbol id="f95i-off" viewBox="0 0 24 24" {...S}><rect x="4" y="4" width="16" height="16" fill="#c0c0c0" stroke="#000" /><path d="M12 7v6" stroke="#c00" strokeWidth="2" /><path d="M8.5 9a5 5 0 1 0 7 0" fill="none" stroke="#c00" strokeWidth="2" /></symbol>
        <symbol id="f95i-display" viewBox="0 0 24 24" {...S}><rect x="2" y="3" width="20" height="14" fill="#c0c0c0" stroke="#000" /><rect x="4" y="5" width="16" height="10" fill="#008080" stroke="#000" /><path d="M8 21h8M12 17v4" stroke="#000" /></symbol>
        <symbol id="f95i-sound" viewBox="0 0 24 24" {...S}><path d="M3 9h4l5-4v14l-5-4H3z" fill="#fff" stroke="#000" /><path d="M15 9c2 2 2 4 0 6M18 6c4 4 4 8 0 12" fill="none" stroke="#000" /></symbol>
        <symbol id="f95i-mute" viewBox="0 0 24 24" {...S}><path d="M3 9h4l5-4v14l-5-4H3z" fill="#fff" stroke="#000" /><path d="M15 9l6 6M21 9l-6 6" stroke="#c00" strokeWidth="2" /></symbol>
        <symbol id="f95i-news" viewBox="0 0 24 24" {...S}><rect x="3" y="4" width="18" height="16" fill="#fff" stroke="#000" /><rect x="5" y="6" width="14" height="4" fill="#000" /><path d="M5 13h6M5 16h6M13 13h6M13 16h6" stroke="#000" /></symbol>
        <symbol id="f95i-camera" viewBox="0 0 24 24" {...S}><path d="M2 8h5l2-3h6l2 3h5v12H2z" fill="#c0c0c0" stroke="#000" /><circle cx="12" cy="13" r="4" fill="#80c0ff" stroke="#000" /></symbol>
        <symbol id="f95i-doc" viewBox="0 0 24 24" {...S}><path d="M5 2h10l4 4v16H5z" fill="#fff" stroke="#000" /><path d="M15 2v4h4M8 11h8M8 14h8M8 17h6" stroke="#000" /></symbol>
        <symbol id="f95i-folder" viewBox="0 0 24 24" {...S}><path d="M2 5h8l2 3h10v12H2z" fill="#ffe000" stroke="#000" /></symbol>
        <symbol id="f95i-info" viewBox="0 0 24 24" {...S}><circle cx="12" cy="12" r="10" fill="#fff" stroke="#000" /><circle cx="12" cy="12" r="8" fill="#0000c0" /><path d="M12 10v7" stroke="#fff" strokeWidth="2.5" /><rect x="11" y="6" width="2" height="2" fill="#fff" /></symbol>
        <symbol id="f95i-warn" viewBox="0 0 24 24" {...S}><path d="M12 2L23 21H1z" fill="#ffe000" stroke="#000" /><path d="M12 9v6" stroke="#000" strokeWidth="2" /><rect x="11" y="17" width="2" height="2" fill="#000" /></symbol>
        <symbol id="f95i-error" viewBox="0 0 24 24" {...S}><circle cx="12" cy="12" r="10" fill="#e00000" stroke="#000" /><path d="M8 8l8 8M16 8l-8 8" stroke="#fff" strokeWidth="2.5" /></symbol>
        <symbol id="f95i-globe" viewBox="0 0 24 24" {...S}><circle cx="12" cy="12" r="9" fill="#0080ff" stroke="#000" /><path d="M6 8c3 0 3 3 6 3s1 4 4 4M15 5c-1 2 1 3 3 3" fill="none" stroke="#00c000" strokeWidth="2.5" /></symbol>
        <symbol id="f95i-chat" viewBox="0 0 24 24" {...S}><path d="M3 4h18v12h-9l-5 5v-5H3z" fill="#fff" stroke="#000" /><circle cx="8" cy="10" r="1" fill="#000" /><circle cx="12" cy="10" r="1" fill="#000" /><circle cx="16" cy="10" r="1" fill="#000" /></symbol>
        <symbol id="f95i-tool-pencil" viewBox="0 0 24 24" {...S}><path d="M4 20l1-5L16 4l4 4L9 19z" fill="#ffe000" stroke="#000" /><path d="M4 20l1-5 4 4z" fill="#f0c090" stroke="#000" /></symbol>
        <symbol id="f95i-tool-rect" viewBox="0 0 24 24" {...S}><rect x="4" y="6" width="16" height="12" fill="none" stroke="#000" strokeWidth="2" /></symbol>
        <symbol id="f95i-tool-ellipse" viewBox="0 0 24 24" {...S}><ellipse cx="12" cy="12" rx="8" ry="6" fill="none" stroke="#000" strokeWidth="2" /></symbol>
        <symbol id="f95i-tool-text" viewBox="0 0 24 24" {...S}><path d="M5 5h14v3h-1V7h-4v10h2v2H8v-2h2V7H6v1H5z" fill="#000" /></symbol>
        <symbol id="f95i-tool-eraser" viewBox="0 0 24 24" {...S}><path d="M4 15l8-9 8 6-6 7H8z" fill="#ff80c0" stroke="#000" /></symbol>
        <symbol id="f95i-tool-fill" viewBox="0 0 24 24" {...S}><path d="M6 12l6-7 7 7-6 6z" fill="#fff" stroke="#000" /><path d="M19 15c2 3 0 5 0 5s-2-2 0-5z" fill="#0000c0" /></symbol>
        <symbol id="f95i-tool-line" viewBox="0 0 24 24" {...S}><path d="M4 19L20 5" stroke="#000" strokeWidth="2" /></symbol>
        <symbol id="f95i-tool-zoom" viewBox="0 0 24 24" {...S}><circle cx="10" cy="10" r="6" fill="#c0e0ff" stroke="#000" strokeWidth="2" /><path d="M15 15l6 6" stroke="#000" strokeWidth="3" /></symbol>
        <symbol id="f95i-staff" viewBox="0 0 24 24" {...S}><circle cx="12" cy="14" r="5" fill="#ffd9b8" stroke="#000" /><path d="M6 12a6 6 0 0 1 12 0z" fill="#ffc21a" stroke="#000" /><rect x="4" y="11" width="16" height="2" fill="#ffc21a" stroke="#000" /><path d="M6 23q6-6 12 0" fill="#ff8a2b" stroke="#000" /></symbol>
        <symbol id="f95i-senate" viewBox="0 0 24 24" {...S}><path d="M12 2v4h4V3h-4" fill="#f00" stroke="#000" /><path d="M6.5 11a5.5 5 0 0 1 11 0z" fill="#ffffff" stroke="#000" /><rect x="4.5" y="11" width="15" height="2" fill="#c0c0c0" stroke="#000" /><path d="M6.5 13v6M10 13v6M14 13v6M17.5 13v6" stroke="#000" /><rect x="2.5" y="19" width="19" height="3" fill="#808080" stroke="#000" /></symbol>
        <symbol id="f95i-lock" viewBox="0 0 24 24" {...S}><rect x="5" y="11" width="14" height="10" fill="#c0c0c0" stroke="#000" /><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="#000" strokeWidth="2" /><rect x="11" y="15" width="2" height="3" fill="#000" /></symbol>
        <symbol id="f95i-help" viewBox="0 0 24 24" {...S}><circle cx="12" cy="12" r="10" fill="#ffe000" stroke="#000" /><path d="M9 9.5a3 3 0 1 1 4.5 2.6c-1 .6-1.500 1.200-1.500 2.400" fill="none" stroke="#000" strokeWidth="2" /><rect x="11" y="16.500" width="2" height="2" fill="#000" /></symbol>
        <symbol id="f95i-net" viewBox="0 0 24 24" {...S}><rect x="1" y="3" width="11" height="8" fill="#c0c0c0" stroke="#000" /><rect x="3" y="5" width="7" height="4" fill="#008080" stroke="#000" /><rect x="12" y="11" width="11" height="8" fill="#c0c0c0" stroke="#000" /><rect x="14" y="13" width="7" height="4" fill="#008080" stroke="#000" /><path d="M6 11v3h6M18 11V8h-6" fill="none" stroke="#000" /><rect x="2" y="21" width="3" height="2" fill="#00e000" /><rect x="7" y="21" width="3" height="2" fill="#e00000" /></symbol>
        <symbol id="f95i-bird" viewBox="0 0 24 24" {...S}><path d="M2 13c3 5 10 7 15 3l3-6 3-1-3-2c-1-3-5-3-7 0-2 2-2 5-1 7-4 0-7-1-10-1z" fill="#00a0ff" stroke="#000" /><path d="M6 13c2 2 5 2 7 1" fill="none" stroke="#0060c0" /><rect x="16" y="7" width="2" height="2" fill="#000" /><path d="M20 8l3 1-3 1" fill="#ffc000" stroke="#000" /></symbol>
        <symbol id="f95i-megaphone" viewBox="0 0 24 24" {...S}><path d="M3 10h4l11-6v16L7 14H3z" fill="#e00000" stroke="#000" /><path d="M7 10v4" stroke="#000" /><path d="M6 14l2 7h3l-1-6" fill="#c0c0c0" stroke="#000" /><path d="M20 9h3M20 12h3M20 15h3" stroke="#000" /></symbol>
        <symbol id="f95i-chart" viewBox="0 0 24 24" {...S}><rect x="2" y="3" width="20" height="18" fill="#fff" stroke="#000" /><path d="M5 17l4-6 4 3 6-8" fill="none" stroke="#e00000" strokeWidth="2" /></symbol>
        <symbol id="f95i-drama" viewBox="0 0 24 24" {...S}><path d="M2 9h4l10-6v18L6 15H2z" fill="#e00000" stroke="#000" /><path d="M6 9v6" stroke="#000" /><path d="M6 15l2 6h3l-1.500-6" fill="#ffe000" stroke="#000" /><path d="M19 8l3-2M19 12h4M19 16l3 2" stroke="#000" strokeWidth="1.500" /></symbol>
        <symbol id="f95i-run" viewBox="0 0 24 24" {...S}><rect x="2" y="3" width="16" height="13" fill="#fff" stroke="#000" /><rect x="2" y="3" width="16" height="3" fill="#000080" stroke="#000" /><path d="M11 13h6v-3l6 5-6 5v-3h-6z" fill="#00a000" stroke="#000" /></symbol>
        <symbol id="f95i-floppy" viewBox="0 0 24 24" {...S}><rect x="2" y="2" width="20" height="20" fill="#202080" stroke="#000" /><rect x="6" y="2" width="11" height="7" fill="#c0c0c0" stroke="#000" /><rect x="13" y="3" width="3" height="5" fill="#202080" /><rect x="5" y="12" width="14" height="10" fill="#fff" stroke="#000" /><path d="M7 15h10M7 18h10" stroke="#808080" /></symbol>
        <symbol id="f95i-programs" viewBox="0 0 24 24" {...S}><path d="M1 6h8l2 2h10v13H1z" fill="#ffe000" stroke="#000" /><rect x="8" y="10" width="13" height="10" fill="#c0c0c0" stroke="#000" /><rect x="8" y="10" width="13" height="2.500" fill="#000080" /></symbol>
      </defs>
    </svg>
  );
}

/** A sprite icon. Unknown names draw nothing. */
export function Ico({ name, size = 20, style }: { name: string; size?: number; style?: CSSProperties }) {
  return (
    <svg className="f95-ico" width={size} height={size} style={style} aria-hidden focusable="false">
      <use href={`#f95i-${name}`} />
    </svg>
  );
}

/**
 * Frontier 95's mark (FLT-70): a sunrise over water in a ring, the same one the box, the BIOS and the splash screen
 * show (the intro paints it on canvas in `paintSunrise`). Drawn on a 16-unit grid so it reads on the Start button at
 * 16 to 24 px: flat colours, one ray per gap, the sun's road on the water in three bars.
 */
export function SunriseMark({ size = 20 }: { size?: number }) {
  const clip = `f95-mark-${useId().replace(/:/g, "")}`;
  return (
    <svg className="f95-mark" width={size} height={size} viewBox="0 0 16 16" aria-hidden focusable="false">
      <defs>
        <clipPath id={clip}>
          <circle cx="8" cy="8" r="7" />
        </clipPath>
      </defs>
      <circle cx="8" cy="8" r="7" fill="#008080" />
      <g clipPath={`url(#${clip})`}>
        <rect width="16" height="4" fill="#000080" {...S} />
        <path d="M8 9.5L1 4.5M8 9.5L4 1M8 9.5V0M8 9.5L12 1M8 9.5L15 4.5" stroke="#ffe14d" strokeWidth="1.1" opacity="0.75" />
        <circle cx="8" cy="9.5" r="3.6" fill="#ffe14d" />
        <rect y="9.5" width="16" height="7" fill="#000080" {...S} />
        <rect x="4.5" y="10.5" width="7" height="1" fill="#ffe14d" {...S} />
        <rect x="5.5" y="12.25" width="5" height="1" fill="#ffe14d" {...S} />
        <rect x="6.75" y="14" width="2.5" height="0.9" fill="#ffe14d" {...S} />
      </g>
      <circle cx="8" cy="8" r="7" fill="none" stroke="#fff" strokeWidth="1" />
      <circle cx="8" cy="8" r="7.6" fill="none" stroke="#000" strokeWidth="0.6" />
    </svg>
  );
}

/** A 16×19 pixel-art portrait built from the walker's colours and mood. */
export function PixelPortrait({ kind, body, head, happiness, drift }: { kind: string; body: string; head: string; happiness: number; drift: number }) {
  if (kind === "agent") {
    const glow = drift > 0.65 ? "#ff4f8a" : drift > 0.3 ? "#a07cff" : "#3ff0ff";
    return (
      <svg className="f95-pix" viewBox="0 0 16 19" {...S} aria-hidden>
        <rect width="16" height="19" fill="#80c0ff" />
        <rect x="7" y="1" width="2" height="3" fill="#404040" />
        <rect x="6" y="0" width="4" height="2" fill={glow} />
        <rect x="3" y="4" width="10" height="8" fill="#f0f0f0" />
        <rect x="4" y="6" width="8" height="3" fill={glow} />
        <rect x="6" y="10" width="4" height="1" fill="#404040" />
        <rect x="2" y="12" width="12" height="7" fill="#808080" />
        <rect x="6" y="14" width="4" height="2" fill="#c0c0c0" />
      </svg>
    );
  }
  const mouth = happiness > 0.62 ? (
    <>
      <rect x="6" y="9" width="4" height="1" fill="#803020" />
      <rect x="5" y="8" width="1" height="1" fill="#803020" />
      <rect x="10" y="8" width="1" height="1" fill="#803020" />
    </>
  ) : happiness > 0.38 ? (
    <rect x="6" y="9" width="4" height="1" fill="#803020" />
  ) : (
    <>
      <rect x="6" y="8" width="4" height="1" fill="#803020" />
      <rect x="5" y="9" width="1" height="1" fill="#803020" />
      <rect x="10" y="9" width="1" height="1" fill="#803020" />
    </>
  );
  return (
    <svg className="f95-pix" viewBox="0 0 16 19" {...S} aria-hidden>
      <rect width="16" height="19" fill="#80c0ff" />
      <rect x="4" y="2" width="8" height="3" fill="#402010" />
      <rect x="4" y="5" width="8" height="6" fill={head} />
      <rect x="5" y="7" width="2" height="1" fill="#000" />
      <rect x="9" y="7" width="2" height="1" fill="#000" />
      {mouth}
      <rect x="2" y="12" width="12" height="7" fill={body} />
    </svg>
  );
}

// The Almanac's engravings: hairline, one accent colour each, all drawn here (no emoji, no symbol fonts: a machine with
// none would show empty boxes). Everything strokes `currentColor`, so a selected tool turns its whole icon white.
import type { ReactElement, ReactNode } from "react";

const TERRA = "#D2703F";
const DUSK = "#5B7DB1";
const GOLD = "#C79A2B";
const PLUM = "#8A6BB8";

const line = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinejoin: "round", strokeLinecap: "round" } as const;
const accent = (color: string, width = 1.8) => ({ fill: "none", stroke: color, strokeWidth: width, strokeLinecap: "round", strokeLinejoin: "round" }) as const;

const TOOLS: Record<string, ReactElement> = {
  path: (
    <>
      <path {...line} d="M4 18 16 24 28 18 16 12Z" />
      <path {...line} d="M4 18v3l12 6 12-6v-3" />
    </>
  ),
  cluster: (
    <>
      <rect {...line} x="6" y="7" width="9" height="19" rx="1.5" />
      <rect {...line} x="17" y="11" width="9" height="15" rx="1.5" />
      <path {...accent(DUSK)} d="M9 12h3M9 16h3M20 16h3" />
    </>
  ),
  hall: (
    <>
      <path {...line} d="M6 24a10 10 0 0 1 20 0M16 14V8" />
      <path {...accent(PLUM, 2.2)} d="M3 25h26" />
    </>
  ),
  gateway: <path {...line} d="M8 27V15a8 8 0 0 1 16 0v12M12 27V16a4 4 0 0 1 8 0v11" />,
  kombucha: (
    <>
      <path {...line} d="M13 4h6v5l3 4v14H10V13l3-4Z" />
      <path {...accent(GOLD)} d="M10 18h12" />
    </>
  ),
  nap: (
    <>
      <rect {...line} x="4" y="13" width="24" height="11" rx="5.5" />
      <path {...line} d="M20 5h5l-5 5h5" />
    </>
  ),
  snack: (
    <>
      <rect {...line} x="7" y="5" width="18" height="22" rx="2" />
      <path {...line} d="M7 12h18M7 19h18" />
      <path {...accent(TERRA)} d="M11 9h2M17 9h2M11 16h2M17 16h2M12 24h8" />
    </>
  ),
  demo: (
    <>
      <rect {...line} x="5" y="6" width="22" height="14" rx="2" />
      <path d="M14 10v6l5-3Z" fill={TERRA} />
      <path {...line} d="M11 26h10M16 20v6" />
    </>
  ),
  datacenter: (
    <>
      <rect {...line} x="6" y="5" width="20" height="6" rx="1.5" />
      <rect {...line} x="6" y="13" width="20" height="6" rx="1.5" />
      <rect {...line} x="6" y="21" width="20" height="6" rx="1.5" />
      <path {...accent(DUSK, 2)} d="M10 8h.01M10 16h.01M10 24h.01" />
    </>
  ),
  gas: (
    <>
      <path {...line} d="M9 27 12 13h8l3 14Z" />
      <path {...accent(TERRA)} d="M16 4c2.6 3 3.4 4.6 0 8-3.4-3.4-2.6-5 0-8Z" />
    </>
  ),
  solar: (
    <>
      <path {...line} d="M5 27 9 15h20l-4 12Z" />
      <path {...line} d="M14 15l-2 12M21 15l-1 12M7 21h19" />
      <circle cx="9" cy="8" r="3" {...accent(GOLD)} />
    </>
  ),
  security: (
    <>
      <path {...line} d="M16 4 25 8v7c0 6-4 10-9 12-5-2-9-6-9-12V8Z" />
      <path {...accent(DUSK, 2)} d="M12 15l3 3 6-6" />
    </>
  ),
  bulldoze: (
    <>
      <rect {...line} x="9" y="10" width="13" height="9" rx="2" />
      <circle {...line} cx="11" cy="24" r="2.6" />
      <circle {...line} cx="21" cy="24" r="2.6" />
      <path {...line} d="M22 14l5 3" />
    </>
  ),
  staff: (
    <>
      <circle {...line} cx="16" cy="10" r="4" />
      <path {...line} d="M7 27a9 9 0 0 1 18 0" />
      <path {...accent(PLUM)} d="M13 17l3 7 3-7" />
    </>
  ),
  senate: (
    <>
      <path {...line} d="M9 15a7 6.5 0 0 1 14 0ZM6 15h20v3H6ZM4 25h24v3H4ZM9 18v7M13.5 18v7M18.5 18v7M23 18v7" />
      <path {...accent(PLUM)} d="M16 8.5V4h4" />
    </>
  ),
};

/** The shelf's engraving for a tool id; a mod's new tool gets a plain crate. */
export function ToolIcon({ kind }: { kind: string }) {
  return (
    <svg className="fa-ico" viewBox="0 0 32 32" aria-hidden>
      {TOOLS[kind] ?? (
        <>
          <path {...line} d="M5 11 16 6l11 5v11l-11 5-11-5Z" />
          <path {...line} d="M5 11l11 5 11-5M16 16v11" />
        </>
      )}
    </svg>
  );
}

const small = { viewBox: "0 0 24 24", width: 22, height: 22, "aria-hidden": true, className: "fa-ico" } as const;
const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function Icon({ children }: { children: ReactNode }) {
  return <svg {...small}>{children}</svg>;
}

/** Two bars: the pause button. */
export const PauseIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden className="fa-ico">
    <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
    <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
  </svg>
);

/** The lens: photo mode. */
export const LensIcon = () => (
  <Icon>
    <circle {...stroke} cx="12" cy="12" r="8" />
    <circle {...stroke} cx="12" cy="12" r="3.2" />
    <path {...stroke} d="M12 4v4M5.1 16l3.5-2M18.9 16l-3.5-2" />
  </Icon>
);

/** A folded letter: the reading room (the News Room). */
export const LetterIcon = () => (
  <Icon>
    <rect {...stroke} x="3" y="6" width="18" height="13" rx="2" />
    <path {...stroke} d="m3.5 7.5 8.5 6 8.5-6" />
  </Icon>
);

export const SoundIcon = ({ muted }: { muted: boolean }) => (
  <Icon>
    <path {...stroke} d="M4 10v4h3.5L12 18V6l-4.5 4Z" />
    {muted ? <path {...stroke} d="m16 9 5 6M21 9l-5 6" /> : <path {...stroke} d="M15.5 9.5a4 4 0 0 1 0 5M18 7a7.5 7.5 0 0 1 0 10" />}
  </Icon>
);

/** Three sliders: the mixer. */
export const MixerIcon = () => (
  <Icon>
    <path {...stroke} d="M5 4v16M12 4v16M19 4v16" />
    <circle cx="5" cy="14" r="2.2" fill="var(--flt-color-panel)" stroke="currentColor" strokeWidth="1.7" />
    <circle cx="12" cy="8" r="2.2" fill="var(--flt-color-panel)" stroke="currentColor" strokeWidth="1.7" />
    <circle cx="19" cy="15" r="2.2" fill="var(--flt-color-panel)" stroke="currentColor" strokeWidth="1.7" />
  </Icon>
);

/** A leaf: change the look. */
export const LeafIcon = () => (
  <Icon>
    <path {...stroke} d="M5 19c0-8 5-13 14-14 0 9-5 14-14 14Z" />
    <path {...stroke} d="M5 19c3-4 6-7 10-9" />
  </Icon>
);

export const CheckIcon = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
    <path d="m3.5 8.4 3 3 6-6.6" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** A clipboard for the folded phone version of the objectives. */
export const ClipboardIcon = () => (
  <Icon>
    <rect {...stroke} x="5" y="4.5" width="14" height="16.5" rx="2" />
    <rect {...stroke} x="9" y="2.5" width="6" height="4" rx="1.2" fill="var(--flt-color-panel)" />
    <path {...stroke} d="m8.5 13 2.2 2.2 4.3-4.6" />
  </Icon>
);

/** A speech bubble: Overheard. */
export const BubbleIcon = () => (
  <Icon>
    <path {...stroke} d="M5 5h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-7l-4.5 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
    <path {...stroke} d="M8 10h8M8 13h5" />
  </Icon>
);

/** A quill, for the standing hint. */
export const QuillIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden className="fa-ico">
    <path {...stroke} d="M20 3C12 4 7 9 6 16l-2 5M6 16c5 0 10-3 12-9M9 13c2 0 5-1 7-4" />
  </svg>
);

/** The little leaf that stands in a wax seal when a message doesn't start with a letter. */
export const SealLeaf = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
    <path d="M6 18c0-7 4-11 12-12 0 8-4 12-12 12Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M6 18c3-3.5 5-6 8-7.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

/** Two carets in one: the fold arrow on the small panels. */
export const Caret = ({ open }: { open: boolean }) => (
  <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden className={`fa-caret ${open ? "open" : ""}`}>
    <path d="m3 4.5 3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Infinity, drawn: the runway of a lab that earns more than it spends (the "∞" glyph is in neither bundled font). */
export const InfinityIcon = () => (
  <svg viewBox="0 0 32 16" width="30" height="15" aria-label="no end in sight" role="img" className="fa-inf">
    <path d="M16 8c-2.4-3.4-4.6-5-7-5a5 5 0 0 0 0 10c2.4 0 4.6-1.6 7-5Zm0 0c2.4 3.4 4.6 5 7 5a5 5 0 0 0 0-10c-2.4 0-4.6 1.6-7 5Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
  </svg>
);

/** A little ruled table: the leaderboard. */
export const TableIcon = () => (
  <Icon>
    <rect {...stroke} x="3.5" y="4.5" width="17" height="15" rx="2" />
    <path {...stroke} d="M3.5 9.5h17M9 9.5v10M3.5 14.5h17" />
  </Icon>
);

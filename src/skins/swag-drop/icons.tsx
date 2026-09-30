// Swag Drop's icons: flat, one ink outline, no gradients. Build-palette pictures for the keycaps (from the mockup, plus
// the buildings the mockup didn't have) and a few little glyphs. All are inline SVG so no font has to have the character
// (the bundled faces are latin subsets: no arrows, no shapes, no emoji).
import type { ReactElement } from "react";

const K = {
  viewBox: "0 0 32 32",
  fill: "none",
  strokeLinejoin: "round",
  strokeLinecap: "round",
  "aria-hidden": true,
} as const;
const W = 2;

/** The picture on a keycap, by tool id. Outlines take the key's ink (`currentColor`), so a pressed key can invert them. */
export const KEY_ICONS: Record<string, ReactElement> = {
  path: (
    <svg {...K}>
      <path d="M4 20 16 26 28 20 16 14Z" fill="#F2D9A8" stroke="currentColor" strokeWidth={W} />
      <path d="M4 14 16 20 28 14 16 8Z" fill="#fff" stroke="currentColor" strokeWidth={W} />
    </svg>
  ),
  cluster: (
    <svg {...K}>
      <rect x="5" y="8" width="10" height="18" rx="2" fill="#7FB2F0" stroke="currentColor" strokeWidth={W} />
      <rect x="17" y="12" width="10" height="14" rx="2" fill="#7FB2F0" stroke="currentColor" strokeWidth={W} />
      <path d="M8 13h4M8 17h4M20 17h4M20 21h4" stroke="#22D3EE" strokeWidth={W} />
    </svg>
  ),
  hall: (
    <svg {...K}>
      <path d="M5 24a11 11 0 0 1 22 0Z" fill="#E9E3FF" stroke="currentColor" strokeWidth={W} />
      <path d="M3 25h26" stroke="#8B7CF6" strokeWidth="3" />
      <path d="M16 13V7" stroke="currentColor" strokeWidth={W} />
      <circle cx="16" cy="6" r="2" fill="#8B7CF6" />
    </svg>
  ),
  gateway: (
    <svg {...K}>
      <path d="M7 27V14a9 9 0 0 1 18 0v13h-5V15a4 4 0 0 0-8 0v12Z" fill="#FFB38F" stroke="currentColor" strokeWidth={W} />
    </svg>
  ),
  kombucha: (
    <svg {...K}>
      <path d="M13 4h6v5l3 4v14H10V13l3-4Z" fill="#F2B53A" stroke="currentColor" strokeWidth={W} />
      <rect x="12" y="16" width="8" height="6" rx="1" fill="#fff" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  nap: (
    <svg {...K}>
      <rect x="4" y="12" width="24" height="12" rx="6" fill="#CFE6FF" stroke="currentColor" strokeWidth={W} />
      <path d="M20 5h5l-5 5h5" stroke="currentColor" strokeWidth={W} />
    </svg>
  ),
  snack: (
    <svg {...K}>
      <rect x="5" y="5" width="22" height="22" rx="3" fill="#FFF" stroke="currentColor" strokeWidth={W} />
      <path d="M5 10h22" stroke="currentColor" strokeWidth={W} />
      <rect x="8.5" y="13" width="5" height="5" rx="1" fill="#FF6B35" />
      <rect x="18.5" y="13" width="5" height="5" rx="1" fill="#F2B53A" />
      <rect x="8.5" y="20" width="5" height="4" rx="1" fill="#2FB36E" />
      <rect x="18.5" y="20" width="5" height="4" rx="1" fill="#8B7CF6" />
    </svg>
  ),
  demo: (
    <svg {...K}>
      <rect x="5" y="6" width="22" height="14" rx="2" fill="#FF7BAC" stroke="currentColor" strokeWidth={W} />
      <path d="M14 10v6l5-3Z" fill="#fff" />
      <path d="M10 26h12M16 20v6" stroke="currentColor" strokeWidth={W} />
    </svg>
  ),
  datacenter: (
    <svg {...K}>
      <rect x="4" y="13" width="24" height="14" rx="2" fill="#7FB2F0" stroke="currentColor" strokeWidth={W} />
      <circle cx="10" cy="8" r="3" fill="#fff" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="16" cy="8" r="3" fill="#fff" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="22" cy="8" r="3" fill="#fff" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 20h4M14 20h4M20 20h4" stroke="#22D3EE" strokeWidth={W} />
    </svg>
  ),
  gas: (
    <svg {...K}>
      <rect x="4" y="17" width="17" height="10" rx="3" fill="#F4EEE4" stroke="currentColor" strokeWidth={W} />
      <rect x="20" y="5" width="6" height="22" rx="1" fill="#E5484D" stroke="currentColor" strokeWidth={W} />
      <path d="M9 22h7" stroke="currentColor" strokeWidth={W} />
    </svg>
  ),
  solar: (
    <svg {...K}>
      <path d="M4 22 10 10H28L22 22Z" fill="#7FB2F0" stroke="currentColor" strokeWidth={W} />
      <path d="M8.5 16H25M13 22 18.5 10M18 22 23.5 10" stroke="#fff" strokeWidth="1.4" />
      <path d="M13 22v5M20 22v5M9 27h15" stroke="currentColor" strokeWidth={W} />
    </svg>
  ),
  bulldoze: (
    <svg {...K}>
      <rect x="9" y="10" width="14" height="10" rx="2" fill="#FFD166" stroke="currentColor" strokeWidth={W} />
      <path d="M3 22h26" stroke="currentColor" strokeWidth={W} />
      <circle cx="11" cy="24" r="3" fill="#fff" stroke="currentColor" strokeWidth={W} />
      <circle cx="21" cy="24" r="3" fill="#fff" stroke="currentColor" strokeWidth={W} />
      <path d="M23 14l5 3" stroke="currentColor" strokeWidth={W} />
    </svg>
  ),
  staff: (
    <svg {...K}>
      <circle cx="16" cy="12" r="5" fill="#FFD9C7" stroke="currentColor" strokeWidth={W} />
      <path d="M11 11a5 5 0 0 1 10 0Z" fill="#F2B53A" stroke="currentColor" strokeWidth={W} />
      <path d="M6 28c1-6 5-9 10-9s9 3 10 9Z" fill="#2FB36E" stroke="currentColor" strokeWidth={W} />
    </svg>
  ),
};

const G = {
  viewBox: "0 0 24 24",
  fill: "none",
  strokeLinejoin: "round",
  strokeLinecap: "round",
  "aria-hidden": true,
} as const;

/** Small glyphs for stickers, tags and controls. */
export const GLYPHS: Record<string, ReactElement> = {
  star: (
    <svg {...G}>
      <path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.5 6.6 19.5l1.2-6L3.3 9.3l6.1-.7Z" fill="currentColor" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
  warn: (
    <svg {...G}>
      <path d="M12 3.5 22 20H2Z" fill="currentColor" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 9.5v5M12 17.4v.2" stroke="var(--sd-ink)" strokeWidth="2.2" />
    </svg>
  ),
  laugh: (
    <svg {...G}>
      <circle cx="12" cy="12" r="9" fill="currentColor" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8.5 10.5v1M15.5 10.5v1M8 14.5c1 2.4 7 2.4 8 0" stroke="var(--sd-ink)" strokeWidth="1.9" />
    </svg>
  ),
  info: (
    <svg {...G}>
      <circle cx="12" cy="12" r="9" fill="currentColor" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 11v5.5M12 7.6v.2" stroke="var(--sd-ink)" strokeWidth="2.2" />
    </svg>
  ),
  tip: (
    <svg {...G}>
      <path d="M12 3a6 6 0 0 0-3.4 10.9c.6.5.9 1.1.9 1.9V17h5v-1.2c0-.8.3-1.4.9-1.9A6 6 0 0 0 12 3Z" fill="currentColor" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9.6 20h4.8" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  up: (
    <svg {...G}>
      <path d="M12 5 20 18H4Z" fill="currentColor" stroke="var(--sd-ink)" strokeWidth="2" />
    </svg>
  ),
  down: (
    <svg {...G}>
      <path d="M12 19 4 6h16Z" fill="currentColor" stroke="var(--sd-ink)" strokeWidth="2" />
    </svg>
  ),
  flat: (
    <svg {...G}>
      <rect x="4" y="9.5" width="16" height="5" rx="1" fill="currentColor" stroke="var(--sd-ink)" strokeWidth="2" />
    </svg>
  ),
  camera: (
    <svg {...G} strokeWidth="2">
      <path d="M3.5 8.5h4l1.6-2.5h5.8l1.6 2.5h4v11h-17Z" fill="#fff" stroke="currentColor" />
      <circle cx="12" cy="13.5" r="3.6" fill="#22D3EE" stroke="currentColor" />
    </svg>
  ),
  news: (
    <svg {...G} strokeWidth="2">
      <path d="M5 4h11v16H7a2 2 0 0 1-2-2Z" fill="#fff" stroke="currentColor" />
      <path d="M16 8h3v10a2 2 0 0 1-2 2" stroke="currentColor" />
      <path d="M8 8.5h5M8 12h5M8 15.5h3" stroke="currentColor" />
    </svg>
  ),
  sound: (
    <svg {...G} strokeWidth="2">
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4Z" fill="#F2B53A" stroke="currentColor" />
      <path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" stroke="currentColor" />
    </svg>
  ),
  muted: (
    <svg {...G} strokeWidth="2">
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4Z" fill="#E7DCCB" stroke="currentColor" />
      <path d="m16 9.5 5 5M21 9.5l-5 5" stroke="currentColor" />
    </svg>
  ),
  mixer: (
    <svg {...G} strokeWidth="2">
      <path d="M7 4v16M12 4v16M17 4v16" stroke="currentColor" />
      <rect x="4.5" y="13" width="5" height="3.5" rx="1" fill="#22D3EE" stroke="currentColor" />
      <rect x="9.5" y="6.5" width="5" height="3.5" rx="1" fill="#FF6B35" stroke="currentColor" />
      <rect x="14.5" y="10" width="5" height="3.5" rx="1" fill="#8B7CF6" stroke="currentColor" />
    </svg>
  ),
  skin: (
    <svg {...G} strokeWidth="2">
      <path d="M12 3.5c5 0 8.5 3.2 8.5 7.2 0 3-2.3 3.9-4.3 3.9-1.6 0-2.4.9-2.4 2 0 1.6-.9 3.9-2.3 3.9C7.4 20.5 3.5 16.7 3.5 12 3.5 7.3 7.3 3.5 12 3.5Z" fill="#fff" stroke="currentColor" />
      <circle cx="8" cy="11" r="1.5" fill="#FF6B35" />
      <circle cx="12" cy="7.8" r="1.5" fill="#22D3EE" />
      <circle cx="16" cy="10.6" r="1.5" fill="#8B7CF6" />
    </svg>
  ),
  flip: (
    <svg {...G} strokeWidth="2.2">
      <path d="M5 12a7 7 0 0 1 12-4.9M19 12a7 7 0 0 1-12 4.9" stroke="currentColor" />
      <path d="M17.5 3.5V8H13M6.5 20.5V16H11" stroke="currentColor" />
    </svg>
  ),
  close: (
    <svg {...G} strokeWidth="3">
      <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 18 14" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M1 8 6 12 17 1" stroke="var(--sd-bad)" strokeWidth="3" />
    </svg>
  ),
  bell: (
    <svg {...G} strokeWidth="2">
      <path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15Z" fill="#F2B53A" stroke="currentColor" />
      <path d="M10 21h4" stroke="currentColor" />
    </svg>
  ),
};

export const Glyph = ({ name, className }: { name: keyof typeof GLYPHS; className?: string }) => <span className={`sd-glyph ${className ?? ""}`}>{GLYPHS[name]}</span>;

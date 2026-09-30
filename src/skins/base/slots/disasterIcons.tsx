// Little pictures for the Disasters menu and alert (FLT-32): one per disaster in the base pack, one per tag. A disaster
// or tag a mod adds gets the warning sign.
import type { ReactElement } from "react";

const S = { viewBox: "0 0 32 32", width: 28, height: 28, fill: "none", "aria-hidden": true } as const;
const ink = "var(--ink)";

const WARN = (
  <svg {...S}>
    <path d="M16 3 L30 28 H2 Z" fill="#ffd24a" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
    <path d="M16 11 V19" stroke={ink} strokeWidth="3" strokeLinecap="round" />
    <circle cx="16" cy="23.5" r="1.8" fill={ink} />
  </svg>
);

export const DISASTER_ICONS: Record<string, ReactElement> = {
  rogueSwarm: (
    <svg {...S}>
      {[
        [9, 10],
        [22, 8],
        [16, 20],
        [7, 24],
        [25, 22],
      ].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <rect x={x! - 3.5} y={y! - 3} width="7" height="6" rx="2" fill="#6ee7a8" stroke={ink} strokeWidth="1.6" />
          <path d={`M${x! - 1.5} ${y! - 0.5}h.01M${x! + 1.5} ${y! - 0.5}h.01`} stroke={ink} strokeWidth="1.6" strokeLinecap="round" />
        </g>
      ))}
    </svg>
  ),
  gpuFire: (
    <svg {...S}>
      <rect x="4" y="20" width="24" height="8" rx="1.5" fill="#6b8cff" stroke={ink} strokeWidth="2" />
      <path d="M16 2c4 5 8 8 8 13a8 8 0 0 1-16 0c0-4 3-6 4-8 1 3 2 4 3 4 0-4 0-6 1-9z" fill="#ff7a3c" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      <path d="M16 10c1.5 2.5 4 4 4 6.5a4 4 0 0 1-8 0c0-2.5 2.5-4 4-6.5z" fill="#ffd24a" />
    </svg>
  ),
  weightsLeak: (
    <svg {...S}>
      <rect x="3" y="3" width="20" height="20" rx="2" fill="#3b5bdb" stroke={ink} strokeWidth="2" />
      <rect x="7" y="3" width="12" height="7" fill="#fff8e6" stroke={ink} strokeWidth="2" />
      <rect x="7" y="14" width="12" height="9" fill="#dfe6fb" stroke={ink} strokeWidth="2" />
      <path d="M26 18c1.5 3 3 4.5 3 7a3 3 0 0 1-6 0c0-2.5 1.5-4 3-7z" fill="#5cc8ff" stroke={ink} strokeWidth="1.8" />
    </svg>
  ),
  viralJailbreak: (
    <svg {...S}>
      <rect x="6" y="14" width="20" height="15" rx="2.5" fill="#ffd24a" stroke={ink} strokeWidth="2" />
      <path d="M11 14V9a5 5 0 0 1 10 0" stroke={ink} strokeWidth="2.4" strokeLinecap="round" transform="rotate(-18 11 14)" />
      <path d="M13 21h6M14 24l2-3 2 3" stroke={ink} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  gridBrownout: (
    <svg {...S}>
      <path d="M18 2 6 18h8l-3 12 15-18h-8z" fill="#ffd24a" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  ),
};

export const disasterIcon = (id: string): ReactElement => DISASTER_ICONS[id] ?? WARN;

const T = { viewBox: "0 0 16 16", width: 13, height: 13, fill: "none", "aria-hidden": true } as const;

export const TAG_ICONS: Record<string, ReactElement> = {
  "off-map": (
    <svg {...T}>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.6" />
      <path d="M2 8h12M8 2c2.5 3 2.5 9 0 12M8 2c-2.5 3-2.5 9 0 12" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  ),
  staff: (
    <svg {...T}>
      <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M2.5 15a5.5 5.5 0 0 1 11 0" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
  compute: (
    <svg {...T}>
      <rect x="3" y="3" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6 1v2M10 1v2M6 13v2M10 13v2M1 6h2M1 10h2M13 6h2M13 10h2" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  ),
  fire: (
    <svg {...T}>
      <path d="M8 1c2.5 3 5 5 5 8a5 5 0 0 1-10 0c0-2 1.5-3.5 2.5-5 .5 1.5 1 2 1.5 2 0-2 .5-3.5 1-5z" fill="currentColor" />
    </svg>
  ),
  building: (
    <svg {...T}>
      <path d="M2 15V6l6-4 6 4v9z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M6.5 15v-4h3v4" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  ),
  model: (
    <svg {...T}>
      <circle cx="4" cy="4" r="2" fill="currentColor" />
      <circle cx="12" cy="4" r="2" fill="currentColor" />
      <circle cx="8" cy="12" r="2" fill="currentColor" />
      <path d="M4 4l4 8 4-8M4 4h8" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  ),
  rivals: (
    <svg {...T}>
      <path d="M2 14h3V8H2zM6.5 14h3V3h-3zM11 14h3V6h-3z" fill="currentColor" />
    </svg>
  ),
  card: (
    <svg {...T}>
      <rect x="3" y="1.5" width="10" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6.5 6a1.5 1.5 0 1 1 2 1.4c-.5.2-.5.6-.5 1.1M8 11h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  api: (
    <svg {...T}>
      <path d="M5 4 1.5 8 5 12M11 4l3.5 4L11 12M9.5 2.5l-3 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  revenue: (
    <svg {...T}>
      <path d="M8 1v14M11.5 4H6.5a2 2 0 0 0 0 4h3a2 2 0 0 1 0 4H4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  power: (
    <svg {...T}>
      <path d="M9.5 1 3 9h4.5l-1 6L13 7H8.5z" fill="currentColor" />
    </svg>
  ),
};

import type { ReactElement } from "react";
import type { Tool } from "../store";

const S = { width: 30, height: 30, viewBox: "0 0 32 32", fill: "none", strokeLinejoin: "round", strokeLinecap: "round" } as const;
const ink = "#3a2a1c";

/** Little chunky glyphs for the build palette, drawn to match the models. */
export const ICONS: Record<Tool, ReactElement> = {
  path: (
    <svg {...S}>
      <path d="M4 22 L16 28 L28 22 L16 16 Z" fill="#f4e9c9" stroke={ink} strokeWidth="2" />
      <path d="M4 16 L16 22 L28 16 L16 10 Z" fill="#efe2bd" stroke={ink} strokeWidth="2" />
      <path d="M4 10 L16 16 L28 10 L16 4 Z" fill="#f7eed6" stroke={ink} strokeWidth="2" />
    </svg>
  ),
  cluster: (
    <svg {...S}>
      <rect x="5" y="9" width="10" height="19" rx="2" fill="#f7eed6" stroke={ink} strokeWidth="2" />
      <rect x="17" y="15" width="10" height="13" rx="2" fill="#f7eed6" stroke={ink} strokeWidth="2" />
      <rect x="5" y="9" width="10" height="4" rx="2" fill="#4f8ff0" stroke={ink} strokeWidth="2" />
      <rect x="17" y="15" width="10" height="4" rx="2" fill="#4f8ff0" stroke={ink} strokeWidth="2" />
      <circle cx="10" cy="19" r="1.5" fill="#3fd98a" />
      <circle cx="10" cy="24" r="1.5" fill="#ffd24a" />
      <circle cx="22" cy="24" r="1.5" fill="#3fd98a" />
    </svg>
  ),
  hall: (
    <svg {...S}>
      <path d="M4 26 V20 H28 V26 Z" fill="#f7eed6" stroke={ink} strokeWidth="2" />
      <path d="M6 20 A10 10 0 0 1 26 20 Z" fill="#e6dcff" stroke={ink} strokeWidth="2" />
      <path d="M4 26 H28" stroke="#8b6cf0" strokeWidth="3" />
      <circle cx="16" cy="6" r="2" fill="#8b6cf0" />
    </svg>
  ),
  gateway: (
    <svg {...S}>
      <path d="M6 28 V14 A10 10 0 0 1 26 14 V28" fill="#fff0e0" stroke={ink} strokeWidth="2" />
      <path d="M11 28 V15 A5 5 0 0 1 21 15 V28 Z" fill="#ff8a4c" stroke={ink} strokeWidth="2" />
      <circle cx="16" cy="6" r="3" fill="#ffd24a" stroke={ink} strokeWidth="1.6" />
    </svg>
  ),
  kombucha: (
    <svg {...S}>
      <path d="M12 4 H20 V10 L23 14 V27 Q23 29 21 29 H11 Q9 29 9 27 V14 L12 10 Z" fill="#e0a030" stroke={ink} strokeWidth="2" />
      <rect x="12" y="2" width="8" height="4" rx="1.5" fill="#2fbfa0" stroke={ink} strokeWidth="1.6" />
      <circle cx="14" cy="20" r="1.4" fill="#fff3c4" />
      <circle cx="18" cy="16" r="1" fill="#fff3c4" />
      <circle cx="18" cy="23" r="1.6" fill="#fff3c4" />
    </svg>
  ),
  bulldoze: (
    <svg {...S}>
      <rect x="4" y="15" width="16" height="8" rx="2" fill="#ffd24a" stroke={ink} strokeWidth="2" />
      <rect x="8" y="9" width="8" height="7" rx="1.5" fill="#fff8e6" stroke={ink} strokeWidth="2" />
      <path d="M22 11 V26 L28 22 V15 Z" fill="#c9c3b6" stroke={ink} strokeWidth="2" />
      <circle cx="9" cy="26" r="2.5" fill={ink} />
      <circle cx="17" cy="26" r="2.5" fill={ink} />
    </svg>
  ),
};

import type { ReactElement } from "react";

const S = { width: 30, height: 30, viewBox: "0 0 32 32", fill: "none", strokeLinejoin: "round", strokeLinecap: "round" } as const;
const ink = "#3a2a1c";

/** Little chunky glyphs for the build palette, drawn to match the models. */
export const ICONS: Record<string, ReactElement> = {
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
  nap: (
    <svg {...S}>
      <path d="M4 25 H28" stroke={ink} strokeWidth="2" />
      <rect x="4" y="18" width="24" height="8" rx="3" fill="#f7eed6" stroke={ink} strokeWidth="2" />
      <path d="M6 18 A10 9 0 0 1 26 18 Z" fill="#c9d6ff" stroke={ink} strokeWidth="2" />
      <rect x="8" y="20" width="7" height="4" rx="2" fill="#7a8cff" />
      <path d="M22 5 h5 l-5 6 h5" stroke={ink} strokeWidth="2" />
      <path d="M13 8 h3 l-3 4 h3" stroke={ink} strokeWidth="1.6" />
    </svg>
  ),
  snack: (
    <svg {...S}>
      <rect x="5" y="5" width="22" height="22" rx="3" fill="#f7eed6" stroke={ink} strokeWidth="2" />
      <path d="M5 9 H27" stroke={ink} strokeWidth="2" />
      <path d="M5 5 h22 v4 H5 Z" fill="#ffb020" stroke={ink} strokeWidth="2" />
      <rect x="8" y="12" width="5" height="5" rx="1" fill="#ff6b4a" stroke={ink} strokeWidth="1.4" />
      <rect x="14" y="12" width="5" height="5" rx="1" fill="#ffd24a" stroke={ink} strokeWidth="1.4" />
      <rect x="20" y="12" width="5" height="5" rx="1" fill="#4fc36b" stroke={ink} strokeWidth="1.4" />
      <rect x="8" y="19" width="5" height="5" rx="1" fill="#4f8ff0" stroke={ink} strokeWidth="1.4" />
      <rect x="14" y="19" width="5" height="5" rx="1" fill="#b06cf0" stroke={ink} strokeWidth="1.4" />
      <rect x="20" y="19" width="5" height="5" rx="1" fill="#ff8fb0" stroke={ink} strokeWidth="1.4" />
    </svg>
  ),
  demo: (
    <svg {...S}>
      <rect x="5" y="4" width="22" height="14" rx="2" fill="#e2559a" stroke={ink} strokeWidth="2" />
      <path d="M14 8 L20 11 L14 14 Z" fill="#fff8e6" stroke={ink} strokeWidth="1.4" />
      <path d="M3 21 H29 V27 H3 Z" fill="#f7eed6" stroke={ink} strokeWidth="2" />
      <path d="M3 21 H29" stroke="#e2559a" strokeWidth="3" />
      <circle cx="9" cy="24.5" r="1.3" fill={ink} />
      <circle cx="23" cy="24.5" r="1.3" fill={ink} />
    </svg>
  ),
  datacenter: (
    <svg {...S}>
      <rect x="3" y="12" width="26" height="15" rx="2.5" fill="#f7eed6" stroke={ink} strokeWidth="2" />
      <rect x="3" y="12" width="26" height="4.5" rx="2" fill="#3a6fd8" stroke={ink} strokeWidth="2" />
      <circle cx="9" cy="8" r="3.4" fill="#dfe7f2" stroke={ink} strokeWidth="1.8" />
      <circle cx="17" cy="8" r="3.4" fill="#dfe7f2" stroke={ink} strokeWidth="1.8" />
      <circle cx="25" cy="8" r="3.4" fill="#dfe7f2" stroke={ink} strokeWidth="1.8" />
      <rect x="7" y="20" width="4" height="3" rx="1" fill="#3fd98a" />
      <rect x="14" y="20" width="4" height="3" rx="1" fill="#3fd98a" />
      <rect x="21" y="20" width="4" height="3" rx="1" fill="#ffd24a" />
    </svg>
  ),
  gas: (
    <svg {...S}>
      <rect x="4" y="18" width="18" height="10" rx="4" fill="#f7eed6" stroke={ink} strokeWidth="2" />
      <rect x="20" y="4" width="6" height="24" rx="1.5" fill="#e0704a" stroke={ink} strokeWidth="2" />
      <rect x="20" y="4" width="6" height="4" fill="#3a2a1c" />
      <circle cx="10" cy="23" r="2.4" fill="#e0704a" />
      <path d="M23 2 q-2 -2 0 -3" stroke="#b9b0a0" strokeWidth="2" />
    </svg>
  ),
  solar: (
    <svg {...S}>
      <path d="M4 22 L10 10 H28 L22 22 Z" fill="#3b78d8" stroke={ink} strokeWidth="2" />
      <path d="M8.3 16 H24.3 M13 22 L18.5 10 M17.5 22 L23 10 M7 22 L12.8 10" stroke="#cfe3ff" strokeWidth="1.2" />
      <path d="M13 22 V28 M20 22 V28 M9 28 H24" stroke={ink} strokeWidth="2" />
      <circle cx="6" cy="6" r="3" fill="#f2b134" stroke={ink} strokeWidth="1.6" />
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

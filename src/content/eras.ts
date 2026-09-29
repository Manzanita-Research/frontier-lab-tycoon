// The four eras of the race, set by the R&D multiplier (agents x skill / researchers x 10).
// Data only. Each era gets a title card, its own agent look, thought and headline pools (see thoughts.ts and
// raceNews.ts), faster event pacing and more aggressive rivals.

export type EraNumber = 1 | 2 | 3 | 4;

export interface EraDef {
  n: EraNumber;
  name: string;
  /** The multiplier this era starts at (2, 5, and just above 25). */
  from: number;
  /** The one-liner on the title card. */
  oneLiner: string;
  /** What changes, as three short chips on the title card. */
  changes: string[];
  /** The button on the title card. */
  cta: string;
  /** Agent look, read by the renderer. */
  agents: { name: string; body: string; visor: string; glow: string; scale: number; hat: boolean; halo: boolean };
  /** Multiplies event cooldowns and the gap between auctions: lower is faster. */
  pace: number;
  /** Rivals: multiplies what a release adds, and divides the weeks a run takes. */
  rivalGrowth: number;
  rivalPace: number;
}

export const ERAS: EraDef[] = [
  {
    n: 1,
    name: "Stumbling Agents",
    from: 0,
    oneLiner: "The agents can do things. Whether they should is a different tab.",
    changes: [],
    cta: "Onward",
    agents: { name: "Stumbling", body: "#f2f6fb", visor: "#3ff0ff", glow: "#5ff5ff", scale: 1, hat: false, halo: false },
    pace: 1,
    rivalGrowth: 1,
    rivalPace: 1,
  },
  {
    n: 2,
    name: "Coding Automation",
    from: 2,
    oneLiner: "The interns have been automated. The interns are fine.",
    changes: ["Agents wear hard hats", "Events arrive 20% faster", "Rivals speed up"],
    cta: "Hire the hard hats",
    agents: { name: "Hard hats", body: "#fff1c9", visor: "#6bff9e", glow: "#8bffb0", scale: 1.08, hat: true, halo: false },
    pace: 0.8,
    rivalGrowth: 1.15,
    rivalPace: 1.1,
  },
  {
    n: 3,
    name: "Superhuman Coder",
    from: 5,
    oneLiner: "It writes the code, reviews the code, and ships before the meeting about the code.",
    changes: ["Agents glow and grow halos", "Events arrive 40% faster", "Rivals ship like they mean it"],
    cta: "Merge without reading",
    agents: { name: "Haloed", body: "#efe6ff", visor: "#c58bff", glow: "#c9a0ff", scale: 1.18, hat: false, halo: true },
    pace: 0.6,
    rivalGrowth: 1.35,
    rivalPace: 1.25,
  },
  {
    n: 4,
    name: "Intelligence Explosion",
    from: 25.0001,
    oneLiner: "The curve is now mostly vertical. Please keep your arms inside the lab.",
    changes: ["Agents burn gold", "Events arrive 60% faster", "Rivals are on fire"],
    cta: "Hold on",
    agents: { name: "Ascendant", body: "#fff0b0", visor: "#ffffff", glow: "#ffd24a", scale: 1.32, hat: false, halo: true },
    pace: 0.4,
    rivalGrowth: 1.7,
    rivalPace: 1.5,
  },
];

export const eraDef = (n: number): EraDef => ERAS[Math.max(1, Math.min(4, n)) - 1]!;

/** Which era a multiplier belongs to: 1 below 2x, 2 up to 5x, 3 up to 25x, 4 above. */
export function eraOf(mult: number): EraNumber {
  if (mult > 25) return 4;
  if (mult >= 5) return 3;
  if (mult >= 2) return 2;
  return 1;
}

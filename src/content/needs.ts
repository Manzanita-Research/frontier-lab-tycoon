// What walkers need. Data only: the sim reads these, the UI draws them.
import type { WalkerKind } from "../sim/types";

export type NeedKey = "energy" | "focus" | "fomo" | "patience" | "impressed" | "drift";

export interface NeedDef {
  key: NeedKey;
  /** Bar label in the inspector. */
  label: string;
  /** false: 1 is the bad end (fomo, drift). Every need runs 0 to 1. */
  goodWhenHigh: boolean;
  /** "Seeking a nap": what a walker heading somewhere for this need says it is after. */
  seeking: string;
  /** How much of a need is worth a special trip: urgency (0 fine, 1 desperate) at which a walker goes looking. */
  urgentAt: number;
}

export const NEEDS: Record<NeedKey, NeedDef> = {
  energy: { key: "energy", label: "Energy", goodWhenHigh: true, seeking: "a nap", urgentAt: 0.6 },
  focus: { key: "focus", label: "Focus", goodWhenHigh: true, seeking: "a snack", urgentAt: 0.6 },
  fomo: { key: "fomo", label: "FOMO", goodWhenHigh: false, seeking: "proof we're winning", urgentAt: 0.55 },
  patience: { key: "patience", label: "Patience", goodWhenHigh: true, seeking: "a seat and a snack", urgentAt: 0.6 },
  impressed: { key: "impressed", label: "Impressed", goodWhenHigh: true, seeking: "a demo", urgentAt: 0.5 },
  drift: { key: "drift", label: "Alignment drift", goodWhenHigh: false, seeking: "a system prompt", urgentAt: 2 },
};

/** Which needs each kind of walker has, in the order the inspector shows them. */
export const NEEDS_BY_KIND: Record<WalkerKind, readonly NeedKey[]> = {
  researcher: ["energy", "focus", "fomo"],
  visitor: ["patience", "impressed"],
  agent: ["drift"],
  protester: [],
};

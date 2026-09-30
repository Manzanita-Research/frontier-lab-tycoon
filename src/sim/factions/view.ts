// What the HUD sees of the factions (FLT-33): a small plain snapshot, built at about 5 Hz by app/hud.ts. The Factions
// panel, the inspector's chip and the bubble tint all read this; nothing here changes the World.
import { AXES, type Axis } from "../../content/factions";
import { defs } from "../defs";
import { systemUnlocked } from "../progression";
import type { GameState } from "../types";
import type { FactionMood, Relation } from "./machines";
import { SAFETY_COST, SAFETY_DRAG, SAFETY_LABELS } from "./stance";
import type { FactionLogItem } from "./state";
import { statementOffer } from "./statement";

export interface FactionRowView {
  id: string;
  name: string;
  short: string;
  color: string;
  prop: string;
  blurb: string;
  /** −100 fed up to 100 adoring. */
  meter: number;
  mood: FactionMood;
  /** Their latest reason to feel the way they do, or null before they have one. */
  why: string | null;
  /** Members on campus right now, and how many of them are at the gate with a sign. */
  members: number;
  marching: number;
  /** Followers off the map, in thousands. */
  audience: number;
}

export interface FactionsView {
  enabled: boolean;
  /** Level 5 or later: factions march on the gate (before that, the meters only). */
  protests: boolean;
  rows: FactionRowView[];
  /** The lab's stance on the five axes, −1 to 1. */
  stance: { axis: Axis; value: number }[];
  /** Pairs that are not merely cordial, strongest feeling first. `schism`: a feud the log still remembers as a split between allies. */
  relations: { a: string; b: string; state: Relation; value: number; schism: boolean }[];
  /** The discourse, newest first. */
  log: FactionLogItem[];
  /** Who is at the gate: the water crowd (id "") and each faction's crowd. */
  gate: { id: string; name: string; color: string; count: number }[];
  safety: { level: number; options: { label: string; cost: number; drag: number }[] };
  /** FLT-56: the Comms statement: its price, days until the next one (0: ready), and whether a Comms Rep writes it. */
  statement: { cost: number; wait: number; staffed: boolean };
}

const OFF: FactionsView = { enabled: false, protests: false, rows: [], stance: [], relations: [], log: [], gate: [], safety: { level: 0, options: [] }, statement: { cost: 0, wait: 0, staffed: false } };

/** The water crowd's colour at the gate: blue, obviously. */
const WATER = { name: "Water Discourse", color: "#3fa7d6" };

export function factionsView(state: GameState): FactionsView {
  const f = state.factions;
  if (!f) return OFF;
  const members = new Map<string, number>();
  const marching = new Map<string, number>();
  let water = 0;
  for (const w of state.walkers) {
    if (w.kind === "protester") {
      if (w.crowd === undefined) water++;
      else marching.set(w.crowd, (marching.get(w.crowd) ?? 0) + 1);
    }
    const id = w.crowd ?? w.faction;
    if (id) members.set(id, (members.get(id) ?? 0) + 1);
  }
  const all = defs().factions;
  const rows = all.map((def): FactionRowView => {
    const m = f.moods[def.id];
    return {
      id: def.id, name: def.name, short: def.short, color: def.color, prop: def.prop, blurb: def.blurb,
      meter: Math.round(m?.context.meter ?? 0), mood: m?.value ?? "calm", why: f.why[def.id]?.text ?? null,
      members: members.get(def.id) ?? 0, marching: marching.get(def.id) ?? 0, audience: def.audience,
    };
  });
  const relations = Object.entries(f.relations)
    .filter(([, r]) => r.value !== "cordial")
    .map(([key, r]) => {
      const [a = "", b = ""] = key.split("|");
      const schism = r.value === "feuding" && f.log.some((l) => l.text.startsWith("Schism") && l.factions.includes(a) && l.factions.includes(b));
      return { a, b, state: r.value, value: Math.round(r.context.value), schism };
    })
    .sort((x, y) => Math.abs(y.value) - Math.abs(x.value));
  const gate = [
    ...(water > 0 ? [{ id: "", ...WATER, count: water }] : []),
    ...all.filter((d) => (marching.get(d.id) ?? 0) > 0).map((d) => ({ id: d.id, name: d.name, color: d.color, count: marching.get(d.id)! })),
  ];
  return {
    enabled: true,
    protests: systemUnlocked(state, "protests"),
    rows,
    stance: AXES.map((axis) => ({ axis, value: f.stance[axis] })),
    relations,
    log: f.log.slice().reverse(),
    gate,
    safety: { level: f.safety, options: SAFETY_LABELS.map((label, i) => ({ label, cost: SAFETY_COST[i]!, drag: SAFETY_DRAG[i]! })) },
    statement: statementOffer(state),
  };
}

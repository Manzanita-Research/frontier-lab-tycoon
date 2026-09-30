// The lab's stance (FLT-33): where it stands on the five axes every faction has an opinion about, −1 to 1 each.
// Pure arithmetic over the World, read once a midnight by the driver. A faction's meter eases toward how well its
// beliefs agree with this; the Factions panel draws it as the "you are here" row.
import type { Axis } from "../../content/factions";
import type { GameState } from "../types";
import type { FactionsState } from "./state";

const clamp1 = (n: number) => Math.max(-1, Math.min(1, n));

/** What the safety budget costs a day, and how much it slows training (0 none, 3 lavish). */
export const SAFETY_COST = [0, 4_000, 10_000, 20_000] as const;
export const SAFETY_DRAG = [0, 0.05, 0.12, 0.2] as const;
export const SAFETY_LABELS = ["None", "Token", "Real", "Lavish"] as const;

/** Training speed with the safety budget taken off: exactly 1 with no factions (so the base game is unchanged). */
export function safetyDrag(state: GameState): number {
  const level = state.factions?.safety ?? 0;
  return level === 0 ? 1 : 1 - SAFETY_DRAG[level]!;
}

/** How the slow memories fade each day: a release is news for about two months. */
const FADE = 0.985;

/** Once a midnight, before the meters move: fold today's signals into the memories, then read the stance. */
export function updateStance(state: GameState, f: FactionsState, today: ReadonlySet<string>) {
  f.pace *= FADE;
  f.openness *= FADE;
  f.trouble *= FADE;
  if (today.has("release")) f.pace += 0.45;
  if (today.has("shipNow")) f.pace += 0.35;
  if (today.has("hold")) f.pace -= 0.4;
  if (today.has("openRelease")) f.openness += 0.6;
  if (today.has("leak")) f.openness += 0.2;
  if (today.has("incident")) f.trouble += 0.35;
  f.stance = readStance(state, f);
}

export function readStance(state: GameState, f: FactionsState): Record<Axis, number> {
  const count = (kind: string) => state.buildings.filter((b) => b.kind === kind && !b.broken).length;
  const training = state.buildings.some((b) => b.kind === "hall") ? 0.15 : 0;
  const policy = String(state.papers?.policy.value ?? "Selective");
  const talked = state.flags.raisedSafety !== undefined && state.day - state.flags.raisedSafety! < 60 ? 0.2 : 0;
  const comms = state.staff.filter((s) => s.job === "comms" && s.machine.value !== "leaving").length;
  const net = state.ledger.net;
  return {
    speed: clamp1(Math.tanh(f.pace) + training - 0.25 * f.safety),
    // A lab that never had an incident and spends nothing on safety is still "a bit cavalier"; a lavish budget carries a lab
    // through a run of bad days, but not an endless one.
    safety: clamp1(-0.3 + 0.4 * f.safety + talked - 0.5 * Math.tanh(f.trouble / 3)),
    openness: clamp1((policy === "Open" ? 0.6 : policy === "Closed" ? -0.6 : 0) + Math.tanh(f.openness)),
    fairness: clamp1(0.3 - state.waterDiscourse / 120 - 0.15 * count("gas") + 0.12 * count("solar") + 0.1 * count("fountain") + 0.15 * comms),
    profit: clamp1(0.6 * Math.tanh(net / 60_000) + (state.hype / 100) * 0.5 - 0.15),
  };
}

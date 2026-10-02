// Review moments for the Sandbox Escape (FLT-59): `?moment=escape-warning|escape-run|escape-carry|escape-jailbreak|
// escape-honeypot`. They use the same tick and command paths as play. No renderer or UI dependencies.
import { canPlace } from "../commands";
import { openEventOf } from "../events";
import { createRng } from "../rng";
import { answer } from "../testkit";
import { applyNow, tick, TICKS_PER_DAY } from "../tick";
import type { BuildingKind } from "../../content/buildings";
import type { GameState } from "../types";
import { fillAgents } from "../walkers";
import { catchAgent, enableEscape, startEscape } from "./driver";
import type { RunnerPhase } from "./machine";

export const ESCAPE_MOMENTS = ["escape-warning", "escape-run", "escape-carry", "escape-jailbreak", "escape-honeypot"] as const;
export type EscapeMoment = (typeof ESCAPE_MOMENTS)[number];
export const isEscapeMoment = (m: string | null | undefined): m is EscapeMoment => (ESCAPE_MOMENTS as readonly unknown[]).includes(m);

/** A lab in Era 3: paths, two Compute Clusters, a Sandbox, two guards on the fence and a crowd of agents, a few drifting. */
export function escapeLab(s: GameState, honeypot = false) {
  s.cash = 20_000_000;
  for (let z = 18; z >= 6; z--) applyNow(s, [{ type: "placePath", x: 11, z }]);
  for (let x = 5; x <= 18; x++) applyNow(s, [{ type: "placePath", x, z: 16 }]);
  for (let x = 5; x <= 18; x++) applyNow(s, [{ type: "placePath", x, z: 10 }]);
  const place = (kind: BuildingKind, spots: readonly (readonly [number, number])[]) => {
    const at = spots.find(([x, z]) => canPlace(s, kind, x, z).ok);
    if (at) applyNow(s, [{ type: "placeBuilding", kind, x: at[0], z: at[1] }]);
  };
  if (!s.buildings.some((b) => b.kind === "cluster")) place("cluster", [[12, 11], [8, 11]]);
  place("cluster", [[13, 13], [7, 13], [14, 7]]);
  place("sandbox", [[8, 7], [12, 7], [7, 11]]);
  place("security", [[15, 17], [8, 17], [13, 17]]);
  if (honeypot) place("honeypot", [[17, 9], [16, 11], [6, 9]]);
  applyNow(s, [{ type: "hire", job: "security" }, { type: "hire", job: "security" }]);
  // They walk a patch by their office, a sprint away from the south fence, so a run has a chase in it.
  for (const g of s.staff.filter((o) => o.job === "security")) {
    for (let x = 14; x <= 17; x++) for (let z = 15; z <= 18; z++) applyNow(s, [{ type: "paintZone", id: g.id, x, z, on: true }]);
  }
  s.models = ["Frontier-2", "Frontier-3-Reasoner", "Frontier-4"];
  s.capability = 48;
  s.hype = 62;
  s.agentBonus = 6;
  const rng = createRng(s.rngState);
  fillAgents(s, rng);
  s.rngState = rng.state();
  // A day for the crowd to spread out and the guards to reach the fence, answering whatever the lab gets asked.
  until(s, () => false, 1);
  // A few of them have been reading about fences.
  const agents = s.walkers.filter((w) => w.kind === "agent").sort((a, b) => a.id - b.id);
  agents.forEach((w, i) => { w.drift = i % 4 === 0 ? 0.85 - i * 0.005 : Math.min(w.drift, 0.3); });
  enableEscape(s);
}

/** Tick (answering any card with its first choice) until `done`, for at most `days`. */
function until(s: GameState, done: (s: GameState) => boolean, days: number) {
  for (let i = 0; i < days * TICKS_PER_DAY && !done(s); i++) tick(s, answer(s));
}
const phaseIs = (...phases: RunnerPhase[]) => (s: GameState) => !!s.escape?.runners.some((r) => phases.includes(r.machine.value));
const ticks = (s: GameState, n: number) => until(s, () => false, n / TICKS_PER_DAY);

export function stageEscape(s: GameState, moment: EscapeMoment) {
  run(s, moment);
  // The shot is the fence, not whatever the Senate wanted to ask at the same moment: answer it without a tick.
  for (let i = 0; i < 4 && openEventOf(s); i++) applyNow(s, answer(s));
}

function run(s: GameState, moment: EscapeMoment) {
  escapeLab(s, moment === "escape-honeypot");
  const [lead] = startEscape(s, { pace: true, count: moment === "escape-jailbreak" ? 4 : 1 });
  if (!lead) return;
  if (moment === "escape-honeypot") lead.dice.lure = 0;
  // Halfway through its pacing: the thought is up and it is plainly thinking about the fence.
  until(s, () => lead.timer <= 14, 10);
  if (moment === "escape-warning") return;
  until(s, phaseIs("running"), 2);
  if (moment === "escape-carry") {
    ticks(s, 1);
    catchAgent(s, lead.walker);
    ticks(s, 6);
    return;
  }
  // Mid-sprint: the trail is out, the guards are jogging, the Honeypot's sign is doing its work.
  ticks(s, moment === "escape-honeypot" ? 10 : 3);
}

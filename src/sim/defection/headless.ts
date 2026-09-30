// Evidence harness (FLT-26, FLT-20): a year of real ticks and commands on a functioning lab, every card answered by
// the policy. No forced stages, no fixture scores: whatever defects, defects.
import { BUILDINGS, type PlaceableKind } from "../../content/buildings";
import { pendingConfirmOf } from "../guardrails";
import { openEventOf } from "../events";
import { outcomeOf } from "../goals";
import { answer, countOf, createTestCampus, findSpot, layPaths } from "../testkit";
import { tick, TICKS_PER_DAY } from "../tick";
import type { Command } from "../commands";
import { enableLeapfrog } from "../race/leapfrog/driver";
import { enablePoaching } from "../poaching/driver";
import { CARD as POACH_CARD, CHOICES as POACH_CHOICES } from "../poaching/pack";
import { enableDefection } from "./driver";
import { CARD, CHOICES, MANIFESTO_CARD } from "./pack";
import type { DefectionPick } from "./state";

export type DefectionPolicy = "off" | DefectionPick;
export type PoachPolicy = "off" | (typeof POACH_CHOICES)[number];

export function runDefectionYear(seed: number, policy: DefectionPolicy, poach: PoachPolicy = "off", days = 365) {
  const s = createTestCampus(seed);
  enableLeapfrog(s);
  if (policy !== "off") enableDefection(s);
  if (poach !== "off") enablePoaching(s);
  layPaths(s);
  const cards: { day: number; id: string; pick: number }[] = [];
  for (let i = 0; s.day < days && outcomeOf(s) !== "lost" && i < days * TICKS_PER_DAY * 3; i++) {
    let commands: Command[] = [];
    const open = openEventOf(s);
    const pending = pendingConfirmOf(s);
    if (pending) commands = [s.cash >= pending.cost + 400_000 ? { ...pending.command, confirmed: true } : { type: "cancelConfirm" }];
    else if (open) {
      let pick = open.id === "computeAuction" ? 1 : 0;
      if (open.id === CARD) pick = CHOICES.indexOf(policy as DefectionPick);
      if (open.id === MANIFESTO_CARD) pick = s.day % 3;
      if (open.id === POACH_CARD) pick = POACH_CHOICES.indexOf(poach as (typeof POACH_CHOICES)[number]);
      commands = answer(s, pick);
      cards.push({ day: s.day, id: open.id, pick });
    } else if (i % (TICKS_PER_DAY * 4) === 2) {
      if (s.day > 15 && s.staff.filter((o) => o.job === "sre").length < 1 + Math.floor(s.buildings.length / 6)) commands = [{ type: "hire", job: "sre" }];
      else if (s.staff.filter((o) => o.job === "janitor").length < 4) commands = [{ type: "hire", job: "janitor" }];
    } else if (i % (TICKS_PER_DAY * 4) === 0) {
      const halls = countOf(s, "hall"), clusters = countOf(s, "cluster"), gateways = countOf(s, "gateway");
      let kind: PlaceableKind | null = null;
      if (s.day > 20 && countOf(s, "kombucha") < 1 + Math.floor(halls / 2)) kind = "kombucha";
      else if (s.day > 40 && countOf(s, "nap") < Math.ceil(halls / 2)) kind = "nap";
      else if (s.day > 60 && countOf(s, "snack") < 1 + Math.floor(halls / 3)) kind = "snack";
      else if (gateways < Math.min(5, 1 + Math.floor(s.day / 50))) kind = "gateway";
      else if (clusters < 3 * halls) kind = "cluster";
      else if (halls < Math.min(7, 3 + Math.floor(s.day / 90))) kind = "hall";
      if (kind && s.cash >= BUILDINGS[kind].price + 400_000) {
        const spot = findSpot(s, kind);
        if (spot) commands = [{ type: "placeBuilding", kind, x: spot[0], z: spot[1] }];
      }
    }
    tick(s, commands);
  }
  return {
    seed, policy, poach, day: s.day, outcome: outcomeOf(s), cards,
    history: s.defection?.history ?? [], exit: s.defection?.exit ?? null, poaching: s.poaching?.tally ?? null,
    neoLabs: (s.neoLabs?.labs ?? []).map((l) => ({ id: l.id, name: l.name, mood: l.mood, origin: l.origin, founded: l.founded, nemesis: l.nemesis, capability: Math.round(l.rival.context.capability) })),
    capability: s.capability, researchers: s.walkers.filter((w) => w.kind === "researcher").length, board: s.race.board.map((r) => r.id), world: s,
  };
}

// Evidence harness: actual ticks and commands, every card answered. No forced stage or exposure day.
import { BUILDINGS, type PlaceableKind } from "../../content/buildings";
import { openEventOf } from "../events";
import { outcomeOf } from "../goals";
import { createInitialState } from "../state";
import { answer, countOf, findSpot, layPaths } from "../testkit";
import { tick, TICKS_PER_DAY } from "../tick";
import type { Command } from "../commands";
import { enableLeapfrog } from "../race/leapfrog/driver";
import { enableCollusion } from "./driver";
import { SIGN_CARD } from "./pack";
import { evalBonus } from "./scores";
export type Policy = "off" | "ignore" | "early" | "late";
export function runCollusionYear(seed: number, policy: Policy) {
  const s = createInitialState(seed);
  enableLeapfrog(s);
  if (policy !== "off") enableCollusion(s);
  layPaths(s);
  let maxBonus = 0;
  const cards: { day: number; id: string; pick: number }[] = [];
  let firstSign: number | null = null;
  // Compare a functioning lab: ordinary bot builds, hires and revenue; no fixture cash or stage overrides.
  for (let i = 0; s.day < 365 && outcomeOf(s) !== "lost" && i < 365 * TICKS_PER_DAY * 3; i++) {
    let commands: Command[] = [];
    const open = openEventOf(s);
    if (open) {
      let pick = open.id === "computeAuction" ? 1 : open.id === "waterDiscourse" && s.cash > 900_000 ? 1 : 0;
      if (open.id === SIGN_CARD) {
        firstSign ??= s.day;
        pick = policy === "early" || (policy === "late" && s.collusion?.machine.value === "organized") ? 0 : 1;
      }
      commands = answer(s, pick);
      cards.push({ day: s.day, id: open.id, pick });
    } else if (i % (TICKS_PER_DAY * 4) === 2) {
      if ((policy === "early" || policy === "late") && s.day >= 60 && s.staff.filter((o) => o.job === "security").length < 6) commands = [{ type: "hire", job: "security" }];
      else if (s.day > 15 && s.staff.filter((o) => o.job === "sre").length < 1 + Math.floor(s.buildings.length / 6)) commands = [{ type: "hire", job: "sre" }];
      else if (s.staff.filter((o) => o.job === "janitor").length < 4) commands = [{ type: "hire", job: "janitor" }];
    } else if (i % (TICKS_PER_DAY * 4) === 0) {
      const halls = countOf(s, "hall"), clusters = countOf(s, "cluster"), gateways = countOf(s, "gateway"), datacenters = countOf(s, "datacenter");
      let kind: PlaceableKind | null = null;
      if (datacenters > countOf(s, "gas") && s.flags["unlocked:gas"] !== undefined) kind = "gas";
      else if (s.day > 20 && countOf(s, "kombucha") < 1 + Math.floor(halls / 2)) kind = "kombucha";
      else if (s.day > 40 && countOf(s, "nap") < Math.ceil(halls / 2)) kind = "nap";
      else if (s.day > 60 && countOf(s, "snack") < 1 + Math.floor(halls / 3)) kind = "snack";
      else if (gateways < Math.min(5, 1 + Math.floor(s.day / 50))) kind = "gateway";
      else if (clusters + 6 * datacenters < 3 * halls) kind = "cluster";
      else if (halls < Math.min(7, 3 + Math.floor(s.day / 90))) kind = "hall";
      else if (clusters < 12) kind = "cluster";
      if (kind && s.cash >= BUILDINGS[kind].price + 400_000) {
        const spot = findSpot(s, kind);
        if (spot) commands = [{ type: "placeBuilding", kind, x: spot[0], z: spot[1] }];
      }
    }
    tick(s, commands);
    maxBonus = Math.max(maxBonus, evalBonus(s));
  }
  return { seed, policy, day: s.day, outcome: outcomeOf(s), firstSign, cards, maxBonus,
    ending: s.collusion?.ending ?? null, history: s.collusion?.history ?? [],
    capability: s.capability, trust: s.disasters.trust, heat: s.disasters.heat, world: s };
}

// Evidence harness: a year of an ordinary bot lab with the auditors on, every card answered, no forced stages.
import { BUILDINGS, type PlaceableKind } from "../../content/buildings";
import type { Command } from "../commands";
import { openEventOf } from "../events";
import { outcomeOf } from "../goals";
import { pendingConfirmOf } from "../guardrails";
import { enableLeapfrog } from "../race/leapfrog/driver";
import { answer, countOf, createTestCampus, findSpot, layPaths } from "../testkit";
import { tick, TICKS_PER_DAY } from "../tick";
import { enableCollusion } from "../collusion/driver";
import { enableAuditors } from "./driver";
import { NOTICE_CARD, PREP_CHOICES, type Prep } from "./pack";

export function runAuditYear(seed: number, prep: Prep | "off", opts: { days?: number; collusion?: boolean } = {}) {
  const days = opts.days ?? 365;
  const s = createTestCampus(seed);
  enableLeapfrog(s);
  if (opts.collusion) enableCollusion(s);
  if (prep !== "off") enableAuditors(s);
  layPaths(s);
  const stats = { trust: [] as number[], visitors: 0, stages: new Set<string>() };
  for (let i = 0; s.day < days && outcomeOf(s) !== "lost" && i < days * TICKS_PER_DAY * 3; i++) {
    let commands: Command[] = [];
    const open = openEventOf(s);
    const pending = pendingConfirmOf(s);
    if (pending) commands = [s.cash >= pending.cost + 400_000 ? { ...pending.command, confirmed: true } : { type: "cancelConfirm" }];
    else if (open) commands = answer(s, open.id === NOTICE_CARD ? PREP_CHOICES.indexOf(prep as Prep) : open.id === "computeAuction" ? 1 : 0);
    else if (i % (TICKS_PER_DAY * 4) === 2) {
      if (s.day > 15 && s.staff.filter((o) => o.job === "sre").length < 1 + Math.floor(s.buildings.length / 6)) commands = [{ type: "hire", job: "sre" }];
      else if (s.day > 60 && s.staff.filter((o) => o.job === "security").length < 3) commands = [{ type: "hire", job: "security" }];
    } else if (i % (TICKS_PER_DAY * 4) === 0) {
      const halls = countOf(s, "hall"), clusters = countOf(s, "cluster"), gateways = countOf(s, "gateway");
      let kind: PlaceableKind | null = null;
      if (s.day > 20 && countOf(s, "kombucha") < 1 + Math.floor(halls / 2)) kind = "kombucha";
      else if (s.day > 40 && countOf(s, "nap") < Math.ceil(halls / 2)) kind = "nap";
      else if (gateways < Math.min(4, 1 + Math.floor(s.day / 50))) kind = "gateway";
      else if (clusters < 3 * halls) kind = "cluster";
      else if (halls < Math.min(6, 3 + Math.floor(s.day / 90))) kind = "hall";
      if (kind && s.cash >= BUILDINGS[kind].price + 400_000) {
        const spot = findSpot(s, kind);
        if (spot) commands = [{ type: "placeBuilding", kind, x: spot[0], z: spot[1] }];
      }
    }
    tick(s, commands);
    if (s.auditors) stats.stages.add(s.auditors.machine.value);
    stats.visitors = Math.max(stats.visitors, (s.groups ?? []).reduce((n, g) => n + g.members.length, 0));
  }
  return { seed, prep, day: s.day, outcome: outcomeOf(s), reports: s.auditors?.history ?? [], report: s.auditors?.report ?? null, stages: [...stats.stages], maxVisitors: stats.visitors, world: s };
}

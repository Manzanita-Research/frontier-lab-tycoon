// Evidence bot: normal ticks, actual applicants at the gate, actual rival machine shocks. No free papers or forced dice.
import { BUILDINGS, type PlaceableKind } from "../../../content/buildings";
import { openEventOf } from "../../events";
import { outcomeOf } from "../../goals";
import { staffOf } from "../../staff";
import { slopStats } from "../../slop";
import { createTestCampus as createInitialState } from "../../testkit";
import { answer, countOf, findSpot, layPaths } from "../../testkit";
import { applyNow, tick, TICKS_PER_DAY } from "../../tick";
import type { Command } from "../../commands";
import { enableLeapfrog } from "../leapfrog/driver";
import { enablePapers } from "./driver";
import type { PublicationPolicy } from "./policy";
import { papersView } from "./view";

export function runPapersHeadless(seed: number, policy: PublicationPolicy, off = false) {
  const s = createInitialState(seed);
  enableLeapfrog(s);
  if (!off) {
    enablePapers(s);
    applyNow(s, [{ type: "setPublicationPolicy", policy }]);
  }
  layPaths(s);
  let applicants = 0;
  let focus = 0;
  let prior = new Set(s.walkers.map((w) => w.id));
  // Stop on actual day 365; cards can freeze the clock, so budget additional iterations and answer them.
  for (let i = 0; s.day < 365 && i < 400 * TICKS_PER_DAY && outcomeOf(s) !== "lost"; i++) {
    const cmds: Command[] = answer(s, (id) => id === "computeAuction" ? 1 : id === "shipNow" ? 1 : 0);
    if (!openEventOf(s) && i % (4 * TICKS_PER_DAY) === 0) {
      const halls = countOf(s, "hall");
      const datacenters = countOf(s, "datacenter");
      let kind: PlaceableKind | null = null;
      if (datacenters > countOf(s, "gas") && s.flags["unlocked:gas"] !== undefined) kind = "gas";
      else if (countOf(s, "gateway") < Math.min(5, 1 + Math.floor(s.day / 50))) kind = "gateway";
      else if (countOf(s, "kombucha") < 1 + Math.floor(halls / 2)) kind = "kombucha";
      else if (s.day > 30 && countOf(s, "nap") < Math.ceil(halls / 2)) kind = "nap";
      else if (s.day > 50 && countOf(s, "snack") < 1 + Math.floor(halls / 3)) kind = "snack";
      else if (countOf(s, "cluster") + 6 * datacenters < 3 * halls) kind = "cluster";
      else if (halls < Math.min(7, 3 + Math.floor(s.day / 90))) kind = "hall";
      if (kind && s.cash > BUILDINGS[kind].price + 400_000) {
        const at = findSpot(s, kind);
        if (at) cmds.push({ type: "placeBuilding", kind, x: at[0], z: at[1] });
      }
    } else if (!openEventOf(s) && i % (4 * TICKS_PER_DAY) === 2) {
      if (s.day > 15 && staffOf(s, "sre").length < 1 + Math.floor(s.buildings.length / 6)) cmds.push({ type: "hire", job: "sre" });
      else if (slopStats(s).share > 0.1 && staffOf(s, "janitor").length < 3) cmds.push({ type: "hire", job: "janitor" });
      else if (s.walkers.filter((w) => w.kind === "protester").length >= 10 && staffOf(s, "comms").length < 2) cmds.push({ type: "hire", job: "comms" });
    }
    tick(s, cmds);
    for (const w of s.walkers) if (w.kind === "researcher" && !prior.has(w.id)) { applicants++; focus += w.focus; }
    prior = new Set(s.walkers.map((w) => w.id));
    // Long-run evidence has no UI to drain toasts.
    s.toasts.length = 0;
  }
  return { seed, policy: off ? "Off" : policy, day: s.day, outcome: outcomeOf(s),
    applicants, applicantFocus: applicants ? focus / applicants : 0,
    published: s.papers?.published ?? 0, scoops: s.papers?.scoops ?? 0, awards: s.papers?.awards ?? 0,
    critiques: s.papers?.critiques ?? 0, spill: s.papers?.knowledgeSpill ?? 0,
    rivalCapability: s.race.rivals.reduce((n, r) => n + r.context.capability, 0),
    view: papersView(s), world: s,
  };
}

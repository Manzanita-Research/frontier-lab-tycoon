// Staged moments for FLT-93's onboarding (`?moment=onboard-growing-team|onboard-hire-sre|onboard-race`): links Jem can
// open on a phone. Pure sim, like the other demos: a small lab moved along the way a player could have, with the ladder
// kept, then the rung's goal met so the real New! card is the one on screen.
//
//   onboard-growing-team  Level 2 met: Level 3's "Growing team" card, by kind (Build, Hire, New systems, New apps).
//   onboard-hire-sre      the same lab with the card read; the HUD starts [Show me] on the Hire SRE button (ui/hud/state.ts).
//   onboard-race          Level 3 met (an SRE and a Janitor Bot hired, the puddles mopped): Level 4's card, all New apps.
import { modelName } from "../content/names";
import { applyNow } from "./tick";
import { updateProgression } from "./progression";
import { createRng } from "./rng";
import { hire } from "./staff";
import type { GameState } from "./types";

export const ONBOARD_MOMENTS = ["onboard-growing-team", "onboard-hire-sre", "onboard-race"] as const;
export type OnboardMoment = (typeof ONBOARD_MOMENTS)[number];
export const isOnboardMoment = (s: string | null | undefined): s is OnboardMoment => !!s && (ONBOARD_MOMENTS as readonly string[]).includes(s);

/** A garage that has shipped its first model and opened for business: paths from the gate, the hall, a Gateway, a Kombucha Bar. */
function smallLab(s: GameState) {
  for (let z = 18; z >= 10; z--) applyNow(s, [{ type: "placePath", x: 11, z }]);
  for (let x = 7; x <= 16; x++) applyNow(s, [{ type: "placePath", x, z: 15 }]);
  applyNow(s, [{ type: "placeBuilding", kind: "hall", x: 12, z: 11 }]);
  applyNow(s, [{ type: "placeBuilding", kind: "gateway", x: 8, z: 13 }]);
  applyNow(s, [{ type: "placeBuilding", kind: "kombucha", x: 14, z: 16 }]);
  s.models = [modelName(1, createRng(s.seed), s.day)];
  s.flags.firstPath ??= s.day;
  s.cash = Math.max(s.cash, 1_400_000);
  s.progression = { value: "growing", context: { level: 2 } };
}

/** Level 2's goal, met: $40K a day and twelve visitors shown round. The ladder's own check pushes the card. */
function meetBusiness(s: GameState) {
  s.flags.visitorsServed = Math.max(s.flags.visitorsServed ?? 0, 12);
  s.ledger = { ...s.ledger, income: Math.max(s.ledger.income, 41_500) };
  updateProgression(s);
}

export function stageOnboard(s: GameState, moment: OnboardMoment) {
  smallLab(s);
  meetBusiness(s);
  switch (moment) {
    case "onboard-growing-team":
      return;
    case "onboard-hire-sre":
      // The card was read (OK); the goal note now says "Hire an SRE", and the HUD's [Show me] takes it from here.
      s.unlockCards = [];
      return;
    case "onboard-race": {
      s.unlockCards = [];
      hire(s, "sre");
      hire(s, "janitor");
      s.flags.mopped = Math.max(s.flags.mopped ?? 0, 20);
      s.flags.repaired = Math.max(s.flags.repaired ?? 0, 1);
      for (const b of s.buildings) b.broken = false;
      updateProgression(s);
      return;
    }
  }
}

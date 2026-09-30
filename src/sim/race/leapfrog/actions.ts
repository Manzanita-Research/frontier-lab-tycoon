// What the Leapfrog cards do when a choice is picked (the `voice`, `trust` and `leapfrog` effects in content/events.ts).
// The card's own hype, cash and news effects run as for any card; these are the parts that need the sim.
import { LEAPFROG } from "../../../content/leapfrog";
import type { Effect, LeapfrogAction } from "../../../content/events";
import { YOU } from "../../../content/rivals";
import { step } from "../../machines/run";
import { addToast } from "../../news";
import type { Rng } from "../../rng";
import { shipEarly } from "../../training";
import type { GameState } from "../../types";
import { honestScore, ownRelease, packNews, refreshRecords, setMaxx } from "./driver";
import { pushVoice, shiftTrust } from "./ops";
import { responseMachine } from "./response";
import { readiness } from "./vars";
import { isOpen } from "./benchmark";

const R = LEAPFROG.rules;

/** Runs one Leapfrog effect from a card. Does nothing while the pack is off. */
export function applyLeapfrogEffect(state: GameState, rng: Rng, e: Extract<Effect, { type: "voice" | "trust" | "leapfrog" }>) {
  if (!state.leapfrog.enabled) return;
  switch (e.type) {
    case "voice":
      pushVoice(state, YOU, e.amount);
      return;
    case "trust":
      shiftTrust(state, e.amount);
      return;
    case "leapfrog":
      return respond(state, rng, e.action);
  }
}

/** The forced-response card: three answers to a rival's launch. */
function respond(state: GameState, rng: Rng, action: LeapfrogAction) {
  const lf = state.leapfrog;
  const pick = action === "shipNow" ? "ship" : action === "hold" ? "hold" : "leak";
  const ready = readiness(state);
  const { stored, effects } = step(responseMachine, lf.response, { type: "PICK", pick, day: state.day, holdDays: R.response.holdDays });
  lf.response = stored;
  if (effects.length === 0) return; // no offer was open: a stale click does nothing
  const rival = lf.last && lf.last.lab !== YOU ? lf.last.lab : "";
  for (const fx of effects) {
    switch (fx.type) {
      case "SHIPPED":
        if (state.training.value !== "training") return;
        {
          // The preview pays out `ready x quality` of the release; the full release later pays out the rest of `ready`'s worth
          // less that: the gap is the quality penalty, kept for good.
          const before = state.capability;
          shipEarly(state, rng, ready * R.response.shipQuality);
          lf.credit = (state.capability - before) / R.response.shipQuality;
          lf.previewed = true;
        }
        ownRelease(state, rng, { early: true, ready });
        return;
      case "HELD":
        // The rival gets the room to itself for a while, and your name drops out of it.
        if (rival) pushVoice(state, rival, R.response.holdRivalPush);
        pushVoice(state, YOU, -(1 - R.response.holdDamp) * (lf.voice.context.attention[YOU] ?? 0));
        addToast(state, `Holding for a counter-launch: ${fx.until - state.day} days to land it.`, "neutral");
        return;
      case "LEAKED":
        leakScreenshot(state, rng);
        return;
    }
  }
}

/** A benchmark screenshot "escapes": a SOTA claim with an asterisk that holds until the real scores land. */
function leakScreenshot(state: GameState, rng: Rng) {
  const lf = state.leapfrog;
  const roll = rng.next();
  // The benchmark you're closest on, or the one you already lead (a leak of a real number is still a leak).
  let closest: string | null = null;
  let gap = Infinity;
  for (const e of lf.benchmarks) {
    if (!isOpen(e.machine) || e.def.kind !== "score") continue;
    const own = honestScore(state, YOU, e.def);
    if (own === null) continue;
    const g = e.machine.context.best - own;
    if (g < gap) {
      gap = g;
      closest = e.def.id;
    }
  }
  if (closest) {
    const def = lf.benchmarks.find((b) => b.def.id === closest)!.def;
    setMaxx(state, def, YOU, roll);
    lf.labs[YOU]!.leaked = closest;
    lf.labs[YOU]!.flash = state.day + 2;
    packNews(state, rng, "leak", {});
    refreshRecords(state, rng);
  }
  pushVoice(state, YOU, R.response.leakPush);
  addToast(state, "The screenshot is everywhere. So are the questions.", "neutral");
}


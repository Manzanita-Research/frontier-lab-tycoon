// Thought bubbles: the main joke delivery and the player's feedback channel.
import { BUILDINGS } from "../content/buildings";
import { THOUGHTS, type ThoughtCondition } from "../content/thoughts";
import { CROWDING_PROTESTERS, THOUGHT_TICKS } from "./constants";
import { fillTemplate } from "./format";
import { causeOf, isLoud, lineFor } from "./mind";
import { isReachable } from "./pathfind";
import { templateVars } from "./news";
import type { Rng } from "./rng";
import type { GameState } from "./types";
import { modeOf } from "./walkers";

export function activeConditions(state: GameState): Set<ThoughtCondition> {
  const c = new Set<ThoughtCondition>(["always"]);
  const kombucha = state.buildings.filter((b) => b.kind === "kombucha");
  if (!kombucha.some((b) => isReachable(state, b))) c.add("noKombucha");
  if (state.cash < 1_000_000) c.add("lowCash");
  if (state.buildings.some((b) => b.kind === "hall")) c.add("training");
  if (state.day - (state.flags.lastRelease ?? -99) < 4) c.add("justReleased");
  if (state.hype > 70) c.add("highHype");
  if (state.buildings.some((b) => !BUILDINGS[b.kind].scenery && !isReachable(state, b))) c.add("unreachable");
  if (state.walkers.filter((w) => modeOf(w) !== "inside").length > 40) c.add("crowded");
  if (state.waterDiscourse >= 12) c.add("discourse");
  if (state.walkers.filter((w) => w.kind === "protester").length >= CROWDING_PROTESTERS) c.add("protest");
  return c;
}

/** Each day: expire old bubbles and maybe start one (at most 3 at a time, each ~3 game days). */
export function dailyThoughts(state: GameState, rng: Rng, force = false) {
  state.thoughts = state.thoughts.filter((t) => t.expiresTick > state.tick);
  if (state.thoughts.length >= 3) return;
  if (!force && !rng.chance(0.85)) return;

  // Keep bubbles readable: never start one on top of another.
  const speaking = state.walkers.filter((w) => state.thoughts.some((t) => t.walkerId === w.id));
  const clear = (w: (typeof state.walkers)[number]) =>
    speaking.every((o) => o !== w && Math.hypot(o.x - w.x, o.z - w.z) > 3);
  const candidates = state.walkers.filter((w) => modeOf(w) !== "inside" && clear(w));
  if (candidates.length === 0) return;
  // When someone has a need nagging them (or is walking out with a box), most bubbles go to them, with their own line.
  const onScreen = new Set(state.thoughts.map((t) => t.text));
  const loud = candidates.filter((w) => {
    const cause = causeOf(w);
    return isLoud(cause) && !onScreen.has(lineFor(state, cause, w));
  });
  const walker = rng.pick(loud.length > 0 && rng.chance(0.7) ? loud : candidates);
  const cause = causeOf(walker);
  if (isLoud(cause)) {
    state.thoughts.push({ id: state.nextId++, walkerId: walker.id, kind: walker.kind, text: lineFor(state, cause, walker), expiresTick: state.tick + THOUGHT_TICKS });
    return;
  }

  const conditions = activeConditions(state);
  let lines = THOUGHTS.filter((l) => l.kind === walker.kind && conditions.has(l.when));
  if (lines.length === 0) return;
  const fresh = lines.filter((l) => !state.recentThoughts.includes(l.text));
  if (fresh.length > 0) lines = fresh;
  // Situational lines are the point; make them three times as likely as the evergreen pool.
  const weighted = lines.flatMap((l) => (l.when === "always" ? [l] : [l, l, l]));
  const line = rng.pick(weighted);

  state.thoughts.push({
    id: state.nextId++,
    walkerId: walker.id,
    kind: walker.kind,
    text: fillTemplate(line.text, templateVars(state, {}, rng)),
    expiresTick: state.tick + THOUGHT_TICKS,
  });
  state.recentThoughts.push(line.text);
  if (state.recentThoughts.length > 10) state.recentThoughts.shift();
}

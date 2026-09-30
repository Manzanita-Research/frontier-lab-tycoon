// Thought bubbles: the main joke delivery and the player's feedback channel.
import type { ThoughtCondition } from "../content/thoughts";
import { FIRST_NIGHT_LINE } from "../content/night";
import { CROWDING_PROTESTERS, THOUGHT_TICKS } from "./constants";
import { hourAt, isNight } from "./daylight";
import { fillTemplate } from "./format";
import { causeOf, isLoud, lineFor } from "./mind";
import { isReachable } from "./pathfind";
import { raceConditions } from "./race/conditions";
import { templateVars } from "./news";
import type { Rng } from "./rng";
import type { GameState } from "./types";
import { modeOf } from "./walkers";
import { defs } from "./defs";

export function activeConditions(state: GameState): Set<ThoughtCondition> {
  const c = new Set<ThoughtCondition>(["always"]);
  // The campus lamps are lit (content/night.ts): someone is still shipping.
  if (isNight(hourAt(state.tick))) c.add("night");
  const kombucha = state.buildings.filter((b) => b.kind === "kombucha");
  if (!kombucha.some((b) => isReachable(state, b))) c.add("noKombucha");
  if (state.cash < 1_000_000) c.add("lowCash");
  if (state.buildings.some((b) => b.kind === "hall")) c.add("training");
  if (state.day - (state.flags.lastRelease ?? -99) < 4) c.add("justReleased");
  if (state.hype > 70) c.add("highHype");
  if (state.buildings.some((b) => !defs().buildings[b.kind].scenery && !isReachable(state, b))) c.add("unreachable");
  if (state.walkers.filter((w) => modeOf(w) !== "inside").length > 40) c.add("crowded");
  if (state.waterDiscourse >= 12) c.add("discourse");
  if (state.walkers.filter((w) => w.kind === "protester").length >= CROWDING_PROTESTERS) c.add("protest");
  for (const race of raceConditions(state)) c.add(race);
  const memo = state.endings?.memo?.choice;
  if (memo) c.add(memo === "race" ? "memoRace" : "memoSlow");
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
  // The first night of a game always has its punchline.
  if (!state.flags.firstNight && isNight(hourAt(state.tick))) {
    const who = candidates.find((w) => w.kind === FIRST_NIGHT_LINE.kind);
    if (who) {
      state.flags.firstNight = 1;
      state.thoughts.push({ id: state.nextId++, walkerId: who.id, kind: who.kind, text: FIRST_NIGHT_LINE.text, expiresTick: state.tick + THOUGHT_TICKS });
      return;
    }
  }
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
  let lines = defs().thoughts.filter((l) => l.kind === walker.kind && conditions.has(l.when));
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

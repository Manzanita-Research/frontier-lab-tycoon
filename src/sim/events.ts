// Event cards: checked once a day, one open at a time, resolved by a chooseEvent command.
import type { BuildingKind } from "../content/buildings";
import type { Condition, Effect } from "../content/events";
import { THOUGHT_TICKS, DISCOURSE_PER_PROTESTER } from "./constants";
import { fillTemplate } from "./format";
import { arcMachine } from "./machines/arc";
import { step } from "./machines/run";
import { addNews, templateVars } from "./news";
import { buildingAt, inBounds, isPathTile, rectContains } from "./pathfind";
import { clampDiscourse, syncProtesters } from "./protest";
import { eraDef } from "../content/eras";
import { applyRaceAction } from "./race/actions";
import { applyLeapfrogEffect } from "./race/leapfrog/actions";
import { eraOfState } from "./race/race";
import { raceVars } from "./race/finance";
import { modeOf } from "./walkers";
import type { Rng } from "./rng";
import type { GameState, OpenEvent } from "./types";
import { pressureReady } from "./tutorial";
import { defs } from "./defs";

export function conditionHolds(state: GameState, c: Condition): boolean {
  if ("all" in c) return c.all.every((sub) => conditionHolds(state, sub));
  if ("flag" in c) {
    const set = state.flags[c.flag];
    return set !== undefined && state.day - set >= c.daysAgo;
  }
  return state[c.stat] >= c.atLeast;
}

/** The card on screen right now, if any: the arc that is in `cardOpen`. */
export function openEventOf(state: GameState): OpenEvent | null {
  // Runs every tick: a plain loop, no entries() arrays.
  for (const id in state.arcs) {
    const arc = state.arcs[id]!;
    if (arc.value === "cardOpen") return { id, day: arc.context.openedDay! };
  }
  return null;
}

/**
 * The daily check. Every arc hears about it, in content order; the first whose condition holds and whose
 * cooldown is over takes the screen, and the rest wait their turn as `brewing`. The game pauses until it is answered.
 */
export function dailyEvents(state: GameState) {
  if (state.goals.value === "lost" || (!state.progression && state.day < 40)) return;
  let slotFree = openEventOf(state) === null;
  // Later eras crowd the calendar: cooldowns shrink.
  const pace = eraDef(eraOfState(state)).pace;
  for (const def of defs().events) {
    const { stored } = step(arcMachine, state.arcs[def.id]!, { type: "DAY", day: state.day, ready: pressureReady(state) && conditionHolds(state, def.when), slotFree, pace });
    state.arcs[def.id] = stored;
    if (stored.value === "cardOpen") slotFree = false;
  }
}

/**
 * Where a fountain goes, nearest the gate first. Right of the approach comes first: the camera looks in from
 * that side, so the fountain stands in front of the gate instead of hiding behind its pillar.
 */
const GATE_SPOTS: [number, number][] = [[2, -1], [2, 0], [2, -2], [3, -1], [-1, -1], [-1, -2], [-1, 0], [-2, -1]];

function placeNearGate(state: GameState, kind: BuildingKind) {
  const g = state.gate;
  for (const [dx, dz] of GATE_SPOTS) {
    const x = g.x + dx;
    const z = g.z + dz;
    if (!inBounds(state, x, z) || isPathTile(state, x, z) || buildingAt(state, x, z) || rectContains(g, x, z)) continue;
    const def = defs().buildings[kind];
    state.buildings.push({ id: state.nextId++, kind, x, z, w: def.size[0], d: def.size[1], placedTick: state.tick, reliability: 1, broken: false, brokenTick: 0 });
    state.version++;
    return;
  }
}

function burstThoughts(state: GameState, rng: Rng, e: Extract<Effect, { type: "thought" }>, vars: Record<string, string>) {
  const speaking = new Set(state.thoughts.map((t) => t.walkerId));
  const pool = state.walkers.filter((w) => modeOf(w) !== "inside" && !speaking.has(w.id) && (!e.kind || w.kind === e.kind));
  for (let i = 0; i < e.count && pool.length > 0; i++) {
    const [w] = pool.splice(rng.int(0, pool.length - 1), 1);
    state.thoughts.push({
      id: state.nextId++,
      walkerId: w!.id,
      kind: w!.kind,
      text: fillTemplate(e.text, { ...templateVars(state, {}, rng), ...vars }),
      expiresTick: state.tick + THOUGHT_TICKS,
    });
  }
}

function applyEffect(state: GameState, rng: Rng, e: Effect, vars: Record<string, string>) {
  switch (e.type) {
    case "cash":
      state.cash += e.amount;
      break;
    case "hype":
      state.hype = Math.max(0, Math.min(100, state.hype + e.amount));
      break;
    case "discourse":
      state.waterDiscourse = clampDiscourse(e.set ?? state.waterDiscourse + (e.add ?? 0));
      break;
    case "protesters":
      state.waterDiscourse = clampDiscourse(
        e.set !== undefined ? e.set * DISCOURSE_PER_PROTESTER : state.waterDiscourse + (e.add ?? 0) * DISCOURSE_PER_PROTESTER,
      );
      break;
    case "flag":
      if (e.clear) delete state.flags[e.name];
      else state.flags[e.name] = state.day;
      break;
    case "news":
      addNews(state, fillTemplate(e.text, { ...templateVars(state, {}, rng), ...vars }), e.tone ?? "neutral");
      break;
    case "thought":
      burstThoughts(state, rng, e, vars);
      break;
    case "place":
      placeNearGate(state, e.kind);
      break;
    case "race":
      applyRaceAction(state, rng, e.action);
      break;
    case "voice":
    case "trust":
    case "leapfrog":
      applyLeapfrogEffect(state, rng, e);
      break;
  }
}

/** Applies the picked choice and closes the card. Ignores stale or invalid picks. */
export function chooseEvent(state: GameState, rng: Rng, eventId: string, choiceIndex: number) {
  const def = defs().eventById(eventId);
  const arc = state.arcs[eventId];
  if (!def || !arc || openEventOf(state)?.id !== eventId) return;
  const { stored, effects } = step(arcMachine, arc, { type: "CHOOSE", choiceIndex });
  state.arcs[eventId] = stored;
  // The race's numbers are read once, before any effect moves them: a card's own text is about how things stood.
  const vars = raceVars(state);
  for (const e of effects) for (const effect of def.choices[e.choiceIndex]!.effects) applyEffect(state, rng, effect, vars);
  if (effects.length > 0) syncProtesters(state, rng);
}

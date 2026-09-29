// Event cards: checked once a day, one open at a time, resolved by a chooseEvent command.
import { BUILDINGS, type BuildingKind } from "../content/buildings";
import { EVENTS, EVENT_COOLDOWN_DAYS, eventById, type Condition, type Effect } from "../content/events";
import { THOUGHT_TICKS, DISCOURSE_PER_PROTESTER } from "./constants";
import { fillTemplate } from "./format";
import { addNews, templateVars } from "./news";
import { buildingAt, inBounds, isPathTile, rectContains } from "./pathfind";
import { clampDiscourse, syncProtesters } from "./protest";
import type { Rng } from "./rng";
import type { GameState } from "./types";

export function conditionHolds(state: GameState, c: Condition): boolean {
  if ("all" in c) return c.all.every((sub) => conditionHolds(state, sub));
  if ("flag" in c) {
    const set = state.flags[c.flag];
    return set !== undefined && state.day - set >= c.daysAgo;
  }
  return state[c.stat] >= c.atLeast;
}

const cooldownKey = (id: string) => `event:${id}`;

/** Opens the first event whose condition holds and whose cooldown is over. The game pauses until it is answered. */
export function dailyEvents(state: GameState) {
  if (state.event) return;
  for (const def of EVENTS) {
    const last = state.flags[cooldownKey(def.id)];
    if (last !== undefined && state.day - last < (def.cooldown ?? EVENT_COOLDOWN_DAYS)) continue;
    if (!conditionHolds(state, def.when)) continue;
    state.event = { id: def.id, day: state.day };
    state.flags[cooldownKey(def.id)] = state.day;
    return;
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
    const def = BUILDINGS[kind];
    state.buildings.push({ id: state.nextId++, kind, x, z, w: def.size[0], d: def.size[1], placedTick: state.tick });
    state.version++;
    return;
  }
}

function burstThoughts(state: GameState, rng: Rng, e: Extract<Effect, { type: "thought" }>) {
  const speaking = new Set(state.thoughts.map((t) => t.walkerId));
  const pool = state.walkers.filter((w) => w.mode !== "inside" && !speaking.has(w.id) && (!e.kind || w.kind === e.kind));
  for (let i = 0; i < e.count && pool.length > 0; i++) {
    const [w] = pool.splice(rng.int(0, pool.length - 1), 1);
    state.thoughts.push({
      id: state.nextId++,
      walkerId: w!.id,
      kind: w!.kind,
      text: fillTemplate(e.text, templateVars(state, {}, rng)),
      expiresTick: state.tick + THOUGHT_TICKS,
    });
  }
}

function applyEffect(state: GameState, rng: Rng, e: Effect) {
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
      addNews(state, fillTemplate(e.text, templateVars(state, {}, rng)), e.tone ?? "neutral");
      break;
    case "thought":
      burstThoughts(state, rng, e);
      break;
    case "place":
      placeNearGate(state, e.kind);
      break;
  }
}

/** Applies the picked choice and closes the card. Ignores stale or invalid picks. */
export function chooseEvent(state: GameState, rng: Rng, eventId: string, choiceIndex: number) {
  const def = eventById(eventId);
  const choice = def?.choices[choiceIndex];
  if (!state.event || state.event.id !== eventId || !choice) return;
  for (const effect of choice.effects) applyEffect(state, rng, effect);
  state.event = null;
  syncProtesters(state, rng);
}

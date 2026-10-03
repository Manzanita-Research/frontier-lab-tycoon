// Event cards: checked once a day, one open at a time, resolved by a chooseEvent command.
import type { BuildingKind } from "../content/buildings";
import type { Condition, Effect, EventDef } from "../content/events";
import { THOUGHT_TICKS, DISCOURSE_PER_PROTESTER, TICKS_PER_DAY, TICKS_PER_SECOND } from "./constants";
import { fillTemplate } from "./format";
import { arcMachine, dayArc } from "./machines/arc";
import { initialStored, step } from "./machines/run";
import { EVENT_COOLDOWN_DAYS } from "../content/events";
import { nudgeFaction, nudgeRelation } from "./factions/state";
import { addNews, templateVars } from "./news";
import { buildingAt, inBounds, isPathTile, rectContains } from "./pathfind";
import { clampDiscourse, syncProtesters } from "./protest";
import { eraDef } from "../content/eras";
import { applyRaceAction } from "./race/actions";
import { applyLeapfrogEffect } from "./race/leapfrog/actions";
import { eraOfState } from "./race/race";
import { raceVars } from "./race/finance";
import { modeOf } from "./walkers";
import type { GameState, OpenEvent } from "./types";
import { pressureReady } from "./tutorial";
import { levelOf } from "./progression";
import { arrivingCard } from "./liveMods";
import { defs } from "./defs";
import { askFlag } from "./disasters/names";
import { modArcsHeard } from "./modArcs";
import { paceFor, pacerAllows, pacerMachine, type Pacing, type PacerStored } from "./machines/cardPace";
import { HANDLED, paceOfCard } from "../content/cardPacing";
import { createRng, type Rng } from "./rng";
import { isChase } from "./escape/machine";

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

/** A runner on the fence has the screen (FLT-59): no card opens mid-chase to pause it; they wait in line for it to end. */
export const screenHeld = (state: GameState): boolean => !!state.escape?.runners.some((r) => isChase(r.machine.value));

/** The card budget's machine, started the first time it is needed (a save from before FLT-54 has none). */
export function pacerOf(state: GameState): PacerStored {
  return (state.pacer ??= initialStored(pacerMachine, undefined));
}

/** Counts the card on screen against the budget once, whoever opened it (the daily check, a hearing, a roll call). */
export function notePacer(state: GameState) {
  const open = openEventOf(state);
  if (!open) return;
  const pacer = pacerOf(state);
  if (pacer.context.seen === `${open.id}@${open.day}`) return;
  state.pacer = step(pacerMachine, pacer, { type: "OPENED", id: open.id, story: paceOfCard(open.id).story, day: open.day }).stored;
}

/** May a pack's own driver put `id` up today (the next question of a sitting, a bill's draft)? If not, it waits in line. */
export function cardAllowed(state: GameState, id: string, how: "urgent" | "chain" | "normal" = "chain"): boolean {
  const pacer = pacerOf(state);
  if (!screenHeld(state) && pacerAllows(pacer.context, id, paceOfCard(id).story, state.day, how)) return true;
  state.pacer = step(pacerMachine, pacer, { type: "JOIN", id, day: state.day }).stored;
  return false;
}

/**
 * The daily check (FLT-54: through the card budget). Every arc hears about it: disasters first, then the waiting line oldest
 * first, then the rest in content order. The first whose condition holds, whose cooldown is over and whom the budget lets
 * through takes the screen (an offer on a clock goes ahead of the line); the rest wait their turn as `brewing`. A minor card that would have to wait (or any minor card
 * at 10×) answers itself with its default and says so on the ticker. The game pauses until a card is answered.
 */
export function dailyEvents(state: GameState, unlocked = true) {
  if (state.goals.value === "lost") return;
  // Before the ladder opens cards (or before day 40 without it) there are none, except one a mod brought mid-game (FLT-78)
  // and the first minutes' own card on Level 1 (FLT-76).
  const early = !unlocked || (!state.progression && state.day < 40);
  const first = early && firstMinutes(state);
  if (early && !state.modsAdded && !first) return;
  notePacer(state);
  let slotFree = openEventOf(state) === null && !screenHeld(state);
  // Later eras crowd the calendar: cooldowns shrink.
  const pace = eraDef(eraOfState(state)).pace;
  const pacer = pacerOf(state).context;
  const events = defs().events;
  const place = (id: string) => pacer.queue.findIndex((q) => q.id === id);
  const rank = (def: EventDef) => { const p = paceOf(def); return p.now ? -3 : p.urgent ? -2 : p.priority ? -1 : place(def.id) >= 0 ? place(def.id) : pacer.queue.length; };
  const order = events.map((def, i) => ({ def, i, r: rank(def) })).sort((a, b) => a.r - b.r || a.i - b.i);
  const waiting: string[] = [];
  for (const { def } of order) {
    const arriving = arrivingCard(state, def.id);
    if (def.early ? !first : early && arriving === undefined) continue;
    // A save from before a pack added this card (the factions' cards, a mod's) starts its machine now.
    state.arcs[def.id] ??= initialStored(arcMachine, { choices: def.choices.length, cooldownDays: def.cooldown ?? EVENT_COOLDOWN_DAYS, openedDay: null });
    const card = paceOf(def);
    // A card the player just added (FLT-78) keeps the gap but doesn't queue behind colour: it was asked for.
    const how: Pacing = card.now ? "now" : card.urgent ? "urgent" : card.priority || arriving !== undefined ? "priority" : "normal";
    const allowed = pacerAllows(pacerOf(state).context, def.id, card.story, state.day, how);
    const ready = arriving ?? (def.early ? conditionHolds(state, def.when) : pressureReady(state) && (conditionHolds(state, def.when) || state.flags[askFlag(def.id)] !== undefined));
    const shrug = card.minor && slotFree && (!allowed || pacer.auto);
    const stored = dayArc(state.arcs[def.id]!, { type: "DAY", day: state.day, ready, slotFree: slotFree && (allowed || shrug === true), pace });
    state.arcs[def.id] = stored;
    if (stored.value === "cardOpen" && shrug) handled(state, def.id, card.default);
    else if (stored.value === "cardOpen") {
      slotFree = false;
      notePacer(state);
    } else if (stored.value === "brewing") waiting.push(def.id);
  }
  state.pacer = step(pacerMachine, pacerOf(state), { type: "WAITING", ids: waiting, day: state.day }).stored;
}

/** A card's pacing: its id's rule (content/cardPacing.ts), and what its own definition asks for (a mod's `pace`, FLT-105). */
const paces = new WeakMap<EventDef, ReturnType<typeof paceOfCard>>();
function paceOf(def: EventDef) {
  let pace = paces.get(def);
  if (!pace) {
    const rule = paceOfCard(def.id);
    pace = def.pace ? { ...rule, [def.pace]: true as const } : rule;
    paces.set(def, pace);
  }
  return pace;
}

/** Level 1 of the ladder, where a first-minutes card (`early`) may open (FLT-76). */
export const firstMinutes = (state: GameState) => state.progression !== undefined && levelOf(state) === 1;

/** A minor card the lab answered without you: its default choice, on its own dice, and one line on the ticker. */
/** A minor card answered without the player: its default choice, and a line on the ticker saying so. */
export function handled(state: GameState, id: string, choice: number) {
  const def = defs().eventById(id)!;
  const pick = def.choices[choice] ? choice : 0;
  chooseEvent(state, createRng((Math.imul(state.seed, 2654435761) ^ Math.imul(state.day + 1, 40503)) >>> 0 || 1), id, pick);
  addNews(state, fillTemplate(HANDLED, { title: def.title, choice: def.choices[pick]!.label }), "neutral");
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
    case "faction":
      nudgeFaction(state, e.id, e.amount);
      break;
    case "relation":
      nudgeRelation(state, e.a, e.b, e.amount);
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
  if (effects.length > 0) {
    // A card a mod arc asked for (the `card` verb) is answered.
    delete state.flags[askFlag(eventId)];
    syncProtesters(state, rng);
    if (defs().arcs.length > 0) modArcsHeard(state, rng, eventId, effects[0]!.choiceIndex);
  }
}

/** A staged moment (`?moment=`, a pack's review link) plays its cards back to back, as it always did: no card budget. */
export function unpaced(state: GameState) {
  state.pacer = step(pacerMachine, pacerOf(state), { type: "PACE", gap: 0, storyGap: 0, auto: false }).stored;
}

/** ...and once it is on its beat, the lab gets the card budget a game at 1× has, so the next card waits its turn (FLT-105). */
export function repaced(state: GameState) {
  state.pacer = step(pacerMachine, pacerOf(state), { type: "PACE", ...paceFor(1, TICKS_PER_SECOND, TICKS_PER_DAY) }).stored;
}

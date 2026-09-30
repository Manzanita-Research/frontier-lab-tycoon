// The factions' driver (FLT-33): once a midnight it notices what the lab did, works out the stance, eases every
// meter, steps the mood and relation machines and turns what they emit into headlines, hype and crowds. Every few
// ticks it gives walkers a faction and starts an argument on the paths.
//
// Its dice are its own (`factions.rngState`), so turning the factions on never moves a draw in the main stream.
// Membership is not a die at all: a hash of the seed and the walker's id, so a save, a replay and a rewind agree.
import type { FactionDef } from "../../content/factions";
import { THOUGHT_TICKS } from "../constants";
import { defs } from "../defs";
import { fillTemplate, formatMoney } from "../format";
import { step } from "../machines/run";
import { addNews, addToast } from "../news";
import { clampDiscourse } from "../protest";
import { systemUnlocked } from "../progression";
import { createRng, type Rng } from "../rng";
import type { GameState, Tone, Walker } from "../types";
import { modeOf } from "../walkers";
import { factionMoodMachine, quietMoodDay, quietRelationDay, relationMachine } from "./machines";
import { readStance, SAFETY_COST, SAFETY_DRAG, SAFETY_LABELS, updateStance } from "./stance";
import { baseRelationOf, nudgeFaction, pairKey, seenNow, type FactionsState } from "./state";

/** A faction with no `protests` line marches on the gate at this meter. */
export const DEFAULT_MARCH = -60;
/** How far a meter moves toward where the stance puts it, each day. */
const EASE = 0.05;
/** Relations: how fast two strongly-felt factions drift together (same side) or apart, and the pull home. */
const DRIFT = 1.2;
const HOMING = 0.015;
/** A fan and an angry faction pull apart this many times faster: one of them is cheering what the other is marching against. */
const SPLIT = 3;
const LOG_SIZE = 12;
/** What a tote bag does for a marching faction's meter. */
const TOTE_CALM = 3;
const OP_ED_EVERY = 18;
/** Ticks between arguments on the paths (a day is 20). */
const ARGUE_EVERY = 36;
const ARGUE_RANGE = 2.5;

const clamp100 = (n: number) => Math.max(-100, Math.min(100, n));
const clampPos = (n: number) => Math.max(0, Math.min(100, n));

export const marchLine = (def: FactionDef): number | null => (def.protests === false ? null : typeof def.protests === "number" ? def.protests : DEFAULT_MARCH);

/** Where a faction's meter is heading, given the lab's stance: how well its beliefs agree, −100 to 100. */
export function targetOf(def: FactionDef, stance: FactionsState["stance"]): number {
  const b = def.beliefs;
  const weight = Math.abs(b.speed) + Math.abs(b.safety) + Math.abs(b.openness) + Math.abs(b.fairness) + Math.abs(b.profit);
  if (weight === 0) return 0;
  const dot = b.speed * stance.speed + b.safety * stance.safety + b.openness * stance.openness + b.fairness * stance.fairness + b.profit * stance.profit;
  // Nobody loves a lab for agreeing with them on paper: the dot is scaled so a perfect match is about +80.
  return clamp100((100 * dot) / weight);
}

/** A Comms Rep handed one of a faction's marchers a tote bag: the faction softens a little (FLT-25). */
export function toteBagFor(state: GameState, faction: string) {
  nudgeFaction(state, faction, TOTE_CALM, "A Comms Rep gave them a tote bag. It is a very good tote bag.");
}

/** The safety budget: up is a `safetyUp` signal at midnight, down a `safetyDown`. */
export function setSafetySpend(state: GameState, level: number) {
  const f = state.factions;
  const to = Math.max(0, Math.min(SAFETY_COST.length - 1, Math.round(level)));
  if (!f || to === f.safety || !Number.isFinite(level)) return;
  signalFactions(state, to > f.safety ? "safetyUp" : "safetyDown");
  f.pending = f.pending.filter((s) => s !== (to > f.safety ? "safetyDown" : "safetyUp"));
  f.safety = to;
  addToast(state, to === 0 ? "Safety budget cut to nothing. The Safetyists felt that." : `Safety budget: ${SAFETY_LABELS[to]} (${formatMoney(SAFETY_COST[to]!)}/day, training ${Math.round(SAFETY_DRAG[to]! * 100)}% slower).`, to === 0 ? "bad" : "neutral", { source: "factions", importance: "you" });
}

/** Queue a signal for midnight (the `faction.signal` verb, the safety budget, a hearing in another pack). */
export function signalFactions(state: GameState, signal: string) {
  const f = state.factions;
  if (f && !f.pending.includes(signal)) f.pending.push(signal);
}

export function log(state: GameState, f: FactionsState, text: string, tone: Tone, factions: string[]) {
  f.log.push({ id: state.nextId++, day: state.day, text, tone, factions });
  if (f.log.length > LOG_SIZE) f.log.splice(0, f.log.length - LOG_SIZE);
}

function headline(state: GameState, rng: Rng, pool: readonly string[], tone: Tone, other?: FactionDef) {
  if (pool.length === 0) return;
  const text = fillTemplate(rng.pick(pool), {
    lab: state.labName,
    model: state.models[state.models.length - 1] ?? state.training.context.name,
    other: other?.name ?? "everyone else",
  });
  addNews(state, text, tone);
}

/** What happened since the last midnight, as signals (content/factions.ts SIGNALS). */
function observe(state: GameState, f: FactionsState): Set<string> {
  const out = new Set<string>(f.pending);
  const now = seenNow(state);
  const was = f.seen;
  if (now.models > was.models) out.add("release");
  if (now.ships > was.ships) out.add("shipNow");
  if (now.holds > was.holds) out.add("hold");
  if (now.leaks > was.leaks) out.add("leak");
  if (now.openModel !== was.openModel && now.openModel >= 0) out.add("openRelease");
  if (now.raisedSafety !== was.raisedSafety && now.raisedSafety >= 0) out.add("safetyTalk");
  if (now.ignoredWater !== was.ignoredWater && now.ignoredWater >= 0) out.add("waterIgnored");
  if (now.policy !== was.policy) {
    if (now.policy === "Open") out.add("papersOpen");
    if (now.policy === "Closed") out.add("papersClosed");
  }
  for (const kind of ["cluster", "gas", "datacenter", "solar", "fountain"] as const) if ((now.built[kind] ?? 0) > (was.built[kind] ?? 0)) out.add(kind);
  if (f.incidents >= 0.1) out.add("incident");
  f.seen = now;
  f.incidents = 0;
  f.pending = [];
  for (const s of out) f.signals[s] = state.day;
  return out;
}

/** Midnight. The tick only calls this once the factions are on (Level 4, or the app's debug switch). */
export function dailyFactions(state: GameState) {
  const f = state.factions;
  if (!f) return;
  const rng = createRng(f.rngState);
  const cost = SAFETY_COST[f.safety] ?? 0;
  if (cost > 0) {
    state.cash -= cost;
    state.ledger = { ...state.ledger, expenses: state.ledger.expenses + cost, net: state.ledger.net - cost };
  }
  const today = observe(state, f);
  updateStance(state, f, today);
  const all = defs().factions;

  for (const def of all) {
    const stored = f.moods[def.id];
    if (!stored) continue;
    let meter = stored.context.meter + (targetOf(def, f.stance) - stored.context.meter) * EASE;
    for (const r of def.grievances) if (r.amount !== 0 && today.has(r.on)) ((meter += r.amount), (f.why[def.id] = { text: r.text, day: state.day, amount: r.amount }));
    for (const r of def.cheers) if (r.amount !== 0 && today.has(r.on)) ((meter += r.amount), (f.why[def.id] = { text: r.text, day: state.day, amount: r.amount }));
    const quiet = quietMoodDay(stored, clamp100(meter), marchLine(def));
    let r = quiet ? { stored: quiet, effects: [] } : step(factionMoodMachine, stored, { type: "DAY", meter: clamp100(meter), day: state.day, march: marchLine(def) });
    for (const e of r.effects) onMood(state, f, rng, def, e);
    if (today.has("release")) {
      const launch = step(factionMoodMachine, r.stored, { type: "RELEASE" });
      for (const e of launch.effects) onMood(state, f, rng, def, e);
      r = launch;
    }
    f.moods[def.id] = r.stored;
  }

  sway(state, f);
  relations(state, f, rng, all);
  opEds(state, f, rng, all);
  factionThought(state, f, rng, all);
  f.rngState = rng.state();
}

/**
 * Start the factions where the lab already stands, as if they had been watching all along: each meter at its target
 * and each mood to match, with no headlines. For staged scenarios (the mid-game, the debug moments).
 */
export function settleFactions(state: GameState) {
  const f = state.factions;
  if (!f) return;
  f.stance = readStance(state, f);
  for (const def of defs().factions) {
    const stored = f.moods[def.id];
    if (!stored) continue;
    const meter = targetOf(def, f.stance);
    let r = step(factionMoodMachine, stored, { type: "DAY", meter, day: state.day, march: marchLine(def) });
    // Upset first, then (maybe) marching: the hysteresis needs two beats to get there.
    r = step(factionMoodMachine, r.stored, { type: "DAY", meter, day: state.day, march: marchLine(def) });
    f.moods[def.id] = r.stored;
  }
}

type MoodEffect = { type: "MOOD"; from: string; to: string } | { type: "HYPE" } | { type: "BOYCOTT" };

function onMood(state: GameState, f: FactionsState, rng: Rng, def: FactionDef, e: MoodEffect) {
  // Hype from a faction is worth more the bigger its audience: a thousand normies outshout ten wonks.
  const loud = 1 + def.audience / 40;
  switch (e.type) {
    case "MOOD":
      if (e.to === "fan") {
        headline(state, rng, def.headlines.fan, "good");
        log(state, f, `${def.name} are fans now.`, "good", [def.id]);
      } else if (e.to === "upset" && e.from === "calm") log(state, f, `${def.name} are upset: ${f.why[def.id]?.text ?? "it's the vibes."}`, "bad", [def.id]);
      else if (e.to === "protesting") {
        f.counts.marches++;
        headline(state, rng, def.headlines.angry, "bad");
        log(state, f, `${def.name} march on the gate.`, "bad", [def.id]);
      } else if (e.from === "protesting") log(state, f, `${def.name} fold their signs and go home.`, "neutral", [def.id]);
      else if (e.to === "calm") log(state, f, `${def.name} have calmed down.`, "neutral", [def.id]);
      break;
    case "HYPE":
      f.counts.hype++;
      state.hype = clampPos(state.hype + loud);
      headline(state, rng, def.headlines.fan, "good");
      break;
    case "BOYCOTT":
      f.counts.boycotts++;
      state.hype = clampPos(state.hype - loud);
      headline(state, rng, def.headlines.angry, "bad");
      break;
  }
}

/** A faction's everyday pull on the lab's numbers, scaled by how strongly it feels. */
function sway(state: GameState, f: FactionsState) {
  const protests = systemUnlocked(state, "protests");
  for (const def of defs().factions) {
    const meter = f.moods[def.id]?.context.meter ?? 0;
    const s = meter >= 0 ? def.fan : def.angry;
    if (!s) continue;
    const k = Math.abs(meter) / 100;
    if (s.hype) state.hype = clampPos(state.hype + s.hype * k);
    if (s.discourse && protests) state.waterDiscourse = clampDiscourse(state.waterDiscourse + s.discourse * k);
    if (s.trust) state.disasters.trust = clampPos(state.disasters.trust + s.trust * k);
    if (s.heat) state.disasters.heat = clampPos(state.disasters.heat + s.heat * k);
  }
}

function relations(state: GameState, f: FactionsState, rng: Rng, all: readonly FactionDef[]) {
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i]!;
      const b = all[j]!;
      const key = pairKey(a.id, b.id);
      const stored = f.relations[key];
      if (!stored) continue;
      const ma = f.moods[a.id]?.context.meter ?? 0;
      const mb = f.moods[b.id]?.context.meter ?? 0;
      let v = stored.context.value;
      // Two factions that both feel strongly about you drift together if they feel the same way, apart if not.
      const split = (f.moods[a.id]?.value === "fan" && f.moods[b.id]?.value !== "calm" && f.moods[b.id]?.value !== "fan")
        || (f.moods[b.id]?.value === "fan" && f.moods[a.id]?.value !== "calm" && f.moods[a.id]?.value !== "fan");
      if (Math.abs(ma) > 25 && Math.abs(mb) > 25) v += Math.sign(ma) * Math.sign(mb) * DRIFT * (split ? SPLIT : 1) * (Math.min(Math.abs(ma), Math.abs(mb)) / 100);
      v += (baseRelationOf(a.id, b.id) - v) * HOMING;
      const still = quietRelationDay(stored, clamp100(v));
      if (still) {
        f.relations[key] = still;
        continue;
      }
      const r = step(relationMachine, stored, { type: "DAY", value: clamp100(v) });
      f.relations[key] = r.stored;
      // The louder of the two gets the headline.
      const [loud, quiet] = a.audience >= b.audience ? [a, b] : [b, a];
      for (const e of r.effects) {
        if (e.type === "ALLIED") {
          f.counts.alliances++;
          headline(state, rng, loud.headlines.ally, "joke", quiet);
          log(state, f, `${a.name} and ${b.name} are allies now.`, "good", [a.id, b.id]);
        } else if (e.type === "SCHISM") {
          f.counts.schisms++;
          headline(state, rng, loud.headlines.schism, "joke", quiet);
          log(state, f, `Schism: ${a.name} and ${b.name} have split.`, "bad", [a.id, b.id]);
        } else if (e.type === "FEUD") {
          f.counts.feuds++;
          log(state, f, `${a.name} and ${b.name} are feuding.`, "bad", [a.id, b.id]);
        } else if (e.type === "COOLED") {
          log(state, f, e.was === "allied" ? `${a.name} and ${b.name} drift apart.` : `${a.name} and ${b.name} are talking again.`, "neutral", [a.id, b.id]);
        }
      }
    }
  }
}

/** What `a` says to `b`, and what `b` says back: a written duel if the pair has one, else an opener and a retort. */
export function exchange(rng: Rng, a: FactionDef, b: FactionDef): [string, string] {
  const duel = a.duels?.find((d) => d.vs === b.id);
  if (duel && duel.lines.length > 0) return [...rng.pick(duel.lines)] as [string, string];
  const back = b.duels?.find((d) => d.vs === a.id);
  if (back && back.lines.length > 0) {
    const [x, y] = rng.pick(back.lines);
    return [y, x];
  }
  return [a.argue.length > 0 ? rng.pick(a.argue) : "Well, actually.", b.retorts.length > 0 ? rng.pick(b.retorts) : "Source?"];
}

/** Feuding factions trade op-eds every few weeks: the one the ticker enjoys most. */
function opEds(state: GameState, f: FactionsState, rng: Rng, all: readonly FactionDef[]) {
  if (state.day - f.lastOpEd < OP_ED_EVERY) return;
  let best: [FactionDef, FactionDef] | null = null;
  let loudest = 0;
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i]!;
      const b = all[j]!;
      if (f.relations[pairKey(a.id, b.id)]?.value !== "feuding") continue;
      const heat = Math.abs(f.moods[a.id]?.context.meter ?? 0) + Math.abs(f.moods[b.id]?.context.meter ?? 0);
      if (heat > loudest) [best, loudest] = [[a, b], heat];
    }
  }
  if (!best || loudest < 50 || !rng.chance(0.5)) return;
  const [a, b] = best;
  const [said, reply] = exchange(rng, a, b);
  f.lastOpEd = state.day;
  f.counts.opEds++;
  addNews(state, `Dueling op-eds. ${a.name}: "${said}" ${b.name}: "${reply}"`, "joke");
  log(state, f, `${a.name} and ${b.name} trade op-eds about ${state.labName}.`, "joke", [a.id, b.id]);
}

function factionThought(state: GameState, f: FactionsState, rng: Rng, all: readonly FactionDef[]) {
  if (!rng.chance(0.4)) return;
  const live = state.thoughts.filter((t) => t.expiresTick > state.tick);
  if (live.length >= 3) return;
  const speaking = new Set(live.map((t) => t.walkerId));
  const pool = state.walkers.filter((w) => w.faction && modeOf(w) === "walk" && !speaking.has(w.id) && Math.abs(f.moods[w.faction]?.context.meter ?? 0) >= 20);
  if (pool.length === 0) return;
  const w = rng.pick(pool);
  const def = all.find((d) => d.id === w.faction);
  if (!def || def.thoughts.length === 0) return;
  state.thoughts.push({ id: state.nextId++, walkerId: w.id, kind: w.kind, text: rng.pick(def.thoughts), expiresTick: state.tick + THOUGHT_TICKS, faction: def.id });
}

// ---- Per tick ------------------------------------------------------------------------------------------------

/** A stable number in [0, 1) for a walker in a run: the membership draw that is not a draw. */
function hash01(seed: number, id: number): number {
  let h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(id + 0x165667b1, 0xc2b2ae35);
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** A walker's pull toward a faction: its role's weight wins over its kind's. */
export const weightFor = (def: FactionDef, w: Pick<Walker, "kind" | "role">): number => def.members[`role:${w.role}`] ?? def.members[w.kind] ?? 0;

/** Which faction a walker belongs to ("" for none), from the content's membership weights. */
export function factionFor(state: GameState, w: Walker): string {
  if (w.crowd) return w.crowd;
  const all = defs().factions;
  let total = 0;
  for (const def of all) total += weightFor(def, w);
  if (total <= 0) return "";
  let x = hash01(state.seed, w.id) * total;
  for (const def of all) {
    x -= weightFor(def, w);
    if (x < 0) return def.id;
  }
  return all[all.length - 1]!.id;
}

/** Every few ticks: give newcomers their faction, and now and then start an argument on the paths. */
export function updateFactions(state: GameState) {
  const f = state.factions;
  if (!f || state.tick % 4 !== 0) return;
  for (const w of state.walkers) if (w.faction === undefined) w.faction = factionFor(state, w);
  if (state.tick - f.lastArgue < ARGUE_EVERY) return;
  const rng = createRng(f.rngState);
  if (argue(state, f, rng)) f.lastArgue = state.tick;
  f.rngState = rng.state();
}

/** Two walkers from factions that are feuding (or just see the world differently) pass on a path: they say so. */
function argue(state: GameState, f: FactionsState, rng: Rng): boolean {
  const speaking = new Set<number>();
  for (const t of state.thoughts) if (t.expiresTick > state.tick) speaking.add(t.walkerId);
  const out = state.walkers.filter((w) => w.faction && w.kind !== "protester" && modeOf(w) === "walk" && !speaking.has(w.id));
  if (out.length < 2) return false;
  for (let tries = 0; tries < 6; tries++) {
    const a = rng.pick(out);
    const da = defs().factionById(a.faction!);
    if (!da) continue;
    let best: Walker | null = null;
    let bestD = ARGUE_RANGE;
    for (const b of out) {
      if (b === a || b.faction === a.faction) continue;
      const d = Math.hypot(b.x - a.x, b.z - a.z);
      if (d >= bestD) continue;
      const rel = f.relations[pairKey(a.faction!, b.faction!)];
      if (!rel || (rel.value !== "feuding" && rel.context.value > -20)) continue;
      best = b;
      bestD = d;
    }
    if (!best) continue;
    const db = defs().factionById(best.faction!);
    if (!db) continue;
    const [said, reply] = exchange(rng, da, db);
    pairedThoughts(state, a, said, da.id, best, reply, db.id);
    f.counts.arguments++;
    return true;
  }
  return false;
}

/** Two bubbles at once, the second marked as the reply: the oldest bubbles make room, so there are never more than three. */
export function pairedThoughts(state: GameState, a: Walker, said: string, fa: string, b: Walker, reply: string, fb: string) {
  state.thoughts = state.thoughts.filter((t) => t.expiresTick > state.tick && t.walkerId !== a.id && t.walkerId !== b.id);
  while (state.thoughts.length > 1) state.thoughts.shift();
  // Half as long as a thought: an argument is a moment, not a mood.
  const until = state.tick + THOUGHT_TICKS / 2;
  state.thoughts.push({ id: state.nextId++, walkerId: a.id, kind: a.kind, text: said, expiresTick: until, faction: fa });
  state.thoughts.push({ id: state.nextId++, walkerId: b.id, kind: b.kind, text: reply, expiresTick: until, faction: fb, replyTo: a.id });
}

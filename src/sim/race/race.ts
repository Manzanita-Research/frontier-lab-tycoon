import { rivalRules } from "./rules";
import { pressureReady } from "../tutorial";
// The Race's driver: once a game day it checks the R&D multiplier and the era ratchet, calls the weekly cycle
// every seventh day (rivals act, the Arena is re-ranked, the news turns) and decides which cards are due
// (open-weights drop, compute auction, funding round). The rivals and the era are machines; this applies what
// they emit to the World, draws the dice and pre-rolls them into the events, in a fixed order.
import { eraDef } from "../../content/eras";
import type { NewsTrigger } from "../../content/headlines";
import type { RivalDef, RivalId } from "../../content/rivals";
import type { EmittedFrom } from "xstate";
import { fillTemplate } from "../format";
import { step } from "../machines/run";
import { addNews, addToast, headlinePool, templateVars } from "../news";
import type { Rng } from "../rng";
import type { GameState } from "../types";
import { resign } from "../walkers";
import { offerPoach } from "../poaching/driver";
import { refreshBoard } from "./arena";
import { queueFinished, pushVoice } from "./leapfrog/ops";
import { LEAPFROG } from "../../content/leapfrog";
import { eraMachine, eraNumber } from "./era";
import { fundingDue, openDropActive, OPEN_DROP_DAYS, raceVars } from "./finance";
import { rdMultiplier } from "./rd";
import { rivalMachine } from "./rival";
import { defs } from "../defs";

/** Cash a poach costs: the recruiter's fee for the replacement. */
export const POACH_FEE = 100_000;
/** Days between open-weights drops, so one lab can't sit on your revenue forever. */
const DROP_GAP_DAYS = 45;
/**
 * A free model matches yours when it is within 10% below (or up to 35% above: it beats you, and it is free).
 * A rival far ahead is a different problem; one far behind is not a problem at all.
 */
const DROP_FLOOR = 0.9;
const DROP_CEILING = 1.35;
/** Researchers you keep no matter who is calling. */
const POACH_FLOOR = 5;

export const eraOfState = (state: GameState): number => eraNumber(state.race.era);

/** Headline from the shared pool for `trigger`, with the race's variables, avoiding what the ticker just showed. */
export function raceNews(state: GameState, rng: Rng, trigger: NewsTrigger, vars: Record<string, string> = {}) {
  const pool = headlinePool(state, rng, trigger);
  if (pool.length === 0) return;
  const shown = new Set(state.news.map((n) => n.text));
  const all = { ...templateVars(state, { rival: vars.rival, model: vars.model }, rng), ...raceVars(state), ...vars };
  for (let attempt = 0; attempt < 4; attempt++) {
    const h = rng.pick(pool);
    const text = fillTemplate(h.text, all);
    if (attempt < 3 && shown.has(text)) continue;
    addNews(state, text, h.tone);
    return;
  }
}

/** Once a game day, after the training and the economy have run. */
export function dailyRace(state: GameState, rng: Rng) {
  const race = state.race;
  race.mult = rdMultiplier(state);
  const { stored, effects } = step(eraMachine, race.era, { type: "DAY", mult: race.mult });
  race.era = stored;
  for (const e of effects) {
    state.flags[`offer:era${e.era}`] = state.day;
    // An earlier era's card still waiting (the ladder holds cards until Level 5) is old news: this era's card replaces it.
    for (let k = 2; k < e.era; k++) delete state.flags[`offer:era${k}`];
    raceNews(state, rng, `eraReached:${e.era}` as NewsTrigger);
  }

  if (race.openDrop && state.day >= race.openDrop.until) {
    addToast(state, `${defs().rivalById[race.openDrop.rival as RivalId]?.name ?? "The rival"}'s free model has settled in. Revenue is back.`, "good", { source: "race" });
    race.openDrop = null;
    // A card still waiting for its turn (the ladder holds cards until Level 5) would be about a drop that is over.
    delete state.flags["offer:openWeights"];
  }
  if (state.day > 0 && state.day % 7 === 0) weekly(state, rng);

  // Cards that are due. The daily events check (run after this) opens them one at a time.
  const pending = (name: string) => state.flags[name] !== undefined;
  if (state.day >= race.nextAuction && !pending("offer:auction") && state.buildings.some((b) => b.kind === "hall")) state.flags["offer:auction"] = state.day;
  if (!pending("offer:funding") && fundingDue(state)) {
    state.flags["offer:funding"] = state.day;
    race.lastFunding = state.day;
  }
}

/** Rubber band: the square root of how far ahead you are, so a lab at half your capability grows 40% faster. */
export const chase = (mine: number, theirs: number): number => Math.max(0.55, Math.min(1.6, Math.sqrt(mine / Math.max(1, theirs))));

/** Model name for a rival's next release. Always exactly one draw, so the stream doesn't depend on who ships. */
export function modelName(def: RivalDef, nth: number, rng: Rng): string {
  if (!def.models) {
    rng.next();
    return "";
  }
  const tier = rng.pick(def.models.tiers);
  return `${def.models.base}-${nth}${tier ? `-${tier}` : ""}`;
}

type RivalEffect = EmittedFrom<typeof rivalMachine>;

/** Every seventh day: each rival takes its turn, then the Arena is re-ranked and the news cycle turns. */
export function weekly(state: GameState, rng: Rng) {
  const race = state.race;
  race.week++;
  const era = eraDef(eraOfState(state));
  for (let i = 0; i < race.rivals.length; i++) {
    const before = race.rivals[i]!;
    const def = defs().rivalById[before.context.id as RivalId];
    // FLT-22: a law's clauses (timed effects) may slow a lab, shrink its releases or forbid open weights. All 1 by default.
    const law = rivalRules(state, before.context);
    const event = {
      type: "WEEK" as const,
      week: race.week,
      aggro: era.rivalGrowth * law.growth,
      pace: era.rivalPace * law.pace,
      chase: chase(state.capability, before.context.capability),
      lengthRoll: rng.next(),
      gainRoll: rng.next(),
      openRoll: rng.next(),
      poachRoll: rng.next(),
      name: modelName(def, before.context.releases + 1, rng),
      // Release Leapfrog: labs with a product finish models privately and the calendar picks their launch day.
      hold: state.leapfrog.enabled && def.models !== null,
      closed: law.closed,
    };
    const { stored, effects } = step(rivalMachine, before, event);
    race.rivals[i] = stored;
    for (const e of effects) applyRival(state, rng, def, e);
  }

  const before = race.rank;
  refreshBoard(state);
  const rank = race.rank;
  if (rank === 1 && before !== 1) {
    raceNews(state, rng, "topOne", { rank: "1" });
    addToast(state, "#1 on the Frontier Arena! Everyone else is updating the rules.", "good", { source: "race", importance: "you" });
  } else if (rank < before) {
    raceNews(state, rng, "rankUp", { rank: String(rank) });
    if (before - rank >= 2) addToast(state, `Up ${before - rank} places: #${rank} on the Arena.`, "good", { source: "race" });
  } else if (rank > before) {
    raceNews(state, rng, "rankDown", { rank: String(rank) });
    if (rank - before >= 2) addToast(state, `Down ${rank - before} places: #${rank} on the Arena.`, "bad", { source: "race" });
  } else if (rng.chance(0.5)) {
    raceNews(state, rng, "weekly", { rival: defs().rivalById[rng.pick(race.rivals).context.id as RivalId].name });
  }
  if (rng.chance(0.4)) raceNews(state, rng, `era:${eraOfState(state)}` as NewsTrigger);
}

/**
 * A rival's model goes public: the headline, and the open-weights check (a free model near yours eats your revenue).
 * `quiet` skips the headline (Release Leapfrog's day-after answers have their own).
 */
export function announceRelease(state: GameState, rng: Rng, def: RivalDef, e: Extract<RivalEffect, { type: "RELEASED" }>, quiet = false) {
  const race = state.race;
  const vars = { rival: def.name, model: e.model, lab: state.labName };
  const ahead = e.capability > state.capability;
  const lines = !def.models ? (def.headlines.stunt ?? []) : e.open && def.headlines.open && rng.chance(0.5) ? def.headlines.open : def.headlines.release;
  if (!quiet && lines.length > 0) addNews(state, fillTemplate(rng.pick(lines), vars), !def.models ? "joke" : ahead ? "bad" : "neutral", "arena");

  const close = e.capability >= state.capability * DROP_FLOOR && e.capability <= state.capability * DROP_CEILING;
  if (pressureReady(state) && e.open && def.models && close && state.ledger.income > 0 && !openDropActive(state) && state.day - race.lastDrop >= DROP_GAP_DAYS) {
    race.openDrop = { until: state.day + OPEN_DROP_DAYS, rival: def.id, model: e.model };
    race.lastDrop = state.day;
    state.flags["offer:openWeights"] = state.day;
    raceNews(state, rng, "openDrop", { rival: def.name, model: e.model });
    addToast(state, `${def.name} just dropped ${e.model} for free. Revenue -30% for ${OPEN_DROP_DAYS} days.`, "bad", { source: "race", importance: "you" });
  }
}

function applyRival(state: GameState, rng: Rng, def: RivalDef, e: RivalEffect) {
  const race = state.race;
  switch (e.type) {
    case "RELEASED":
      announceRelease(state, rng, def, e);
      // A lab with no product has only stunts, which are the whole of its news cycle.
      if (!def.models) pushVoice(state, def.id, LEAPFROG.rules.voice.stuntPush);
      return;
    case "FINISHED":
      // Release Leapfrog: the model waits in the queue for a launch date.
      queueFinished(state, e);
      return;
    case "POACH": {
      // The poached researcher hands in the box like any quitter (FLT-8): box, gate, headline, a dent in the Vibes.
      const staff = state.walkers.filter((w) => w.kind === "researcher" && w.machine.value !== "leaving" && w.machine.value !== "quitting");
      if (staff.length <= POACH_FLOOR) return;
      // The Poaching War (FLT-20), when it is on, turns this into one offer to several people and a card.
      if (offerPoach(state, { from: def.id, name: def.name, short: def.short })) return;
      const gone = rng.pick(staff);
      resign(state, gone, rng);
      state.cash -= POACH_FEE;
      state.hype = Math.max(0, state.hype - 1.5);
      race.poached++;
      const own = def.headlines.poach;
      if (own && own.length > 0 && rng.chance(0.6)) addNews(state, fillTemplate(rng.pick(own), { rival: def.name, lab: state.labName }), "bad");
      else raceNews(state, rng, "poach", { rival: def.name });
      addToast(state, `${def.name} poached ${gone.name}. Recruiter fee: $${POACH_FEE / 1000}K.`, "bad", { source: "race" });
      return;
    }
  }
}

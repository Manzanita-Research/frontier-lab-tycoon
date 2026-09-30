// Release Leapfrog's driver: once a game day it runs the release calendar and applies what the machines emit to the
// World (a lab launches, a benchmark record falls, a benchmark is solved, somebody owns the news cycle). It also
// handles your own launches (the SOTA claims, the counter-launch, the livestream). The machines are pure; the dice are
// drawn here, in a fixed order, and none are drawn at all while the pack is off.
import { BENCH_BY_ID, LEAPFROG, mishapById, successorOf, type BenchmarkDef, type PackTrigger } from "../../../content/leapfrog";
import { eraDef } from "../../../content/eras";
import { RIVAL_BY_ID, YOU, type RivalId } from "../../../content/rivals";
import { fillTemplate } from "../../format";
import { step } from "../../machines/run";
import { addNews, addToast } from "../../news";
import type { Rng } from "../../rng";
import { demoOdds } from "../../demo";
import type { GameState } from "../../types";
import { addIncident } from "../../vibes";
import { announceRelease, eraOfState, modelName } from "../race";
import { opensThisTime, rivalMachine } from "../rival";
import { benchMachine, isOpen, scoreFor } from "./benchmark";
import { calendarMachine } from "./calendar";
import { livestreamMachine } from "./livestream";
import { capOf, hasProduct, hypeOf, labIds, nameOf, pushVoice, rivalOf, shiftTrust } from "./ops";
import { responseMachine } from "./response";
import { benchStored, type BenchEntry, type Claim, type DropRecord, type PendingLaunch } from "./state";
import { bugChance, readiness } from "./vars";
import { voiceMachine } from "./voice";

const R = LEAPFROG.rules;

// ---------------------------------------------------------------------------------------------------- news

/** A headline from the pack for `trigger`, avoiding what the ticker just showed. Returns the text (or null when the pool is empty). */
export function packNews(state: GameState, rng: Rng, trigger: PackTrigger, vars: Record<string, string> = {}): string | null {
  const pool = LEAPFROG.headlines.filter((h) => h.trigger === trigger);
  if (pool.length === 0) return null;
  const shown = new Set(state.news.map((n) => n.text));
  const all = { lab: state.labName, ...vars };
  for (let attempt = 0; attempt < 4; attempt++) {
    const h = rng.pick(pool);
    const text = fillTemplate(h.text, all);
    if (attempt < 3 && shown.has(text)) continue;
    addNews(state, text, h.tone);
    return text;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------- scores

/** A lab's real score on a benchmark, from its capability (times its bias) and, for Elo, its hype. Null: no product. */
export function honestScore(state: GameState, id: string, def: BenchmarkDef): number | null {
  if (!hasProduct(id)) return null;
  const bias = id === YOU ? 1 : (LEAPFROG.labs[id]?.bias[def.id] ?? 1);
  return scoreFor(def, R.benchmarks.slope, capOf(state, id), bias, hypeOf(state, id));
}

/** What the leaderboard shows: the real score, or the benchmaxxed one if that is higher. */
export function shownScore(state: GameState, id: string, def: BenchmarkDef): number | null {
  const real = honestScore(state, id, def);
  if (real === null) return null;
  const maxx = state.leapfrog.labs[id]?.maxx[def.id];
  return maxx !== undefined ? Math.max(real, maxx) : real;
}

/** The best score on a benchmark among everyone but `except`. */
function bestOthers(state: GameState, def: BenchmarkDef, except: string): number {
  let best = 0;
  for (const id of labIds(state)) {
    if (id === except) continue;
    const s = shownScore(state, id, def);
    if (s !== null && s > best) best = s;
  }
  return best;
}

/** The best score on a benchmark and who has it; the current holder keeps a tie. */
function recordOf(state: GameState, e: BenchEntry): { best: number; holder: string } {
  let best = -1;
  let holder = "";
  for (const id of labIds(state)) {
    const s = shownScore(state, id, e.def);
    if (s !== null && s > best + 1e-9) {
      best = s;
      holder = id;
    }
  }
  const current = e.machine.context.holder;
  if (current && current !== holder) {
    const s = shownScore(state, current, e.def);
    if (s !== null && s >= best - 1e-9) holder = current;
  }
  return { best, holder };
}

/** Put the leaderboard's records in place without announcing anything (a new game, or a new column). */
function seedRecord(state: GameState, e: BenchEntry) {
  const { best, holder } = recordOf(state, e);
  e.machine = { value: e.machine.value, context: { ...e.machine.context, best, holder } };
}

/** Called when the pack is switched on: the current scores are the starting records, not news. */
export function seedRecords(state: GameState) {
  for (const e of state.leapfrog.benchmarks) seedRecord(state, e);
}

/**
 * Re-read every open benchmark after something moved a score. Records fall, columns fill up and get declared solved;
 * each of those is applied here. Returns the SOTA claims made, in benchmark order.
 */
export function refreshRecords(state: GameState, rng: Rng): Claim[] {
  const lf = state.leapfrog;
  const claims: Claim[] = [];
  // A solved benchmark adds a new column while we loop; it is seeded, so it needs no pass of its own.
  for (let i = 0; i < lf.benchmarks.length; i++) {
    const e = lf.benchmarks[i]!;
    if (!isOpen(e.machine)) continue;
    const { best, holder } = recordOf(state, e);
    const { stored, effects } = step(benchMachine, e.machine, { type: "SCORES", best, holder, day: state.day });
    e.machine = stored;
    for (const fx of effects) {
      switch (fx.type) {
        case "SOTA": {
          const held = lf.labs[fx.lab];
          const maxx = held?.maxx[fx.id];
          claims.push({ bench: fx.id, lab: fx.lab, score: fx.score, prev: fx.prev, prevHolder: fx.prevHolder, maxx: maxx !== undefined && maxx >= fx.score - 1e-9 });
          lf.stats.sota++;
          break;
        }
        case "CROWDED":
          packNews(state, rng, "crowded", { bench: e.def.name });
          break;
        case "SATURATED":
          declareSolved(state, rng, e, fx.lab);
          break;
        case "RETIRED":
          break;
      }
    }
  }
  for (const c of claims) if (c.maxx) state.leapfrog.stats.maxxed++;
  return claims;
}

/**
 * Give a lab that just launched a claim to fame. If its real scores don't top any leaderboard, it benchmaxxes the
 * benchmark it is closest on (a custom prompt, best of 64, a footnote): the score lands just past the record.
 * Always draws one die. The player's launches are honest; a leaked screenshot is the player's version.
 */
function benchmaxx(state: GameState, rng: Rng, id: string) {
  const roll = rng.next();
  const mine = state.leapfrog.labs[id]!;
  mine.maxx = {};
  let closest: BenchEntry | null = null;
  let gap = Infinity;
  for (const e of state.leapfrog.benchmarks) {
    if (!isOpen(e.machine) || e.def.kind !== "score") continue;
    const own = honestScore(state, id, e.def);
    if (own === null) continue;
    const record = standing(state, e, id);
    if (own > record + 0.05) return; // an honest record: nothing to tune
    if (record - own < gap) {
      gap = record - own;
      closest = e;
    }
  }
  if (closest) setMaxx(state, closest, id, roll);
}

/** The record to beat for `id`: the best anyone else has, or the standing record if that is higher (its own old claim counts). */
const standing = (state: GameState, e: BenchEntry, id: string): number => Math.max(bestOthers(state, e.def, id), e.machine.context.best);

/** A claim just past the record on `e`: a custom prompt, best of 64. Near the ceiling the margin shrinks, so the last points take forever. */
export function setMaxx(state: GameState, e: BenchEntry, id: string, roll: number) {
  const record = standing(state, e, id);
  const [lo, hi] = e.def.kind === "elo" ? R.benchmarks.eloMargin : R.benchmarks.maxxMargin;
  const margin = e.def.kind === "elo" ? lo + (hi - lo) * roll : Math.min(lo + (hi - lo) * roll, Math.max(0.05, (100 - record) * 0.3));
  state.leapfrog.labs[id]!.maxx[e.def.id] = e.def.kind === "elo" ? record + margin : Math.min(99.95, record + margin);
}

// ---------------------------------------------------------------------------------------------------- saturation

/** Declare a benchmark solved: the headline, the reactions, and a harder replacement joins the leaderboard. */
function declareSolved(state: GameState, rng: Rng, e: BenchEntry, holder: string) {
  const lf = state.leapfrog;
  lf.stats.solved.push({ id: e.def.id, day: state.day });
  const next = introduceSuccessor(state, e.def);
  const seeded = lf.benchmarks[lf.benchmarks.length - 1]!;
  const vars = { bench: e.def.name, next: next.name, pct: String(Math.max(1, Math.floor(seeded.machine.context.best))) };
  packNews(state, rng, "saturated", vars);
  // Frontier labs, neo labs, open-weights labs and BigCos each have a way of taking the news: two of them speak up.
  const speakers = LEAPFROG.labs;
  const ids = Object.keys(speakers).filter((id) => id !== holder && rivalOf(state, id));
  const first = ids.length > 0 ? rng.pick(ids) : "";
  const others = ids.filter((id) => id !== first && speakers[id]!.kind !== speakers[first]?.kind);
  const second = others.length > 0 ? rng.pick(others) : "";
  for (const id of [first, second]) {
    if (!id) continue;
    packNews(state, rng, `react:${speakers[id]!.kind}` as PackTrigger, { ...vars, rival: nameOf(state, id) });
    pushVoice(state, id, R.voice.sotaPush);
  }
  if (holder) pushVoice(state, holder, R.voice.sotaPush);
  addToast(state, `${e.def.short} is solved. Everyone is back to ${vars.pct}% on ${next.short}.`, "neutral");
}

/** The pack's replacement for a solved benchmark, or (if a mod never named one) a tougher "(Extended)" version of it. */
function introduceSuccessor(state: GameState, solved: BenchmarkDef): BenchmarkDef {
  const named = successorOf(solved.id);
  const def: BenchmarkDef = named ?? {
    id: `${solved.id}+`,
    name: `${solved.name} (Extended)`,
    short: `${solved.short}+`,
    kind: "score",
    difficulty: Math.round(solved.difficulty * 2.4),
    replaces: solved.id,
  };
  const entry: BenchEntry = { def, machine: benchStored(def, state.day) };
  state.leapfrog.benchmarks.push(entry);
  seedRecord(state, entry);
  return def;
}

// ---------------------------------------------------------------------------------------------------- launches

/** Weighted pick by a die: `weights[i]` is the odds of `items[i]`. Always one die. */
function weighted<T>(items: readonly T[], weights: readonly number[], roll: number): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let at = roll * total;
  for (let i = 0; i < items.length; i++) {
    at -= weights[i]!;
    if (at < 0) return items[i]!;
  }
  return items[items.length - 1]!;
}

/** A small update from a lab with nothing finished: a lab launches something even when nothing is ready ("Chatty-5-mini-turbo"). */
function pointRelease(state: GameState, rng: Rng, id: string): PendingLaunch {
  const def = RIVAL_BY_ID[id as RivalId];
  const ctx = rivalOf(state, id)!.context;
  const era = eraDef(eraOfState(state));
  const gain = def.personality.growth * 0.45 * era.rivalGrowth;
  // What it pays out now comes off the lab's next finished model, so launching more often doesn't make a lab grow faster.
  state.leapfrog.labs[id]!.advance += gain;
  return { id, model: modelName(def, ctx.releases + 1, rng), gain, hype: 5 * def.personality.hypeHunger, open: opensThisTime(ctx, rng.next()), since: state.day };
}

/**
 * Which lab launches. Labs with a finished model waiting are likelier (and the longer it has waited the likelier), a lab
 * that launched recently is not, and an answer favors the strong. A lab with nothing finished ships a point release.
 * Always one die (plus what a point release draws).
 */
function pickLaunch(state: GameState, rng: Rng, slot: "lead" | "answer", leadLab: string): PendingLaunch | null {
  const lf = state.leapfrog;
  const roll = rng.next();
  const ids = state.race.rivals.map((r) => r.context.id).filter((id) => id !== leadLab && id !== YOU && hasProduct(id));
  if (ids.length === 0) return null;
  const weights = ids.map((id) => {
    const queued = lf.queue.find((p) => p.id === id);
    const ctx = rivalOf(state, id)!.context;
    const daysSince = ctx.lastRelease < 0 ? 99 : (state.race.week - ctx.lastRelease) * 7;
    const cool = Math.max(0.15, Math.min(1, daysSince / 28));
    const base = queued ? 2 + (state.day - queued.since) / 8 : 0.7;
    const strength = slot === "answer" ? (ctx.capability + (queued?.gain ?? 0)) / 30 : 1;
    return base * cool * strength;
  });
  const id = weighted(ids, weights, roll);
  return lf.queue.find((p) => p.id === id) ?? pointRelease(state, rng, id);
}

const pushLog = (state: GameState, rec: DropRecord) => {
  const lf = state.leapfrog;
  lf.last = rec;
  lf.log.push(rec);
  if (lf.log.length > 12) lf.log.splice(0, lf.log.length - 12);
};

/** A lab launches today (a lead drop, or its day-after answer). */
export function handleDrop(state: GameState, rng: Rng, slot: "lead" | "answer") {
  const lf = state.leapfrog;
  const leadLab = slot === "answer" && lf.last ? lf.last.lab : "";
  const pending = pickLaunch(state, rng, slot, leadLab);
  if (!pending) return;
  const def = RIVAL_BY_ID[pending.id as RivalId];
  const race = state.race;
  const at = race.rivals.findIndex((r) => r.context.id === pending.id);
  const { stored, effects } = step(rivalMachine, race.rivals[at]!, {
    type: "LAUNCH",
    week: race.week,
    model: pending.model,
    gain: pending.gain,
    hype: pending.hype,
    open: pending.open,
  });
  race.rivals[at] = stored;
  lf.queue = lf.queue.filter((p) => p.id !== pending.id);
  for (const e of effects) if (e.type === "RELEASED") announceRelease(state, rng, def, e, slot === "answer");

  benchmaxx(state, rng, pending.id);
  lf.labs[pending.id]!.flash = state.day + 2;
  const claims = refreshRecords(state, rng).filter((c) => c.lab === pending.id);

  const leadName = leadLab ? nameOf(state, leadLab) : "";
  if (slot === "answer") packNews(state, rng, "answer", { rival: def.name, lead: leadName, model: pending.model });
  const claim = claims[0];
  if (claim) {
    const bench = BENCH_BY_ID[claim.bench]?.name ?? claim.bench;
    const fn = claim.maxx ? ` (*${rng.pick(LEAPFROG.footnotes)})` : "";
    packNews(state, rng, "sota", { rival: def.name, model: pending.model, bench, fn });
  }
  for (const c of claims) if (c.prevHolder === YOU) addToast(state, `${def.name} took your record on ${BENCH_BY_ID[c.bench]?.short ?? c.bench}.`, "bad");
  addToast(state, slot === "lead" ? `${def.name} launched ${pending.model}. The news cycle is theirs.` : `${def.name} answers ${leadName} a day later: ${pending.model}.`, "bad");

  pushVoice(state, pending.id, slot === "lead" ? R.voice.leadPush : R.voice.answerPush);
  pushVoice(state, pending.id, R.voice.sotaPush * claims.length);
  if (slot === "lead") offerResponse(state);
  pushLog(state, { day: state.day, slot, lab: pending.id, model: pending.model, lead: leadLab, claims });
}

/** A rival just launched: if your run is far enough along, the forced-response card is offered. */
function offerResponse(state: GameState) {
  const lf = state.leapfrog;
  const ready = readiness(state);
  const eligible =
    state.training.value === "training" && !lf.previewed && ready >= R.response.minReady && ready < 1 && state.day >= R.response.minDay && state.goals.value === "tracking";
  const { stored, effects } = step(responseMachine, lf.response, { type: "DROP", day: state.day, eligible, gapDays: R.response.gapDays });
  lf.response = stored;
  for (const e of effects) if (e.type === "OFFER") state.flags["offer:shipNow"] = state.day;
}

// ---------------------------------------------------------------------------------------------------- your launches

const pickMishap = (rng: Rng) => {
  const roll = rng.next();
  const mishap = weighted(LEAPFROG.mishaps, LEAPFROG.mishaps.map((m) => m.weight), roll);
  return mishap;
};

/**
 * You launched a model (a finished run, or ship-now): the SOTA claims your scores earn, the counter-launch if you were
 * holding, the news cycle, and the livestream. `ready` is 1 for a finished run.
 */
export function ownRelease(state: GameState, rng: Rng, opts: { early: boolean; ready: number; mishap?: string }) {
  const lf = state.leapfrog;
  lf.modelsSeen = state.models.length;
  const model = state.models[state.models.length - 1] ?? "";
  const mine = lf.labs[YOU]!;
  const leaked = mine.leaked;
  const leakedScore = leaked ? (mine.maxx[leaked] ?? 0) : 0;
  mine.maxx = {};
  mine.leaked = "";
  mine.flash = state.day + 2;

  // The real scores land. A leaked screenshot that the model can't reproduce is its own little scandal.
  if (leaked) {
    const def = lf.benchmarks.find((b) => b.def.id === leaked)?.def;
    const real = def ? honestScore(state, YOU, def) : null;
    if (real !== null && real < leakedScore - 0.05) {
      shiftTrust(state, -R.response.leakBustedTrust);
      packNews(state, rng, "leakBusted", { model });
    }
  }
  const claims = refreshRecords(state, rng).filter((c) => c.lab === YOU);
  const topClaim = claims[0];
  if (topClaim) packNews(state, rng, "youSota", { model, bench: BENCH_BY_ID[topClaim.bench]?.name ?? topClaim.bench });

  const rivalTop = state.race.rivals.reduce((best, r) => (hasProduct(r.context.id) && r.context.capability > best ? r.context.capability : best), 0);
  const strong = state.capability >= rivalTop;
  const lastRival = lf.last && lf.last.lab !== YOU ? nameOf(state, lf.last.lab) : "the field";

  // Holding for a counter-launch pays off now.
  const held = step(responseMachine, lf.response, { type: "RELEASED", day: state.day, strong });
  lf.response = held.stored;
  // The full release after a preview lands quieter: the news cycle already had its launch.
  const after = !opts.early && lf.previewed;
  if (!opts.early) lf.previewed = false;
  let push = opts.early ? R.response.shipPush : after ? R.voice.ownPush * 0.5 : R.voice.ownPush;
  for (const e of held.effects) {
    if (e.type === "WITHDRAWN") delete state.flags["offer:shipNow"];
    if (e.type !== "COUNTER") continue;
    if (e.strong) {
      push = R.response.counterStrongPush;
      state.hype = Math.min(100, state.hype + R.response.counterHype);
      state.cash += Math.round(state.ledger.income * 7 * R.response.counterBonus);
      packNews(state, rng, "counterStrong", { model, rival: lastRival });
      addToast(state, `Counter-launch lands: ${model} takes the news cycle back.`, "good");
    } else {
      push = R.response.counterSoftPush;
      packNews(state, rng, "counterSoft", { model, rival: lastRival });
      addToast(state, `The counter-launch is out, and a bit... comparable.`, "neutral");
    }
  }

  // The early release: maybe a bug.
  if (opts.early) {
    const bug = rng.chance(bugChance(opts.ready));
    const vars = { model, ready: String(Math.round(opts.ready * 100)), rival: lastRival };
    if (bug) {
      state.hype = Math.max(0, state.hype + R.response.bugHype);
      addIncident(state, R.response.bugIncident);
      push *= 0.4;
      packNews(state, rng, "bug", vars);
      addToast(state, `${model} has a launch bug. It insists it doesn't.`, "bad");
    } else {
      packNews(state, rng, "shipped", vars);
      addToast(state, `${model} is out at ${vars.ready}%: the news cycle is yours (for now).`, "good");
    }
  }
  pushVoice(state, YOU, push + R.voice.ownSotaPush * claims.length);
  livestream(state, rng, model, opts.ready, opts.mishap);
}

/** The launch livestream: it works by quality and readiness, or a mishap card opens. */
function livestream(state: GameState, rng: Rng, model: string, ready: number, forced?: string) {
  const lf = state.leapfrog;
  const L = R.livestream;
  const odds = Math.max(L.oddsFloor, Math.min(L.oddsCeil, demoOdds(state.capability) * ready * L.oddsScale + (state.buildings.some((b) => b.kind === "demo" && !b.broken) ? L.stageBonus : 0)));
  const roll = rng.next();
  const picked = pickMishap(rng);
  // `forced` (a debug scene) names the mishap; the dice are drawn either way.
  const mishap = (forced && mishapById(forced)) || picked;
  const ok = forced ? false : roll < odds;
  const { stored, effects } = step(livestreamMachine, lf.livestream, { type: "GO", day: state.day, ok, kind: mishap.id });
  lf.livestream = stored;
  for (const e of effects) {
    if (e.ok) {
      packNews(state, rng, "flawless", { model });
      state.hype = Math.min(100, state.hype + L.flawlessHype);
      pushVoice(state, YOU, L.flawlessPush);
      addToast(state, "The launch livestream goes flawlessly. (It was pre-recorded.)", "good");
      continue;
    }
    const def = mishapById(e.kind);
    if (!def) continue;
    state.flags[`offer:stream:${def.id}`] = state.day;
    addNews(state, fillTemplate(def.headline, { lab: state.labName, model }), "joke");
    addIncident(state, L.mishapIncident);
    pushVoice(state, YOU, def.voice);
  }
}

// ---------------------------------------------------------------------------------------------------- the day

const eraIndex = (state: GameState) => Math.max(0, Math.min(3, eraOfState(state) - 1));

/** Once a game day, after the race's daily check (which is when the rivals finish models). */
export function dailyLeapfrog(state: GameState, rng: Rng) {
  const lf = state.leapfrog;
  if (!lf.enabled) return;

  // Your run finished on its own since yesterday.
  if (state.models.length > lf.modelsSeen) ownRelease(state, rng, { early: false, ready: 1 });

  // The calendar. Two dice every day, so the stream doesn't depend on whether anything dropped.
  const gapRoll = rng.next();
  const pairRoll = rng.next();
  const era = eraIndex(state);
  const cal = step(calendarMachine, lf.calendar, { type: "DAY", gapRoll, pairRoll, pace: R.cadence.eraPace[era]!, pairChance: R.cadence.pairChance[era]! });
  lf.calendar = cal.stored;
  for (const e of cal.effects) handleDrop(state, rng, e.slot);

  // Solved columns retire after their moment.
  for (const e of lf.benchmarks) if (e.machine.value === "saturated") e.machine = step(benchMachine, e.machine, { type: "DAY", day: state.day }).stored;

  // The response window and the livestream tidy themselves up.
  const resp = step(responseMachine, lf.response, { type: "DAY", day: state.day });
  lf.response = resp.stored;
  for (const e of resp.effects) {
    if (e.type !== "EXPIRED") continue;
    packNews(state, rng, "windowClosed", {});
    shiftTrust(state, -2);
  }
  lf.livestream = step(livestreamMachine, lf.livestream, { type: "DAY", day: state.day }).stored;

  // The news cycle decays, and whoever owns it makes the papers.
  const baselines: Record<string, number> = {};
  for (const id of labIds(state)) baselines[id] = R.voice.baseline + R.voice.baselinePerHype * hypeOf(state, id);
  const v = step(voiceMachine, lf.voice, { type: "DAY", decay: R.voice.decay, baselines, ownShare: R.voice.ownShare, ownLead: R.voice.ownLead, keepShare: R.voice.keepShare });
  lf.voice = v.stored;
  const taken = new Set(v.effects.filter((e) => e.type === "OWNED").map((e) => e.lab));
  for (const e of v.effects) {
    if (e.type === "OWNED") {
      lf.stats.owned++;
      packNews(state, rng, "cycleOwned", { who: nameOf(state, e.lab) });
      addToast(state, e.lab === YOU ? "You own the news cycle. Enjoy it: it lasts about four days." : `${nameOf(state, e.lab)} owns the news cycle.`, e.lab === YOU ? "good" : "bad");
    } else if (!taken.has(e.lab)) {
      packNews(state, rng, "cycleLost", { who: nameOf(state, e.lab) });
    }
  }

  // The cycle feeds your hype (a share above the fair one lifts it), and trust comes back slowly.
  const total = Object.values(lf.voice.context.attention).reduce((a, b) => a + b, 0);
  const share = total > 0 ? (lf.voice.context.attention[YOU] ?? 0) / total : 0;
  const nudge = Math.max(R.voice.hypeMin, Math.min(R.voice.hypeMax, (share - R.voice.fairShare) * R.voice.hypePerShare));
  state.hype = Math.max(0, Math.min(100, state.hype + nudge));
  lf.trust = Math.min(R.trust.start, lf.trust + R.trust.restorePerDay);
}

/** The switch: the pack is loaded. Today's scores are the starting records. */
export function enableLeapfrog(state: GameState) {
  if (state.leapfrog.enabled) return;
  state.leapfrog.enabled = true;
  state.leapfrog.modelsSeen = state.models.length;
  seedRecords(state);
}

// FLT-69 the Bird App: researchers who post. Once a day, at midnight, on the pack's own random stream:
//   1. every researcher on staff has a posting profile (new ones get a tier, an archetype, a spice and a handle);
//   2. yesterday's posts land: flop, banger, controversy, ratioed or cancelled, and each does what it does;
//   3. today's posts are scheduled (who posts depends on tier, archetype and the moment), each one's outcome and
//      engagement rolled now, so the panels can let the likes tick up toward a number the sim already knows;
//   4. the Comms desk reviews ("Run it by Comms") and then works the queue of fires with what is left;
//   5. Aura drifts toward the floor the posters hold up.
// Every die is rolled here, in a fixed order. The two machines (machines.ts) hear only the discrete changes.
import { BIRD_OUTCOMES, type BirdBeat, type BirdEvent, type BirdMoment, type BirdOutcome, type BirdPost } from "../../content/birdapp";
import { THOUGHT_TICKS, TICKS_PER_DAY } from "../constants";
import { hourAt, isNight } from "../daylight";
import { defs } from "../defs";
import { nudgeFaction } from "../factions/state";
import { fillTemplate } from "../format";
import { initialStored } from "../machines/run";
import { addNews, addToast } from "../news";
import { createRng, type Rng } from "../rng";
import { staffOf } from "../staff";
import type { GameState, Walker } from "../types";
import { resign } from "../walkers";
import { commsMachine, posterStored, stepComms, stepPoster, type PosterTier } from "./machines";
import { BIRD as R } from "./pack";
import { dailyBirdRivals, dunk, dunkLanded, enableBirdRivals, type Scheduler } from "./rivals";
import type { BirdAppState, BirdLever, BirdPostRecord, Poster } from "./state";

export const OWNER = "birdapp";
/** How many settled posts the log keeps. */
const LOG = 40;
/** Suffixes the handle generator may add to a stem ("so_back_twice_irl"). */
const SUFFIXES = ["", "", "", "_", "2", "_irl", "_real", "_ok", "_v2", "_final", "_final_final", "_again", "_hq"];

const onStaff = (w: Walker) => w.kind === "researcher" && w.machine.value !== "quitting" && w.machine.value !== "leaving" && w.machine.value !== "gone";
const round2 = (x: number) => Math.round(x * 100) / 100;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const clampAura = (x: number) => round2(Math.max(0, Math.min(100, x)));
/** Tiers that post. */
const posting = (t: PosterTier) => t === "occasional" || t === "big";

export function enableBirdApp(s: GameState) {
  s.birdapp ??= {
    enabled: true, rngState: (s.seed ^ 0x42495244) >>> 0, aura: R.aura.start, posters: {}, posts: [], queue: [],
    comms: initialStored(commsMachine, {}), capacity: { used: 0, size: 0 }, models: s.models.length, moments: [],
    tally: { posts: 0, bangers: 0, controversies: 0, ratios: 0, cancels: 0, stuck: 0 }, history: [],
  };
  s.birdapp.enabled = true;
  enableBirdRivals(s, s.birdapp);
}
/** Nudge the lab's Aura now (FLT-109's late lunch): false, and nothing, while the Bird App is asleep. */
export function nudgeAura(s: GameState, amount: number): boolean {
  const b = s.birdapp;
  if (!b?.enabled) return false;
  b.aura = clampAura(b.aura + amount);
  return true;
}
export function disableBirdApp(s: GameState) {
  if (s.birdapp) s.birdapp.enabled = false;
}

// ---- Words

const pickEvent = (rng: Rng, beat: BirdBeat, channel: BirdEvent["channel"]): string | null => {
  const pool = defs().bird.events(beat, channel);
  return pool.length > 0 ? rng.pick(pool).text : null;
};
function vars(s: GameState, p?: { name: string; handle: string; text?: string }): Record<string, string> {
  const lab = s.labName;
  const rivals = defs().rivals;
  const rival = rivals.length > 0 ? rivals[s.day % rivals.length]! : null;
  return {
    lab, model: s.models[s.models.length - 1] ?? "the new model", rival: rival?.short ?? rival?.name ?? "a rival lab",
    name: p?.name ?? "", handle: p ? `@${p.handle}` : "", post: p?.text ?? "", queue: String(s.birdapp?.queue.length ?? 0),
  };
}
function think(s: GameState, rng: Rng, walkerId: number, beat: BirdBeat, only = false) {
  const text = pickEvent(rng, beat, "thought");
  if (!text) return;
  if (only) s.thoughts = s.thoughts.filter((t) => t.walkerId !== walkerId);
  s.thoughts.push({ id: s.nextId++, walkerId, kind: "researcher", text, expiresTick: s.tick + THOUGHT_TICKS });
}

// ---- Posters

/** A fresh handle for an archetype, unique in the lab. */
export function makeHandle(rng: Rng, stems: readonly string[], taken: (h: string) => boolean): string {
  const base = `${rng.pick(stems)}${rng.pick(SUFFIXES)}`;
  if (!taken(base)) return base;
  for (let n = 2; ; n++) if (!taken(`${base}${n}`)) return `${base}${n}`;
}

function newPoster(b: BirdAppState, w: Walker, rng: Rng, handles: Set<string>): Poster {
  const archetypes = defs().bird.archetypes;
  const arch = rng.pick(archetypes);
  const t = rng.next();
  const tier = t < R.tiers.recluse ? "recluse" : t < R.tiers.recluse + R.tiers.occasional ? "occasional" : "big";
  const [lo, hi] = R.followers[tier];
  const handle = makeHandle(rng, arch.handles, (h) => handles.has(h));
  handles.add(handle);
  const p: Poster = {
    id: w.id, handle, archetype: arch.id, spice: round2(arch.spice[0] + rng.next() * (arch.spice[1] - arch.spice[0])),
    followers: Math.round(lo + rng.next() * (hi - lo)), lever: "cook", machine: posterStored(tier), offDays: 0, posts: 0, bangers: 0, cancels: 0,
  };
  if (arch.duo) {
    const lonely = Object.values(b.posters).find((o) => o.archetype === arch.id && o.partner === undefined && o.machine.value !== "gone");
    if (lonely) {
      lonely.partner = p.id;
      p.partner = lonely.id;
    }
  }
  return p;
}

function syncPosters(b: BirdAppState, rng: Rng, staff: Map<number, Walker>) {
  for (const key in b.posters) {
    const p = b.posters[key]!;
    if (staff.has(p.id)) continue;
    delete b.posters[key];
    if (p.partner !== undefined && b.posters[p.partner]) delete b.posters[p.partner]!.partner;
    b.queue = b.queue.filter((f) => f.by !== p.id);
  }
  let handles: Set<string> | null = null;
  for (const w of staff.values()) {
    if (b.posters[w.id]) continue;
    handles ??= new Set(Object.values(b.posters).map((p) => p.handle));
    b.posters[w.id] = newPoster(b, w, rng, handles);
  }
}

// ---- The odds

/** The chance of each outcome for one post of this spice (0 to 1), reviewed by Comms or not. Flop is the rest. */
export function outcomeOdds(spice: number, reviewed: boolean): Record<BirdOutcome, number> {
  const x = clamp01(reviewed ? spice * R.comms.spice : spice);
  const banger = (R.odds.banger[0] + R.odds.banger[1] * x) * (reviewed ? R.comms.banger : 1);
  const controversy = R.odds.controversy[0] + R.odds.controversy[1] * x;
  const ratioed = R.odds.ratioed[0] + R.odds.ratioed[1] * x;
  const cancelled = R.odds.cancelled[0] + R.odds.cancelled[1] * x * x;
  return { flop: Math.max(0, 1 - banger - controversy - ratioed - cancelled), banger, controversy, ratioed, cancelled };
}
/** A poster's odds on an average line (spice 0.5): what the timeline's meter and the lever buttons show. */
export const posterOdds = (spice: number, reviewed: boolean) => outcomeOdds(clamp01(0.5 * spice + 0.25), reviewed);
/** One die against the odds, in BIRD_OUTCOMES order with flop last. */
export function rollOutcome(u: number, odds: Record<BirdOutcome, number>): BirdOutcome {
  let acc = 0;
  for (const o of BIRD_OUTCOMES) {
    if (o === "flop") continue;
    acc += odds[o];
    if (u < acc) return o;
  }
  return "flop";
}

// ---- Settling yesterday's posts

function settle(s: GameState, b: BirdAppState, rng: Rng, staff: Map<number, Walker>) {
  for (const post of b.posts) {
    if (post.settled) continue;
    post.settled = true;
    const p = b.posters[post.by];
    const w = staff.get(post.by);
    const who = { name: post.name, handle: post.handle, text: post.text };
    b.tally.posts++;
    if (!p) continue;
    const tier = p.machine.value;
    switch (post.outcome) {
      case "flop":
        p.followers = Math.round(p.followers * (1 + R.growth.flop));
        break;
      case "banger": {
        b.tally.bangers++;
        p.bangers++;
        post.viral = true;
        b.aura = clampAura(b.aura + (tier === "big" ? R.aura.banger.big : R.aura.banger.occasional));
        s.hype = Math.min(100, s.hype + R.effects.bangerHype);
        p.followers = Math.round(p.followers * (1 + R.growth.banger[0] + rng.next() * (R.growth.banger[1] - R.growth.banger[0])));
        const { effects } = applyPoster(p, { type: "BANGER", promote: tier === "occasional" && p.followers >= R.bigAt });
        if (w) think(s, rng, w.id, effects.some((e) => e.type === "PROMOTED") ? "promoted" : "banger", true);
        headline(s, rng, "banger", who, "good");
        // FLT-92: a dunk on a rival that lands says so, with its own Aura.
        if (!dunkLanded(s, b, post)) addToast(s, `🐦 @${post.handle} went viral: "${post.text}"`, "good", { source: OWNER, importance: "you", group: { kind: "viral", who: `@${post.handle}` } });
        break;
      }
      case "controversy": {
        b.tally.controversies++;
        b.aura = clampAura(b.aura + R.aura.controversy);
        s.waterDiscourse += R.cancel.controversyDiscourse;
        const arch = defs().bird.archetypeById.get(post.archetype);
        if (arch && s.factions) for (const [id, amount] of Object.entries(arch.factions)) nudgeFaction(s, id, amount, `a post by @${post.handle}`);
        b.queue.push({ post: post.id, by: post.by, kind: "controversy", day: s.day });
        headline(s, rng, "controversy", who, "bad");
        addToast(s, `🐦 @${post.handle}'s post is a Discourse now`, "neutral", { source: OWNER, importance: "world" });
        break;
      }
      case "ratioed":
        b.tally.ratios++;
        b.aura = clampAura(b.aura + R.aura.ratioed);
        p.followers = Math.max(0, Math.round(p.followers * (1 + R.growth.ratioed)));
        if (w) {
          think(s, rng, w.id, "ratioed", true);
          w.focus = Math.max(0, w.focus - 0.1);
        }
        break;
      case "cancelled":
        b.tally.cancels++;
        p.cancels++;
        b.aura = clampAura(b.aura + R.aura.cancelled);
        s.waterDiscourse += R.cancel.discourse;
        p.followers = Math.max(0, Math.round(p.followers * (1 + R.growth.cancelled)));
        b.queue.push({ post: post.id, by: post.by, kind: "cancelled", day: s.day });
        if (w) think(s, rng, w.id, "cancelled", true);
        headline(s, rng, "cancelled", who, "bad");
        addToast(s, `🐦 @${post.handle} is cancelled. Comms has it in the queue`, "bad", { source: OWNER, importance: "you", group: { kind: "cancelled", who: `@${post.handle}` } });
        break;
    }
  }
  const settled = b.posts.filter((p) => p.settled);
  if (settled.length > LOG) b.posts = b.posts.filter((p) => !p.settled || settled.indexOf(p) >= settled.length - LOG);
}

function headline(s: GameState, rng: Rng, beat: BirdOutcome, who: { name: string; handle: string; text: string }, tone: "good" | "bad") {
  const text = pickEvent(rng, beat, "headline");
  if (text) addNews(s, fillTemplate(text, vars(s, who)), tone, "birdapp");
}

/** Step a poster's machine and do what it asks. Returns what it emitted. */
function applyPoster(p: Poster, event: Parameters<typeof stepPoster>[1]) {
  const r = stepPoster(p.machine, event);
  p.machine = r.stored;
  return r;
}

// ---- The Comms desk

function workQueue(s: GameState, b: BirdAppState, rng: Rng, staff: Map<number, Walker>) {
  let left = b.capacity.size - b.capacity.used;
  const keep: typeof b.queue = [];
  for (const fire of b.queue) {
    const cost = fire.kind === "cancelled" ? 2 : 1;
    const post = b.posts.find((x) => x.id === fire.post);
    if (left >= cost) {
      left -= cost;
      b.capacity.used += cost;
      if (post) post.handled = "contained";
      if (fire.kind === "cancelled") {
        // Caught in time: Comms wins back part of the crash, and it ends in a posting break, not a resignation.
        b.aura = clampAura(b.aura - R.aura.cancelled * R.cancel.contained);
        cancelFate(s, b, rng, fire.by, "break", staff);
      }
      continue;
    }
    if (s.day - fire.day < R.comms.sticksDays) {
      keep.push(fire);
      continue;
    }
    // It sticks.
    b.tally.stuck++;
    if (post) post.handled = "stuck";
    if (fire.kind === "cancelled") {
      const u = rng.next();
      cancelFate(s, b, rng, fire.by, u < R.cancel.leave ? "leave" : u < (R.cancel.leave + 1) / 2 ? "target" : "break", staff);
    }
  }
  b.queue = keep;
  const { stored, effects } = stepComms(b.comms, { type: "DAY", queue: b.queue.reduce((n, f) => n + (f.kind === "cancelled" ? 2 : 1), 0), limit: R.comms.drown + b.capacity.size });
  b.comms = stored;
  for (const e of effects) {
    if (e.type === "DROWNING") {
      const text = pickEvent(rng, "drowning", "toast");
      if (text) addToast(s, `📣 ${fillTemplate(text, vars(s))}`, "bad", { source: OWNER, importance: "you" });
    }
  }
}

function cancelFate(s: GameState, b: BirdAppState, rng: Rng, id: number, fate: "break" | "leave" | "target", staff: Map<number, Walker>) {
  const p = b.posters[id];
  if (!p) return;
  const { effects } = applyPoster(p, { type: "CANCELLED", fate, until: s.day + R.cancel.breakDays });
  const w = staff.get(id);
  for (const e of effects) {
    if (e.type === "BREAK") {
      b.posts = b.posts.filter((x) => x.settled || x.by !== id);
      if (w) think(s, rng, id, "break", true);
    } else if (e.type === "LEFT" && w) {
      s.flags[`quietExit:${w.id}`] = s.day;
      const text = pickEvent(rng, "leave", "headline");
      if (text) addNews(s, fillTemplate(text, vars(s, { name: w.name, handle: p.handle })), "bad", "birdapp");
      resign(s, w, rng);
    } else if (e.type === "DEMOTED") {
      // Still here, still posting, and every rival's recruiter knows the name now.
      p.hot = true;
      const d = s.defection;
      if (d?.enabled) d.scores[id] = Math.min(100, (d.scores[id] ?? 0) + R.cancel.defection);
    }
  }
}

// ---- Scheduling today's posts

function momentsToday(s: GameState, b: BirdAppState): BirdMoment[] {
  const out: BirdMoment[] = [];
  if (s.models.length > b.models) out.push("launch");
  if (s.flags.rivalShippedDay === s.day) out.push("rivalDrop");
  if (s.waterDiscourse >= R.moments.water) out.push("water");
  if (s.hearing?.enabled && s.hearing.machine.value !== "quiet") out.push("hearing");
  if (isNight(hourAt(s.tick + TICKS_PER_DAY / 2))) out.push("night");
  return out;
}

function pickLine(rng: Rng, archetype: string, moments: readonly BirdMoment[]): BirdPost | null {
  const pool = defs().bird.postsFor(archetype);
  if (pool.length === 0) return null;
  const topical = pool.filter((l) => l.moment !== undefined && moments.includes(l.moment));
  if (topical.length > 0 && rng.chance(R.momentLine)) return rng.pick(topical);
  const plain = pool.filter((l) => l.moment === undefined);
  return rng.pick(plain.length > 0 ? plain : pool);
}

/** Put one post on today's timeline, its outcome and engagement rolled now. */
function schedule(s: GameState, b: BirdAppState, rng: Rng, p: Poster, name: string, text: string, line: string, lineSpice: number, moment: BirdMoment | null, tick: number, replyTo?: number, forced?: BirdOutcome): BirdPostRecord {
  const wantsReview = p.lever === "comms";
  const reviewed = wantsReview && b.capacity.used < b.capacity.size;
  if (reviewed) b.capacity.used++;
  const spice = clamp01(0.5 * p.spice + 0.5 * lineSpice + (moment ? R.momentSpice : 0));
  const rolled = rollOutcome(rng.next(), outcomeOdds(spice, reviewed));
  const outcome = forced ?? rolled;
  const [perFollower, perLike, repliesPerLike] = R.engagement[outcome];
  const likes = Math.round(Math.max(1, p.followers) * perFollower * (0.6 + 0.8 * rng.next())) + rng.int(0, 3);
  const post: BirdPostRecord = {
    id: s.nextId++, by: p.id, name, handle: p.handle, archetype: p.archetype, line, text, tick, spice: round2(reviewed ? spice * R.comms.spice : spice),
    moment, reviewed, outcome, settled: false, likes, reposts: Math.round(likes * perLike), replies: Math.round(likes * repliesPerLike) + rng.int(0, 2),
    reply: pickEvent(rng, outcome, "reply") ?? "", viral: false, ...(replyTo !== undefined ? { replyTo } : {}),
  };
  b.posts.push(post);
  p.posts++;
  return post;
}

function scheduleDay(s: GameState, b: BirdAppState, rng: Rng, staff: Map<number, Walker>) {
  const moments = b.moments;
  const queued = new Set(b.queue.filter((f) => f.kind === "cancelled").map((f) => f.by));
  const ids = Object.keys(b.posters);
  if (ids.length === 0) return;
  const night = moments.includes("night");
  const topical = moments.some((m) => m !== "night");
  let made = 0;
  let drafted = false;
  const start = s.day % ids.length;
  for (let i = 0; i < ids.length && made < R.maxPosts; i++) {
    const p = b.posters[ids[(start + i) % ids.length]!]!;
    const tier = p.machine.value;
    if (!posting(tier) || p.lever === "logoff" || queued.has(p.id)) continue;
    const arch = defs().bird.archetypeById.get(p.archetype);
    const rate = R.rates[tier as "occasional" | "big"] * (arch?.rate ?? 1) * (topical ? R.moment : 1) * (night ? (arch?.night ?? 1) : 1);
    if (!rng.chance(Math.min(1, rate))) continue;
    const w = staff.get(p.id);
    const line = pickLine(rng, p.archetype, moments);
    if (!w || !line) continue;
    const tick = s.tick + rng.int(1, TICKS_PER_DAY - 4);
    const text = fillTemplate(line.text, vars(s));
    const post = schedule(s, b, rng, p, w.name, text, line.id, line.spice, line.moment ?? null, tick);
    made++;
    if (!drafted && rng.chance(0.5)) {
      drafted = true;
      think(s, rng, w.id, "drafting");
    }
    // The Duo: the other half answers the same afternoon.
    const partner = p.partner !== undefined ? b.posters[p.partner] : undefined;
    const pw = partner ? staff.get(partner.id) : undefined;
    if (line.answer && partner && pw && posting(partner.machine.value) && partner.lever !== "logoff" && !queued.has(partner.id) && made < R.maxPosts) {
      schedule(s, b, rng, partner, pw.name, fillTemplate(line.answer, vars(s)), `${line.id}:answer`, line.spice, line.moment ?? null, Math.min(s.tick + TICKS_PER_DAY - 1, tick + rng.int(1, 3)), post.id);
      made++;
    }
  }
}

// ---- The day

function logoffDay(s: GameState, b: BirdAppState, rng: Rng, staff: Map<number, Walker>) {
  for (const key in b.posters) {
    const p = b.posters[key]!;
    if (p.lever !== "logoff") {
      p.offDays = 0;
      continue;
    }
    p.offDays++;
    const w = staff.get(p.id);
    if (!w) continue;
    const heavy = p.machine.value === "big";
    w.focus = Math.max(0, w.focus - R.logoff.focus * (heavy ? 2 : 1));
    if (heavy && p.offDays >= R.logoff.quitAfter && rng.chance(R.logoff.quitChance)) {
      s.flags[`quietExit:${w.id}`] = s.day;
      addNews(s, `${w.name} leaves ${s.labName} "to post full time"`, "bad", "birdapp");
      addToast(s, `🐦 @${p.handle} quit: they would rather post than work here`, "bad", { source: OWNER, importance: "you" });
      resign(s, w, rng);
    }
  }
}

function breaks(s: GameState, b: BirdAppState, rng: Rng, staff: Map<number, Walker>) {
  for (const key in b.posters) {
    const p = b.posters[key]!;
    if (p.machine.value !== "break" || s.day < p.machine.context.until) continue;
    const { effects } = applyPoster(p, { type: "DAY", day: s.day });
    if (effects.some((e) => e.type === "BACK") && staff.has(p.id)) think(s, rng, p.id, "back", true);
  }
}

function auraDrift(b: BirdAppState) {
  let bigs = 0;
  let occasional = 0;
  for (const key in b.posters) {
    const v = b.posters[key]!.machine.value;
    if (v === "big") bigs++;
    else if (v === "occasional") occasional++;
  }
  const floor = Math.min(R.aura.floorMax, bigs * R.aura.perBig + occasional * R.aura.perOccasional);
  // A drowning PR team stops the Aura climbing back.
  if (b.aura < floor && b.comms.value === "drowning") return;
  b.aura = clampAura(b.aura + (floor - b.aura) * R.aura.ease);
}

export function dailyBirdApp(s: GameState) {
  const b = s.birdapp;
  if (!b?.enabled) return;
  const rng = createRng(b.rngState);
  const staff = new Map<number, Walker>();
  for (const w of s.walkers) if (onStaff(w)) staff.set(w.id, w);
  syncPosters(b, rng, staff);
  const landing = b.rivals ? b.posts.filter((p) => !p.settled) : [];
  settle(s, b, rng, staff);
  breaks(s, b, rng, staff);
  logoffDay(s, b, rng, staff);
  b.moments = momentsToday(s, b);
  b.models = s.models.length;
  b.capacity = { used: 0, size: R.comms.founder + R.comms.perRep * staffOf(s, "comms").length };
  scheduleDay(s, b, rng, staff);
  workQueue(s, b, rng, staff);
  auraDrift(b);
  b.history.push(b.aura);
  if (b.history.length > 30) b.history.shift();
  b.rngState = rng.state();
  // FLT-92: the rival labs, on their own stream. A dunk borrows the lab's scheduler (and its dice, after today's).
  if (b.rivals) dailyBirdRivals(s, b, landing, rivalScheduler(s, b));
}

/** How the rivals' driver puts a dunk on one of your posters' timeline: schedule(), with the lab's own stream. */
function rivalScheduler(s: GameState, b: BirdAppState): Scheduler {
  return (by, name, text, line, tick, outcome) => {
    const p = b.posters[by];
    if (!p) return null;
    const rng = createRng(b.rngState);
    const post = schedule(s, b, rng, p, name, text, line, 0.5, null, tick, undefined, outcome);
    b.rngState = rng.state();
    return post;
  };
}

/** For the debug scenes (demo.ts): one of your posters dunks on `lab` now, to land as `outcome` at the next settle. */
export function dunkNow(s: GameState, lab: string, outcome: "banger" | "flop"): BirdPostRecord | null {
  const b = s.birdapp;
  const r = b?.enabled ? b.rivals : undefined;
  if (!b || !r) return null;
  const rng = createRng(r.rngState);
  const post = dunk(s, b, r, rng, lab, rivalScheduler(s, b), outcome);
  r.rngState = rng.state();
  return post;
}

/**
 * The Vocabulary's `birdapp.post` (a Daily Drama pack, a mod arc): someone at the lab posts `text` within the hour,
 * the beat's first person if they post, else a poster of `archetype`, else anyone who posts. It lands at midnight like
 * any other post; `outcome` decides how, or the odds for its `spice` do. Nothing while the pack is asleep.
 */
export function postNow(s: GameState, rng: Rng, o: { text?: string; spice?: number; archetype?: string; outcome?: BirdOutcome; by?: number }): BirdPostRecord | null {
  const b = s.birdapp;
  if (!b?.enabled) return null;
  const active = Object.values(b.posters).filter((p) => posting(p.machine.value) && p.lever !== "logoff");
  const named = o.by !== undefined ? active.find((p) => p.id === o.by) : undefined;
  const typed = o.archetype ? active.filter((p) => p.archetype === o.archetype) : [];
  const p = named ?? (typed.length > 0 ? rng.pick(typed) : active.length > 0 ? rng.pick(active) : undefined);
  const w = p ? s.walkers.find((x) => x.id === p.id) : undefined;
  if (!p || !w) return null;
  if (o.text !== undefined) return schedule(s, b, rng, p, w.name, o.text, "birdapp.post", o.spice ?? 0.5, null, s.tick + 1, undefined, o.outcome);
  // No text (the debug scenes): one of their archetype's own lines.
  const line = pickLine(rng, p.archetype, b.moments);
  return line ? schedule(s, b, rng, p, w.name, fillTemplate(line.text, vars(s)), line.id, line.spice, line.moment ?? null, s.tick + 1, undefined, o.outcome) : null;
}

/** For the debug scenes (demo.ts): today's posts land now, or the Comms desk works its queue now, as midnight would. */
export function landNow(s: GameState, what: "posts" | "comms") {
  const b = s.birdapp;
  if (!b?.enabled) return;
  const rng = createRng(b.rngState);
  const staff = new Map<number, Walker>();
  for (const w of s.walkers) if (onStaff(w)) staff.set(w.id, w);
  if (what === "posts") settle(s, b, rng, staff);
  else workQueue(s, b, rng, staff);
  b.rngState = rng.state();
}

/** The player's lever on one poster. "Please log off" deletes the drafts they have not posted yet. */
export function setBirdLever(s: GameState, id: number, lever: BirdLever) {
  const b = s.birdapp;
  const p = b?.enabled ? b.posters[id] : undefined;
  if (!b || !p || p.lever === lever) return;
  p.lever = lever;
  if (lever === "logoff") {
    b.posts = b.posts.filter((x) => x.settled || x.by !== id || x.tick <= s.tick);
    const rng = createRng(b.rngState);
    think(s, rng, id, "logoff", true);
    b.rngState = rng.state();
  }
}

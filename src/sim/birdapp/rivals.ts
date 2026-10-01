// FLT-92 the rival labs post too. Once a day, at midnight, right after the lab's own posters (driver.ts), on a stream
// of its own:
//   1. yesterday's rival posts land (a rival's ratioed post is a flop someone here may dunk on);
//   2. quiet labs count down their silence (the lab-feed machine, machines.ts) and come back "so back";
//   3. the driver diffs the World against what it saw last midnight: a rival's release (and another lab's subtweet),
//      Arena swings (#1, a climb, a slide of 3 places: one line, then silence), your launch, your leak, a cancel, an
//      escape, a hearing, a raise; each beat is a post by one of the lab's voices, up within the hour;
//   4. the quiet-day filler, up to the day's cap; a teaser account counting down a run that is nearly done;
//   5. the dunk (one of your posters on a rival's slide or flop: lands, and it is +Aura) and the ratio (a rival CEO
//      quote-posts one of your ratioed posts: -Hype).
// Every die is rolled here, in a fixed order; with `?birdrivals=off` none of this exists and the lab's own posters roll
// exactly what they did before FLT-92.
import type { RivalId } from "../../content/rivals";
import type { BirdRivalLine, BirdVoice, RivalBeat, RivalRole } from "../../content/birdapp";
import { TICKS_PER_DAY } from "../constants";
import { defs } from "../defs";
import { fillTemplate } from "../format";
import { initialStored } from "../machines/run";
import { addToast } from "../news";
import { ranksOf } from "../race/state";
import { createRng, type Rng } from "../rng";
import type { GameState } from "../types";
import { labFeedMachine, stepLabFeed } from "./machines";
import { BIRD as R } from "./pack";
import type { BirdAppState, BirdPostRecord, BirdRivalsState, RivalPostRecord } from "./state";

export const RIVALS_OWNER = "birdapp";
/** Beats that are a lab's own big news: the post is likelier to land, and it reaches the ticker. */
const LOUD: ReadonlySet<RivalBeat> = new Set(["release", "top"]);
/** Beats about you: the first one each day is a toast. */
const ABOUT_YOU: ReadonlySet<RivalBeat> = new Set(["launch", "leak", "cancel", "escape", "hearing", "raise"]);
/** Which role answers each beat first, if the lab has a line for it. */
const FIRST: Partial<Record<RivalBeat, RivalRole>> = { teaser: "teaser", release: "teaser", back: "back", ratio: "ceo", hearing: "safety", escape: "safety" };

const round2 = (x: number) => Math.round(x * 100) / 100;
const clampAura = (x: number) => round2(Math.max(0, Math.min(100, x)));
/** "Super Super AI" -> "super_super_ai": the stem an `any` voice's handle hangs off. */
export const labSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

const feedOf = (r: BirdRivalsState, lab: string) => (r.labs[lab] ??= initialStored(labFeedMachine, {}));
const isQuiet = (r: BirdRivalsState, lab: string) => r.labs[lab]?.value === "quiet";

function snapshotSeen(s: GameState): BirdRivalsState["seen"] {
  return {
    releases: Object.fromEntries(s.race.rivals.map((x) => [x.context.id, x.context.releases])),
    ranks: ranksOf(s.race.board),
    models: s.models.length,
    leaks: s.leapfrog?.response.context.leaks ?? 0,
    cancels: s.birdapp?.tally.cancels ?? 0,
    escaped: s.escape?.escaped ?? 0,
    hearing: s.hearing?.enabled ? String(s.hearing.machine.value) : "quiet",
    funding: s.race.lastFunding,
    bailout: s.economy.context.lastBailout ?? -1,
    teased: {},
  };
}

export function enableBirdRivals(s: GameState, b: BirdAppState) {
  if (s.flags.birdrivalsOff) return;
  b.rivals ??= { rngState: (s.seed ^ 0x52495641) >>> 0, nextId: 1, posts: [], labs: {}, seen: snapshotSeen(s), tally: { posts: 0, dunks: 0, ratios: 0 } };
}

// ---- Words

/** A voice's handle: its own, or the lab's slug and the `any` voice's suffix. */
const handleOf = (v: BirdVoice, lab: string) => (v.lab === "any" ? `${labSlug(defs().rivalById[lab as RivalId]?.short ?? lab)}${v.handle}` : v.handle);
const labShort = (lab: string) => defs().rivalById[lab as RivalId]?.short ?? lab;

interface Beat {
  lab: string;
  beat: RivalBeat;
  /** The lab it is about (a subtweet, a dunk), for `{rival}`. */
  about?: string;
  model?: string;
  rank?: number;
}

function vars(s: GameState, beat: Beat, handle = ""): Record<string, string> {
  const rival = beat.about ? labShort(beat.about) : labShort(defs().rivals[(s.day + 1) % Math.max(1, defs().rivals.length)]?.id ?? "");
  return {
    you: s.labName, lab: s.labName, me: labShort(beat.lab), rival, handle,
    model: beat.model ?? (beat.beat === "launch" ? (s.models[s.models.length - 1] ?? "the new model") : "the new model"),
    rank: beat.rank !== undefined ? String(beat.rank) : "?",
  };
}

/** Lines nobody has said yet today (all of them, if everyone has): two labs never post the same joke on one afternoon. */
function unsaid<L extends { id: string }>(r: BirdRivalsState, lines: readonly L[]): readonly L[] {
  const said = new Set(r.posts.filter((p) => !p.settled).map((p) => p.line));
  const fresh = lines.filter((l) => !said.has(l.id));
  return fresh.length > 0 ? fresh : lines;
}

/** Who at the lab says it, and what: the beat's usual role first if it has a line, else any voice that has one. */
function pickVoiceLine(r: BirdRivalsState, rng: Rng, lab: string, beat: RivalBeat, only?: RivalRole): { voice: BirdVoice; line: BirdRivalLine } | null {
  const bird = defs().bird;
  const voices = bird.voicesFor(lab).filter((v) => (only ? v.role === only : true) && bird.rivalLines(beat, v.role, lab).length > 0);
  if (voices.length === 0) return null;
  const first = FIRST[beat];
  const preferred = first ? voices.filter((v) => v.role === first) : [];
  const voice = preferred.length > 0 && rng.chance(0.7) ? rng.pick(preferred) : rng.pick(voices);
  return { voice, line: rng.pick(unsaid(r, bird.rivalLines(beat, voice.role, lab))) };
}

// ---- Posting

type Outcome = RivalPostRecord["outcome"];

function rollRivalOutcome(u: number, loud: boolean): Outcome {
  const banger = loud ? R.rivals.outcomes.loud : R.rivals.outcomes.banger;
  if (u < banger) return "banger";
  if (u < banger + R.rivals.outcomes.ratioed) return "ratioed";
  return "flop";
}

function post(s: GameState, r: BirdRivalsState, rng: Rng, beat: Beat, voice: BirdVoice, line: { id: string; text: string }, tick: number, forced?: Outcome): RivalPostRecord {
  const handle = handleOf(voice, beat.lab);
  const outcome = forced ?? rollRivalOutcome(rng.next(), LOUD.has(beat.beat));
  const [perFollower, perLike, repliesPerLike] = R.engagement[outcome];
  const likes = Math.round(Math.max(1, voice.followers) * perFollower * (0.6 + 0.8 * rng.next())) + rng.int(0, 3);
  const replies = defs().bird.rivalLines("reply", voice.role, beat.lab);
  const rec: RivalPostRecord = {
    id: r.nextId++, lab: beat.lab, voice: voice.id, role: voice.role, name: fillTemplate(voice.name, vars(s, beat)), handle, line: line.id, beat: beat.beat,
    text: fillTemplate(line.text, vars(s, beat)), tick, outcome, settled: false, likes, reposts: Math.round(likes * perLike),
    replies: Math.round(likes * repliesPerLike) + rng.int(0, 2), reply: replies.length > 0 ? fillTemplate(rng.pick(replies).text, vars(s, beat)) : "",
  };
  r.posts.push(rec);
  r.tally.posts++;
  return rec;
}

/** One beat's post, if the lab has anything to say. Returns it. */
function say(s: GameState, r: BirdRivalsState, rng: Rng, beat: Beat, tick: number, only?: RivalRole): RivalPostRecord | null {
  const pick = pickVoiceLine(r, rng, beat.lab, beat.beat, only);
  return pick ? post(s, r, rng, beat, pick.voice, pick.line, tick) : null;
}

// ---- The day

function settleRivals(r: BirdRivalsState): RivalPostRecord[] {
  const flops: RivalPostRecord[] = [];
  for (const p of r.posts) {
    if (p.settled) continue;
    p.settled = true;
    if (p.outcome === "ratioed") flops.push(p);
  }
  const settled = r.posts.filter((p) => p.settled);
  if (settled.length > R.rivals.log) r.posts = r.posts.filter((p) => !p.settled || settled.indexOf(p) >= settled.length - R.rivals.log);
  return flops;
}

/** What happened since last midnight, as beats, loudest first. Also returns the labs that slid (dunk material). */
function beatsToday(s: GameState, r: BirdRivalsState, rng: Rng): { beats: Beat[]; slid: string[] } {
  const seen = r.seen;
  const beats: Beat[] = [];
  const slid: string[] = [];
  const labs = defs().rivals.map((d) => d.id);
  const posting = (lab: string) => !isQuiet(r, lab);
  // The silences that end today.
  for (const lab of labs) {
    if (!isQuiet(r, lab)) continue;
    const { stored, effects } = stepLabFeed(feedOf(r, lab), { type: "DAY", day: s.day });
    r.labs[lab] = stored;
    if (effects.some((e) => e.type === "BACK")) beats.push({ lab, beat: "back" });
  }
  // Releases, and someone else's subtweet.
  for (const x of s.race.rivals) {
    const lab = x.context.id;
    if (x.context.releases <= (seen.releases[lab] ?? 0)) continue;
    const model = x.context.model || undefined;
    if (posting(lab)) beats.push({ lab, beat: "release", ...(model ? { model } : {}) });
    const others = labs.filter((o) => o !== lab && posting(o));
    if (others.length > 0 && rng.chance(R.rivals.subtweet)) beats.push({ lab: rng.pick(others), beat: "subtweet", about: lab, ...(model ? { model } : {}) });
  }
  // The Arena (it moves weekly; a lab seen for the first time has nothing to compare against).
  const ranks = ranksOf(s.race.board);
  for (const lab of labs) {
    const now = ranks[lab];
    const before = seen.ranks[lab];
    if (now === undefined || before === undefined || now === before) continue;
    if (now - before >= R.rivals.dropPlaces) {
      slid.push(lab);
      if (posting(lab)) beats.push({ lab, beat: "drop", rank: now });
    } else if (now === 1) {
      if (posting(lab)) beats.push({ lab, beat: "top", rank: now });
    } else if (before - now >= R.rivals.climbPlaces && posting(lab)) beats.push({ lab, beat: "climb", rank: now });
  }
  // You.
  const aboutYou: RivalBeat[] = [];
  if (s.models.length > seen.models) aboutYou.push("launch");
  if ((s.leapfrog?.response.context.leaks ?? 0) > seen.leaks) aboutYou.push("leak");
  if ((s.birdapp?.tally.cancels ?? 0) > seen.cancels) aboutYou.push("cancel");
  if ((s.escape?.escaped ?? 0) > seen.escaped) aboutYou.push("escape");
  const hearing = s.hearing?.enabled ? String(s.hearing.machine.value) : "quiet";
  if (hearing !== "quiet" && seen.hearing === "quiet") aboutYou.push("hearing");
  if (s.race.lastFunding !== seen.funding || (s.economy.context.lastBailout ?? -1) !== seen.bailout) aboutYou.push("raise");
  for (const beat of aboutYou) {
    const open = labs.filter(posting);
    for (let n = 0; n < R.rivals.reactors && open.length > 0; n++) {
      const lab = open.splice(rng.int(0, open.length - 1), 1)[0]!;
      if (rng.chance(R.rivals.react)) beats.push({ lab, beat });
    }
  }
  // Teasers: a run in its last week, once a run; or (Release Leapfrog) the calendar's drop is tomorrow.
  for (const x of s.race.rivals) {
    const lab = x.context.id;
    if (x.value !== "training" || x.context.weeks > 1 || seen.teased[lab] === x.context.releases || !posting(lab)) continue;
    seen.teased[lab] = x.context.releases;
    if (rng.chance(R.rivals.teaser)) beats.push({ lab, beat: "teaser" });
  }
  if (s.leapfrog?.enabled && s.leapfrog.calendar.context.daysLeft === 1) {
    const open = labs.filter(posting);
    if (open.length > 0 && rng.chance(R.rivals.teaser)) beats.push({ lab: rng.pick(open), beat: "teaser" });
  }
  return { beats, slid };
}

/** One of your posters dunks on a lab: the big accounts first. Forced to land or flop now; settle() pays the Aura. */
export function dunk(s: GameState, b: BirdAppState, r: BirdRivalsState, rng: Rng, lab: string, schedule: Scheduler, forced?: "banger" | "flop"): BirdPostRecord | null {
  const lines = defs().bird.rivalLines("dunk", "us", lab);
  const active = Object.values(b.posters).filter((p) => (p.machine.value === "big" || p.machine.value === "occasional") && p.lever !== "logoff");
  if (lines.length === 0 || active.length === 0) return null;
  const bigs = active.filter((p) => p.machine.value === "big");
  const p = rng.pick(bigs.length > 0 ? bigs : active);
  const w = s.walkers.find((x) => x.id === p.id);
  if (!w) return null;
  const line = rng.pick(lines);
  const roll = rng.chance(R.rivals.dunk.banger) ? "banger" : "flop";
  const outcome = forced ?? roll;
  const rec = schedule(p.id, w.name, fillTemplate(line.text, vars(s, { lab, beat: "dunk", about: lab })), line.id, s.tick + rng.int(2, 6), outcome);
  if (rec) {
    rec.dunk = lab;
    r.tally.dunks++;
  }
  return rec;
}

/** A rival CEO quote-posts one of your ratioed posts into the ground. Back-dated to just after it, and already landed. */
export function ratio(s: GameState, r: BirdRivalsState, rng: Rng, mine: BirdPostRecord): RivalPostRecord | null {
  const labs = defs().rivals.map((d) => d.id).filter((lab) => !isQuiet(r, lab));
  if (labs.length === 0) return null;
  const lab = rng.pick(labs);
  const pick = pickVoiceLine(r, rng, lab, "ratio", "ceo") ?? pickVoiceLine(r, rng, lab, "ratio");
  if (!pick) return null;
  const rec = post(s, r, rng, { lab, beat: "ratio" }, pick.voice, pick.line, Math.min(s.tick - 1, mine.tick + rng.int(1, 3)), "banger");
  rec.settled = true;
  rec.quote = { handle: mine.handle, text: mine.text };
  rec.ratio = { post: mine.id, hype: R.rivals.ratio.hype };
  s.hype = Math.max(0, s.hype - R.rivals.ratio.hype);
  r.tally.ratios++;
  addToast(s, `🐦 @${rec.handle} quote-posted @${mine.handle}: "${rec.text}" (ratioed, −${R.rivals.ratio.hype} Hype)`, "bad", { source: RIVALS_OWNER, importance: "you" });
  return rec;
}

/** What the lab's own driver lends the rivals: put a post on one of your posters' timeline (driver.ts's schedule). */
export type Scheduler = (by: number, name: string, text: string, line: string, tick: number, outcome: "banger" | "flop") => BirdPostRecord | null;

/**
 * The rivals' midnight. `landed` is the lab's own posts that landed this midnight (the ratio candidates); `schedule`
 * posts for one of your posters. Runs after the lab's own day, so its dice never move theirs.
 */
export function dailyBirdRivals(s: GameState, b: BirdAppState, landed: readonly BirdPostRecord[], schedule: Scheduler) {
  const r = b.rivals;
  if (!r) return;
  const rng = createRng(r.rngState);
  const flops = settleRivals(r);
  const { beats, slid } = beatsToday(s, r, rng);
  // Each beat's post, up within the hour; a slide's line goes up before the silence starts.
  let made = 0;
  let toasted = false;
  for (const beat of beats) {
    if (made >= R.rivals.maxPosts) break;
    const rec = say(s, r, rng, beat, s.tick + rng.int(1, 6));
    if (beat.beat === "drop") r.labs[beat.lab] = stepLabFeed(feedOf(r, beat.lab), { type: "DROP", until: s.day + R.rivals.silenceDays }).stored;
    if (!rec) continue;
    made++;
    if (ABOUT_YOU.has(beat.beat) && !toasted) {
      toasted = true;
      addToast(s, `🐦 @${rec.handle}: "${rec.text}"`, "neutral", { source: RIVALS_OWNER, importance: "you" });
    } else if (LOUD.has(beat.beat) || beat.beat === "drop") {
      addToast(s, `🐦 @${rec.handle}: "${rec.text}"`, "neutral", { source: RIVALS_OWNER, importance: "world" });
    }
  }
  // A quiet day's filler, spread through the day.
  const labs = defs().rivals.map((d) => d.id).filter((lab) => !isQuiet(r, lab));
  const start = labs.length > 0 ? s.day % labs.length : 0;
  for (let i = 0; i < labs.length && made < R.rivals.maxPosts; i++) {
    const lab = labs[(start + i) % labs.length]!;
    for (const voice of defs().bird.voicesFor(lab)) {
      if (made >= R.rivals.maxPosts) break;
      if (!rng.chance(Math.min(1, R.rivals.idle * (voice.rate ?? 1)))) continue;
      const lines = defs().bird.rivalLines("idle", voice.role, lab);
      if (lines.length === 0) continue;
      post(s, r, rng, { lab, beat: "idle" }, voice, rng.pick(unsaid(r, lines)), s.tick + rng.int(1, TICKS_PER_DAY - 2));
      made++;
    }
  }
  // The dunk: a lab that slid, else a rival post that got ratioed. One a day at most.
  const targets = [...slid, ...flops.map((p) => p.lab)];
  if (targets.length > 0 && rng.chance(R.rivals.dunk.chance)) dunk(s, b, r, rng, targets[0]!, schedule);
  // The ratios.
  for (const mine of landed) if (mine.outcome === "ratioed" && rng.chance(R.rivals.ratio.chance)) ratio(s, r, rng, mine);
  r.seen = { ...snapshotSeen(s), teased: r.seen.teased };
  r.rngState = rng.state();
}

/** For the debug scenes (demo.ts): `lab` slid, and goes quiet until `until`. */
export function silenceLab(r: BirdRivalsState, lab: string, until: number) {
  r.labs[lab] = stepLabFeed(feedOf(r, lab), { type: "DROP", until }).stored;
}

/** settle() calls this for a landed dunk: the Aura on top of the banger's, and a toast that is about you. */
export function dunkLanded(s: GameState, b: BirdAppState, mine: BirdPostRecord) {
  if (!mine.dunk || mine.outcome !== "banger") return false;
  b.aura = clampAura(b.aura + R.rivals.dunk.aura);
  addToast(s, `🐦 @${mine.handle} dunked on ${labShort(mine.dunk)}: "${mine.text}" (+${R.rivals.dunk.aura} Aura)`, "good", { source: RIVALS_OWNER, importance: "you", group: { kind: "viral", who: `@${mine.handle}` } });
  return true;
}

/**
 * The Vocabulary's `birdapp.rival` (a Daily Drama pack, a mod arc) and the debug scenes: a lab posts now. `lab` is a
 * rival id (any lab that is posting, without one); `text` is what it says (a line for `beat`, without); `role` picks
 * the voice. Nothing while the rivals are off.
 */
export function rivalPostNow(s: GameState, rng: Rng, o: { lab?: string; beat?: RivalBeat; text?: string; role?: RivalRole; about?: string; model?: string; outcome?: Outcome; tick?: number }): RivalPostRecord | null {
  const r = s.birdapp?.enabled ? s.birdapp.rivals : undefined;
  if (!r) return null;
  const open = defs().rivals.map((d) => d.id).filter((lab) => !isQuiet(r, lab));
  const lab = o.lab && defs().rivalById[o.lab as RivalId] ? o.lab : open.length > 0 ? rng.pick(open) : undefined;
  if (!lab) return null;
  const rank = ranksOf(s.race.board)[lab];
  const beat: Beat = { lab, beat: o.beat ?? "idle", ...(o.about ? { about: o.about } : {}), ...(o.model ? { model: o.model } : {}), ...(rank !== undefined ? { rank } : {}) };
  const tick = o.tick ?? s.tick + 1;
  if (o.text !== undefined) {
    const voices = defs().bird.voicesFor(lab).filter((v) => !o.role || v.role === o.role);
    const voice = voices.length > 0 ? rng.pick(voices) : defs().bird.voicesFor(lab)[0];
    if (!voice) return null;
    const rec = post(s, r, rng, beat, voice, { id: "birdapp.rival", text: o.text }, tick, o.outcome);
    rec.beat = o.beat ?? "drama";
    return rec;
  }
  const pick = pickVoiceLine(r, rng, lab, beat.beat, o.role) ?? pickVoiceLine(r, rng, lab, beat.beat);
  return pick ? post(s, r, rng, beat, pick.voice, pick.line, tick, o.outcome) : null;
}

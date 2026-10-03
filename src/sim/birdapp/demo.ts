// Debug scenes for the Bird App (`?moment=bird|bird-banger|bird-cancel`, FLT-69): the timeline staged a moment before
// something is worth a screenshot, like factions/demo.ts. A cast of posters (two big accounts, a Comms-reviewed one,
// one told to log off), a week of landed posts and today's live ones, all through the driver's own code (the posts
// land, the queue is worked, the toasts and headlines fire as at midnight). Pure sim and deterministic; the game
// itself never uses it. FLT-92's `?moment=bird-rivals|bird-rivals-dunk|bird-rivals-ratio|bird-rivals-launch` stage the
// rival labs on top: a hand-picked day of their posts (a #1, a slide and its silence, a teaser, your launch), and the
// dunk and the ratio through the rivals' own code.
import { TICKS_PER_DAY } from "../constants";
import { createRng } from "../rng";
import { tick } from "../tick";
import type { GameState } from "../types";
import type { BirdOutcome } from "../../content/birdapp";
import { defs } from "../defs";
import { seedWalkers } from "../walkers";
import type { RivalBeat, RivalRole } from "../../content/birdapp";
import { dailyBirdApp, dunkNow, enableBirdApp, landNow, makeHandle, postNow } from "./driver";
import { posterStored, stepComms } from "./machines";
import { ratio, rivalPostNow, silenceLab } from "./rivals";
import type { BirdPostRecord, Poster, RivalPostRecord } from "./state";
import { dsin } from "../dmath";

export const BIRD_RIVAL_MOMENTS = ["bird-rivals", "bird-rivals-dunk", "bird-rivals-ratio", "bird-rivals-launch"] as const;
export const BIRD_DEMO_MOMENTS = ["bird", "bird-banger", "bird-cancel", ...BIRD_RIVAL_MOMENTS] as const;
type BirdRivalMoment = (typeof BIRD_RIVAL_MOMENTS)[number];
const isRivalMoment = (m: string): m is BirdRivalMoment => (BIRD_RIVAL_MOMENTS as readonly string[]).includes(m);
export type BirdDemoMoment = (typeof BIRD_DEMO_MOMENTS)[number];
export const isBirdMoment = (s: string | null | undefined): s is BirdDemoMoment => !!s && (BIRD_DEMO_MOMENTS as readonly string[]).includes(s);

/** Who plays whom: archetype, tier, followers, lever. The rest of the staff post sometimes. */
const CAST = [
  { archetype: "oracle", tier: "big", followers: 48_200, lever: "cook" },
  { archetype: "leaderboard", tier: "big", followers: 21_700, lever: "cook" },
  { archetype: "hype", tier: "occasional", followers: 6_400, lever: "comms" },
  { archetype: "thread", tier: "occasional", followers: 3_100, lever: "cook" },
  { archetype: "doomer", tier: "occasional", followers: 2_300, lever: "logoff" },
  { archetype: "anon", tier: "occasional", followers: 880, lever: "cook" },
  { archetype: "oracle", tier: "recluse", followers: 140, lever: "cook" },
] as const;

/** The week behind today, oldest first: [cast member, outcome]. */
const WEEK: Record<BirdDemoMoment, [number, BirdOutcome][]> = {
  bird: [[3, "flop"], [0, "banger"], [5, "ratioed"], [2, "flop"], [1, "controversy"], [3, "banger"], [5, "flop"]],
  "bird-banger": [[3, "flop"], [5, "ratioed"], [2, "flop"], [1, "flop"], [3, "controversy"], [0, "banger"]],
  "bird-cancel": [[3, "flop"], [0, "banger"], [5, "controversy"], [1, "cancelled"], [3, "controversy"], [0, "cancelled"]],
  "bird-rivals": [[3, "flop"], [0, "banger"], [2, "flop"], [1, "controversy"], [3, "flop"], [5, "ratioed"]],
  "bird-rivals-dunk": [[3, "flop"], [5, "flop"], [2, "flop"], [1, "controversy"], [3, "flop"]],
  "bird-rivals-ratio": [[3, "flop"], [0, "banger"], [2, "flop"], [3, "controversy"], [5, "ratioed"]],
  "bird-rivals-launch": [[3, "flop"], [0, "banger"], [5, "ratioed"], [2, "flop"], [3, "flop"]],
};
/** Today's live posts: [cast member, how it will land at midnight, ticks since it went up]. */
const TODAY: Record<BirdDemoMoment, [number, BirdOutcome, number][]> = {
  bird: [[1, "banger", 9], [5, "ratioed", 6], [3, "flop", 3]],
  "bird-banger": [[1, "banger", 11], [3, "flop", 4]],
  "bird-cancel": [[5, "ratioed", 8], [3, "flop", 2]],
  "bird-rivals": [[1, "banger", 4]],
  "bird-rivals-dunk": [[3, "flop", 2]],
  "bird-rivals-ratio": [],
  "bird-rivals-launch": [],
};

/**
 * The rivals' day, per scene: [lab, beat, ticks ago, how it lands, role?, about?]. Ticks ago past this afternoon's
 * 13 are yesterday's, and have landed. `quiet` slid and is sulking; `dunk` is the lab your big account dunks on.
 */
type RivalCue = [lab: string, beat: RivalBeat, ago: number, outcome: RivalPostRecord["outcome"], role?: RivalRole, about?: string];
const RIVAL_DAY: Record<BirdRivalMoment, { cues: RivalCue[]; quiet?: string; dunk?: string; ratio?: boolean }> = {
  "bird-rivals": {
    cues: [
      ["anthro", "idle", 30, "flop", "safety"],
      ["supersuper", "top", 26, "banger", "ceo"],
      ["metameta", "drop", 22, "flop", "ceo"],
      ["openish", "release", 11, "banger", "teaser"],
      ["anthro", "subtweet", 9, "flop", "ceo", "openish"],
      ["macrohard", "launch", 6, "flop", "ceo"],
      ["sirocco", "teaser", 2, "flop", "teaser"],
    ],
    quiet: "metameta",
    dunk: "metameta",
    ratio: true,
  },
  "bird-rivals-dunk": {
    cues: [
      ["anthro", "idle", 28, "flop", "safety"],
      ["metameta", "drop", 24, "flop", "ceo"],
      ["supersuper", "climb", 10, "banger", "back"],
    ],
    quiet: "metameta",
    dunk: "metameta",
  },
  "bird-rivals-ratio": {
    cues: [
      ["sirocco", "idle", 34, "flop", "back"],
      ["anthro", "idle", 30, "flop", "safety"],
    ],
    ratio: true,
  },
  "bird-rivals-launch": {
    cues: [
      ["anthro", "idle", 30, "flop", "safety"],
      ["openish", "launch", 9, "banger", "ceo"],
      ["anthro", "launch", 7, "flop", "ceo"],
      ["supersuper", "launch", 5, "ratioed", "back"],
      ["macrohard", "launch", 3, "flop", "ceo"],
      ["sirocco", "teaser", 1, "flop", "teaser"],
    ],
  },
};

/** The rivals' scene: their day, the sulk, your dunk (landed, so its Aura and toast fire) and the ratio. */
function stageRivals(s: GameState, moment: BirdRivalMoment, landed: BirdPostRecord[]) {
  const b = s.birdapp!;
  const r = b.rivals;
  if (!r) return;
  r.posts = [];
  r.labs = {};
  r.tally = { posts: 0, dunks: 0, ratios: 0 };
  const day = RIVAL_DAY[moment];
  const midnight = Math.floor(s.tick / TICKS_PER_DAY) * TICKS_PER_DAY;
  const rng = createRng(r.rngState);
  // The launch they are reacting to: your last model, or the one in training as if it just shipped.
  const model = s.models[s.models.length - 1] ?? s.training.context.name;
  for (const [lab, beat, ago, outcome, role, about] of day.cues) {
    const rec = rivalPostNow(s, rng, { lab, beat, outcome, ...(beat === "launch" ? { model } : {}), tick: s.tick - ago, ...(role ? { role } : {}), ...(about ? { about } : {}) });
    if (rec) rec.settled = rec.tick < midnight;
  }
  if (day.quiet) silenceLab(r, day.quiet, s.day + 2);
  if (day.ratio) {
    const mine = [...landed].reverse().find((p) => p.outcome === "ratioed");
    if (mine) ratio(s, r, rng, mine);
  }
  r.rngState = rng.state();
  if (day.dunk) {
    const post = dunkNow(s, day.dunk, "banger");
    if (post) post.tick = midnight - 3;
    landNow(s, "posts");
  }
}

export function stageBird(s: GameState, moment: BirdDemoMoment) {
  if (s.flags.birdappOff) return;
  // A week in (the timeline needs one behind it), mid-afternoon, so today's posts have been up a while and have hours left to climb.
  const until = Math.max(s.day, 8) * TICKS_PER_DAY + 13;
  for (let i = 0; i < 12 * TICKS_PER_DAY && s.tick < until; i++) tick(s);
  // A cast needs people: a young lab gets a few more researchers.
  const have = s.walkers.filter((w) => w.kind === "researcher").length;
  if (have < CAST.length + 2) {
    const r = createRng(s.rngState);
    seedWalkers(s, "researcher", CAST.length + 2 - have, r);
    s.rngState = r.state();
  }
  enableBirdApp(s);
  const b = s.birdapp!;
  dailyBirdApp(s);
  b.posts = [];
  const rng = createRng(b.rngState);
  const posters = Object.values(b.posters).sort((x, y) => x.id - y.id);
  const cast: Poster[] = [];
  const handles = new Set(posters.slice(CAST.length).map((p) => p.handle));
  CAST.forEach((c, i) => {
    const p = posters[i];
    if (!p) return;
    const arch = defs().bird.archetypeById.get(c.archetype);
    if (!arch) return;
    Object.assign(p, { archetype: c.archetype, followers: c.followers, lever: c.lever, machine: posterStored(c.tier), handle: makeHandle(rng, arch.handles, (h) => handles.has(h)) });
    delete p.partner;
    handles.add(p.handle);
    cast.push(p);
  });
  b.rngState = rng.state();
  // The week: each post goes up and lands through the driver, then is dated back to its day.
  const week = WEEK[moment];
  const landed: BirdPostRecord[] = [];
  const reviewedLever = (p: Poster, go: () => void) => {
    const lever = p.lever;
    p.lever = "cook";
    go();
    p.lever = lever;
  };
  week.forEach(([who, outcome], i) => {
    const p = cast[who];
    if (!p) return;
    const r = createRng(b.rngState);
    let post: BirdPostRecord | null = null;
    reviewedLever(p, () => (post = postNow(s, r, { by: p.id, outcome })));
    b.rngState = r.state();
    landNow(s, "posts");
    if (!post) return;
    landed.push(post);
    (post as BirdPostRecord).tick = Math.max(0, s.tick - (week.length - i) * TICKS_PER_DAY + ((i * 7) % 11));
  });
  // The fires are from the days their posts landed; the cancel scene's desk has spent the day on reviews.
  for (const fire of b.queue) {
    const post = landed.find((x) => x.id === fire.post);
    if (post) fire.day = Math.floor(post.tick / TICKS_PER_DAY) + 1;
  }
  b.capacity = { used: moment === "bird-cancel" ? b.capacity.size : 0, size: b.capacity.size };
  landNow(s, "comms");
  if (moment === "bird-cancel") {
    const weight = b.queue.reduce((n, f) => n + (f.kind === "cancelled" ? 2 : 1), 0);
    if (weight > 0) b.comms = stepComms(b.comms, { type: "DAY", queue: weight, limit: 0 }).stored;
  }
  if (isRivalMoment(moment)) stageRivals(s, moment, landed);
  // Today's posts, already up and climbing toward how they will land at midnight.
  for (const [who, outcome, ago] of TODAY[moment]) {
    const p = cast[who];
    if (!p) continue;
    const r = createRng(b.rngState);
    const post = postNow(s, r, { by: p.id, outcome });
    b.rngState = r.state();
    if (post) post.tick = s.tick - ago;
  }
  // A month of Aura behind today: a slow climb, the week's bangers, and (in the cancel scene) the crash.
  const now = b.aura;
  b.history = Array.from({ length: 30 }, (_, i) => Math.round((20 + (now - 20) * (i / 29) + 6 * dsin(i / 2.5)) * 100) / 100);
  b.history[29] = now;
  s.version++;
}

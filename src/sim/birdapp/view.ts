// What the HUD reads of the Bird App (FLT-69): plain JSON for the snapshot. Only posts that are up (their tick has
// come) are in it, plus who is typing next; the view-model (ui/hud/birdapp.ts) lets the numbers tick up.
import type { BirdMoment, BirdOutcome, RivalBeat, RivalRole } from "../../content/birdapp";
import type { RivalId } from "../../content/rivals";
import { defs } from "../defs";
import type { GameState } from "../types";
import { posterOdds } from "./driver";
import { BIRD as R } from "./pack";
import type { BirdLever } from "./state";

/** How many profiles the panel gets (the loudest first). */
const POSTERS = 16;
const TIER_ORDER = { big: 0, occasional: 1, break: 2, recluse: 3, gone: 4 } as const;

export interface BirdPostView {
  id: number;
  by: number;
  name: string;
  handle: string;
  archetype: string;
  glyph: string;
  text: string;
  tick: number;
  spice: number;
  moment: BirdMoment | null;
  reviewed: boolean;
  /** How it lands: the view-model shapes the engagement curve by it, and only names it once `settled`. */
  outcome: BirdOutcome;
  settled: boolean;
  likes: number;
  reposts: number;
  replies: number;
  reply: string;
  viral: boolean;
  handled: "contained" | "stuck" | null;
  replyTo: string | null;
  /** FLT-92: a dunk on this rival lab (its id), or null. */
  dunk: string | null;
}

/** FLT-92: one post by a rival lab's voice. */
export interface RivalPostView {
  id: number;
  lab: string;
  labName: string;
  /** The lab's colour (content/rivals.ts). */
  color: string;
  role: RivalRole;
  name: string;
  handle: string;
  glyph: string;
  text: string;
  tick: number;
  beat: RivalBeat | "drama";
  outcome: "flop" | "banger" | "ratioed";
  settled: boolean;
  likes: number;
  reposts: number;
  replies: number;
  reply: string;
  quote: { handle: string; text: string } | null;
  /** The Hype a ratio cost you, or 0. */
  ratioHype: number;
}

/** FLT-92: the rival labs' side. `on: false` with `?birdrivals=off` (and in saves from before it). */
export interface BirdRivalsView {
  on: boolean;
  posts: RivalPostView[];
  /** Labs sulking after an Arena slide: name, colour, and the day the silence ends. */
  quiet: { lab: string; name: string; color: string; until: number }[];
  next: { handle: string; name: string; ticks: number } | null;
  tally: { posts: number; dunks: number; ratios: number };
}

function rivalsView(s: GameState): BirdRivalsView {
  const r = s.birdapp?.rivals;
  if (!r) return NO_RIVALS;
  const d = defs();
  const voices = new Map(d.bird.voices.map((v) => [v.id, v]));
  const labOf = (id: string) => d.rivalById[id as RivalId];
  const posts: RivalPostView[] = [];
  let next: BirdRivalsView["next"] = null;
  for (const p of r.posts) {
    if (p.tick > s.tick) {
      if (!next || p.tick - s.tick < next.ticks) next = { handle: p.handle, name: p.name, ticks: p.tick - s.tick };
      continue;
    }
    posts.push({
      id: p.id, lab: p.lab, labName: labOf(p.lab)?.short ?? p.lab, color: labOf(p.lab)?.color ?? "#888888", role: p.role, name: p.name, handle: p.handle,
      glyph: voices.get(p.voice)?.glyph ?? "🐦", text: p.text, tick: p.tick, beat: p.beat, outcome: p.outcome, settled: p.settled, likes: p.likes,
      reposts: p.reposts, replies: p.replies, reply: p.reply, quote: p.quote ? { handle: p.quote.handle, text: p.quote.text } : null, ratioHype: p.ratio?.hype ?? 0,
    });
  }
  const quiet = Object.entries(r.labs)
    .filter(([, f]) => f.value === "quiet")
    .map(([lab, f]) => ({ lab, name: labOf(lab)?.short ?? lab, color: labOf(lab)?.color ?? "#888888", until: f.context.until }));
  return { on: true, posts, quiet, next, tally: r.tally };
}

export interface BirdPosterView {
  id: number;
  name: string;
  handle: string;
  archetype: string;
  archetypeName: string;
  glyph: string;
  tier: "recluse" | "occasional" | "big" | "break";
  followers: number;
  lever: BirdLever;
  hot: boolean;
  breakDays: number;
  posts: number;
  bangers: number;
  cancels: number;
  /** Their banger and cancel odds on an average post, as they are and with Comms reading it first. */
  odds: { cook: { banger: number; cancelled: number }; comms: { banger: number; cancelled: number } };
}

export function birdView(s: GameState) {
  const b = s.birdapp;
  if (!b?.enabled) return OFF;
  const bird = defs().bird;
  const glyph = (id: string) => bird.archetypeById.get(id)?.glyph ?? "🐦";
  const handleOf = new Map(b.posts.map((p) => [p.id, p.handle]));
  const post = (p: (typeof b.posts)[number]): BirdPostView => ({
    id: p.id, by: p.by, name: p.name, handle: p.handle, archetype: p.archetype, glyph: glyph(p.archetype), text: p.text, tick: p.tick,
    spice: p.spice, moment: p.moment, reviewed: p.reviewed, outcome: p.outcome, settled: p.settled, likes: p.likes, reposts: p.reposts,
    replies: p.replies, reply: p.reply, viral: p.viral, handled: p.handled ?? null, replyTo: p.replyTo !== undefined ? (handleOf.get(p.replyTo) ?? null) : null,
    dunk: p.dunk ?? null,
  });
  let next: { handle: string; name: string; ticks: number } | null = null;
  const up: BirdPostView[] = [];
  for (const p of b.posts) {
    if (p.tick <= s.tick) up.push(post(p));
    else if (!next || p.tick - s.tick < next.ticks) next = { handle: p.handle, name: p.name, ticks: p.tick - s.tick };
  }
  const names = new Map<number, string>();
  for (const w of s.walkers) if (b.posters[w.id]) names.set(w.id, w.name);
  const all = Object.values(b.posters).filter((p) => p.machine.value !== "gone");
  const posters: BirdPosterView[] = all
    .sort((x, y) => TIER_ORDER[x.machine.value] - TIER_ORDER[y.machine.value] || y.followers - x.followers || x.id - y.id)
    .slice(0, POSTERS)
    .map((p) => {
      const cook = posterOdds(p.spice, false);
      const comms = posterOdds(p.spice, true);
      return {
        id: p.id, name: names.get(p.id) ?? "", handle: p.handle, archetype: p.archetype,
        archetypeName: bird.archetypeById.get(p.archetype)?.name ?? p.archetype, glyph: glyph(p.archetype),
        tier: p.machine.value as BirdPosterView["tier"], followers: p.followers, lever: p.lever, hot: p.hot ?? false,
        breakDays: p.machine.value === "break" ? Math.max(0, p.machine.context.until - s.day) : 0,
        posts: p.posts, bangers: p.bangers, cancels: p.cancels,
        odds: { cook: { banger: cook.banger, cancelled: cook.cancelled }, comms: { banger: comms.banger, cancelled: comms.cancelled } },
      };
    });
  return {
    enabled: true,
    day: s.day,
    tick: s.tick,
    aura: b.aura,
    history: b.history,
    /** What the Aura does right now: Hype points, and the visitor and applicant multipliers. */
    effects: { hype: b.aura * R.effects.hype, visitors: 1 + b.aura / R.effects.visitors, applicants: 1 + b.aura / R.effects.applicants },
    moments: b.moments,
    posts: up,
    next,
    posters,
    posterCount: all.length,
    comms: {
      desk: b.comms.value,
      queue: b.queue.map((f) => ({ post: f.post, handle: b.posters[f.by]?.handle ?? "", kind: f.kind, daysLeft: Math.max(0, R.comms.sticksDays - (s.day - f.day)) })),
      used: b.capacity.used,
      size: b.capacity.size,
      drownAt: R.comms.drown + b.capacity.size,
    },
    tally: b.tally,
    rivals: rivalsView(s),
  };
}
export type BirdView = ReturnType<typeof birdView>;

const NO_RIVALS: BirdRivalsView = { on: false, posts: [], quiet: [], next: null, tally: { posts: 0, dunks: 0, ratios: 0 } };
const OFF = {
  enabled: false, day: 0, tick: 0, aura: 0, history: [] as number[], effects: { hype: 0, visitors: 1, applicants: 1 }, moments: [] as BirdMoment[],
  posts: [] as BirdPostView[], next: null as { handle: string; name: string; ticks: number } | null, posters: [] as BirdPosterView[], posterCount: 0,
  comms: { desk: "calm" as "calm" | "busy" | "drowning", queue: [] as { post: number; handle: string; kind: "controversy" | "cancelled"; daysLeft: number }[], used: 0, size: 0, drownAt: 0 },
  tally: { posts: 0, bangers: 0, controversies: 0, ratios: 0, cancels: 0, stuck: 0 },
  rivals: NO_RIVALS,
};

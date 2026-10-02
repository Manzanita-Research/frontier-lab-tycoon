// The Bird App (FLT-69): the snapshot's `birdapp` view in, the panel's plain JSON out. Pure. The sim rolls each
// post's outcome and final numbers when it is scheduled; here the likes, reposts and replies climb toward them along
// a curve that depends on how it will land (a banger starts slow and explodes, a ratio's replies outrun its likes).
import type { Snapshot } from "../../app/hud";
import { clockLabel, hourAt } from "../../render/fx/clock";
import { TICKS_PER_DAY } from "../../sim/constants";
import type { BirdPostView, BirdPosterView, RivalPostView } from "../../sim/birdapp/view";
import type { BirdAppVM, BirdLeverVM, BirdPostVM, BirdPosterVM } from "./types";

/** How many landed posts the log shows (yours and, FLT-92, the rival labs'). */
const LOG = 16;
const OUTCOME_TEXT = { flop: "Flopped", banger: "Banger", controversy: "Discourse", ratioed: "Ratioed", cancelled: "Cancelled" } as const;
const OUTCOME_TONE = { flop: "neutral", banger: "good", controversy: "bad", ratioed: "joke", cancelled: "bad" } as const;
const MOMENT_TEXT = { launch: "Launch day", rivalDrop: "Rival drop", water: "Water discourse", hearing: "Hearing week", night: "3am posting" } as const;
const TIER_TEXT = { recluse: "Never posts", occasional: "Posts sometimes", big: "Big account" } as const;

/** "987", "1.2K", "34K", "1.1M". */
export function countText(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  if (n < 1_000_000) return `${Math.round(n / 1000)}K`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}
const pct = (x: number) => `${Math.round(x * 100)}%`;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** FLT-92: the tag on a rival post (and on a dunk of yours). */
const BEAT_TEXT: Record<RivalPostView["beat"], string> = {
  idle: "", teaser: "Teaser", release: "Release", top: "#1 on the Arena", climb: "Climbing the Arena", drop: "Slid on the Arena", back: "So back",
  subtweet: "Subtweet", launch: "About your launch", leak: "About your leak", cancel: "About the cancel", escape: "About the escape",
  hearing: "About the hearing", raise: "About your raise", ratio: "Quote-post", dunk: "", reply: "", drama: "",
};

/** How far along a post is, 0 when it goes up to 1 at the midnight it lands. */
function progress(p: Pick<BirdPostView, "tick" | "settled">, tick: number): number {
  if (p.settled) return 1;
  const lands = (Math.floor(p.tick / TICKS_PER_DAY) + 1) * TICKS_PER_DAY;
  return Math.max(0, Math.min(1, (tick - p.tick) / Math.max(1, lands - p.tick)));
}

/** The numbers so far: they climb toward where the post lands, along a curve that depends on how. */
function climb(p: Pick<BirdPostView, "tick" | "settled" | "outcome" | "likes" | "reposts" | "replies">, tick: number) {
  const f = progress(p, tick);
  const loud = p.outcome === "ratioed" || p.outcome === "controversy" || p.outcome === "cancelled";
  const likeCurve = p.outcome === "banger" ? f ** 2.2 : p.outcome === "flop" ? 1 - (1 - f) ** 3 : f ** 0.8;
  const replyCurve = loud ? Math.sqrt(f) : f;
  return { f, likes: Math.round(p.likes * likeCurve), reposts: Math.round(p.reposts * likeCurve), replies: Math.round(p.replies * replyCurve) };
}

/** FLT-92: a rival lab's post, the same card as yours with the lab's colour, the quote and the beat's tag. */
export function birdRivalPost(p: RivalPostView, tick: number): BirdPostVM {
  const { f, likes, reposts, replies } = climb(p, tick);
  const ratio = p.ratioHype > 0;
  return {
    id: `r${p.id}`,
    name: p.name,
    handle: `@${p.handle}`,
    glyph: p.glyph,
    archetype: `rival-${p.role}`,
    text: p.text,
    time: clockLabel(hourAt(p.tick)),
    likes, reposts, replies,
    likesText: countText(likes),
    repostsText: countText(reposts),
    repliesText: countText(replies),
    outcome: p.settled ? p.outcome : "live",
    outcomeText: ratio ? `Ratioed ${p.quote?.handle ? `@${p.quote.handle}` : "you"} · −${p.ratioHype} Hype` : p.settled ? OUTCOME_TEXT[p.outcome] : "",
    tone: ratio ? "bad" : p.settled ? OUTCOME_TONE[p.outcome] : "neutral",
    viral: p.outcome === "banger" && (p.settled || f > 0.6),
    ratioing: replies > likes && replies > 2,
    reply: replies > 0 ? p.reply : "",
    reviewed: false,
    handledText: "",
    replyTo: null,
    momentText: "",
    side: "them",
    lab: { id: p.lab, name: p.labName, color: p.color },
    quote: p.quote ? { handle: `@${p.quote.handle}`, text: p.quote.text } : null,
    beatText: BEAT_TEXT[p.beat],
  };
}

export function birdPost(p: BirdPostView, tick: number, labName?: (id: string) => string): BirdPostVM {
  const { f, likes, reposts, replies } = climb(p, tick);
  const outcome = p.settled ? p.outcome : "live";
  return {
    id: String(p.id),
    name: p.name,
    handle: `@${p.handle}`,
    glyph: p.glyph,
    archetype: p.archetype,
    text: p.text,
    time: clockLabel(hourAt(p.tick)),
    likes, reposts, replies,
    likesText: countText(likes),
    repostsText: countText(reposts),
    repliesText: countText(replies),
    outcome,
    outcomeText: p.settled ? OUTCOME_TEXT[p.outcome] : "",
    tone: p.settled ? OUTCOME_TONE[p.outcome] : "neutral",
    viral: p.outcome === "banger" && (p.settled || f > 0.6),
    ratioing: replies > likes && replies > 2,
    reply: replies > 0 ? p.reply : "",
    reviewed: p.reviewed,
    handledText: p.handled === "contained" ? "Comms got to it" : p.handled === "stuck" ? "It stuck" : "",
    replyTo: p.replyTo ? `@${p.replyTo}` : null,
    momentText: p.moment ? MOMENT_TEXT[p.moment] : "",
    side: "us",
    lab: null,
    quote: null,
    beatText: p.dunk ? `Dunk on ${labName?.(p.dunk) ?? p.dunk}` : "",
  };
}

export function birdPoster(p: BirdPosterView): BirdPosterVM {
  const odds = p.lever === "comms" ? p.odds.comms : p.lever === "cook" ? p.odds.cook : { banger: 0, cancelled: 0 };
  const quiet = p.tier === "recluse" || p.tier === "break";
  const levers: BirdLeverVM[] = [
    { id: "cook", label: "Let them cook", tradeoff: `${pct(p.odds.cook.banger)} banger · ${pct(p.odds.cook.cancelled)} cancel`, active: p.lever === "cook" },
    { id: "comms", label: "Run it by Comms", tradeoff: `${pct(p.odds.comms.banger)} banger · ${pct(p.odds.comms.cancelled)} cancel · uses Comms`, active: p.lever === "comms" },
    { id: "logoff", label: "Please log off", tradeoff: p.tier === "big" ? "no posts · −focus · may quit" : "no posts · −focus", active: p.lever === "logoff" },
  ];
  return {
    id: p.id,
    name: p.name,
    handle: `@${p.handle}`,
    glyph: p.glyph,
    archetypeName: p.archetypeName,
    tier: p.tier,
    tierText: p.tier === "break" ? `On a posting break (${plural(p.breakDays, "day")})` : TIER_TEXT[p.tier],
    followersText: `${countText(p.followers)} followers`,
    banger: quiet ? 0 : odds.banger,
    cancel: quiet ? 0 : odds.cancelled,
    meterText: p.lever === "logoff" ? "Logged off" : quiet ? "Not posting" : `${pct(odds.banger)} banger · ${pct(odds.cancelled)} cancel`,
    hot: p.hot,
    levers,
    record: `${plural(p.posts, "post")} · ${plural(p.bangers, "banger")} · ${plural(p.cancels, "cancel")}`,
  };
}

export function birdAppOf(snap: Snapshot, earned: boolean, open: boolean): BirdAppVM {
  // Snapshots from before FLT-69 (fixtures, old links) have no `birdapp`: that is "off".
  const v = snap.birdapp;
  const enabled = !!v?.enabled && earned;
  if (!v || !enabled) return OFF;
  const tick = v.tick;
  // FLT-92: the rival labs' posts on the same timeline, newest first (a quote-post is dated just after what it quotes).
  const rv = v.rivals;
  const rivals = rv?.on ? rv.posts : [];
  const labName = (id: string) => rivals.find((p) => p.lab === id)?.labName ?? rv?.quiet.find((q) => q.lab === id)?.name ?? id;
  const merged = <A extends { tick: number; id: number }, B extends { tick: number; id: number }>(a: A[], b: B[], ma: (x: A) => BirdPostVM, mb: (x: B) => BirdPostVM) =>
    [...a.map((x) => ({ tick: x.tick, id: x.id, vm: () => ma(x) })), ...b.map((x) => ({ tick: x.tick, id: -x.id, vm: () => mb(x) }))]
      .sort((x, y) => y.tick - x.tick || y.id - x.id);
  const ours = (p: BirdPostView) => birdPost(p, tick, labName);
  const theirs = (p: RivalPostView) => birdRivalPost(p, tick);
  const live = merged(v.posts.filter((p) => !p.settled), rivals.filter((p) => !p.settled), ours, theirs).map((x) => x.vm());
  const landed = v.posts.filter((p) => p.settled).reverse();
  const log = merged(landed, rivals.filter((p) => p.settled), ours, theirs).slice(0, LOG).map((x) => x.vm());
  const next = [v.next, rv?.on ? rv.next : null].filter((n) => n !== null && n !== undefined).sort((a, b) => a.ticks - b.ticks)[0] ?? null;
  const fresh = landed.find((p) => (p.outcome === "banger" || p.outcome === "cancelled") && v.day - (Math.floor(p.tick / TICKS_PER_DAY) + 1) <= 1);
  const weight = v.comms.queue.reduce((n, f) => n + (f.kind === "cancelled" ? 2 : 1), 0);
  const aura = Math.round(v.aura);
  const t = v.tally;
  return {
    enabled: true,
    open,
    headline: v.comms.desk === "drowning" ? `Comms is drowning · Aura ${aura}` : `${plural(live.length, "post")} live · Aura ${aura}`,
    aura,
    auraText: `Aura ${aura}`,
    auraEffects: `+${Math.round(v.effects.hype)} Hype · visitors ×${v.effects.visitors.toFixed(2)} · applicants ×${v.effects.applicants.toFixed(2)}`,
    auraHistory: v.history.map((x) => Math.round(x)),
    moments: v.moments.map((m) => MOMENT_TEXT[m]),
    live,
    typing: next && next.ticks <= 3 ? `@${next.handle} is typing…` : null,
    log,
    posters: v.posters.map(birdPoster),
    postersText: `${v.posters.length} of ${plural(v.posterCount, "researcher")}`,
    comms: {
      desk: v.comms.desk,
      deskText: v.comms.desk === "drowning" ? "Drowning: the PR team is underwater" : v.comms.desk === "busy" ? `Busy: ${plural(v.comms.queue.length, "fire")} in the queue` : "Calm",
      queue: v.comms.queue.map((f) => ({
        id: String(f.post),
        handle: `@${f.handle}`,
        kind: f.kind,
        text: `${f.kind === "cancelled" ? "Cancel" : "Discourse"} · ${f.daysLeft <= 0 ? "sticks tonight" : `sticks in ${plural(f.daysLeft, "day")}`}`,
      })),
      capacityText: `${v.comms.used} of ${v.comms.size} today`,
      load: v.comms.drownAt > 0 ? Math.min(1, weight / v.comms.drownAt) : 0,
    },
    tally: `${plural(t.posts, "post")} · ${plural(t.bangers, "banger")} · ${plural(t.cancels, "cancel")}`,
    spotlight: fresh ? ours(fresh) : null,
    rivals: rv?.on
      ? {
          on: true,
          quiet: rv.quiet.map((q) => `${q.name} is taking a few days offline${q.until - v.day > 0 ? ` (back in ${plural(q.until - v.day, "day")})` : ""}`),
          tally: `${plural(rv.tally.posts, "rival post")} · ${plural(rv.tally.dunks, "dunk")} · ${plural(rv.tally.ratios, "ratio")}`,
          labs: rivalLabs(rivals),
        }
      : { on: false, quiet: [], tally: "", labs: [] },
  };
}

function rivalLabs(posts: RivalPostView[]) {
  const seen = new Map<string, { id: string; name: string; color: string }>();
  for (const p of posts) if (!seen.has(p.lab)) seen.set(p.lab, { id: p.lab, name: p.labName, color: p.color });
  return [...seen.values()];
}

const OFF: BirdAppVM = {
  enabled: false, open: false, headline: "", aura: 0, auraText: "", auraEffects: "", auraHistory: [], moments: [], live: [], typing: null, log: [], posters: [], postersText: "",
  comms: { desk: "calm", deskText: "", queue: [], capacityText: "", load: 0 }, tally: "", spotlight: null,
};

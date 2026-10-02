// The moment queue (FLT-76): the big beats (a model ships, a level-up's New! card, an era, an event card, an ending)
// play one at a time, a couple of real seconds apart, at any speed. Before this, Level 5, Frontier-4 SHIPPED and the
// Open-weights card could all land in the same second, and the Takeover was first announced inside a batch summary.
//
// Presentation only: the sim has already done all of it. The queue decides when the HUD *shows* each one; it never
// holds the sim back or changes a number (an event card stops the clock on its own, shown or not). It is pure and
// clock-free like the notice policy (`now` is the frame clock, passed in), so it is tested with a fake clock; the app
// machine calls it on every SYNCED (about 5 Hz, paused or not) and hands the HUD a small `StageView`.
import type { OpenEvent, Outcome } from "../sim/types";
import type { UiToast } from "./hud";

export type MomentKind = "ship" | "level" | "era" | "card" | "ending";

/** Real milliseconds between two beats. */
export const BEAT_GAP_MS = 2500;
/** An ending has the screen to itself this long: nothing else goes on until it is over. */
export const ENDING_SOLO_MS = 7000;
/** A shipped model's sticker stays this long in real time, whatever the speed (3 game days at 10× is a blink). */
export const SHIP_MS = 6000;

/** Within one report, the order they go on: the news first, then what it unlocked, then the card that asks you something, the ending last. */
const ORDER: Record<MomentKind, number> = { ship: 0, level: 1, era: 2, card: 3, ending: 4 };

export interface Moment {
  kind: MomentKind;
  /** What it is (`ship:4`, `level:scrutiny`, `card:openWeights`, ...): the same one is never queued twice. */
  key: string;
  /** The toasts that announce it, shown when it goes on (they skip the notice window, and are never grouped). */
  toasts: readonly UiToast[];
}

export interface Queued extends Moment {
  /** When it goes on (the frame clock). */
  at: number;
}

export interface MomentQueue {
  waiting: readonly Queued[];
  /** The next free slot: one gap after the last one scheduled (a whole solo after an ending). */
  free: number;
  shipUntil: number;
  soloUntil: number;
}

export const newMoments = (): MomentQueue => ({ waiting: [], free: 0, shipUntil: 0, soloUntil: 0 });

/** What the HUD needs: what to keep off the screen for now, whether an ending has it to itself, and the shipped sticker. */
export interface StageView {
  waiting: readonly MomentKind[];
  solo: boolean;
  shipped: boolean;
}

export const NO_STAGE: StageView = { waiting: [], solo: false, shipped: false };

/** The parts of a report (and of the one before it) that say a big moment happened. */
export interface Seen {
  models: number;
  /** The New! card on top of the sim's queue. */
  unlock: string | null;
  event: OpenEvent | null;
  outcome: Outcome;
}

const isEra = (id: string) => /^era\d+$/.test(id);
const shipToast = (t: UiToast) => t.source === "training" && t.importance === "you";
const endingToast = (t: UiToast) => t.source === "endings" && t.importance === "you";

/**
 * The big moments between two reports, and the rest of the toasts (for the notice policy). The release toast goes with
 * its ship; every ending toast goes with the ending, so neither can ever be folded into "2 things happened...".
 */
export function spot(before: Seen, after: Seen, toasts: readonly UiToast[]): { moments: Moment[]; rest: readonly UiToast[] } {
  const moments: Moment[] = [];
  let rest = toasts;
  const take = (pick: (t: UiToast) => boolean) => {
    const mine = rest.filter(pick);
    rest = rest.filter((t) => !pick(t));
    return mine;
  };
  if (after.models > before.models) moments.push({ kind: "ship", key: `ship:${after.models}`, toasts: take(shipToast) });
  if (after.unlock && after.unlock !== before.unlock) moments.push({ kind: "level", key: `level:${after.unlock}`, toasts: [] });
  const ev = after.event;
  if (ev && (ev.id !== before.event?.id || ev.day !== before.event.day)) moments.push({ kind: isEra(ev.id) ? "era" : "card", key: `card:${ev.id}:${ev.day}`, toasts: [] });
  const ended = after.outcome !== "playing" && after.outcome !== before.outcome;
  const said = take(endingToast);
  if (ended || said.length > 0) moments.push({ kind: "ending", key: ended ? `ending:${after.outcome}` : `ending:${said[0]!.text}`, toasts: said });
  return { moments: moments.sort((a, b) => ORDER[a.kind] - ORDER[b.kind]), rest };
}

/** Give each new moment the next free slot. An ending takes a whole solo, so whatever comes after it waits that long. */
export function enqueue(q: MomentQueue, moments: readonly Moment[], now: number): MomentQueue {
  if (moments.length === 0) return q;
  const waiting = [...q.waiting];
  let free = Math.max(now, q.free, q.soloUntil);
  for (const m of moments) {
    if (waiting.some((w) => w.key === m.key)) continue;
    waiting.push({ ...m, at: free });
    free += m.kind === "ending" ? ENDING_SOLO_MS : BEAT_GAP_MS;
  }
  return { ...q, waiting, free };
}

/** The moments whose turn has come, in order, and the queue without them. */
export function release(q: MomentQueue, now: number): { queue: MomentQueue; out: Queued[] } {
  const out = q.waiting.filter((m) => m.at <= now);
  if (out.length === 0) return { queue: q, out };
  let { shipUntil, soloUntil } = q;
  for (const m of out) {
    if (m.kind === "ship") shipUntil = m.at + SHIP_MS;
    if (m.kind === "ending") soloUntil = m.at + ENDING_SOLO_MS;
  }
  return { queue: { ...q, waiting: q.waiting.filter((m) => m.at > now), shipUntil, soloUntil }, out };
}

/** The HUD's view, the same object while nothing changes (the context is compared by identity). */
export function stageOf(q: MomentQueue, now: number, prev: StageView): StageView {
  const waiting = q.waiting.map((m) => m.kind);
  const solo = now < q.soloUntil;
  const shipped = now < q.shipUntil;
  if (prev.solo === solo && prev.shipped === shipped && prev.waiting.length === waiting.length && prev.waiting.every((k, n) => k === waiting[n])) return prev;
  return waiting.length === 0 && !solo && !shipped ? NO_STAGE : { waiting, solo, shipped };
}

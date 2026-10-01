// The notice policy (FLT-51): one rule for everything the sim wants to say, keyed on the tags every toast carries.
//
//   coach, a reply -> a toast now: the first-run coach, and the answer to what you just did, are never held back
//   you            -> a toast, at most one per 15 real seconds; what piles up meanwhile comes out as one batch summary
//   world          -> the ticker (and the panel that owns it already shows it: the Benchmarks board, the Staff list...)
//
// FLT-31 did this for Release Leapfrog alone by matching toast *text*; the sim now says who a toast is from (`source`) and
// whether it is about you (`importance`), so rewording a line can no longer bring the flood back. Speed changes nothing
// here, on purpose: the window is real time, so at 3x and 10x only `you` toasts ever reach the screen, and fewer per game
// day the faster you go. This module is pure and clock-free (`now` is the frame clock, passed in) so it can be tested
// with a fake clock; the app machine calls it where toasts come in. `hudViewModel` has to stay a pure function of its
// input, so it cannot hold a 15-second window itself.
import type { LeapfrogView } from "../sim/race/leapfrog/view";
import { GROUP_LINES } from "../content/toastGroups";
import { fillTemplate } from "../sim/format";
import type { NewsItem, NoticeSource, Tone } from "../sim/types";
import type { UiToast } from "./hud";

/** At most one `you` toast per this many real milliseconds (replies and the coach do not count). */
export const TOAST_WINDOW_MS = 15_000;
/** The ticker carries this many of the app's own items (world notices), newest last. */
export const WIRE_MAX = 30;

export type Lane = "now" | "toast" | "ticker";

/**
 * Where a toast goes. A reply skips the window only when it is about you: the pleasantries that come with it ("the
 * livestream went flawlessly") are ticker news like any other, or they would bury the answer itself. Untagged toasts (an
 * older save's) are `world`, the default.
 */
export function laneOf(t: Pick<UiToast, "reply" | "source" | "importance">): Lane {
  if (t.source === "coach") return "now";
  if (t.importance !== "you") return "ticker";
  return t.reply ? "now" : "toast";
}

export interface NoticeGate {
  /** When the last `you` toast (or batch) was shown (the frame clock), or null. */
  lastAt: number | null;
  /** `you` toasts that came while the window was shut, oldest first. */
  held: readonly UiToast[];
}

export const newGate = (): NoticeGate => ({ lastAt: null, held: [] });

export interface GateEnv {
  /** The frame clock, in milliseconds. */
  now: number;
  /** Today, for the ticker items. */
  day: number;
  /** The snapshot the toasts came with (null: no publish, so nothing to look at). */
  leapfrog: LeapfrogView | undefined;
  /** Your Arena rank before and after this snapshot, and who is on top now. */
  rank: { prev: number; next: number; top: string } | null;
  /** The next free UI toast id. */
  seq: number;
  /** An ending has the screen to itself (FLT-76, `moments.ts`): the window stays shut and the pile waits. */
  shut?: boolean;
}

/** A world notice on the ticker: a news item that remembers who sent it. */
export type WireItem = NewsItem & { source?: NoticeSource };

export interface Gated {
  gate: NoticeGate;
  /** What goes on the screen now, in order. */
  toasts: UiToast[];
  /** What goes to the ticker, in order. */
  wire: WireItem[];
  /** The UI toast ids used (the next `seq`). */
  seq: number;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The one to lead with: the first bad news, else the newest. */
const headlineOf = (held: readonly UiToast[]) => held.find((t) => t.tone === "bad") ?? held[held.length - 1]!;

/** "3 things happened while you were busy. Top of the pile: Priya Residual handed in the box and left." */
export function summaryText(held: readonly UiToast[]): string {
  return `${plural(held.length, "thing", "things")} happened while you were busy. Top of the pile: ${headlineOf(held).text}`;
}

/** "A", "A and B", "A, B and C", "A, B, C and 2 more". */
export function namesText(names: readonly string[]): string {
  const shown = names.length > 4 ? [...names.slice(0, 3), `${names.length - 3} more`] : names;
  return shown.length < 2 ? (shown[0] ?? "") : `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}`;
}

/**
 * Fold a pile's toasts of one group (FLT-54) into one line where the first of them was: "3 staff handed in the box:
 * Priya Residual, Kevin Backprop and Dana Gradient." A group of one keeps its own words. `folded` is what went in, for
 * the ticker.
 */
export function coalesce(held: readonly UiToast[], nextId: () => number): { held: UiToast[]; folded: UiToast[] } {
  const out: UiToast[] = [];
  const folded: UiToast[] = [];
  for (const t of held) {
    const kind = t.group?.kind;
    if (!kind) out.push(t);
    else if (out.some((o) => o.group?.kind === kind)) continue;
    else {
      const pile = held.filter((h) => h.group?.kind === kind);
      if (pile.length === 1) out.push(t);
      else {
        folded.push(...pile);
        const text = fillTemplate(GROUP_LINES[kind], { n: String(pile.length), who: namesText(pile.map((h) => h.group!.who)) });
        out.push({ id: nextId(), text, tone: t.tone, source: t.source, importance: "you", group: t.group });
      }
    }
  }
  return { held: out, folded };
}

/** Sort a publish's toasts into what is shown now, what waits for the window, and what is for the ticker. */
export function gateToasts(gate: NoticeGate, fresh: readonly UiToast[], env: GateEnv): Gated {
  const out: UiToast[] = [];
  const wire: WireItem[] = [];
  let held = gate.held;
  const hold = (t: UiToast) => {
    // The same words again (a second Gateway down) are one line, counted.
    held = held.some((h) => h.text === t.text) ? held : [...held, t];
  };
  for (const t of fresh) {
    const lane = laneOf(t);
    if (lane === "now") out.push(t);
    else if (lane === "toast") hold(t);
    else wire.push({ id: t.id, day: env.day, text: t.text, tone: t.tone, source: t.source });
  }
  let seq = env.seq;
  // You just lost #1 (the sim only toasts a fall of two places or more): worth a word while the pack is on.
  if (env.rank && env.leapfrog?.enabled && env.rank.prev === 1 && env.rank.next === 2) {
    hold({ id: 1_000_000 + seq++, text: `You lost #1 on the Arena${env.rank.top ? ` to ${env.rank.top}` : ""}.`, tone: "bad", source: "leapfrog", importance: "you" });
  }

  const open = !env.shut && (gate.lastAt === null || env.now - gate.lastAt >= TOAST_WINDOW_MS);
  if (!open || held.length === 0) return { gate: held === gate.held ? gate : { lastAt: gate.lastAt, held }, toasts: out, wire, seq };
  const pile = held;
  const c = coalesce(pile, () => 1_000_000 + seq++);
  held = c.held;
  if (held.length === 1) {
    out.push(held[0]!);
  } else {
    // A pile: one toast that says how big it is and leads with the worst of it; the rest are on the ticker to read.
    const bad = held.some((t) => t.tone === "bad");
    out.push({
      id: 1_000_000 + seq++,
      text: summaryText(held),
      tone: (bad ? "bad" : "neutral") as Tone,
      importance: "you",
      batch: held.map((t) => ({ text: t.text, tone: t.tone, source: t.source })),
    });
  }
  // Everything a line stands for is on the ticker to read: the pile behind a summary, and the names behind a folded group.
  if (held.length > 1 || c.folded.length > 0) for (const t of pile) wire.push({ id: t.id, day: env.day, text: t.text, tone: t.tone, source: t.source });
  return { gate: { lastAt: env.now, held: [] }, toasts: out, wire, seq };
}

/** The ticker's items: the sim's headlines and the app's world notices, in the order they happened (ids share one counter). */
export function mergeWire(news: readonly NewsItem[], wire: readonly WireItem[]): readonly NewsItem[] {
  if (wire.length === 0) return news;
  const said = new Set(news.map((n) => n.text));
  const extra = wire.filter((w) => !said.has(w.text));
  if (extra.length === 0) return news;
  return [...news, ...extra].sort((a, b) => a.id - b.id);
}

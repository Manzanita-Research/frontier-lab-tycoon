// The toast gate: what a rival launch is allowed to do to the player's screen (FLT-31).
//
// Release Leapfrog produces a launch every ~10 game days, which at 3x or 10x is a toast every few real seconds. The
// leaderboard (which flashes the row) and the ticker are where launches belong; a toast is for what matters to *you*.
// This module is pure and clock-free (`now` is passed in) so it can be tested with a fake clock. The app machine calls
// it where toasts come in: the one place that sees each toast once, with the frame clock at hand. `hudViewModel`
// itself has to stay a pure function of its input, so it cannot hold a 20-second window; same split as `useArenaMotion`.
//
// The sim is untouched: toasts are recognised by their text, and `notices.test.ts` runs a whole year of Leapfrog and
// fails if a toast the pack can produce is not recognised, so rewording one in the sim cannot quietly bring the flood back.
import type { LeapfrogView } from "../sim/race/leapfrog/view";
import type { Tone } from "../sim/types";
import type { UiToast } from "./hud";

/** At most one Leapfrog toast per this many real milliseconds. */
export const LEAPFROG_TOAST_MS = 20_000;
/** Launches that go unannounced this many at a time before a "N labs launched while you were busy" summary is worth a toast. */
export const LAUNCH_SUMMARY_MIN = 4;
/** A handful of old launches are not news: forget them after this long. */
export const HELD_STALE_MS = 90_000;
/** From this speed on, the small stuff (a flawless livestream, "you own the news cycle") stays in the ticker. */
export const HURRY_SPEED = 3;

export type NoticeKind =
  /** A rival launched (or answered): the leaderboard and the ticker say so. Never a toast. */
  | "launch"
  /** A rival took one of your records. */
  | "record"
  /** A benchmark was solved: a toast only if you led it. */
  | "solved"
  /** How your own launch went (a counter-launch, a launch bug, an early release). */
  | "yours"
  /** Nice to hear, fine to miss: a flawless livestream, "you own the news cycle". */
  | "minor"
  /** A rival owns the news cycle: the leaderboard's voice meter says so. */
  | "rivalCycle"
  /** The reply to a card choice you just made. Always shown, and it doesn't use up the window. */
  | "direct"
  /** Everything else: the gate has no opinion. */
  | "other";

const RULES: readonly (readonly [NoticeKind, RegExp])[] = [
  ["record", / took your record on /],
  ["launch", / launched .+\. The news cycle is theirs\.$/],
  ["launch", / answers .+ a day later: /],
  ["solved", / is solved\. Everyone is back to /],
  ["yours", /^Counter-launch lands: |^The counter-launch is out, and |has a launch bug\.|is out at \d+%: the news cycle is yours/],
  ["minor", /^The launch livestream goes flawlessly|^You own the news cycle/],
  ["rivalCycle", / owns the news cycle\.$/],
  ["direct", /^Holding for a counter-launch|^The screenshot is everywhere/],
];

export function classifyToast(text: string): NoticeKind {
  for (const [kind, re] of RULES) if (re.test(text)) return kind;
  return "other";
}

/** The kinds that are Release Leapfrog's (everything but `other`). */
export const isLeapfrogToast = (text: string): boolean => classifyToast(text) !== "other";

/** What the gate is sitting on: things that happened while the window was shut. */
export interface Held {
  launches: number;
  records: number;
  /** Toasts that matter, in the order they came (and a lost #1 the sim has no toast for). */
  matters: { kind: NoticeKind | "lostTop"; toast: { id: number | null; text: string; tone: Tone } }[];
  /** When the oldest thing being held arrived (the frame clock), or null. */
  since: number | null;
}

export interface NoticeGate {
  /** When the last Leapfrog toast was shown (the frame clock), or null. */
  lastAt: number | null;
  held: Held;
}

const EMPTY: Held = { launches: 0, records: 0, matters: [], since: null };
export const newGate = (): NoticeGate => ({ lastAt: null, held: EMPTY });

export interface GateEnv {
  /** The frame clock, in milliseconds. */
  now: number;
  speed: number;
  /** The snapshot the toasts came with (null: no publish, so nothing to look at). */
  leapfrog: LeapfrogView | undefined;
  /** Your Arena rank before and after this snapshot, and who is on top now. */
  rank: { prev: number; next: number; top: string } | null;
  /** The next free UI toast id. */
  seq: number;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "4 labs launched and 2 records fell while you were busy. Receipts: the Benchmarks tab." */
export function summaryText(h: Held): string {
  const parts: string[] = [];
  if (h.launches > 0) parts.push(`${plural(h.launches, "lab", "labs")} launched`);
  if (h.records > 0) parts.push(`${h.records} of your records fell`);
  const other = h.matters.filter((m) => m.kind !== "record").length;
  if (other > 0) parts.push(`${plural(other, "more thing", "more things")} happened`);
  const joined = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : (parts[0] ?? "Things happened");
  return `${joined} while you were busy.${h.launches > 0 || h.records > 0 ? " Receipts: the Benchmarks tab." : ""}`;
}

/** Did you hold the record on the benchmark that "{short} is solved..." is about? */
function youLed(text: string, lf: LeapfrogView | undefined): boolean {
  if (!lf?.enabled) return false;
  const short = text.split(" is solved.")[0];
  return lf.benchmarks.some((b) => b.short === short && b.holder === "you");
}

export interface Gated {
  gate: NoticeGate;
  /** What goes on the screen, in order. */
  toasts: UiToast[];
  /** The UI toast ids used (the next `seq`). */
  seq: number;
}

/**
 * Sort a publish's toasts into what is shown now, what is held for the window to open, and what is for the ticker.
 * Only Release Leapfrog's toasts are touched; anything else passes through in place.
 */
export function gateToasts(gate: NoticeGate, fresh: readonly UiToast[], env: GateEnv): Gated {
  const out: UiToast[] = [];
  // A few launches from a while ago are not news any more.
  const stale = gate.held.since !== null && gate.held.matters.length === 0 && env.now - gate.held.since > HELD_STALE_MS;
  const held: Held = stale ? { ...EMPTY, matters: [] } : { ...gate.held, matters: [...gate.held.matters] };
  const hold = () => {
    held.since ??= env.now;
  };
  for (const t of fresh) {
    const kind = classifyToast(t.text);
    switch (kind) {
      case "other":
      case "direct":
        out.push(t);
        break;
      case "launch":
        held.launches++;
        hold();
        break;
      case "record":
        held.records++;
        held.matters.push({ kind, toast: t });
        hold();
        break;
      case "solved":
        if (youLed(t.text, env.leapfrog)) {
          held.matters.push({ kind, toast: t });
          hold();
        }
        break;
      case "yours":
        held.matters.push({ kind, toast: t });
        hold();
        break;
      case "minor":
        if (env.speed < HURRY_SPEED) {
          held.matters.push({ kind, toast: t });
          hold();
        }
        break;
      case "rivalCycle":
        break;
    }
  }
  // You just lost #1 (the sim only toasts a fall of two places or more): worth a word while the pack is on.
  if (env.rank && env.leapfrog?.enabled && env.rank.prev === 1 && env.rank.next === 2) {
    held.matters.push({ kind: "lostTop", toast: { id: null, text: `You lost #1 on the Arena${env.rank.top ? ` to ${env.rank.top}` : ""}.`, tone: "bad" } });
    hold();
  }

  const open = gate.lastAt === null || env.now - gate.lastAt >= LEAPFROG_TOAST_MS;
  const piled = held.launches >= LAUNCH_SUMMARY_MIN;
  if (open && held.matters.length > 0 && !(held.matters.length > 1 || piled)) {
    // One thing that matters (a launch that took your record comes with its own launch toast, so that alone is no reason for a summary): say it as it is.
    const only = held.matters[0]!.toast;
    out.push({ id: only.id ?? 1_000_000 + env.seq, text: only.text, tone: only.tone });
    return { gate: { lastAt: env.now, held: { ...held, records: 0, matters: [] } }, toasts: out, seq: only.id === null ? env.seq + 1 : env.seq };
  }
  if (open && (held.matters.length > 0 || piled)) {
    const bad = held.matters.some((m) => m.toast.tone === "bad");
    out.push({ id: 1_000_000 + env.seq, text: summaryText(held), tone: (bad ? "bad" : "neutral") as Tone });
    return { gate: { lastAt: env.now, held: EMPTY }, toasts: out, seq: env.seq + 1 };
  }
  const same = !stale && held.since === gate.held.since && held.launches === gate.held.launches && held.matters.length === gate.held.matters.length;
  return { gate: same ? gate : { lastAt: gate.lastAt, held }, toasts: out, seq: env.seq };
}

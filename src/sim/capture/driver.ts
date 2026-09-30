// Regulatory Capture's driver (FLT-22). Own random stream; the chart steps purely inside the tick. Once a hearing has
// happened and Capture is high, a Senate staffer asks the lab to "take a first pass" at the bill: the draft card is a
// word processor with five clauses, two allowed. Sent to the floor, the bill is voted on by The Hearing's senators
// (through the Promise Tracker's roll call when FLT-23 is awake, so lobbying counts; by the same dice here when it is
// not). Signed, each clause's calls run as timed effects owned by "capture" (the race reads them in `race/rules.ts`).
// Every day the law stands, journalists may open the file properties: the odds grow with the clauses' shame, the heat
// and the distrust (or another pack sets `capture:leak`). Exposed, the law is struck (`effects.end`) and the auditors take note.
// FLT-56: the roll no longer exposes the law on the spot. A reporter starts asking (a beat and a toast), and the story
// runs `warning.days` later unless the lab buries it (`buryLeak`: money, Capture and a little heat, dearer each time, and
// each burial makes the next leak likelier). Another pack handing over the file still exposes it at once.
import { eventById } from "../../content/events";
import type { RivalId } from "../../content/rivals";
import { defs } from "../defs";
import { arcMachine } from "../machines/arc";
import { initialStored, step } from "../machines/run";
import { fillTemplate, formatMoney } from "../format";
import { addNews, addToast } from "../news";
import { openEventOf } from "../events";
import { createRng, type Rng } from "../rng";
import { runVerb, STATS } from "../verbs";
import { chartStats, type Beat } from "../circus/chart";
import { rivalMatches } from "../race/rules";
import { castVotes, tableMotion } from "../promises/driver";
import { BILL_MOTION } from "../promises/pack";
import { motionOf } from "../promises/machine";
import type { Call } from "../disasters/types";
import type { GameState } from "../types";
import { CAPTURE, clauseById, DRAFT_CARD, EXPOSED_CARD, PICK_PREFIX, PICKS } from "./pack";
import { CAPTURE_STATS, freshBill, stepBill } from "./machine";
import { picks } from "../picks";

const R = CAPTURE.rules;
const W = R.warning;
const OWNER = "capture";
/** The reporter and the bury are about you, and need you (FLT-51). */
const TAG = { source: "politics", importance: "you" } as const;
const CARD_IDS = CAPTURE.content.events.add.map((e) => e.id);
// Lazy, like the yacht's (FLT-52): verbs -> commands -> this driver is a cycle, so nothing from verbs runs at load.
let measure: string[] | undefined;
const MEASURE = () => (measure ??= chartStats(CAPTURE.chart).filter((n) => !(CAPTURE_STATS as readonly string[]).includes(n)));
const ENDED: Record<string, string> = { declined: "declined", failed: "failed", exposed: "exposed", sunset: "sunset" };

const armCard = (id: string) => {
  const def = eventById(id)!;
  return initialStored(arcMachine, { choices: def.choices.length, cooldownDays: def.cooldown ?? 0, openedDay: null });
};
/** The law's life in days: the chart's sunset (the `after` guard on the way out of "law"). */
const SUNSET_DAYS = (() => {
  const on = (CAPTURE.chart.states.law as { on?: Record<string, unknown> }).on?.DAY;
  for (const t of (Array.isArray(on) ? on : on ? [on] : []) as { guard?: { type?: string; params?: { days?: unknown } } }[]) {
    if (t.guard?.type === "after" && typeof t.guard.params?.days === "number") return t.guard.params.days;
  }
  return 180;
})();
const releases = (s: GameState) => Object.fromEntries(s.race.rivals.map((r) => [r.context.id, r.context.releases]));

export function enableCapture(s: GameState) {
  if (!s.bill) {
    const rngState = (s.seed ^ 0x43415054) >>> 0;
    s.bill = { enabled: true, rngState, machine: freshBill(s.tick), act: R.actNames[0]!, draft: [], floorDay: null, lawDay: null, ayes: null, seen: releases(s), history: [] };
  }
  s.bill.enabled = true;
  for (const id of CARD_IDS) s.arcs[id] ??= armCard(id);
}

/** Off: back to quiet, the law struck, any bill card closed. The history stays. */
export function disableCapture(s: GameState) {
  const b = s.bill;
  if (!b) return;
  b.enabled = false;
  if (b.machine.value !== "quiet") runVerb({ state: s, rng: createRng(b.rngState), run: null, owner: OWNER }, { type: "effects.end", params: {} });
  b.machine = freshBill(s.tick);
  b.draft = [];
  b.floorDay = null;
  delete b.warned;
  delete b.buried;
  for (const key of PICKS) delete s.flags[PICK_PREFIX + key];
  for (const id of CARD_IDS) s.arcs[id] = armCard(id);
}

/** Tick a clause on or off the draft. Only while the staffer is waiting; two at most (a toast says so). */
export function draftClause(s: GameState, clause: string, on: boolean): boolean {
  const b = s.bill;
  if (!b?.enabled || b.machine.value !== "invited" || !clauseById(clause)) return false;
  if (!on) return (b.draft = b.draft.filter((c) => c !== clause)), true;
  if (b.draft.includes(clause)) return true;
  if (b.draft.length >= R.pick) return void addToast(s, `The staffer says ${R.pick} clauses is "already a lot of clauses".`, "neutral", { source: "politics", importance: "you" }), false;
  b.draft = [...b.draft, clause];
  return true;
}

/** Put a card on screen now, if nothing else has it. */
function openCard(s: GameState, id: string) {
  if (openEventOf(s)) return;
  s.arcs[id] = step(arcMachine, armCard(id), { type: "DAY", day: s.day, ready: true, slotFree: true, pace: 1 }).stored;
}

const vars = (s: GameState) => ({ lab: s.labName, act: s.bill!.act });

function send(s: GameState, rng: Rng, beat: Beat) {
  const b = s.bill!;
  const before = b.machine.value;
  const result = stepBill(b.machine, beat);
  b.machine = result.stored;
  const env = { state: s, rng, run: null, owner: OWNER, vars: vars(s) };
  for (const call of result.calls) runVerb(env, { type: call.verb, params: call.params });
  const now = b.machine.value;
  if (now !== before) arrived(s, rng, now);
}

/** What happens on the way into a stage: the bill is named, tabled, signed or struck. */
function arrived(s: GameState, rng: Rng, to: string) {
  const b = s.bill!;
  const clauses = b.machine.context.clauses;
  if (to === "invited") {
    b.act = rng.pick(R.actNames);
    b.draft = [];
    b.ayes = null;
    openCard(s, DRAFT_CARD);
  }
  if (to === "floor") {
    b.floorDay = s.day;
    tableMotion(s, { id: BILL_MOTION, title: b.act });
  }
  if (to === "law") {
    b.lawDay = s.day;
    b.seen = releases(s);
    delete b.warned;
    delete b.buried;
    const env = { state: s, rng, run: null, owner: OWNER, vars: vars(s) };
    if (!clauses.length) addNews(s, fillTemplate(R.empty, vars(s)), "joke");
    for (const id of clauses) for (const call of clauseById(id)!.effects) runVerb(env, call as Call);
  }
  if (to === "exposed") openCard(s, EXPOSED_CARD);
  const outcome = ENDED[to];
  if (outcome) {
    delete b.warned;
    b.history = [...b.history, { day: s.day, act: b.act, clauses: [...clauses], outcome }].slice(-8);
    b.floorDay = null;
  }
}

/** Picks arrive as flags from the cards' choices; consumed at once, including while paused. */
const PICK_FLAGS = picks(PICK_PREFIX, PICKS);

export function applyCaptureChoices(s: GameState) {
  const b = s.bill;
  if (!b?.enabled) return;
  for (const { key, flag } of PICK_FLAGS) {
    if (s.flags[flag] === undefined) continue;
    delete s.flags[flag];
    const rng = createRng(b.rngState);
    send(s, rng, { type: "CHOSE", tick: s.tick, day: s.day, roll: 0, stats: {}, choice: key, data: key === "send" ? { clauses: [...b.draft] } : undefined });
    b.rngState = rng.state();
  }
}

const shameOf = (ids: readonly string[]) => ids.reduce((n, id) => n + (clauseById(id)?.shame ?? 0), 0);

/** A day's odds that someone reads the file properties of a law this shameless, at today's heat and trust. */
function oddsFor(s: GameState, shame: number): number {
  const k = R.backfire;
  return Math.min(1, k.base * Math.max(1, shame) * (1 + Math.max(0, s.disasters.heat) / k.heatScale) * (1 + (50 - s.disasters.trust) / k.trustScale));
}

/** A day's odds that someone reads the file properties (every burial adds `warning.shame`). */
export function leakOdds(s: GameState): number {
  const b = s.bill;
  if (!b || b.machine.value !== "law") return 0;
  return oddsFor(s, shameOf(b.machine.context.clauses) + (b.buried ?? 0) * W.shame);
}

/**
 * FLT-56, the draft's leak-risk meter: the odds someone reads the file properties before the law sunsets, if the
 * clauses ticked now became law today (at today's heat and trust). While the law stands: over the days it has left.
 */
export function projectedLeak(s: GameState): number {
  const b = s.bill;
  if (!b) return 0;
  const stage = b.machine.value;
  if (stage === "invited") return 1 - (1 - oddsFor(s, shameOf(b.draft))) ** SUNSET_DAYS;
  if (stage !== "law") return 0;
  const left = Math.max(0, SUNSET_DAYS - (b.lawDay === null ? 0 : s.day - b.lawDay));
  return 1 - (1 - leakOdds(s)) ** left;
}

/** What burying the story costs now: dearer each time. */
export function buryCost(s: GameState): number {
  return Math.round(W.cost * W.costGrowth ** (s.bill?.buried ?? 0));
}

/** Days until the reporter's story runs (null: nobody is asking). */
export function leakDaysLeft(s: GameState): number | null {
  const b = s.bill;
  return b?.warned === undefined || b.machine.value !== "law" ? null : Math.max(0, b.warned + W.days - s.day);
}

/** A reporter starts asking: the beat at the gate, a toast, and the clock. */
function warn(s: GameState, rng: Rng) {
  const b = s.bill!;
  b.warned = s.day;
  const v = { ...vars(s), reporter: R.reporter, days: String(W.days) };
  addToast(s, fillTemplate(W.toast, v), "bad", TAG);
  runVerb({ state: s, rng, run: null, owner: OWNER, vars: v }, { type: "camera.beat", params: { kind: "leak", caption: W.caption, sub: W.sub, on: "gate", zoom: 1.3, hold: 5 } });
}

/** A reporter starts asking now, whatever the dice say (the staged moment and tests). */
export function warnLeak(s: GameState) {
  const b = s.bill;
  if (!b?.enabled || b.machine.value !== "law" || b.warned !== undefined) return;
  const rng = createRng(b.rngState);
  warn(s, rng);
  b.rngState = rng.state();
}

/** Bury the story the reporter is chasing. Refused (with a toast) without the cash. Returns whether it was buried. */
export function buryLeak(s: GameState): boolean {
  const b = s.bill;
  if (!b?.enabled || b.machine.value !== "law" || b.warned === undefined) return false;
  const cost = buryCost(s);
  if (s.cash < cost) return addToast(s, fillTemplate(W.broke, { cost: formatMoney(cost) }), "bad", TAG), false;
  const rng = createRng(b.rngState);
  s.cash -= cost;
  s.ledger = { ...s.ledger, expenses: s.ledger.expenses + cost, net: s.ledger.net - cost };
  const env = { state: s, rng, run: null, owner: OWNER, vars: { ...vars(s), reporter: R.reporter } };
  runVerb(env, { type: "capture.delta", params: { amount: -W.capture } });
  runVerb(env, { type: "heat.delta", params: { amount: W.heat } });
  delete b.warned;
  b.buried = (b.buried ?? 0) + 1;
  addNews(s, fillTemplate(rng.pick(W.buried), env.vars), "joke");
  addToast(s, fillTemplate(W.buriedToast, { cost: formatMoney(buryCost(s)) }), "neutral", TAG);
  b.rngState = rng.state();
  return true;
}

/** The roll call on the bill: the Senate's, if the Promise Tracker counted it since the bill went to the floor. */
function rollCall(s: GameState, rng: Rng): { voted: number; ayes: number } {
  const b = s.bill!;
  const since = b.floorDay ?? s.day;
  if (s.promises?.enabled) {
    const passed = s.flags[`senate:passed:${BILL_MOTION}`];
    const failed = s.flags[`senate:failed:${BILL_MOTION}`];
    const counted = (passed !== undefined && passed >= since) || (failed !== undefined && failed >= since);
    if (!counted) return { voted: 0, ayes: 0 };
    const ayes = s.promises.last?.motion === BILL_MOTION ? s.promises.last.ayes : passed !== undefined && passed >= since ? 3 : 0;
    return { voted: 1, ayes };
  }
  if (s.day - since < R.floorDays) return { voted: 0, ayes: 0 };
  const votes = castVotes(s, rng, motionOf(BILL_MOTION, b.act)!, []);
  return { voted: 1, ayes: Object.values(votes).filter((v) => v === "aye").length };
}

/** A rival released under the law: a headline says what the law did to it (once per release). */
function underTheLaw(s: GameState, rng: Rng) {
  const b = s.bill!;
  const clauses = b.machine.context.clauses;
  for (const r of s.race.rivals) {
    const c = r.context;
    const was = b.seen[c.id] ?? c.releases;
    b.seen[c.id] = c.releases;
    if (c.releases <= was) continue;
    const trigger = clauses.includes("permit") && c.id === "sirocco" ? "boat"
      : clauses.includes("permit") && rivalMatches(s, c, ["open", "!sirocco"]) ? "closed"
      : clauses.includes("threshold") && c.capability < s.capability ? "licence" : null;
    const lines = trigger ? CAPTURE.content.headlines.add.filter((h) => h.trigger === trigger) : [];
    if (!lines.length) continue;
    const line = rng.pick(lines);
    addNews(s, fillTemplate(line.text, { ...vars(s), rival: defs().rivalById[c.id as RivalId]?.name ?? c.id, model: c.model }), line.tone);
  }
}

export function dailyCapture(s: GameState) {
  const b = s.bill;
  if (!b?.enabled) return;
  const rng = createRng(b.rngState);
  const stage = b.machine.value;
  const stats: Record<string, number> = { voted: 0, ayes: 0, leaked: 0 };
  for (const name of MEASURE()) stats[name] = STATS[name]?.(s, null) ?? 0;
  if (stage === "floor") {
    const vote = rollCall(s, rng);
    stats.voted = vote.voted;
    stats.ayes = vote.ayes;
    if (vote.voted) b.ayes = vote.ayes;
  }
  if (stage === "law") {
    underTheLaw(s, rng);
    // Another pack (an audit, a subpoena) may hand the journalists the file: the `capture:leak` flag.
    const handed = s.flags["capture:leak"] !== undefined;
    delete s.flags["capture:leak"];
    const hit = rng.next() < leakOdds(s);
    const due = b.warned !== undefined && s.day - b.warned >= W.days;
    stats.leaked = handed || due ? 1 : 0;
    if (hit && !stats.leaked && b.warned === undefined) warn(s, rng);
  }
  send(s, rng, { type: "DAY", tick: s.tick, day: s.day, roll: 0, stats });
  // The draft or the leak may have waited behind another card.
  if (b.machine.value === "invited" && !openEventOf(s)) openCard(s, DRAFT_CARD);
  b.rngState = rng.state();
}

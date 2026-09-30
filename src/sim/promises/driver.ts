// The Promise Tracker's driver (FLT-23). Own random stream; the chart steps purely inside the tick. It wakes after the
// first hearing, puts the next motion on the docket each recess (or the bill FLT-22 tabled), prints each senator's
// promise as a headline and opens the whip card, then rolls the roll call: a senator the lab lobbied votes the lab's
// way, the others by their lean, nudged by regulatory capture. The result moves heat (the motion's pass/fail verbs)
// and is posted as flags (`senate:passed:<motion>`, `senate:failed:<motion>`) for other packs to hear.
import { eventById } from "../../content/events";
import { arcMachine } from "../machines/arc";
import { initialStored, step } from "../machines/run";
import { fillTemplate, formatMoney } from "../format";
import { addNews, addToast, type ToastTag } from "../news";
import { openEventOf } from "../events";
import { createRng, type Rng } from "../rng";
import { runVerb, STATS } from "../verbs";
import { chartStats, type Beat } from "../circus/chart";
import type { Call } from "../disasters/types";
import type { GameState } from "../types";
import { BILL_MOTION, PICK_PREFIX, PROMISES, ROLLCALL_CARD, SENATORS, truthLabel, WHIP_CARD, type MotionLike, type Side } from "./pack";
import { freshPromises, motionOf, PROMISES_STATS, stepPromises } from "./machine";
import type { PromisesState } from "./state";

const R = PROMISES.rules;
const OWNER = "promises";
/** The lobby desk's answers (FLT-51): the Senate is politics, and each one answers what you just did. */
const SENATE: ToastTag = { source: "politics", importance: "you" };
const CARD_IDS = PROMISES.content.events.add.map((e) => e.id);
// Lazy, like the yacht's (FLT-52): verbs -> commands -> this driver is a cycle, so nothing from verbs runs at load.
let measure: string[] | undefined;
const MEASURE = () => (measure ??= chartStats(PROMISES.chart).filter((n) => !(PROMISES_STATS as readonly string[]).includes(n)));
const LIVE = ["campaign", "rollCall"];

const armCard = (id: string) => {
  const def = eventById(id)!;
  return initialStored(arcMachine, { choices: def.choices.length, cooldownDays: def.cooldown ?? 0, openedDay: null });
};
const other = (side: Side): Side => (side === "aye" ? "nay" : "aye");

/** The docket's next motion: any the Senate has not heard lately. */
function rollNext(p: PromisesState, rng: Rng): string {
  const fresh = R.motions.filter((m) => !p.recent.includes(m.id));
  return rng.pick(fresh.length ? fresh : R.motions).id;
}

export function enablePromises(s: GameState) {
  if (!s.promises) {
    const p: PromisesState = { enabled: true, rngState: (s.seed ^ 0x50524f4d) >>> 0, machine: freshPromises(s.tick), tabled: null, next: "", recent: [], last: null };
    const rng = createRng(p.rngState);
    p.next = rollNext(p, rng);
    p.rngState = rng.state();
    s.promises = p;
  }
  s.promises.enabled = true;
  for (const id of CARD_IDS) s.arcs[id] ??= armCard(id);
}

/** Off: back to recess (a pack that has woken stays awake), the docket cleared, any tracker card closed. Records stay. */
export function disablePromises(s: GameState) {
  const p = s.promises;
  if (!p) return;
  p.enabled = false;
  if (LIVE.includes(p.machine.value)) p.machine = { value: "recess", context: { ...p.machine.context, enteredTick: s.tick, lobbied: [], votes: {}, ayes: 0 } };
  delete s.flags[`${PICK_PREFIX}done`];
  for (const id of CARD_IDS) s.arcs[id] = armCard(id);
}

/** Put a motion to the floor out of turn (FLT-22's bill): it is heard at the next recess, ahead of the docket. */
export function tableMotion(s: GameState, motion: { id: string; title: string }) {
  if (s.promises?.enabled) s.promises.tabled = { ...motion };
}

/** A senator's odds of voting the lab's way on this motion, before any lobbying: their lean, plus capture's nudge. */
export function labOdds(s: GameState, m: MotionLike, senator: string): number {
  return Math.max(0.02, Math.min(0.98, (m.lean[senator] ?? 0.5) + R.captureLean * (s.capture ?? 0)));
}
/** How a senator is leaning today: the lab's side if lobbied or more likely than not. */
export function leaning(s: GameState, m: MotionLike, senator: string, lobbied: readonly string[]): Side {
  return lobbied.includes(senator) || labOdds(s, m, senator) >= 0.5 ? m.labSide : other(m.labSide);
}

/** Roll a roll call: one die per senator, in The Hearing's order (the lobbied still roll, so the stream stays put). */
export function castVotes(s: GameState, rng: Rng, m: MotionLike, lobbied: readonly string[]): Record<string, Side> {
  const votes: Record<string, Side> = {};
  for (const sen of SENATORS) {
    const roll = rng.next();
    votes[sen.id] = lobbied.includes(sen.id) || roll < labOdds(s, m, sen.id) ? m.labSide : other(m.labSide);
  }
  return votes;
}

/** Put a card on screen now, if nothing else has it. */
function openCard(s: GameState, id: string) {
  if (openEventOf(s)) return;
  s.arcs[id] = step(arcMachine, armCard(id), { type: "DAY", day: s.day, ready: true, slotFree: true, pace: 1 }).stored;
}

const nameOf = (id: string) => SENATORS.find((x) => x.id === id)?.name ?? id;
const vars = (s: GameState, m: MotionLike) => ({ lab: s.labName, motion: m.title });

function send(s: GameState, rng: Rng, beat: Beat) {
  const p = s.promises!;
  const before = p.machine.value;
  const result = stepPromises(p.machine, beat);
  p.machine = result.stored;
  for (const call of result.calls) runVerb({ state: s, rng, run: null, owner: OWNER }, { type: call.verb, params: call.params });
  const now = p.machine.value;
  if (now !== before) arrived(s, rng, before, now);
}

/** What happens on the way into a stage: the docket turns, the promises are made, the votes are read out. */
function arrived(s: GameState, rng: Rng, from: string, to: string) {
  const p = s.promises!;
  const c = p.machine.context;
  const m = motionOf(c.motion, c.title);
  if (!m) return;
  if (to === "campaign") {
    if (p.tabled?.id === c.motion) p.tabled = null;
    else {
      p.recent = [...p.recent, c.motion].slice(-3);
      p.next = rollNext(p, rng);
    }
    for (const sen of SENATORS) addNews(s, `${nameOf(sen.id)} ${fillTemplate(m.promises[sen.id]!.line, vars(s, m))}`, "neutral");
    openCard(s, WHIP_CARD);
  }
  if (from === "rollCall" && (to === "passed" || to === "failed")) {
    const passed = to === "passed";
    const ayes = c.ayes;
    const nays = SENATORS.length - ayes;
    p.last = { motion: m.id, title: m.title, passed, ayes, nays, day: s.day, lobbied: [...c.lobbied] };
    s.flags[`senate:${passed ? "passed" : "failed"}:${m.id}`] = s.day;
    const tally = `${Math.max(ayes, nays)}–${Math.min(ayes, nays)}`;
    const line = fillTemplate(passed ? R.passed : R.failed, { ...vars(s, m), tally });
    addNews(s, line.charAt(0).toUpperCase() + line.slice(1), "neutral");
    const pack = R.motions.find((x) => x.id === m.id);
    const env = { state: s, rng, run: null, owner: OWNER, vars: vars(s, m) };
    for (const call of (passed ? pack?.pass : pack?.fail) ?? []) runVerb(env, call as Call);
    headlines(s, rng, m);
    if (c.lobbied.length > 0 || m.id === BILL_MOTION) openCard(s, ROLLCALL_CARD);
  }
}

/** One headline about the roll call: the first broken promise (a lobbied flip first), else a technically-true or a kept one. */
function headlines(s: GameState, rng: Rng, m: MotionLike) {
  const c = s.promises!.machine.context;
  const rows = SENATORS.map((sen) => ({ id: sen.id, rec: c.records[sen.id]?.log.at(-1) })).filter((r) => r.rec?.motion === m.id);
  const pick = rows.find((r) => !r.rec!.kept && r.rec!.lobbied) ?? rows.find((r) => !r.rec!.kept) ?? rows.find((r) => r.rec!.said === "both") ?? rows[0];
  if (!pick) return;
  const r = pick.rec!;
  const trigger = !r.kept ? (r.lobbied ? "flipLobbied" : "flip") : r.said === "both" ? "both" : "kept";
  const lines = PROMISES.content.headlines.add.filter((h) => h.trigger === trigger);
  if (!lines.length) return;
  const line = rng.pick(lines);
  const rec = c.records[pick.id]!;
  const truth = truthScore(rec.kept, rec.broken);
  addNews(s, fillTemplate(line.text, { ...vars(s, m), senator: nameOf(pick.id), vote: r.voted, truth: truthLabel(truth) }), line.tone);
}

export const truthScore = (kept: number, broken: number): number | null => (kept + broken === 0 ? null : Math.round((100 * kept) / (kept + broken)));

/** The lab's lobbyists visit a senator about the motion on the docket. A toast says why not, when not. */
export function lobbySenator(s: GameState, senator: string): boolean {
  const p = s.promises;
  const fee = R.senators[senator]?.lobby;
  if (!p?.enabled || fee === undefined) return false;
  const c = p.machine.context;
  if (!LIVE.includes(p.machine.value)) return void addToast(s, "The Senate is in recess. Your lobbyists are at the beach.", "neutral", SENATE), false;
  if (c.lobbied.includes(senator)) return void addToast(s, `${nameOf(senator)} has already been "informed".`, "neutral", SENATE), false;
  if (s.cash < fee) return void addToast(s, `Your lobbyists want ${formatMoney(fee)} up front.`, "bad", SENATE), false;
  const rng = createRng(p.rngState);
  send(s, rng, { type: "CHOSE", tick: s.tick, day: s.day, roll: 0, stats: {}, choice: `lobby:${senator}` });
  p.rngState = rng.state();
  addToast(s, R.senators[senator]!.line, "neutral", SENATE);
  return true;
}

/** The tracker's cards only close: their one pick is consumed at once, including while paused. */
export function applyPromisesChoices(s: GameState) {
  if (!s.promises?.enabled) return;
  delete s.flags[`${PICK_PREFIX}done`];
}

export function dailyPromises(s: GameState) {
  const p = s.promises;
  if (!p?.enabled) return;
  const rng = createRng(p.rngState);
  const stage = p.machine.value;
  const stats: Record<string, number> = { tabled: stage === "recess" && p.tabled ? 1 : 0 };
  for (const name of MEASURE()) stats[name] = STATS[name]?.(s, null) ?? 0;
  const beat: Beat = { type: "DAY", tick: s.tick, day: s.day, roll: 0, stats };
  if (stage === "recess") {
    const next = p.tabled ?? { id: p.next, title: motionOf(p.next)?.title ?? "" };
    beat.data = { motion: next.id, title: next.title };
  }
  if (stage === "rollCall") {
    const c = p.machine.context;
    const m = motionOf(c.motion, c.title);
    if (m) beat.data = { votes: castVotes(s, rng, m, c.lobbied) };
  }
  send(s, rng, beat);
  p.rngState = rng.state();
}

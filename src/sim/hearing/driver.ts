// The Hearing's driver (FLT-21). Own random stream; the chart steps purely inside the tick. Every day while quiet it
// checks the pack's triggers (a flag set anew, a stat that rises or crosses a line, days since the pack woke), rolls a
// docket (one question per senator) and sends it in the DAY beat. In session it keeps the next question card on screen:
// the card holds time like any other, the pick comes back as a flag and is sent to the chart as a CHOSE straight away.
import { eventById } from "../../content/events";
import { arcMachine } from "../machines/arc";
import { initialStored, step } from "../machines/run";
import { fillTemplate } from "../format";
import { addNews } from "../news";
import { cardAllowed, openEventOf } from "../events";
import { createRng, type Rng } from "../rng";
import { runVerb, STATS } from "../verbs";
import type { Beat } from "../circus/chart";
import type { GameState } from "../types";
import { ANSWER_KEYS, GAVEL_CARD, HEARING, isVerdict, PICK_PREFIX, type HearingTrigger } from "./pack";
import { freshHearing, stepHearing } from "./machine";
import type { HearingState } from "./state";

const R = HEARING.rules;
const OWNER = "hearing";
const CARD_IDS = HEARING.content.events.add.map((e) => e.id);

const newestFlag = (s: GameState, prefix: string) => {
  let newest = -1;
  for (const k in s.flags) if (k.startsWith(prefix) && s.flags[k]! > newest) newest = s.flags[k]!;
  return newest;
};
const statOf = (s: GameState, name: string) => STATS[name]?.(s, null) ?? 0;

/** Where each trigger stands today, so a pack switched on late does not answer for last year's news. */
function baseline(s: GameState, t: HearingTrigger): number {
  if (t.flagPrefix !== undefined) return newestFlag(s, t.flagPrefix);
  if (t.stat !== undefined) return t.rises ? statOf(s, t.stat) : statOf(s, t.stat) >= (t.atLeast ?? 0) ? 1 : 0;
  return 0;
}

const armCard = (id: string) => {
  const def = eventById(id)!;
  return initialStored(arcMachine, { choices: def.choices.length, cooldownDays: def.cooldown ?? 0, openedDay: null });
};

export function enableHearing(s: GameState) {
  if (!s.hearing) s.hearing = {
    enabled: true, rngState: (s.seed ^ 0x48524e47) >>> 0, machine: freshHearing(s.tick), enabledDay: s.day,
    seen: Object.fromEntries(R.triggers.map((t) => [t.id, baseline(s, t)])), history: [],
  };
  s.hearing.enabled = true;
  for (const id of CARD_IDS) s.arcs[id] ??= armCard(id);
}

/** Off: back to quiet, any hearing card closed. Meters stay where the hearings left them. */
export function disableHearing(s: GameState) {
  const h = s.hearing;
  if (!h) return;
  h.enabled = false;
  h.machine = freshHearing(s.tick);
  for (const key of [...ANSWER_KEYS, "leave"]) delete s.flags[PICK_PREFIX + key];
  for (const id of CARD_IDS) s.arcs[id] = armCard(id);
}

/** The first trigger that fired since the driver last looked, if its die agrees. Each one is reacted to once. */
function tripped(s: GameState, h: HearingState, rng: Rng): HearingTrigger | null {
  for (const t of R.triggers) {
    const was = h.seen[t.id];
    let fire = false;
    if (t.afterDays !== undefined) {
      fire = !was && s.day - h.enabledDay >= t.afterDays;
      if (fire) h.seen[t.id] = 1;
    } else if (t.flagPrefix !== undefined) {
      const newest = newestFlag(s, t.flagPrefix);
      fire = newest > (was ?? -1);
      h.seen[t.id] = Math.max(newest, was ?? -1);
    } else if (t.stat !== undefined) {
      const v = statOf(s, t.stat);
      if (t.rises) {
        fire = v > (was ?? v);
        h.seen[t.id] = v;
      } else {
        const over = v >= (t.atLeast ?? 0);
        fire = over && !was;
        h.seen[t.id] = over ? 1 : 0;
      }
    }
    if (fire && (t.chance === undefined || rng.next() < t.chance)) return t;
  }
  return null;
}

/** One question per senator, in the pack's order; nobody asks the same thing twice running if they have another. */
function rollDocket(h: HearingState, rng: Rng): string[] {
  const last = new Set(h.machine.context.docket);
  return R.senators.flatMap((sen) => {
    const mine = Object.keys(R.questions).filter((id) => R.questions[id]!.senator === sen.id);
    const fresh = mine.filter((id) => !last.has(id));
    const pool = fresh.length ? fresh : mine;
    return pool.length ? [rng.pick(pool)] : [];
  });
}

function send(s: GameState, rng: Rng, beat: Beat) {
  const h = s.hearing!;
  const before = h.machine.value;
  const result = stepHearing(h.machine, beat);
  h.machine = result.stored;
  for (const call of result.calls) runVerb({ state: s, rng, run: null, owner: OWNER }, { type: call.verb, params: call.params });
  const now = h.machine.value;
  if (now !== before && isVerdict(now)) {
    const c = h.machine.context;
    h.history.push({ day: s.day, topic: c.topic, trigger: c.trigger, verdict: now, trust: c.sessionTrust, capture: c.sessionCapture });
    if (h.history.length > 12) h.history.shift();
  }
}

/** Put a card on screen now (a hearing does not wait for midnight), if nothing else has it. */
function openCard(s: GameState, id: string) {
  const open = openEventOf(s);
  if (open) return;
  s.arcs[id] = step(arcMachine, armCard(id), { type: "DAY", day: s.day, ready: true, slotFree: true, pace: 1 }).stored;
}
/**
 * In session, the next question is the card on screen, once the card budget allows (FLT-54): each a
 * few days apart while the committee "recesses to review the testimony". The gavel follows the last answer: it is its result.
 */
function nextQuestion(s: GameState) {
  const c = s.hearing!.machine.context;
  const id = c.docket[c.answers.length];
  if (id && eventById(id) && cardAllowed(s, id, "chain")) openCard(s, id);
}

/** Picks arrive as flags from the card's choice; consumed at once, including while paused. */
export function applyHearingChoices(s: GameState) {
  const h = s.hearing;
  if (!h?.enabled) return;
  let picked = false;
  for (const key of [...ANSWER_KEYS, "leave"]) {
    if (s.flags[PICK_PREFIX + key] === undefined) continue;
    delete s.flags[PICK_PREFIX + key];
    picked = true;
    if (key === "leave") continue;
    const rng = createRng(h.rngState);
    const before = h.machine.value;
    send(s, rng, { type: "CHOSE", tick: s.tick, day: s.day, roll: 0, stats: {}, choice: key });
    h.rngState = rng.state();
    if (before === "inSession" && isVerdict(h.machine.value)) openCard(s, GAVEL_CARD);
  }
  // Another card may have had the screen when the session opened: the next question follows it at once.
  if (h.machine.value === "inSession" && (picked || !openEventOf(s))) nextQuestion(s);
}

export function dailyHearing(s: GameState) {
  const h = s.hearing;
  if (!h?.enabled) return;
  const rng = createRng(h.rngState);
  const beat: Beat = { type: "DAY", tick: s.tick, day: s.day, roll: 0, stats: { summons: 0 } };
  const trigger = h.machine.value === "quiet" ? tripped(s, h, rng) : null;
  if (trigger) {
    beat.stats.summons = 1;
    beat.data = { docket: rollDocket(h, rng), topic: fillTemplate(trigger.topic, { lab: s.labName }), trigger: trigger.id };
  }
  send(s, rng, beat);
  if (trigger && h.machine.value === "summoned") {
    const line = HEARING.content.headlines.add.find((l) => l.trigger === trigger.id);
    if (line) addNews(s, fillTemplate(line.text, { lab: s.labName }), line.tone);
  }
  if (h.machine.value === "inSession") nextQuestion(s);
  h.rngState = rng.state();
}

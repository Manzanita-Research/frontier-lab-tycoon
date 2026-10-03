// The Slop Bowl is late (FLT-109): the driver. At each campus noon it rolls whether the lab's lunch order is late (on
// its own stream); if it is, the machine walks it through the afternoon and the driver plays each beat it emits: the
// toasts and headlines, thought bubbles over the researchers waiting at the gate, the posts and the rival labs piling
// on, the Aura, the card (once the ladder has opened cards), the courier walking in with the bowls, and the research
// the hunger took (training.ts asks `lunchGain`) won back once everyone has eaten. Woken with the Bird App (Level 3,
// `PACKS` in progression.ts); `?slopbowl=off` keeps it asleep, and a Daily Drama pack can `flag.set` `slopbowl:late`.
import { TICKS_PER_DAY, THOUGHT_TICKS } from "../constants";
import { START_HOUR, CYCLE_TICKS, TICKS_PER_HOUR } from "../daylight";
import { cardAllowed, handled, openEventOf, pacerOf, screenHeld } from "../events";
import { fillTemplate } from "../format";
import { arcMachine } from "../machines/arc";
import { initialStored, step } from "../machines/run";
import { callMeeting } from "../meetings";
import { addNews, addToast } from "../news";
import { systemUnlocked } from "../progression";
import { createRng, type Rng } from "../rng";
import { nudgeAura, postNow } from "../birdapp/driver";
import { rivalPostNow } from "../birdapp/rivals";
import { runVerb } from "../verbs";
import { VIBES_MAX } from "../vibes";
import type { GameState, Walker } from "../types";
import { HOLDING, MEETING_HOLD, waitsForLunch } from "./crowd";
import { freshSlopBowl, stepSlopBowl } from "./machine";
import { CARD, PICK_PREFIX, PICKS, SLOPBOWL, type SlopBeat } from "./pack";
import type { SlopBowlState } from "./state";

const R = SLOPBOWL.rules;
const OWNER = "slopbowl";
/** A Daily Drama pack (or a test) sets this to make the next noon's order late, whatever the odds say. */
export const LATE_FLAG = "slopbowl:late";
/** Lunch is at noon on the campus clock. */
const DUE_HOUR = 12;
/** The tick of the first campus noon (the clock opens at START_HOUR); the next is a whole cycle later. */
const NOON = (DUE_HOUR - START_HOUR) * TICKS_PER_HOUR;
/** The machine is asked every half day while an order is out (the meltdown comes half way through day three). */
const BEAT_TICKS = TICKS_PER_DAY / 2;
export const isDue = (tick: number) => tick >= NOON && (tick - NOON) % CYCLE_TICKS === 0;
/** The bubbles stay up for most of a day, so each beat's lines replace the last's. */
const SAY_TICKS = Math.min(THOUGHT_TICKS, TICKS_PER_DAY - 2);

const onStaff = (w: Walker) => w.kind === "researcher" && w.machine.value !== "quitting" && w.machine.value !== "leaving" && w.machine.value !== "gone";
const armCard = () => initialStored(arcMachine, { choices: SLOPBOWL.content.events.add[0]!.choices.length, cooldownDays: SLOPBOWL.content.events.add[0]!.cooldown ?? 30, openedDay: null });

export function enableSlopBowl(s: GameState) {
  s.slopbowl ??= {
    enabled: true, rngState: (s.seed ^ 0x534c4f50) >>> 0, machine: freshSlopBowl(), wokeDay: s.day, lastDay: null,
    crowd: 0, owed: 0, courier: null, host: null, said: [], flopped: [], tally: { late: 0, lost: 0 },
  };
  s.slopbowl.enabled = true;
}

/** Per tick, and cheap: nothing to ask the machine on most ticks. */
export function updateSlopBowl(s: GameState) {
  const sb = s.slopbowl;
  if (!sb?.enabled) return;
  const value = sb.machine.value;
  let late = false;
  let delivered = false;
  if (value === "quiet") {
    if (!isDue(s.tick)) return;
    const rng = createRng(sb.rngState);
    late = s.flags[LATE_FLAG] !== undefined || (ready(s, sb) && rng.chance(R.odds.perNoon));
    sb.rngState = rng.state();
    if (!late) return;
  } else if (value === "arriving") {
    delivered = sb.courier === null || !(s.meetings ?? []).some((m) => m.guestId === sb.courier && m.owner === OWNER);
  } else if ((s.tick - sb.machine.context.due) % BEAT_TICKS !== 0) return;
  send(s, sb, { type: "TICK", tick: s.tick, late, delivered });
}

/** May today's order run late? Enough people to be hungry, the pack settled in, and a while since the last time. */
function ready(s: GameState, sb: SlopBowlState): boolean {
  if (s.day - sb.wokeDay < R.odds.firstAfterDays || (sb.lastDay !== null && s.day - sb.lastDay < R.odds.gapDays)) return false;
  let n = 0;
  for (const w of s.walkers) if (onStaff(w)) n++;
  return n >= R.odds.minResearchers;
}

function send(s: GameState, sb: SlopBowlState, event: Parameters<typeof stepSlopBowl>[1]) {
  const before = sb.machine.value;
  const { stored, effects } = stepSlopBowl(sb.machine, event);
  sb.machine = stored;
  // Lunch is over: everyone who ate at the gate goes back to work.
  if (before === "fed" && stored.value === "quiet") backToWork(s, sb);
  const rng = createRng(sb.rngState);
  for (const e of effects) play(s, sb, rng, e.beat as SlopBeat);
  sb.rngState = rng.state();
}

/** The player's answer on the card comes back as a flag (`slopbowl:pick:*`), paused or not. */
export function applySlopBowlChoices(s: GameState) {
  const sb = s.slopbowl;
  if (!sb?.enabled) return;
  for (const pick of PICKS) {
    const flag = PICK_PREFIX + pick;
    if (s.flags[flag] === undefined) continue;
    delete s.flags[flag];
    send(s, sb, { type: "CHOSE", pick });
  }
}

const CROWD: Partial<Record<SlopBeat, number>> = { late: R.crowd.late, hangry: R.crowd.hangry, worse: R.crowd.worse, meltdown: R.crowd.meltdown };

function play(s: GameState, sb: SlopBowlState, rng: Rng, beat: SlopBeat) {
  const b = R.beats[beat];
  const vars = { lab: s.labName, place: R.place };
  const say = (text: string) => fillTemplate(text, vars);
  if (beat === "late") {
    delete s.flags[LATE_FLAG];
    sb.lastDay = s.day;
    sb.tally.late++;
  }
  const crowd = CROWD[beat];
  if (crowd !== undefined) sb.crowd = crowd;
  // The card, once the ladder has opened cards; when it takes the screen it says what the toast would have.
  const carded = beat === "hangry" && offerCard(s);
  if (b.toast && !carded) addToast(s, say(b.toast.text), b.toast.tone, { source: "staff", importance: b.toast.importance });
  for (const line of sample(rng, b.news, 1)) addNews(s, say(line), "joke");
  if (b.aura) aura(s, b.aura);
  if (b.vibes) s.vibes.value = Math.max(0, Math.min(VIBES_MAX, s.vibes.value + b.vibes));
  if (b.beat) runVerb({ state: s, rng, run: null, owner: OWNER }, { type: "camera.beat", params: { ...b.beat, on: "gate" } });
  const waiting = s.walkers.filter((w) => onStaff(w) && waitsForLunch(s, w));
  if (beat === "meltdown") sb.flopped = sample(rng, waiting.map((w) => String(w.id)), R.flop).map(Number);
  if (beat === "arrive") courier(s, sb, rng, waiting);
  if (beat === "fed") fed(s, sb);
  think(s, sb, rng, b.thoughts, b.thoughtCount ?? 0, waiting.length > 0 ? waiting : s.walkers.filter(onStaff));
  for (const text of sample(rng, b.posts, b.postCount ?? 0)) {
    const by = waiting.length > 0 ? rng.pick(waiting).id : undefined;
    postNow(s, rng, { text: say(text), spice: b.spice ?? 0.5, by });
  }
  for (const text of sample(rng, b.rivals, b.rivalCount ?? 0)) rivalPostNow(s, rng, { text: say(text) });
}

/** Bird App Aura; while the Bird App is asleep, the Vibes take it (ten Vibes a point). */
function aura(s: GameState, amount: number) {
  if (!nudgeAura(s, amount)) s.vibes.value = Math.max(0, Math.min(VIBES_MAX, s.vibes.value + amount * 10));
}

/** `n` distinct lines from a pool, in the pack's stream. */
function sample(rng: Rng, pool: readonly string[] | undefined, n: number): string[] {
  const left = [...(pool ?? [])];
  const out: string[] = [];
  while (out.length < n && left.length > 0) out.push(left.splice(Math.floor(rng.next() * left.length), 1)[0]!);
  return out;
}

/** Bubbles over `n` of `who` (the ones at the gate, if any are), replacing the order's last ones. */
function think(s: GameState, sb: SlopBowlState, rng: Rng, pool: readonly string[] | undefined, n: number, who: readonly Walker[]) {
  if (!pool || n <= 0) return;
  const old = new Set(sb.said);
  s.thoughts = s.thoughts.filter((t) => !old.has(t.id));
  sb.said = [];
  const lines = sample(rng, pool, n);
  const people = [...who];
  for (const text of lines) {
    if (people.length === 0) break;
    const w = people.splice(Math.floor(rng.next() * people.length), 1)[0]!;
    s.thoughts = s.thoughts.filter((t) => t.walkerId !== w.id);
    const id = s.nextId++;
    s.thoughts.push({ id, walkerId: w.id, kind: "researcher", text, expiresTick: s.tick + SAY_TICKS });
    sb.said.push(id);
  }
}

/**
 * Put the card up now (a late lunch does not wait for midnight) if cards are open on the ladder and nothing else has the
 * screen. It is minor colour (FLT-54): when the budget is spent, or at 10×, the chief of staff waits it out for you and
 * the ticker says so. Returns whether it is on screen.
 */
export function offerCard(s: GameState, staged = false): boolean {
  if (!systemUnlocked(s, "events") || openEventOf(s) || screenHeld(s)) return false;
  // A staged review link (`?moment=slop-card`) puts it up whatever the budget says.
  const allowed = staged || (!pacerOf(s).context.auto && cardAllowed(s, CARD, "normal"));
  s.flags[`offer:${CARD}`] = s.day;
  s.arcs[CARD] = step(arcMachine, (staged ? undefined : s.arcs[CARD]) ?? armCard(), { type: "DAY", day: s.day, ready: true, slotFree: true, pace: 1 }).stored;
  if (openEventOf(s)?.id !== CARD) {
    delete s.flags[`offer:${CARD}`];
    return false;
  }
  if (allowed) return true;
  handled(s, CARD, 0);
  return false;
}

/** Three hours late: the courier walks in from the gate to the researcher nearest it, and hands the bowls over. */
function courier(s: GameState, sb: SlopBowlState, rng: Rng, waiting: readonly Walker[]) {
  const g = s.gate;
  const near = (w: Walker) => Math.abs(w.x - (g.x + g.w / 2)) + Math.abs(w.z - g.z);
  const free = new Set(["arriving", "seeking", "loitering", "wandering"]);
  const host = [...(waiting.length > 0 ? waiting : s.walkers.filter(onStaff))].filter((w) => free.has(w.machine.value)).sort((a, b) => near(a) - near(b) || a.id - b.id)[0];
  sb.courier = null;
  sb.host = null;
  if (!host) return;
  const c = R.courier;
  const m = callMeeting(s, rng, { owner: OWNER, hostId: host.id, role: c.role, at: "gate", hours: c.talkTicks * (24 / TICKS_PER_DAY), lines: c.lines.map((l) => fillTemplate(l, { lab: s.labName })) });
  if (!m) return;
  sb.courier = m.guestId;
  sb.host = host.id;
}

/** The bowls are handed out: everyone gets up off the floor and eats where they are, a little brighter, and the lab starts winning back the research. */
function fed(s: GameState, sb: SlopBowlState) {
  sb.flopped = [];
  sb.courier = null;
  sb.host = null;
  for (const w of s.walkers) {
    if (!onStaff(w)) continue;
    w.energy = Math.min(1, w.energy + R.cheer);
    w.focus = Math.min(1, w.focus + R.cheer);
  }
}

/** After lunch: whoever ate at the gate picks their next stop now (staggered, so they don't leave as one). */
function backToWork(s: GameState, sb: SlopBowlState) {
  sb.crowd = 0;
  for (const w of s.walkers) if (onStaff(w) && w.machine.value === "wandering" && w.timer >= HOLDING && w.timer < MEETING_HOLD) w.timer = 1 + (w.id % 6);
}


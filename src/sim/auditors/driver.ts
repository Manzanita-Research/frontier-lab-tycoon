// Evals Without Borders (FLT-19): the audit chart's driver. Its own random stream, so a lab that never sees an
// auditor draws exactly the numbers it did before. The chart hears a DAY beat every day and an INSPECTED beat each
// time the group finishes a stop; the visit itself (walking, dwelling) is the generic visitor-group engine's.
import { eventById } from "../../content/events";
import { TICKS_PER_DAY } from "../constants";
import { auditorOdds } from "../disasters/driver";
import { fillTemplate } from "../format";
import { groupsOf, sendGroupsHome } from "../groups";
import { arcMachine } from "../machines/arc";
import { initialStored } from "../machines/run";
import { addNews, addToast } from "../news";
import { eraOfState } from "../race/race";
import { shiftTrust } from "../race/leapfrog/ops";
import { createRng, type Rng } from "../rng";
import type { GameState, Tone, Walker } from "../types";
import { runVerb } from "../verbs";
import type { Call } from "../disasters/types";
import { activeSwarm } from "../collusion/state";
import { auditFacts, gradeReport, notesSince } from "./grade";
import { freshAudit, stepAudit, type AuditEvent } from "./machine";
import { AUDITORS, NOTICE_CARD, OWNER, PICK_PREFIX, PREP_CHOICES, REPORT_CARD, REPORT_CHOICES, type Grade, type Prep } from "./pack";

const R = AUDITORS.rules;
const HEADLINES = AUDITORS.content.headlines.add;
const THOUGHTS = AUDITORS.content.thoughts.add;
const COUNTDOWN_DAYS = 7;
const GRADE_TONE: Record<Grade, Tone> = { A: "good", B: "good", C: "neutral", D: "bad", F: "bad" };

const lines = (kind: string, when: string) => THOUGHTS.filter((t) => t.kind === kind && t.when === when);
const fill = (s: GameState, text: string, vars: Record<string, string> = {}) => fillTemplate(text, { lab: s.labName, ...vars });
function headline(s: GameState, trigger: string) {
  const h = HEADLINES.find((o) => o.trigger === trigger);
  if (h) addNews(s, fill(s, h.text), h.tone);
}

/** The ladder turns this on at the Scrutiny level. Baseline init and its RNG do not change. */
export function enableAuditors(s: GameState) {
  if (!s.auditors) s.auditors = {
    enabled: true, rngState: (s.seed ^ 0x45574221) >>> 0, machine: freshAudit(),
    report: null, frontPage: null, history: [], inspected: [], seenPhase: "", chatTick: 0,
  };
  s.auditors.enabled = true;
  // Older saves may predate the registered cards.
  for (const def of AUDITORS.content.events.add) s.arcs[def.id] ??= initialStored(arcMachine, { choices: def.choices.length, cooldownDays: def.cooldown ?? 14, openedDay: null });
}

export function disableAuditors(s: GameState) {
  if (!s.auditors) return;
  s.auditors.enabled = false;
  sendGroupsHome(s, OWNER);
  if (s.disguises) delete s.disguises.agent;
  for (const card of [NOTICE_CARD, REPORT_CARD]) {
    delete s.flags[`offer:${card}`];
    const def = eventById(card);
    if (def) s.arcs[card] = initialStored(arcMachine, { choices: def.choices.length, cooldownDays: def.cooldown ?? 14, openedDay: null });
  }
  for (const key of [...PREP_CHOICES, ...REPORT_CHOICES]) delete s.flags[PICK_PREFIX + key];
  s.auditors.machine = { ...freshAudit(), context: { ...freshAudit().context, lastVisit: s.auditors.machine.context.lastVisit, visits: s.auditors.machine.context.visits } };
}

/** Days until the auditors arrive (during the countdown), else null. */
export function daysUntilVisit(s: GameState): number | null {
  const m = s.auditors?.machine;
  if (!m || m.value !== "countdown") return null;
  return Math.max(0, COUNTDOWN_DAYS - Math.floor((s.tick - m.context.enteredTick) / TICKS_PER_DAY));
}

/** The report card: grades from what the lab is today and what the visit found; trust, heat and hype move. */
function publish(s: GameState, rng: Rng) {
  const a = s.auditors!;
  const ctx = a.machine.context;
  const { grades, average, overall, moves } = gradeReport(auditFacts(s, ctx), notesSince(s));
  const env = { state: s, rng, run: null, owner: OWNER };
  runVerb(env, { type: "trust.delta", params: { amount: moves.trust } });
  runVerb(env, { type: "heat.delta", params: { amount: moves.heat } });
  runVerb(env, { type: "hype.delta", params: { amount: moves.hype } });
  shiftTrust(s, moves.trust);
  const caught = ctx.caught > 0;
  const swarm = ctx.swarm > 0;
  const title = fill(s, R.frontPage[caught ? "caught" : swarm ? "swarm" : overall]);
  a.report = {
    day: s.day, visit: ctx.visits, prep: (ctx.prep || null) as Prep | null, grades, average, overall, caught, swarm,
    inspected: [...a.inspected], evals: ctx.evals > 0, moves, headline: title,
  };
  a.frontPage = { day: s.day, title, grade: overall };
  a.history.push({ day: s.day, overall, caught });
  addNews(s, `Frontier Times: ${title}`, caught || swarm ? "bad" : GRADE_TONE[overall]);
  // The rest of the industry reads it too (FLT-56): a rival has something to say about it.
  const said = HEADLINES.filter((h) => h.trigger === `rivals:${caught ? "caught" : overall}`);
  if (said.length) {
    const h = rng.pick(said);
    runVerb(env, { type: "news", params: { text: h.text, tone: h.tone } });
  }
}

/** For a while after a report, the visitors have heard about it (FLT-56). Draws nothing before the first report. */
function gradeTalk(s: GameState, rng: Rng) {
  const talk = R.gradeTalk;
  const last = s.auditors!.report;
  if (!talk || !last || s.day - last.day > talk.days || !rng.chance(talk.chance)) return;
  const pool = lines("visitor", `grade:${last.caught ? "caught" : last.overall}`);
  const visitors = s.walkers.filter((w) => w.kind === "visitor");
  if (!pool.length || !visitors.length || s.thoughts.length >= 6) return;
  const who = rng.pick(visitors);
  s.thoughts.push({ id: s.nextId++, walkerId: who.id, kind: "visitor", text: fill(s, rng.pick(pool).text, { grade: last.overall }), expiresTick: s.tick + TICKS_PER_DAY / 2 });
}

function send(s: GameState, rng: Rng, event: AuditEvent) {
  const a = s.auditors!;
  const previous = a.machine.value;
  const result = stepAudit(a.machine, event);
  a.machine = result.stored;
  for (const call of result.calls) runVerb({ state: s, rng, run: null, owner: OWNER }, { type: call.verb, params: call.params });
  if (previous === a.machine.value) return;
  if (a.machine.value === "visit") {
    a.inspected = [];
    a.seenPhase = "";
    a.chatTick = s.tick + 8;
    if (groupsOf(s, OWNER).length === 0) headline(s, "noShow");
  }
  if (a.machine.value === "report") publish(s, rng);
}

/** Consume the cards' pick flags right after chooseEvent, including picks made while paused. */
export function applyAuditorChoices(s: GameState) {
  const a = s.auditors;
  if (!a?.enabled) return;
  let rng: Rng | null = null;
  for (const choice of [...PREP_CHOICES, ...REPORT_CHOICES]) {
    if (s.flags[PICK_PREFIX + choice] === undefined) continue;
    delete s.flags[PICK_PREFIX + choice];
    send(s, (rng ??= createRng(a.rngState)), { type: "CHOSE", choice, day: s.day, tick: s.tick });
  }
  if (rng) a.rngState = rng.state();
}

/** Something since the last visit that makes an extra one likely: a disaster, signs of collusion, a hearing. */
function incidentSince(s: GameState, day: number): boolean {
  return s.disasters.lastStart > day || R.incidentFlags.some((f) => (s.flags[f] ?? -Infinity) > day);
}

function say(s: GameState, rng: Rng, who: { id: number; kind: Walker["kind"] }, pool: readonly { text: string }[], ticks: number) {
  if (pool.length === 0) return;
  s.thoughts = s.thoughts.filter((t) => t.expiresTick > s.tick);
  // The visit is the show: the oldest bubble on campus makes room.
  if (s.thoughts.length >= 3) s.thoughts.shift();
  s.thoughts.push({ id: s.nextId++, walkerId: who.id, kind: who.kind, text: fill(s, rng.pick(pool).text), expiresTick: s.tick + ticks });
}

export function dailyAuditors(s: GameState) {
  const a = s.auditors;
  if (!a?.enabled) return;
  const rng = createRng(a.rngState);
  const ctx = a.machine.context;
  if (a.machine.value === "visit" && s.day - ctx.visitDay >= R.schedule.maxVisitDays) sendGroupsHome(s, OWNER);
  send(s, rng, {
    type: "DAY", day: s.day, tick: s.tick, era: eraOfState(s), incident: incidentSince(s, ctx.lastVisit) ? 1 : 0,
    heat: s.disasters.heat, odds: auditorOdds(s), incidentRoll: rng.next(), jitterRoll: rng.next(),
    gone: groupsOf(s, OWNER).length === 0 ? 1 : 0,
  });
  // The week before: the staff talk about it, and the boxes talk back.
  const left = daysUntilVisit(s);
  if (left !== null) {
    if (left === 1) addToast(s, "Evals Without Borders arrive tomorrow. Somebody find the lanyards.");
    const prep = a.machine.context.prep;
    const agents = s.walkers.filter((w) => w.kind === "agent");
    const researchers = s.walkers.filter((w) => w.kind === "researcher");
    if (s.disguises?.agent && agents.length && rng.chance(0.5)) say(s, rng, rng.pick(agents), lines("agent", "box"), TICKS_PER_DAY * 2);
    else if (researchers.length) say(s, rng, rng.pick(researchers), lines("researcher", prep === "tidy" && rng.chance(0.5) ? "tidy" : "audit"), TICKS_PER_DAY * 2);
  }
  gradeTalk(s, rng);
  a.rngState = rng.state();
}

/** Per tick, only during a visit: finished stops reach the chart; the group chats, and the campus answers. */
export function updateAuditors(s: GameState) {
  const a = s.auditors;
  if (!a?.enabled || a.machine.value !== "visit") return;
  const groups = groupsOf(s, OWNER);
  let rng: Rng | null = null;
  const dice = () => (rng ??= createRng(a.rngState));
  for (const g of groups) {
    for (const d of g.done.splice(0)) {
      a.inspected.push(d.kind);
      send(s, dice(), { type: "INSPECTED", day: s.day, tick: s.tick, kind: d.kind, evals: d.evals, swarmActive: activeSwarm(s) ? 1 : 0, hideRoll: dice().next(), swarmRoll: dice().next() });
    }
    const phase = g.machine.value;
    if (phase !== a.seenPhase) {
      a.seenPhase = phase;
      if (phase === "evaluating") {
        headline(s, "evals");
        runVerb({ state: s, rng: dice(), run: null, owner: OWNER }, { type: "camera.focus", params: { on: "hall", zoom: 1.4, hold: 2.6 } });
      }
      if (phase === "huddling") {
        // FLT-56: the hold-your-breath beat before the report. They talk first, too.
        a.chatTick = s.tick;
        const at = g.route[0];
        const env = { state: s, rng: dice(), run: null, owner: OWNER, at: at ? ([at[0], at[1]] as [number, number]) : undefined };
        for (const c of R.huddle ?? []) runVerb(env, c as Call);
      }
      if (phase === "leaving") headline(s, "leave");
    }
    if (phase === "leaving" || s.tick < a.chatTick) continue;
    a.chatTick = s.tick + R.chat.everyTicks;
    const r = dice();
    const who = r.pick(g.members);
    const when = phase === "evaluating" ? "evals" : phase === "huddling" ? "huddle" : s.disguises?.agent && r.chance(0.4) ? "box" : "inspect";
    say(s, r, { id: who.id, kind: "visitor" }, lines("auditor", when), R.chat.everyTicks + 15);
    if (!r.chance(R.chat.replyChance)) continue;
    // Whoever is nearest answers: a researcher, or (in a box) an agent.
    let best: Walker | null = null;
    let bestD = 36;
    for (const w of s.walkers) {
      if (w.kind !== "researcher" && !(w.kind === "agent" && s.disguises?.agent)) continue;
      const d = (w.x - who.x) ** 2 + (w.z - who.z) ** 2;
      if (d < bestD) { bestD = d; best = w; }
    }
    if (best) say(s, r, best, best.kind === "agent" ? lines("agent", "box") : lines("researcher", a.machine.context.prep === "tidy" && r.chance(0.5) ? "tidy" : "audit"), R.chat.everyTicks + 15);
  }
  if (rng) a.rngState = (rng as Rng).state();
}

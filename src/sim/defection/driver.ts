// FLT-26 Defection. The chart (mods/base-defection) owns the beats and their words; this computes the hidden
// defect scores, picks who the VCs court, pre-rolls every die on the pack's own stream, and founds the spin-out.
import { THEIR } from "../../content/names";
import { THOUGHT_TICKS } from "../constants";
import { eventById } from "../../content/events";
import { dailyEvents } from "../events";
import { fillTemplate } from "../format";
import { arcMachine } from "../machines/arc";
import { compileChart, stepChart, type ChartEvent } from "../machines/packChart";
import { initialStored } from "../machines/run";
import { happinessOf } from "../needs";
import { addNews } from "../news";
import { foundNeoLab, neoLabById } from "../neolabs/driver";
import { eraOfState } from "../race/race";
import { refreshBoard } from "../race/arena";
import { shiftTrust } from "../race/leapfrog/ops";
import { createRng, type Rng } from "../rng";
import type { GameState, Walker } from "../types";
import { runVerb, type VerbEnv } from "../verbs";
import { CARD, CHOICES, DEFECTION, MANIFESTO_CARD, MANIFESTO_CHOICES, PICK_PREFIX } from "./pack";
import type { DefectionStage, DefectionState, DefectionSubject } from "./state";

const R = DEFECTION.rules;
const OWNER = "defection";
export const defectionMachine = compileChart(DEFECTION.chart);
const REASONS = DEFECTION.content.reasons.add;
const THOUGHTS = DEFECTION.content.thoughts.add;
const HEADLINES = DEFECTION.content.headlines.add;
const line = (when: string, rng: Rng) => rng.pick(THOUGHTS.filter((t) => t.when === when)).text;
const headline = (trigger: string, rng: Rng) => rng.pick(HEADLINES.filter((h) => h.trigger === trigger));

const onStaff = (w: Walker) => w.kind === "researcher" && w.machine.value !== "quitting" && w.machine.value !== "leaving" && w.machine.value !== "gone";
const researchers = (s: GameState) => s.walkers.filter(onStaff);
const byId = (s: GameState, id: number) => s.walkers.find((w) => w.id === id);

function registerCards(s: GameState) {
  for (const def of DEFECTION.content.events.add) s.arcs[def.id] ??= initialStored(arcMachine, { choices: def.choices.length, cooldownDays: def.cooldown ?? 0, openedDay: null });
}

/** The ladder (Level 5, Scrutiny) calls this; so do `?moment=defection-*` and the tests. */
export function enableDefection(s: GameState) {
  s.defection ??= {
    enabled: true, rngState: (s.seed ^ 0x44454654) >>> 0,
    machine: { value: "watching", context: { enteredTick: s.tick, enteredDay: s.day } },
    scores: {}, bumps: {}, passedOver: {}, seen: {}, models: s.models.length, resolved: -1000, subject: null, exit: null, history: [],
  };
  s.defection.enabled = true;
  registerCards(s);
}
export function disableDefection(s: GameState) {
  const d = s.defection;
  if (!d) return;
  d.enabled = false;
  d.subject = null;
  d.machine = { value: "watching", context: { enteredTick: s.tick, enteredDay: s.day } };
  s.meetings = (s.meetings ?? []).filter((m) => m.owner !== OWNER);
  for (const id of [CARD, MANIFESTO_CARD]) {
    delete s.flags[`offer:${id}`];
    const def = eventById(id);
    if (def) s.arcs[id] = initialStored(arcMachine, { choices: def.choices.length, cooldownDays: def.cooldown ?? 0, openedDay: null });
  }
  for (const key of [...CHOICES, ...MANIFESTO_CHOICES]) delete s.flags[PICK_PREFIX + key];
}

/** How long they have been here against the longest-serving researcher: the spec's "seniority", 0 to 1. */
function seniorityOf(s: GameState, w: Walker, staff: Walker[]): number {
  const first = Math.min(...staff.map((o) => o.stats.joined));
  const span = s.day - first;
  return span <= 0 ? 0 : Math.max(0, Math.min(1, (s.day - w.stats.joined) / span));
}

/** The hidden score's daily step for one researcher. Pure arithmetic, exported for the tests. */
export function scoreDelta(o: { happiness: number; seniority: number; passedOver: number; rivalHype: number; era: number; bumps: number }): number {
  const k = R.score;
  let delta = k.base + k.morale * (1 - o.happiness) + k.seniority * o.seniority + k.passedOver * o.passedOver + k.rivalHype * (o.rivalHype / 100) + (R.eras[o.era] ?? 0);
  if (o.happiness >= k.contentHappiness) delta -= k.contentDecay;
  return delta > 0 ? delta * (1 + k.bump * o.bumps) : delta;
}

/** The top candidates, highest score first. */
export function candidates(s: GameState): Walker[] {
  const d = s.defection;
  if (!d) return [];
  return researchers(s).filter((w) => (d.scores[w.id] ?? 0) > 0).sort((a, b) => (d.scores[b.id] ?? 0) - (d.scores[a.id] ?? 0) || a.id - b.id).slice(0, R.eligibility.candidates);
}

function updateScores(s: GameState) {
  const d = s.defection!;
  const staff = researchers(s);
  const live = new Set(staff.map((w) => w.id));
  for (const key of Object.keys(d.scores)) if (!live.has(Number(key))) delete d.scores[Number(key)];
  if (staff.length < R.eligibility.minResearchers) return;
  // A release ships and the most senior candidate is not on the byline: everyone else in the top three is passed over.
  if (s.models.length > d.models) {
    const top = candidates(s);
    const senior = [...top].sort((a, b) => a.stats.joined - b.stats.joined || a.id - b.id)[0];
    for (const w of top) if (w !== senior) d.passedOver[w.id] = (d.passedOver[w.id] ?? 0) + 1;
  }
  d.models = s.models.length;
  const rivalHype = Math.max(0, ...s.race.rivals.map((r) => r.context.hype));
  const era = eraOfState(s);
  for (const w of staff) {
    if (s.day - w.stats.joined < R.eligibility.minTenureDays) continue;
    const delta = scoreDelta({ happiness: happinessOf(w), seniority: seniorityOf(s, w, staff), passedOver: d.passedOver[w.id] ?? 0, rivalHype, era, bumps: d.bumps[w.id] ?? 0 });
    // The VCs' attention is its own push.
    const courted = d.subject?.id === w.id && d.machine.value === "courted" ? R.score.courtBoost : 0;
    d.scores[w.id] = Math.max(0, Math.min(100, (d.scores[w.id] ?? 0) + delta + courted));
  }
}

function subjectFor(s: GameState, w: Walker, rng: Rng): DefectionSubject {
  const staff = researchers(s);
  const team = staff.filter((o) => o.id !== w.id)
    .sort((a, b) => Math.abs(a.stats.joined - w.stats.joined) - Math.abs(b.stats.joined - w.stats.joined) || a.id - b.id)
    .slice(0, R.exit.maxFollowers + 1).map((o) => o.id);
  return { id: w.id, name: w.name, role: w.role, pro: w.pro, reason: rng.pick(REASONS).id, team, seniority: seniorityOf(s, w, staff), since: s.day };
}

/** Who walks out with them: the least happy of the people they worked with, as many as the die says. */
function followersOf(s: GameState, subject: DefectionSubject, roll: number, loud: boolean): number[] {
  const n = R.exit.minFollowers + Math.floor(roll * (R.exit.maxFollowers - R.exit.minFollowers + 1)) + (loud ? 1 : 0);
  const team = subject.team.map((id) => byId(s, id)).filter((w): w is Walker => !!w && onStaff(w));
  const pool = team.filter((w) => happinessOf(w) < R.exit.followerHappiness);
  // Nobody unhappy enough still means one loyal follower: somebody always goes with them.
  return (pool.length ? pool : team.slice(0, 1)).slice(0, Math.min(n, R.exit.maxFollowers)).map((w) => w.id);
}

const listNames = (names: string[]) => names.length <= 1 ? (names[0] ?? "nobody") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
const oddsText = (p: number) => (p <= 0.55 ? "a coin flip" : p >= 0.85 ? "it usually works" : "it probably works");

/** Template variables for the cards, news and verbs (`raceVars` spreads these in). */
export function defectionVars(s: GameState): Record<string, string> {
  const d = s.defection;
  const out: Record<string, string> = {};
  if (!d) return out;
  const sub = d.subject;
  if (sub) {
    const reason = REASONS.find((r) => r.id === sub.reason);
    const team = sub.team.filter((id) => { const w = byId(s, id); return !!w && onStaff(w) && happinessOf(w) < R.exit.followerHappiness; }).length;
    Object.assign(out, {
      defName: sub.name, defTheir: THEIR[sub.pro] ?? "their", defRole: sub.role, defReason: reason?.text ?? "",
      defTitleOdds: oddsText(reason?.titleOdds ?? 0.5),
      defFollowers: team >= 2 ? `${team} of ${THEIR[sub.pro] ?? "their"} team are rumoured to be going too.` : team === 1 ? "One of the team is rumoured to be going too." : "The team seems settled. For now.",
    });
  }
  const x = d.exit;
  const lab = x?.lab ? neoLabById(s, x.lab) : undefined;
  if (x && lab) Object.assign(out, {
    neoName: lab.name, neoFounder: x.founder, neoManifesto: lab.manifesto, neoFollowerCount: String(x.followers.length + 1),
    neoFollowers: x.followers.length ? listNames(x.followers) : "nobody else",
  });
  return out;
}

function send(s: GameState, rng: Rng, event: ChartEvent, people: { meet?: number[]; cheer?: number[]; quit?: number[] }, vars: Record<string, string>) {
  const d = s.defection!;
  const previous = d.machine.value;
  const { stored, calls } = stepChart<DefectionStage>(defectionMachine, d.machine, event);
  d.machine = stored;
  for (const call of calls) {
    const who = call.verb === "people.meet" ? people.meet : call.verb === "people.cheer" ? people.cheer : call.verb === "people.quit" ? people.quit : undefined;
    const env: VerbEnv = { state: s, rng, run: null, owner: OWNER, people: who, vars };
    if (call.verb === "people.meet") {
      // Each call is a fresh visit, so fresh lines.
      env.vars = { ...vars, vcLine: line("vc", rng), defLine: d.subject ? line(d.subject.reason, rng) : "" };
      if (d.subject) d.seen[d.subject.id] = (d.seen[d.subject.id] ?? 0) + 1;
    }
    runVerb(env, { type: call.verb, params: call.params });
  }
  if (previous !== d.machine.value) d.history.push({ day: s.day, stage: d.machine.value, name: d.subject?.name ?? d.exit?.founder ?? "" });
  return { previous, next: d.machine.value };
}

const statsFor = (s: GameState, d: DefectionState, extra: Record<string, number> = {}): Record<string, number> => {
  const sub = d.subject;
  const w = sub ? byId(s, sub.id) : undefined;
  const score = sub ? (d.scores[sub.id] ?? 0) : 0;
  const since = s.day - (sub?.since ?? s.day);
  const meeting = (s.meetings ?? []).some((m) => m.owner === OWNER);
  return {
    subjectGone: sub && (!w || !onStaff(w)) ? 1 : 0,
    cooled: sub && score < R.thresholds.coolScore ? 1 : 0,
    // The warning signs always get their days on screen, however high the score already is.
    cardReady: sub && score >= R.thresholds.cardScore && since >= R.signs.minWarnDays ? 1 : 0,
    meetDue: sub && since > 0 && since % R.signs.meetEveryDays === 0 && !meeting ? 1 : 0,
    rested: s.day - d.machine.context.enteredDay >= R.exit.restDays ? 1 : 0,
    ...extra,
  };
};

/** Once a day: the scores move, the VCs pick someone, the warning signs play, the chart takes its beat. */
export function dailyDefection(s: GameState) {
  const d = s.defection;
  if (!d?.enabled) return;
  const rng = createRng(d.rngState);
  updateScores(s);
  let courtReady = 0;
  if (d.machine.value === "watching") {
    const top = candidates(s)[0];
    if (top && (d.scores[top.id] ?? 0) >= R.thresholds.courtScore && researchers(s).length >= R.eligibility.minResearchers && s.day - d.resolved >= R.signs.gapDays) {
      d.subject = subjectFor(s, top, rng);
      courtReady = 1;
    }
  }
  const sub = d.subject;
  const { previous, next } = send(s, rng, { type: "DAY", day: s.day, tick: s.tick, stats: statsFor(s, d, { courtReady }) }, { meet: sub ? [sub.id] : [] }, defectionVars(s));
  if (next === "courted" && previous === "watching") {
    const h = headline("courted", rng);
    addNews(s, fillTemplate(h.text, { lab: s.labName }), h.tone);
  } else if (previous === "courted" && next === "watching") {
    d.subject = null;
    d.resolved = s.day;
  }
  else if (previous === "watching" && next === "watching") d.subject = null;
  // The warning signs: readable, not certain.
  if (d.machine.value === "courted" && d.subject) {
    const since = s.day - d.subject.since;
    if (since === R.signs.headlineDay) {
      const h = headline("domain", rng);
      addNews(s, fillTemplate(h.text, { lab: s.labName }), h.tone);
    }
    if (since > 0 && since % R.signs.thoughtEveryDays === 0) {
      think(s, d.subject.id, "researcher", line(d.subject.reason, rng));
      const mate = d.subject.team.map((id) => byId(s, id)).find((w) => !!w && onStaff(w) && happinessOf(w) < R.exit.followerHappiness);
      if (mate) think(s, mate.id, "researcher", fillTemplate(line("follower", rng), { defName: d.subject.name }));
    }
  }
  d.rngState = rng.state();
}

function think(s: GameState, walkerId: number, kind: Walker["kind"], text: string) {
  s.thoughts = s.thoughts.filter((t) => t.walkerId !== walkerId);
  s.thoughts.push({ id: s.nextId++, walkerId, kind, text, expiresTick: s.tick + THOUGHT_TICKS });
}

/** Consume the card's picks right after chooseEvent (paused or not). */
export function applyDefectionChoices(s: GameState) {
  const d = s.defection;
  if (!d?.enabled) return;
  const rng = createRng(d.rngState);
  for (const choice of CHOICES) {
    if (s.flags[PICK_PREFIX + choice] === undefined) continue;
    delete s.flags[PICK_PREFIX + choice];
    const sub = d.subject;
    if (!sub || d.machine.value !== "deciding") continue;
    // Dice first, in a fixed order, whatever the pick.
    const titleRoll = rng.next();
    const followerRoll = rng.next();
    const reason = REASONS.find((r) => r.id === sub.reason);
    const titleWorks = titleRoll < (reason?.titleOdds ?? 0.5) ? 1 : 0;
    const loud = choice === "title" && !titleWorks;
    const followers = followersOf(s, sub, followerRoll, loud);
    const team = sub.team.filter((id) => { const w = byId(s, id); return !!w && onStaff(w); });
    const { next } = send(s, rng, { type: "CHOSE", choice, day: s.day, tick: s.tick, stats: statsFor(s, d, { titleWorks }) },
      { meet: [sub.id], cheer: [sub.id, ...team], quit: [sub.id, ...followers] }, defectionVars(s));
    d.resolved = s.day;
    if (next === "watching") {
      d.scores[sub.id] = 0;
      if (choice === "counter") d.bumps[sub.id] = (d.bumps[sub.id] ?? 0) + 1;
      if (choice === "title") { const w = byId(s, sub.id); if (w) w.role = "Head of Safety"; }
      d.subject = null;
    } else if (next === "farewell" || next === "storming") {
      const loss = R.exit.minLoss + (R.exit.maxLoss - R.exit.minLoss) * sub.seniority;
      s.capability = Math.max(0, s.capability * (1 - loss / 100));
      d.exit = {
        day: s.day, founderId: sub.id, founder: sub.name, pro: sub.pro, followerIds: followers,
        followers: followers.map((id) => byId(s, id)?.name ?? ""), mood: next === "farewell" ? "friendly" : "hostile", loss, lab: null,
      };
      delete d.scores[sub.id];
      for (const id of followers) delete d.scores[id];
      d.subject = null;
      refreshBoard(s);
    }
  }
  const x = d.exit;
  const lab = x?.lab ? neoLabById(s, x.lab) : undefined;
  for (const choice of MANIFESTO_CHOICES) {
    if (s.flags[PICK_PREFIX + choice] === undefined) continue;
    delete s.flags[PICK_PREFIX + choice];
    if (!lab) continue;
    if (choice === "congratulate") {
      s.hype = Math.min(100, s.hype + 2);
      const ctx = lab.rival.context;
      lab.rival = { ...lab.rival, context: { ...ctx, personality: { ...ctx.personality, poaching: ctx.personality.poaching / 2 } } };
    } else if (choice === "vaguepost") {
      s.hype = Math.min(100, s.hype + 4);
      shiftTrust(s, -3);
      lab.nemesis = true;
    }
    const h = headline(choice, rng);
    addNews(s, fillTemplate(h.text, { lab: s.labName, neoName: lab.name }), h.tone);
  }
  d.rngState = rng.state();
}

/** Per tick, cheap: once the founder is through the gate (or two days on), the new lab goes live. */
export function updateDefection(s: GameState) {
  const x = s.defection?.exit;
  if (!s.defection?.enabled || !x || x.lab) return;
  if (s.walkers.some((w) => w.id === x.founderId) && s.day - x.day < 2) return;
  const friendly = x.mood === "friendly";
  const lab = foundNeoLab(s, {
    founder: { id: x.founderId, name: x.founder }, followers: x.followers, origin: "defection", mood: x.mood,
    names: DEFECTION.names[x.mood], manifestos: DEFECTION.manifestos[x.mood],
    capability: s.capability * R.spinout.startShare * (friendly ? 1 : R.spinout.hostileBoost), hype: R.spinout.startHype,
    personality: R.personality[x.mood], lines: DEFECTION.content.neoLines,
  });
  x.lab = lab.id;
  const rng = createRng(s.defection.rngState);
  const h = headline(friendly ? "foundedFriendly" : "founded", rng);
  s.defection.rngState = rng.state();
  addNews(s, fillTemplate(h.text, { lab: s.labName, neoName: lab.name, neoFollowerCount: String(x.followers.length + 1) }), h.tone);
  s.flags[`offer:${MANIFESTO_CARD}`] = s.day;
  dailyEvents(s);
}

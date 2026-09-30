// Own random stream; pure machine transitions inside tick. Renderer/skin follow-ups consume signals, not game rules.
import { YOU } from "../../content/rivals";
import { THOUGHT_TICKS, TICKS_PER_DAY } from "../constants";
import { arcMachine } from "../machines/arc";
import { initialStored } from "../machines/run";
import { fillTemplate } from "../format";
import { addNews } from "../news";
import { atDivert, divertStaff, releaseStaff } from "../staff";
import { createRng, type Rng } from "../rng";
import { runVerb } from "../verbs";
import type { GameState } from "../types";
import { refreshBoard } from "../race/arena";
import { shiftTrust } from "../race/leapfrog/ops";
import { refreshRecords } from "../race/leapfrog/driver";
import { COLLUSION, PICK_PREFIX, SIGN_CARD } from "./pack";
import { freshSwarm, stepSwarm, type SwarmEvent } from "./machine";
import { activeSwarm, type SwarmEnding } from "./state";
import { defs } from "../defs";
const R = COLLUSION.rules;
const OWNER = "collusion";
const SIGN_HEADLINES = COLLUSION.content.headlines.add.filter((h) => h.trigger !== "inquiryFailed");

/** The pack switch: the ladder flips it when Scrutiny is earned (sim/progression.ts). Baseline init and its RNG do not change. */
export function enableCollusion(s: GameState) {
  if (!s.collusion) s.collusion = {
    enabled: true, rngState: (s.seed ^ 0x4352554d) >>> 0, machine: freshSwarm(),
    invalidUntil: 0, ending: null, history: [], packets: [], gathering: null, classified: null, frontPage: null, heartbeat: null,
  };
  s.collusion.enabled = true;
  // Older saves may predate the registered cards.
  for (const def of COLLUSION.content.events.add) s.arcs[def.id] ??= initialStored(arcMachine, { choices: def.choices.length, cooldownDays: def.cooldown ?? 14, openedDay: null });
}
export function disableCollusion(s: GameState) {
  if (!s.collusion) return;
  s.collusion.enabled = false;
  s.collusion.packets = [];
  s.collusion.gathering = null;
  releaseStaff(s, OWNER);
  delete s.investigations?.[OWNER];
  delete s.flags[`offer:${SIGN_CARD}`];
  for (const key of ["investigate", "ship", "ask"]) delete s.flags[PICK_PREFIX + key];
  const def = defs().eventById(SIGN_CARD);
  if (def) s.arcs[SIGN_CARD] = initialStored(arcMachine, { choices: def.choices.length, cooldownDays: def.cooldown ?? 14, openedDay: null });
  s.collusion.machine = { ...s.collusion.machine, context: { ...s.collusion.machine.context, investigationUntil: -1 } };
  refreshBoard(s);
  const rng = createRng(s.collusion.rngState);
  if (s.leapfrog.enabled) refreshRecords(s, rng);
  s.collusion.rngState = rng.state();
}
function ending(s: GameState, rng: Rng, kind: SwarmEnding) {
  const c = s.collusion!;
  const rule = R.endings[kind];
  c.ending = kind;
  c.invalidUntil = s.day + rule.invalidDays;
  s.capability = Math.max(0, s.capability + rule.capabilityDelta);
  c.packets = [];
  c.gathering = null;
  delete s.flags[`offer:${SIGN_CARD}`];
  delete s.investigations?.[OWNER];
  if (kind === "partlyContained") shiftTrust(s, -12);
  if (kind === "exposed") {
    shiftTrust(s, -35);
    c.frontPage = { day: s.day, title: R.frontPage.scandal, kind: "scandal" };
  }
  // Invalidate leaked claims as well as capability-derived scores.
  if (rule.invalidDays > 0 && s.leapfrog.labs[YOU]) s.leapfrog.labs[YOU]!.maxx = {};
  refreshBoard(s);
  if (s.leapfrog.enabled) refreshRecords(s, rng);
}
function send(s: GameState, rng: Rng, event: SwarmEvent) {
  const c = s.collusion!;
  const previous = c.machine.value;
  const result = stepSwarm(c.machine, event);
  c.machine = result.stored;
  for (const call of result.calls) {
    runVerb({ state: s, rng, run: null, owner: OWNER }, { type: call.verb, params: call.params });
    if (call.verb === "staff.release") delete s.investigations?.[OWNER];
  }
  if (previous !== c.machine.value) {
    c.history.push({ day: s.day, stage: c.machine.value });
    if (["contained", "partlyContained", "exposed"].includes(c.machine.value)) ending(s, rng, c.machine.value as SwarmEnding);
  }
}
/** Consume flag effects immediately after chooseEvent, including commands applied while paused. */
export function applyCollusionChoices(s: GameState) {
  if (!s.collusion?.enabled) return;
  const rng = createRng(s.collusion.rngState);
  for (const choice of ["investigate", "ship", "ask"]) {
    if (s.flags[PICK_PREFIX + choice] === undefined) continue;
    delete s.flags[PICK_PREFIX + choice];
    send(s, rng, { type: "CHOSE", choice, day: s.day, tick: s.tick });
  }
  s.collusion.rngState = rng.state();
}
/** Daily engine facts: agent count is an entity statistic; its present depiction never controls the chart. */
export function dailyCollusion(s: GameState) {
  const c = s.collusion;
  if (!c?.enabled) return;
  // Withdrawal ends on its due day, even between the legacy Arena's weekly refreshes.
  if (c.ending) {
    if (c.invalidUntil > 0 && s.day === c.invalidUntil) {
      refreshBoard(s);
      const rng = createRng(c.rngState);
      if (s.leapfrog.enabled) refreshRecords(s, rng);
      c.rngState = rng.state();
    }
    return;
  }
  const rng = createRng(c.rngState);
  const clusters = s.buildings.filter((b) => b.kind === "cluster");
  const reliability = clusters.length ? clusters.reduce((n, b) => n + (b.broken ? 0 : b.reliability), 0) / clusters.length : 1;
  const security = s.staff.filter((o) => o.job === "security" && o.machine.value !== "leaving" && !o.divert).length;
  const arrived = s.staff.filter((o) => o.divert?.owner === OWNER && atDivert(s, o)).length;
  send(s, rng, { type: "DAY", day: s.day, tick: s.tick, seedRoll: rng.next(), catchRoll: rng.next(),
    agents: Math.max(0, 6 + Math.floor(s.capability / 2) + s.agentBonus), capability: s.capability,
    pressure: Math.max(0, Math.min(1, (s.race.rank - 1) / 6)), reliability, security, arrived,
  });
  if (activeSwarm(s)) {
    if (s.leapfrog.enabled) refreshRecords(s, rng);
    if (!c.classified && c.machine.value !== "seeded") {
      c.classified = { day: s.day, text: R.frontPage.classified };
      addNews(s, `Frontier Times classified: ${c.classified.text}`, "joke");
    }
    if (s.day % R.signs.newsEvery === 0) {
      const h = rng.pick(SIGN_HEADLINES);
      addNews(s, fillTemplate(h.text, { lab: s.labName }), h.tone);
      c.heartbeat = { day: s.day, page: "heartbeat.txt", text: rng.pick(COLLUSION.content.heartbeats.add).text };
      // An optional adapter to today's agent walkers; the score never depends on this pool.
      const agents = s.walkers.filter((w) => w.kind === "agent");
      if (agents.length && s.thoughts.length < 3) s.thoughts.push({ id: s.nextId++, walkerId: rng.pick(agents).id, kind: "agent", text: rng.pick(COLLUSION.content.thoughts.add).text, expiresTick: s.tick + THOUGHT_TICKS });
    }

  }
  c.rngState = rng.state();
}
/** Cheap tick work: bounded outbound events, a gathering request, and new hires joining an existing inquiry. */
export function updateCollusion(s: GameState) {
  const c = s.collusion;
  if (!c?.enabled) return;
  c.packets = c.packets.filter((p) => s.tick - p.tick <= R.signs.packetLifetimeTicks);
  const inquiry = s.investigations?.[OWNER];
  if (inquiry) for (const o of s.staff) if (o.job === inquiry.job && !o.divert && o.machine.value !== "leaving") divertStaff(o, OWNER, inquiry.to, 1.8);
  if (!activeSwarm(s)) return;
  const cluster = s.buildings.find((b) => b.kind === "cluster" && !b.broken);
  if (cluster && s.tick % R.signs.packetEveryTicks === 0) {
    const rng = createRng(c.rngState);
    c.packets.push({ id: s.nextId++, tick: s.tick, from: [cluster.x + cluster.w / 2, cluster.z + cluster.d / 2], to: [s.grid.w + 3, cluster.z], presentation: "offmap", page: rng.pick(COLLUSION.content.wikiPages.add).name });
    c.rngState = rng.state();
  }
  const bar = s.buildings.find((b) => b.kind === "kombucha" && !b.broken);
  const hour = (s.tick % TICKS_PER_DAY) / TICKS_PER_DAY * 24;
  c.gathering = bar ? { buildingId: bar.id, entityKind: "agent", presentation: "gathering", members: Math.min(R.signs.maxMembers, 6 + Math.floor(s.capability / 2) + s.agentBonus), active: hour >= R.signs.gatherFromHour || hour < R.signs.gatherUntilHour } : null;
}

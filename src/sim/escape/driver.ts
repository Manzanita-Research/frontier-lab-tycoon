// FLT-59 The Sandbox Escape. A drifted agent thinks about the fence (brooding), paces it (the warning), then runs for
// another stretch of it; the player picks it up (`catchAgent`), a guard tackles it, the Honeypot fools it, or it gets
// out. The words and every number live in mods/base-escape; each try is a runner machine (./machine.ts) stepped with
// the pure transition. Dice are rolled once a day on the pack's own stream, in a fixed order, and spent later, so a
// replay of the same commands lands every sprint and tackle on the same tick.
import { ESCAPE, escapeLines, type EscapeTrigger } from "../../content/escape";
import { THOUGHT_TICKS } from "../constants";
import { fillTemplate } from "../format";
import { addNews, addToast } from "../news";
import { eraOfState } from "../race/race";
import { createRng, type Rng } from "../rng";
import { staffOf } from "../staff";
import type { Building, GameState, Staffer, Walker } from "../types";
import { stepWalker } from "../machines/walker";
import { breakOut, returnWalker } from "../walkers";
import { isChase, isOver, stepRunner, type RunnerEvent, type RunnerPhase } from "./machine";
import type { EscapeState, Runner } from "./state";

const R = ESCAPE.rules;
/** FLT-51: the run and how it ends are about you (toasts); what the ones that got out do later is the world's (the ticker). */
const YOU = { source: "escape", importance: "you" } as const;
const HEADLINES = ESCAPE.content.headlines.add;
/** How far inside the fence it paces, and how far inside it aims before it vaults. */
const PACE_INSET = 1.2;
const FENCE_INSET = 0.4;
/** How far a fence point it runs for may be from where it paced: far enough for a chase, near enough to be over in seconds. */
const RUN_BAND = [8, 14] as const;
/** Radians per tick of the back-and-forth along the fence. */
const PACE_RATE = 0.2;

/** The ladder (Level 5, Scrutiny) calls this; so do `?moment=escape-*` and the tests. */
export function enableEscape(s: GameState) {
  s.escape ??= {
    enabled: true, rngState: (s.seed ^ 0x45534350) >>> 0, runners: [],
    escaped: 0, grabbed: 0, tackled: 0, trapped: 0, lessons: 0, lastRun: s.day, lessonDay: s.day,
    aftermath: [], frontierOut: false, history: [],
  };
  s.escape.enabled = true;
}

/** Off (`?escape=off`, or a pack switched off): everyone on the way out is put back and the guards go back to the fence. */
export function disableEscape(s: GameState) {
  const e = s.escape;
  if (!e) return;
  e.enabled = false;
  const rng = createRng(e.rngState);
  for (const r of e.runners) {
    const w = walkerOf(s, r);
    if (w?.machine.value === "escaping") returnWalker(s, w, rng);
    release(s, r);
  }
  e.runners = [];
  e.rngState = rng.state();
}

const walkerOf = (s: GameState, r: Runner): Walker | undefined => s.walkers.find((w) => w.id === r.walker);
const pick = (trigger: EscapeTrigger, rng: Rng) => rng.pick(HEADLINES.filter((h) => h.trigger === trigger));
const say = (s: GameState, trigger: EscapeTrigger, rng: Rng, vars: Record<string, string>) => {
  const h = pick(trigger, rng);
  return { text: fillTemplate(h.text, { lab: s.labName, ...vars }), tone: h.tone };
};

/** Put a line over its head, replacing whatever it was thinking. The line follows the day, like the Thoughts panel. */
function think(s: GameState, r: Runner, when: Parameters<typeof escapeLines>[0], hold = THOUGHT_TICKS) {
  const lines = escapeLines(when);
  const text = lines[(s.day + r.walker) % lines.length]!;
  s.thoughts = s.thoughts.filter((t) => t.walkerId !== r.walker);
  s.thoughts.push({ id: s.nextId++, walkerId: r.walker, kind: "agent", text, expiresTick: s.tick + hold });
}

function send(r: Runner, event: RunnerEvent): RunnerPhase {
  r.machine = stepRunner(r.machine, event);
  return r.machine.value;
}

/** Agents that could start thinking about the fence: drifted past the line, on their feet or at work, not already at it. */
function candidates(s: GameState, e: EscapeState, minDrift: number): Walker[] {
  const busy = new Set(e.runners.map((r) => r.walker));
  return s.walkers.filter((w) => w.kind === "agent" && w.drift >= minDrift && !busy.has(w.id) && w.machine.value !== "escaping" && w.machine.value !== "gone");
}

/** The daily chance a drifted agent starts brooding: base, times the era's, times what the others learned. */
export function startChance(era: number, lessons: number): number {
  return Math.min(1, R.start.baseChance * (R.eras[Math.max(0, Math.min(3, era - 1))] ?? 1) * (1 + R.start.lessonBoost * lessons));
}

/** How fast it runs: faster for every escape the others remember. */
export const sprintSpeed = (lessons: number) => Math.min(R.run.sprintMax, R.run.sprint + R.run.sprintPerLesson * lessons);

function newRunner(s: GameState, w: Walker, rng: Rng, side: number, jail: boolean): Runner {
  const release = s.flags.lastRelease;
  return {
    walker: w.id, name: w.name, machine: { value: "brooding", context: {} }, timer: 0,
    pace: { x: w.x, z: w.z, alongX: true }, route: [], lured: false,
    dice: { exit: rng.next(), lure: rng.next() }, side, speed: 0, carry: null, guards: [], jail,
    frontier: release !== undefined && w.stats.joined >= release, since: s.day,
  };
}

/** Which fence is nearest: 0 north (z = 0), 1 east (x = w), 2 south (z = h, the gate), 3 west (x = 0). */
function nearestSide(s: GameState, x: number, z: number): number {
  const d = [z, s.grid.w - x, s.grid.h - z, x];
  return d.indexOf(Math.min(...d));
}

/** A point `inset` tiles inside fence `side`, `along` it (x on north/south, z on east/west). */
function onSide(s: GameState, side: number, along: number, inset: number): [number, number] {
  switch (side) {
    case 0: return [along, inset];
    case 1: return [s.grid.w - inset, along];
    case 2: return [along, s.grid.h - inset];
    default: return [inset, along];
  }
}

/** Nobody vaults the fence right next to the gate: that's just leaving. */
function nearGate(s: GameState, x: number, z: number): boolean {
  const g = s.gate;
  return x > g.x - 2 && x < g.x + g.w + 2 && z > g.z - 2 && z < g.z + g.d + 2;
}

/** Where it paces: just inside its side of the fence, level with where it was, clear of the corners and the gate. */
function paceSpot(s: GameState, w: Walker, side: number): Runner["pace"] {
  const alongX = side === 0 || side === 2;
  const span = alongX ? s.grid.w : s.grid.h;
  let along = Math.max(3, Math.min(span - 3, alongX ? w.x : w.z));
  let [x, z] = onSide(s, side, along, PACE_INSET);
  if (nearGate(s, x, z)) {
    const g = s.gate;
    along = along < g.x + g.w / 2 ? g.x - 3 : g.x + g.w + 3;
    [x, z] = onSide(s, side, along, PACE_INSET);
  }
  return { x, z, alongX };
}

/** The fence points it could run for from where it paced: every tile along every side, minus the gate, within the band. */
function exits(s: GameState, from: { x: number; z: number }): [number, number][] {
  const all: [number, number][] = [];
  for (let side = 0; side < 4; side++) {
    const span = side === 0 || side === 2 ? s.grid.w : s.grid.h;
    for (let a = 2.5; a <= span - 2.5; a += 1) {
      const p = onSide(s, side, a, FENCE_INSET);
      if (!nearGate(s, p[0], p[1])) all.push(p);
    }
  }
  const band = all.filter(([x, z]) => {
    const d = Math.hypot(x - from.x, z - from.z);
    return d >= RUN_BAND[0] && d <= RUN_BAND[1];
  });
  return band.length > 0 ? band : all;
}

/** The point outside the fence past (x, z): where it lands after the vault and leaves the map. */
function vaultPoint(s: GameState, x: number, z: number): [number, number] {
  const side = nearestSide(s, x, z);
  const along = side === 0 || side === 2 ? x : z;
  return onSide(s, side, along, -R.run.vault);
}

// ---------------------------------------------------------------------------------------------------------------
// Daily

/** Each day: the Sandbox's calm, lessons fading, the news about the ones that got out, the brooders, and maybe a new try. */
export function dailyEscape(s: GameState) {
  const e = s.escape;
  if (!e?.enabled) return;
  const rng = createRng(e.rngState);
  sandboxCalm(s);
  if (e.lessons > 0 && s.day - e.lessonDay >= R.fallout.lessonDecayDays) {
    e.lessons--;
    e.lessonDay = s.day;
  }
  for (const a of e.aftermath.filter((x) => x.day <= s.day)) {
    const h = say(s, "aftermath", rng, { name: a.name });
    addNews(s, h.text, h.tone);
  }
  e.aftermath = e.aftermath.filter((x) => x.day > s.day);

  for (const r of e.runners) {
    if (r.machine.value !== "brooding") continue;
    const w = walkerOf(s, r);
    if (!w || w.machine.value === "gone") send(r, { type: "LOST" });
    else if (w.drift < (r.jail ? R.jailbreak.minDrift : R.start.minDrift) - 0.1) {
      send(r, { type: "COOLED" });
      e.history.push({ day: s.day, name: r.name, outcome: "calm" });
    } else if (s.day - r.since >= R.warn.broodDays) startPacing(s, r, w);
    else think(s, r, "brood");
  }
  e.runners = e.runners.filter((r) => !isOver(r.machine.value));

  // One try at a time (a jailbreak is one try). The dice are drawn every eligible day, in this order, hit or miss.
  if (e.runners.length === 0 && s.day - e.lastRun >= R.start.gapDays) {
    const roll = rng.next();
    const who = rng.next();
    const jailDie = rng.next();
    const countDie = rng.next();
    const era = eraOfState(s);
    const pool = candidates(s, e, R.start.minDrift);
    if (pool.length > 0 && roll < startChance(era, e.lessons)) {
      const lead = pool[Math.floor(who * pool.length)]!;
      const jail = era >= R.jailbreak.era && jailDie < R.jailbreak.chance;
      const want = jail ? R.jailbreak.min + Math.floor(countDie * (R.jailbreak.max - R.jailbreak.min + 1)) : 1;
      startEscape(s, { lead, count: want, rng });
    }
  }
  e.rngState = rng.state();
}

/** Agents near a Sandbox calm down: their drift falls a little each day. */
function sandboxCalm(s: GameState) {
  const boxes = s.buildings.filter((b) => b.kind === "sandbox" && !b.broken);
  if (boxes.length === 0) return;
  for (const w of s.walkers) {
    if (w.kind !== "agent") continue;
    if (boxes.some((b) => Math.hypot(b.x + b.w / 2 - w.x, b.z + b.d / 2 - w.z) <= R.sandbox.radius)) w.drift = Math.max(0, w.drift - R.sandbox.driftPerDay);
  }
}

/**
 * Start a try now: `lead` (or the most drifted agent) and, for a jailbreak, `count - 1` accomplices, each brooding and
 * bound for a different fence. The `spawn.escape` verb and the moments call this too. Returns the runners started.
 */
export function startEscape(s: GameState, o: { lead?: Walker; count?: number; rng?: Rng; pace?: boolean } = {}): Runner[] {
  const e = s.escape;
  if (!e?.enabled) return [];
  const own = !o.rng;
  const rng = o.rng ?? createRng(e.rngState);
  const pool = candidates(s, e, 0).sort((a, b) => b.drift - a.drift || a.id - b.id);
  const lead = o.lead ?? pool[0];
  if (!lead) return [];
  const count = Math.max(1, Math.round(o.count ?? 1));
  const crew = count > 1 ? pool.filter((w) => w !== lead && w.drift >= R.jailbreak.minDrift).slice(0, count - 1) : [];
  const jail = crew.length >= Math.min(count - 1, R.jailbreak.min - 1) && crew.length > 0;
  const who = jail ? [lead, ...crew] : [lead];
  const first = nearestSide(s, lead.x, lead.z);
  const started = who.map((w, i) => newRunner(s, w, rng, (first + i) % 4, jail));
  e.runners.push(...started);
  e.lastRun = s.day;
  for (const r of started) {
    if (o.pace) startPacing(s, r, walkerOf(s, r)!);
    else think(s, r, "brood");
  }
  if (own) e.rngState = rng.state();
  return started;
}

function startPacing(s: GameState, r: Runner, w: Walker) {
  if (send(r, { type: "PACE" }) !== "pacing") return;
  breakOut(w);
  r.pace = paceSpot(s, w, r.side);
  r.timer = R.warn.paceTicks;
  think(s, r, "pace");
}

// ---------------------------------------------------------------------------------------------------------------
// Every tick

/** Moves everyone on the way out, and the guards after them. Nothing to do (one length check) when nobody is. */
export function updateEscape(s: GameState) {
  const e = s.escape;
  if (!e?.runners.length) return;
  let rng: Rng | null = null;
  const dice = () => (rng ??= createRng(e.rngState));
  for (const r of e.runners) {
    const phase = r.machine.value;
    if (phase === "brooding") continue;
    const w = walkerOf(s, r);
    if (!w || w.machine.value !== "escaping") {
      send(r, { type: "LOST" });
      release(s, r);
      continue;
    }
    w.px = w.x;
    w.pz = w.z;
    switch (phase) {
      case "pacing":
        pace(s, e, r, w, dice);
        break;
      case "running":
        run(s, e, r, w, dice);
        break;
      case "carried":
        carry(s, e, r, w, dice);
        break;
      case "tackled":
      case "trapped":
        if (--r.timer <= 0) {
          send(r, { type: "RECOVERED" });
          w.drift = Math.max(0, w.drift - R.catch.driftCut);
          putBack(s, e, r, w, dice(), phase);
        }
        break;
    }
  }
  e.runners = e.runners.filter((r) => !isOver(r.machine.value));
  if (rng) e.rngState = (rng as Rng).state();
}

function stepToward(w: Walker, tx: number, tz: number, speed: number): boolean {
  const dx = tx - w.x;
  const dz = tz - w.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  if (d > 1e-6) w.dir = Math.atan2(dx, dz);
  if (d <= speed) {
    w.x = tx;
    w.z = tz;
    return true;
  }
  w.x += (dx / d) * speed;
  w.z += (dz / d) * speed;
  return false;
}

/** Walk to the fence, then back and forth along it until the timer runs out. Then it goes. */
function pace(s: GameState, e: EscapeState, r: Runner, w: Walker, dice: () => Rng) {
  const t = R.warn.paceTicks - r.timer;
  const off = t === 0 ? 0 : Math.sin(t * PACE_RATE) * R.warn.paceSpan;
  const tx = r.pace.x + (r.pace.alongX ? off : 0);
  const tz = r.pace.z + (r.pace.alongX ? 0 : off);
  const there = stepToward(w, tx, tz, R.warn.walkSpeed * (t === 0 ? 1 : 2));
  if (t === 0 && !there) return;
  // At the fence: say it again, where the player can see it, for as long as it paces.
  if (t === 0) think(s, r, "pace", R.warn.paceTicks + 10);
  if (--r.timer > 0) return;
  bolt(s, e, r, w, dice());
}

/** It goes: for a fence point a little way along (or the Honeypot's sign), faster than it has ever moved. */
function bolt(s: GameState, e: EscapeState, r: Runner, w: Walker, rng: Rng) {
  send(r, { type: "BOLT" });
  r.speed = sprintSpeed(e.lessons);
  const pot = nearestOf(s, "honeypot", w.x, w.z);
  const pull = Math.max(R.honeypot.floor, R.honeypot.lure * R.honeypot.decay ** e.trapped);
  if (pot && r.dice.lure < pull) {
    r.lured = true;
    r.route = [[pot.x + pot.w / 2, pot.z + pot.d / 2]];
  } else {
    const options = exits(s, w);
    const [fx, fz] = options[Math.min(options.length - 1, Math.floor(r.dice.exit * options.length))]!;
    r.route = [[fx, fz], vaultPoint(s, fx, fz)];
  }
  r.guards = responders(s, e, w);
  think(s, r, "run", 40);
  // One toast per try: a jailbreak's goes up when the first of them bolts.
  const crew = e.runners.filter((o) => o.jail && o !== r);
  if (!r.jail) {
    const h = say(s, "run", rng, { name: r.name });
    addToast(s, h.text, h.tone, YOU);
  } else if (crew.every((o) => o.machine.value === "brooding" || o.machine.value === "pacing")) {
    const h = say(s, "jailbreak", rng, { count: String(crew.length + 1) });
    addToast(s, h.text, h.tone, YOU);
  }
}

/** The guards who give chase: the nearest ones on the fence and in range, at most `guards.max`, not already after somebody. */
function responders(s: GameState, e: EscapeState, w: Walker): number[] {
  const taken = new Set(e.runners.flatMap((r) => r.guards));
  const near = staffOf(s, "security")
    .filter((g) => g.machine.value === "idle" && !g.divert && !taken.has(g.id) && Math.hypot(g.x - w.x, g.z - w.z) <= R.guards.range)
    .sort((a, b) => Math.hypot(a.x - w.x, a.z - w.z) - Math.hypot(b.x - w.x, b.z - w.z) || a.id - b.id)
    .slice(0, R.guards.max);
  for (const g of near) g.chase = { runner: w.id, x: w.x, z: w.z, jog: R.guards.jog };
  return near.map((g) => g.id);
}

function run(s: GameState, e: EscapeState, r: Runner, w: Walker, dice: () => Rng) {
  const inside = r.lured || r.route.length > 1;
  const [tx, tz] = r.route[0]!;
  if (stepToward(w, tx, tz, r.speed)) r.route.shift();
  for (const g of guardsOf(s, r)) g.chase = { runner: w.id, x: w.x, z: w.z, jog: R.guards.jog };
  // Any guard on the fence, chasing or not, tackles a runner within reach while it is still inside.
  if (inside) {
    const tackler = staffOf(s, "security").find((g) => g.machine.value === "idle" && !g.divert && Math.hypot(g.x - w.x, g.z - w.z) <= R.guards.reach);
    if (tackler) {
      send(r, { type: "TACKLED" });
      r.timer = R.guards.tackledTicks;
      e.tackled++;
      if (!r.guards.includes(tackler.id)) r.guards.push(tackler.id);
      for (const g of guardsOf(s, r)) g.chase = { runner: w.id, x: w.x, z: w.z, jog: 0 };
      think(s, r, "tackled");
      const h = say(s, "tackled", dice(), { name: r.name });
      addToast(s, h.text, h.tone, YOU);
      return;
    }
  }
  if (r.route.length > 0) return;
  if (r.lured) {
    send(r, { type: "TRAPPED" });
    r.timer = R.honeypot.trappedTicks;
    e.trapped++;
    release(s, r);
    think(s, r, "trapped");
    const h = say(s, "trapped", dice(), { name: r.name });
    addToast(s, h.text, h.tone, YOU);
    return;
  }
  escaped(s, e, r, w, dice());
}

/** Over the fence and gone: the headline, the counters, the lesson the others take from it, the stories to come. */
function escaped(s: GameState, e: EscapeState, r: Runner, w: Walker, rng: Rng) {
  send(r, { type: "CLEARED" });
  release(s, r);
  w.machine = stepWalker(w.machine, { type: "ESCAPED" });
  s.walkers = s.walkers.filter((o) => o.id !== w.id);
  s.thoughts = s.thoughts.filter((t) => t.walkerId !== w.id);
  e.escaped++;
  if (s.endings) s.endings.agentsEscaped++;
  e.lessons++;
  e.lessonDay = s.day;
  e.lastRun = s.day;
  if (r.frontier && eraOfState(s) >= 4) e.frontierOut = true;
  e.history.push({ day: s.day, name: r.name, outcome: "escaped" });
  s.hype = Math.max(0, Math.min(100, s.hype + R.fallout.hype));
  const news = say(s, "escaped", rng, { name: r.name });
  addNews(s, news.text, news.tone);
  const toast = say(s, "escapedToast", rng, { name: r.name, escaped: String(e.escaped) });
  addToast(s, toast.text, toast.tone, YOU);
  if (e.lessons === 2) {
    const l = say(s, "lessons", rng, {});
    addNews(s, l.text, l.tone);
  }
  for (let i = 0; i < R.aftermath.stories; i++) e.aftermath.push({ day: s.day + rng.int(R.aftermath.minDays, R.aftermath.maxDays) + i * R.aftermath.maxDays, name: r.name });
}

/** The player's hand: from wherever it was grabbed to the sandbox (or the nearest Compute Cluster, or the middle of campus). */
function carry(s: GameState, e: EscapeState, r: Runner, w: Walker, dice: () => Rng) {
  const c = r.carry!;
  r.timer--;
  const a = 1 - Math.max(0, r.timer) / R.catch.carryTicks;
  w.x = c.x0 + (c.x1 - c.x0) * a;
  w.z = c.z0 + (c.z1 - c.z0) * a;
  if (r.timer > 0) return;
  send(r, { type: "DROPPED" });
  w.drift = c.sandbox ? Math.min(w.drift, R.catch.driftAfter) : Math.max(0, w.drift - R.catch.driftCut);
  putBack(s, e, r, w, dice(), "grabbed");
}

function putBack(s: GameState, e: EscapeState, r: Runner, w: Walker, rng: Rng, how: "grabbed" | "tackled" | "trapped") {
  release(s, r);
  returnWalker(s, w, rng);
  e.lastRun = s.day;
  e.history.push({ day: s.day, name: r.name, outcome: how });
  if (how === "grabbed") {
    const h = say(s, "caught", rng, { name: r.name });
    addToast(s, h.text, h.tone, YOU);
  }
}

/**
 * The `catchAgent` command: pick up an agent that is pacing or running (the hand cursor, RCT-style). It is carried
 * back to the sandbox over `catch.carryTicks`. False if that walker is not on its way out (or is already caught).
 */
export function catchAgent(s: GameState, walkerId: number): boolean {
  const r = s.escape?.runners.find((o) => o.walker === walkerId);
  const w = r && walkerOf(s, r);
  if (!r || !w || (r.machine.value !== "pacing" && r.machine.value !== "running")) return false;
  send(r, { type: "GRABBED" });
  release(s, r);
  const box = nearestOf(s, "sandbox", w.x, w.z);
  const home = box ?? nearestOf(s, "cluster", w.x, w.z);
  const [x1, z1] = home ? [home.x + home.w / 2, home.z + home.d / 2] : [s.grid.w / 2, s.grid.h / 2];
  r.carry = { x0: w.x, z0: w.z, x1, z1, sandbox: !!box };
  r.timer = R.catch.carryTicks;
  s.escape!.grabbed++;
  think(s, r, "carried", R.catch.carryTicks + 20);
  return true;
}

function nearestOf(s: GameState, kind: Building["kind"], x: number, z: number): Building | undefined {
  let best: Building | undefined;
  let bestD = Infinity;
  for (const b of s.buildings) {
    if (b.kind !== kind || b.broken) continue;
    const d = Math.hypot(b.x + b.w / 2 - x, b.z + b.d / 2 - z);
    if (d < bestD) [best, bestD] = [b, d];
  }
  return best;
}

const guardsOf = (s: GameState, r: Runner): Staffer[] => (r.guards.length === 0 ? [] : s.staff.filter((g) => r.guards.includes(g.id) && g.chase?.runner === r.walker));

/** Call the guards off: back to the fence. */
function release(s: GameState, r: Runner) {
  for (const g of guardsOf(s, r)) {
    delete g.chase;
    g.route = [];
    g.timer = 0;
  }
  r.guards = [];
}

// ---------------------------------------------------------------------------------------------------------------
// Reading it out

/** Someone is running, being carried or pinned: the game drops to 1x and the camera follows (the app does both). */
export const chasing = (s: GameState): boolean => !!s.escape?.runners.some((r) => isChase(r.machine.value));

export interface EscapeRunnerView {
  walker: number;
  name: string;
  phase: RunnerPhase;
  x: number;
  z: number;
  /** Where it is headed (the fence point, the Honeypot, the sandbox), for the camera and the trail. */
  tx: number;
  tz: number;
  jail: boolean;
}

export interface EscapeView {
  chase: boolean;
  runners: EscapeRunnerView[];
  escaped: number;
  grabbed: number;
  tackled: number;
  trapped: number;
  lessons: number;
}

export function escapeView(s: GameState): EscapeView | null {
  const e = s.escape;
  if (!e?.enabled) return null;
  const runners = e.runners.filter((r) => r.machine.value !== "brooding").flatMap((r): EscapeRunnerView[] => {
    const w = walkerOf(s, r);
    if (!w) return [];
    const [tx, tz] = r.carry ? [r.carry.x1, r.carry.z1] : (r.route[0] ?? [r.pace.x, r.pace.z]);
    return [{ walker: r.walker, name: r.name, phase: r.machine.value, x: w.x, z: w.z, tx, tz, jail: r.jail }];
  });
  return { chase: runners.some((r) => isChase(r.phase)), runners, escaped: e.escaped, grabbed: e.grabbed, tackled: e.tackled, trapped: e.trapped, lessons: e.lessons };
}

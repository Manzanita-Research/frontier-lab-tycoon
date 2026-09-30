// Fixture inputs for the view-model and for the skin render tests: real snapshots of a real (seeded) World, plus the
// UI state a moment needs. Deterministic: the same call gives the same JSON.
import { makeSnapshot, type Snapshot } from "../../app/hud";
import { frontPage, recap, type Edition } from "../../newsroom/edition";
import { createTestCampus } from "../../sim/testkit";
import { enableLeapfrog } from "../../sim/race/leapfrog/driver";
import { stageCircus, type CircusMoment } from "../../sim/circus/demo";
import { leapfrogView } from "../../sim/race/leapfrog/view";
import { answer, layPaths, readyForPressure } from "../../sim/testkit";
import { stageAudit, type AuditMoment } from "../../sim/auditors/demo";
import { applyNow, tick } from "../../sim/tick";
import { triggerDisaster } from "../../sim/disasters/driver";
import type { GameState } from "../../sim/types";
import { newMotion, stepMotion, type MotionView } from "./leapfrogMotion";
import type { SkinPickerVM } from "./types";
import type { HudInput } from "./vm";
import { playableFixture } from "./previewLadder";
import { stagePapers } from "../../sim/race/papers/demo";
import { stageCollusion } from "../../sim/collusion/demo";
import { createInitialState } from "../../sim/state";
import { stageDrama, type DramaMoment } from "../../sim/defection/demo";

/** A busy campus a few game days in, with thoughts, a crowd and a run in flight (the real opening is quieter: see `openingWorld`). */
export function fixtureWorld(days = 12, seed = 3): GameState {
  const s = createTestCampus(seed);
  for (let i = 0; i < days * 20; i++) tick(s);
  return s;
}

/**
 * A campus with Release Leapfrog on, 48 days in: a few launches and records on the board, a news cycle with a history.
 * Returns the World and the real-time flourishes a HUD would have gathered watching it (flashing rows, a retired
 * benchmark still on the board), stepped day by day the way the app does.
 */
export function fixtureLeapfrog(days = 48, seed = 3): { world: GameState; motion: MotionView } {
  const s = createTestCampus(seed);
  enableLeapfrog(s);
  const m = newMotion();
  let now = 0;
  let view: MotionView = stepMotion(m, leapfrogView(s), s.day, now);
  for (let i = 0; i < days * 20; i++) {
    tick(s, answer(s));
    if (i % 20 === 19) {
      now += 200;
      view = stepMotion(m, leapfrogView(s), s.day, now);
    }
  }
  const lf = leapfrogView(s);
  // A solved benchmark that the sim has already retired, still up for its moment: the first column, struck through.
  const first = lf.benchmarks[0];
  if (first) {
    const cells = Object.fromEntries(lf.rows.map((r) => [r.id, { score: r.scores[0] ?? null, sota: r.sota[0] ?? false, maxx: false }]));
    view = { ...view, ghosts: [{ column: { ...first, id: `${first.id}-retired`, status: "saturated" }, cells, until: now + 20_000 }] };
  }
  return { world: s, motion: view };
}

/**
 * A lab mid-disaster (FLT-32): a Rogue Agent Swarm, its card answered, Security at the Security Office pulling the plug
 * (so the gate is unguarded), a weights leak lifting a rival on the Arena, and trust and heat moved off their start.
 */
export function fixtureDisaster(seed = 3): GameState {
  const s = fixtureWorld(12, seed);
  readyForPressure(s);
  s.cash = 50_000_000;
  applyNow(s, [{ type: "hire", job: "security" }, { type: "hire", job: "security" }, { type: "hire", job: "sre" }]);
  for (let i = 0; i < 40; i++) tick(s);
  triggerDisaster(s, "rogueSwarm");
  triggerDisaster(s, "weightsLeak");
  for (let i = 0; i < 1200 && !s.disasters.runs.some((r) => r.id === "rogueSwarm" && r.machine.value.startsWith("cleanup") && r.machine.context.progress > 0.2); i++) tick(s, answer(s));
  return s;
}

/** The busy campus with The Hearing or the yacht summit staged on it: the card that moment wants is on screen. */
export function fixtureCircus(moment: CircusMoment, seed = 3): GameState {
  const s = fixtureWorld(12, seed);
  stageCircus(s, moment);
  return s;
}

/** A lab staged at one of Defection's or the Poaching War's moments (the VC chat, a card, the exit, the new rival). */
export function fixtureDrama(moment: DramaMoment, seed = 7): GameState {
  const s = createInitialState(seed);
  delete s.progression;
  delete s.coach;
  delete s.tutorial;
  stageDrama(s, moment);
  return s;
}

/**
 * Evals Without Borders (FLT-19) on a small campus: a staged moment, through the same chart, cards and ticks as play.
 * "audit-countdown" answers the warning card with Prep, so the sign stands over the gate.
 */
export function fixtureAudit(moment: AuditMoment | "audit-countdown", seed = 3): GameState {
  const s = createTestCampus(seed);
  layPaths(s);
  readyForPressure(s);
  s.tick = s.day * 20;
  stageAudit(s, moment === "audit-countdown" ? "audit-notice" : moment);
  if (moment === "audit-countdown") applyNow(s, answer(s));
  return s;
}

export const NO_SKINS: SkinPickerVM = {
  open: false,
  reducedMotion: false,
  active: "frontier-95",
  original: null,
  list: [
    { id: "frontier-95", name: "Frontier 95", author: "Frontier Lab Tycoon", description: "The lab as a 1995 desktop.", version: "1.0.0", preview: "" },
    { id: "homepage-98", name: "Homepage '98", author: "Frontier Lab Tycoon", description: "The lab's home page.", version: "1.0.0", preview: "" },
  ],
  rejected: [],
};

const STORIES = [
  { id: 701, day: 27, kind: "release" as const, text: "Mostly Harmless Compute releases Frontier-4.5; benchmarks up, sleep down" },
  { id: 702, day: 26, kind: "protest" as const, text: "Protesters chant 'H2O LIES'; a passing pigeon joins in" },
  { id: 703, day: 25, kind: "rival" as const, text: "Open-ish AI drops free weights on launch day. Again." },
  { id: 704, day: 24, kind: "money" as const, text: "CFO says 'runway is a state of mind'" },
];
export const FIXTURE_PAPER = frontPage(STORIES, 28, "Mostly Harmless Compute");
export const FIXTURE_CHAT = recap(STORIES, 30, "Mostly Harmless Compute");

export interface FixtureOptions {
  /** Playable v1: put the snapshot on this rung of the ladder (absent: everything is earned). */
  level?: 1 | 2 | 3 | 4 | 5;
  /** Which of the seven coach lines is up (0-based), or none. */
  coach?: number | null;
  /** The "New!" card is up. */
  unlock?: boolean;
  world?: GameState;
  /** An Evals Without Borders moment (the world comes from `fixtureAudit`). */
  audit?: AuditMoment | "audit-countdown";
  /** Release Leapfrog on, 48 days in, with its leaderboard, news cycle and history. */
  leapfrog?: boolean;
  /** The Hearing (a question, or the gavel) or the yacht summit (the invitation, or the leaked chat) on screen. */
  circus?: CircusMoment;
  selected?: number | null;
  event?: string | null;
  tool?: string | null;
  view?: "archive" | Edition | null;
  chatCount?: number;
  photo?: boolean;
  staff?: boolean;
  outcome?: "won" | "lost" | null;
  /** A spend waiting for a yes or a no. */
  confirm?: boolean;
  /** Help ▸ How to play is open. */
  help?: boolean;
  /** Standing warnings. */
  warnings?: string[];
  /** Papers staged as the review moments are (`?moment=paper-*`); "panel" is the scoop's World with the Papers window open. */
  papers?: "drop" | "scoop" | "award" | "panel";
  /** Agent collusion staged as its review moments are (`?moment=collusion-*`); "sign" opens the card. */
  collusion?: "sign" | "traffic" | "scandal";
  /** Mid-disaster (see `fixtureDisaster`). */
  disaster?: boolean;
  /** The Disasters menu is open. */
  disastersOpen?: boolean;
  width?: number;
  height?: number;
  skins?: Partial<SkinPickerVM>;
}

/** A World with a papers or collusion moment staged on it, through the same code the `?moment=` links use. */
export function fixtureStaged(o: Pick<FixtureOptions, "papers" | "collusion">): GameState {
  const w = createTestCampus(3);
  if (o.papers) stagePapers(w, o.papers === "panel" ? "paper-scoop" : `paper-${o.papers}`);
  if (o.collusion) stageCollusion(w, `collusion-${o.collusion}`);
  return w;
}

export function fixtureSnapshot(o: FixtureOptions = {}): Snapshot {
  const w = o.world ?? (o.audit ? fixtureAudit(o.audit) : o.leapfrog ? fixtureLeapfrog().world : o.papers || o.collusion ? fixtureStaged(o) : o.disaster ? fixtureDisaster() : o.circus ? fixtureCircus(o.circus) : fixtureWorld());
  const selected = o.selected === undefined ? (w.walkers.find((x) => x.kind === "researcher")?.id ?? null) : o.selected;
  const snap = makeSnapshot(w, undefined, { selected, follow: false, highlight: null });
  const pendingConfirm = o.confirm
    ? { kind: "hire" as const, cost: 4_000, runwayAfter: 1.8, message: "This leaves 1.8 months of runway. The board will have questions.", command: { type: "hire" as const, job: "sre" as const } }
    : snap.pendingConfirm;
  const ladder = o.level ? playableFixture(o.level, o.coach ?? null, o.unlock ?? false) : {};
  return { ...snap, ...ladder, event: o.event ? { id: o.event, day: snap.day } : snap.event, outcome: o.outcome ?? snap.outcome, pendingConfirm, warnings: o.warnings ?? snap.warnings };
}

export function fixtureInput(o: FixtureOptions = {}): HudInput {
  const lf = o.leapfrog ? fixtureLeapfrog() : null;
  const snap = fixtureSnapshot(lf ? { ...o, world: lf.world } : o);
  return {
    snap,
    speed: 1,
    tool: (o.tool ?? null) as HudInput["tool"],
    follow: false,
    highlight: null,
    toasts: [
      { id: 1, text: "Frontier-2 is out! Launch week: +$70K", tone: "good" },
      { id: 2, text: "Hugo Stochastic handed in the box and left.", tone: "bad" },
    ],
    news: [
      { id: 1, day: 3, text: "Mostly Harmless Compute opens its doors with $5M in seed money", tone: "neutral" },
      { id: 2, day: 4, text: "Interns told not to touch the big red button, or the green one", tone: "joke" },
    ],
    outcomeDismissed: false,
    tapHint: true,
    toldGateway: false,
    staffOpen: o.staff ?? false,
    zone: null,
    arena: { open: true, alert: false, flinch: false, moved: {} },
    room: {
      archive: [FIXTURE_PAPER, FIXTURE_CHAT],
      view: o.view ?? null,
      unread: [FIXTURE_PAPER.id],
      storage: true,
    },
    chatCount: o.chatCount ?? 2,
    helpOpen: o.help ?? false,
    papersOpen: o.papers === "panel",
    dismissed: [],
    disastersOpen: o.disastersOpen ?? false,
    mixer: { open: false, ready: true, muted: false, master: 0.7, music: 0.3, sfx: 0.65 },
    photo: { on: o.photo ?? false, time: "live", shot: { id: 1, url: "data:image/png;base64,", name: "frontier-lab-tycoon-campus.png" }, flash: 1 },
    skins: { ...NO_SKINS, ...o.skins },
    leapfrog: lf?.motion,
    viewport: { width: o.width ?? 1440, height: o.height ?? 900 },
  };
}

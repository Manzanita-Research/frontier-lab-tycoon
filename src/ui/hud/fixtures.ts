// Fixture inputs for the view-model and for the skin render tests: real snapshots of a real (seeded) World, plus the
// UI state a moment needs. Deterministic: the same call gives the same JSON.
import { makeSnapshot, type Snapshot } from "../../app/hud";
import { frontPage, recap, type Edition } from "../../newsroom/edition";
import { enableLeapfrog } from "../../sim/race/leapfrog/driver";
import { leapfrogView } from "../../sim/race/leapfrog/view";
import { createInitialState } from "../../sim/state";
import { answer } from "../../sim/testkit";
import { tick } from "../../sim/tick";
import type { GameState } from "../../sim/types";
import { newMotion, stepMotion, type MotionView } from "./leapfrogMotion";
import type { SkinPickerVM } from "./types";
import type { HudInput } from "./vm";

/** A campus a few game days in, with thoughts, a crowd and a first release on the books. */
export function fixtureWorld(days = 12, seed = 3): GameState {
  const s = createInitialState(seed);
  for (let i = 0; i < days * 20; i++) tick(s);
  return s;
}

/**
 * A campus with Release Leapfrog on, 48 days in: a few launches and records on the board, a news cycle with a history.
 * Returns the World and the real-time flourishes a HUD would have gathered watching it (flashing rows, a retired
 * benchmark still on the board), stepped day by day the way the app does.
 */
export function fixtureLeapfrog(days = 48, seed = 3): { world: GameState; motion: MotionView } {
  const s = createInitialState(seed);
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

export const NO_SKINS: SkinPickerVM = {
  open: false,
  reducedMotion: false,
  active: "frontier-95",
  original: null,
  list: [
    { id: "frontier-95", name: "Frontier 95", author: "Frontier Lab Tycoon", description: "The lab as a 1995 desktop.", version: "1.0.0", preview: "" },
    { id: "geocities", name: "GeoCities", author: "Frontier Lab Tycoon", description: "The lab's home page.", version: "1.0.0", preview: "" },
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
  world?: GameState;
  /** Release Leapfrog on, 48 days in, with its leaderboard, news cycle and history. */
  leapfrog?: boolean;
  selected?: number | null;
  event?: string | null;
  tool?: string | null;
  view?: "archive" | Edition | null;
  chatCount?: number;
  photo?: boolean;
  staff?: boolean;
  outcome?: "won" | "lost" | null;
  width?: number;
  height?: number;
  skins?: Partial<SkinPickerVM>;
}

export function fixtureSnapshot(o: FixtureOptions = {}): Snapshot {
  const w = o.world ?? (o.leapfrog ? fixtureLeapfrog().world : fixtureWorld());
  const selected = o.selected === undefined ? (w.walkers.find((x) => x.kind === "researcher")?.id ?? null) : o.selected;
  const snap = makeSnapshot(w, undefined, { selected, follow: false, highlight: null });
  return { ...snap, event: o.event ? { id: o.event, day: snap.day } : snap.event, outcome: o.outcome ?? snap.outcome };
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
    mixer: { open: false, ready: true, muted: false, master: 0.7, music: 0.3, sfx: 0.65 },
    photo: { on: o.photo ?? false, time: "live", shot: { id: 1, url: "data:image/png;base64,", name: "frontier-lab-tycoon-campus.png" }, flash: 1 },
    skins: { ...NO_SKINS, ...o.skins },
    leapfrog: lf?.motion,
    viewport: { width: o.width ?? 1440, height: o.height ?? 900 },
  };
}

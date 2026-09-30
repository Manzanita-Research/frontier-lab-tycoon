// Fixture inputs for the view-model and for the skin render tests: real snapshots of a real (seeded) World, plus the
// UI state a moment needs. Deterministic: the same call gives the same JSON.
import { makeSnapshot, type Snapshot } from "../../app/hud";
import { frontPage, recap, type Edition } from "../../newsroom/edition";
import { createTestCampus } from "../../sim/testkit";
import { tick } from "../../sim/tick";
import type { GameState } from "../../sim/types";
import type { SkinPickerVM } from "./types";
import type { HudInput } from "./vm";

/** A busy campus a few game days in, with thoughts, a crowd and a run in flight (the real opening is quieter: see `openingWorld`). */
export function fixtureWorld(days = 12, seed = 3): GameState {
  const s = createTestCampus(seed);
  for (let i = 0; i < days * 20; i++) tick(s);
  return s;
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
  /** Standing warnings. */
  warnings?: string[];
  width?: number;
  height?: number;
  skins?: Partial<SkinPickerVM>;
}

export function fixtureSnapshot(o: FixtureOptions = {}): Snapshot {
  const w = o.world ?? fixtureWorld();
  const selected = o.selected === undefined ? (w.walkers.find((x) => x.kind === "researcher")?.id ?? null) : o.selected;
  const snap = makeSnapshot(w, undefined, { selected, follow: false, highlight: null });
  const pendingConfirm = o.confirm
    ? { kind: "hire" as const, cost: 4_000, runwayAfter: 1.8, message: "This leaves 1.8 months of runway. The board will have questions.", command: { type: "hire" as const, job: "sre" as const } }
    : snap.pendingConfirm;
  return { ...snap, event: o.event ? { id: o.event, day: snap.day } : snap.event, outcome: o.outcome ?? snap.outcome, pendingConfirm, warnings: o.warnings ?? snap.warnings };
}

export function fixtureInput(o: FixtureOptions = {}): HudInput {
  const snap = fixtureSnapshot(o);
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
    viewport: { width: o.width ?? 1440, height: o.height ?? 900 },
  };
}

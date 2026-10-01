// Fixture inputs for the view-model and for the skin render tests: real snapshots of a real (seeded) World, plus the
// UI state a moment needs. Deterministic: the same call gives the same JSON.
import { makeSnapshot, type Snapshot } from "../../app/hud";
import { frontPage, recap, type Edition } from "../../newsroom/edition";
import { createTestCampus } from "../../sim/testkit";
import { enableLeapfrog } from "../../sim/race/leapfrog/driver";
import { stageCircus, type CircusMoment } from "../../sim/circus/demo";
import { stageSenate, type SenateMoment } from "../../sim/capture/demo";
import { leapfrogView } from "../../sim/race/leapfrog/view";
import { answer, layPaths, readyForPressure } from "../../sim/testkit";
import { stageAudit, type AuditMoment } from "../../sim/auditors/demo";
import { applyNow, tick } from "../../sim/tick";
import { triggerDisaster } from "../../sim/disasters/driver";
import { unpaced } from "../../sim/events";
import type { GameState } from "../../sim/types";
import { newMotion, stepMotion, type MotionView } from "./leapfrogMotion";
import type { SkinPickerVM } from "./types";
import type { HudInput } from "./vm";
import type { SavesInput } from "./saves.vm";
import { SLOTS, type SaveMeta } from "../../save";
import { playableFixture } from "./previewLadder";
import { stagePapers } from "../../sim/race/papers/demo";
import { stageCollusion } from "../../sim/collusion/demo";
import { createInitialState } from "../../sim/state";
import { stageDrama, type DramaMoment } from "../../sim/defection/demo";
import { OPEN_FAST, runFactions } from "../../sim/factions/headless";
import { dramaViewModel, NO_DRAMA_UI, type FeedPackData } from "../../drama/feed";
import { stageEndingMoment } from "../../sim/endings/demo";
import { stageBird, type BirdDemoMoment } from "../../sim/birdapp/demo";
import { continueTutorial } from "../../sim/tutorial";
import { enableEarnedPacks } from "../../sim/progression";

const staged = new Map<string, GameState>();
/** An ending's scene (`memo`, `takeover`, `thanks`, `front-<id>`), staged once per test run: they start from the mid-game campus. */
export function fixtureEnding(moment: string): GameState {
  if (!staged.has(moment)) staged.set(moment, stageEndingMoment(moment));
  return staged.get(moment)!;
}

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
  // A staged moment: both disasters' cards back to back, no card budget (FLT-54).
  unpaced(s);
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
export function fixtureDefection(moment: DramaMoment, seed = 7): GameState {
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

/** A lab staged at one of the Senate's moments (Regulatory Capture's bill, the Promise Tracker's vote). */
export function fixtureSenate(moment: SenateMoment, seed = 3): GameState {
  const s = fixtureWorld(12, seed);
  stageSenate(s, moment);
  return s;
}

/**
 * FLT-33: the headless open + fast lab (sim/factions/headless.ts) with the factions on, 60 days in: fans, upset
 * factions, relations that have moved, a discourse log and walkers who have picked a side. Cached: it is a real run.
 */
let factionsWorld: GameState | null = null;
export function fixtureFactions(): GameState {
  factionsWorld ??= runFactions(1, OPEN_FAST, 60).world;
  return factionsWorld;
}

/** FLT-69: a campus a week into the Bird App, staged as its `?moment=bird|bird-banger|bird-cancel` link is. Cached. */
const birdWorlds = new Map<BirdDemoMoment, GameState>();
export function fixtureBird(moment: BirdDemoMoment): GameState {
  let w = birdWorlds.get(moment);
  if (!w) {
    w = createInitialState(3);
    continueTutorial(w, true);
    delete w.progression;
    enableEarnedPacks(w);
    stageBird(w, moment);
    birdWorlds.set(moment, w);
  }
  return w;
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

/** The rehearsal Drama feed (drama/fixtures/feed), as index.json lists it: newest first. */
export const FIXTURE_DRAMA_FEED: FeedPackData[] = [
  {
    id: "drama-2026-09-29",
    date: "2026-09-29",
    title: "The Perk Arms Race",
    description: "The labs stop competing on models and start competing on snacks. By Friday, one of them is offering a moon.",
    url: "/mods/drama-fixture/2026-09-29/mod.json",
    teasers: [
      "MetaMeta offers researchers a private chef, a private gym and a private moon (moon pending)",
      "Open-ish AI answers with unlimited nap pods; output flat, dreams 40% more agentic",
      "Anthropomorphic's only perk is a sincere handwritten letter about your potential; three researchers cry",
    ],
    event: { title: "Your Researchers Have Seen the Other Lab's Snack Wall", day: 20 },
    counts: { events: 1, headlines: 8, thoughts: 7, rivals: 1 },
  },
  {
    id: "drama-2026-09-28",
    date: "2026-09-28",
    title: "The Benchmark Bake-Off",
    description: "Every lab tops a leaderboard today, each on a benchmark it wrote that morning.",
    url: "/mods/drama-fixture/2026-09-28/mod.json",
    teasers: ["Open-ish AI sets record on Open-ish Bench, which it released 20 minutes earlier"],
    event: { title: "A Rival Tops a Benchmark It Invented at Breakfast", day: 20 },
    counts: { events: 1, headlines: 6, thoughts: 5, rivals: 0 },
  },
  {
    id: "drama-2026-09-27",
    date: "2026-09-27",
    title: "The Price War",
    description: "Every lab halves its prices, then halves them again. By lunch, tokens cost less than the kombucha that made them.",
    url: "/mods/drama-fixture/2026-09-27/mod.json",
    teasers: ["Tokens now cheaper than the kombucha used to generate them"],
    event: { title: "The Price War Reaches Your Pricing Page", day: 20 },
    counts: { events: 1, headlines: 5, thoughts: 5, rivals: 1 },
  },
];

/** Today's Drama in a few moments: the window open on the feed, the "now playing" card, a feed with nothing in it. */
/** The fixture's clock for saves: "3 hours ago" and "yesterday" stay put. */
export const FIXTURE_NOW = Date.parse("2026-09-30T15:00:00Z");

const fixtureMeta = (lab: string, day: number, hoursAgo: number, size: number, skin: string | null, mods: string[] = []): SaveMeta => ({
  kind: "fltsave", v: 3, savedAt: new Date(FIXTURE_NOW - hoursAgo * 3_600_000).toISOString(), seed: 7, lab, day, tick: day * 20, enc: "gzip64", skin, size,
  mods: mods.map((id) => ({ id, version: "1.0.0", hash: "f3b023e9" })),
});

/** FLT-65: the saves shelf the fixtures show. */
export function fixtureSaves(kind: "window" | "welcome" | "prompt" | "private"): SavesInput {
  const auto = fixtureMeta("Gradient Descent Labs", 424, 3, 44_700, "frontier-95");
  return {
    open: kind === "window" || kind === "prompt" || kind === "private",
    available: kind !== "private",
    listing: kind === "private" ? SLOTS.map((slot) => ({ slot, meta: null })) : [
      { slot: "auto", meta: auto },
      { slot: "1", meta: fixtureMeta("Mostly Harmless Compute", 45, 50, 5_300, "frontier-95", ["every-lab-is-steve"]) },
      { slot: "2", meta: null, broken: "Scrambled" },
      { slot: "3", meta: null },
    ],
    welcome: kind === "welcome" ? { slot: "auto", meta: auto } : null,
    busy: false,
    status: kind === "window" ? { text: 'Saved "Gradient Descent Labs" to slot 1.', tone: "good" } : null,
    modPrompt: kind === "prompt" ? { lab: "Mostly Harmless Compute", missing: ["every-lab-is-steve 1.0.0"], extra: [], canFetch: true } : null,
    dragging: false,
    skinNames: { "frontier-95": "Frontier 95" },
    now: FIXTURE_NOW,
  };
}

export function fixtureDrama(kind: "feed" | "intro" | "empty" | "fresh" | "added"): NonNullable<HudInput["drama"]> {
  const href = "https://flt.test/?drama=fixture";
  const playing = [{ id: "drama-2026-09-29", name: "Daily Drama: The Perk Arms Race", source: FIXTURE_DRAMA_FEED[0]!.url }];
  const now = new Date(2026, 8, 29, 12);
  if (kind === "fresh") return dramaViewModel({ ...NO_DRAMA_UI, latest: FIXTURE_DRAMA_FEED[0]! }, [], href, now);
  if (kind === "empty") return dramaViewModel({ ...NO_DRAMA_UI, open: true, status: "ready", packs: [] }, [], href, now);
  const ui = { ...NO_DRAMA_UI, open: true, status: "ready" as const, packs: FIXTURE_DRAMA_FEED, latest: FIXTURE_DRAMA_FEED[0]!, seen: "drama-2026-09-28" };
  if (kind === "added") return dramaViewModel(ui, playing, href, now);
  return kind === "intro" ? dramaViewModel({ ...ui, intro: true }, playing, href, now) : dramaViewModel(ui, [], href, now);
}

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
  /** The Senate (FLT-22/23): the bill's draft, the law in force, the leak, the whip count or the roll call. */
  senate?: SenateMoment;
  /** The Senate window is open. */
  senateOpen?: boolean;
  /** FLT-33: the factions on, 16 days in (a member of one is selected); `factionsOpen` opens the panel. */
  factions?: boolean;
  factionsOpen?: boolean;
  /** FLT-69: the Bird App staged at one of its moments; `birdOpen` opens the panel. */
  bird?: BirdDemoMoment;
  birdOpen?: boolean;
  selected?: number | null;
  event?: string | null;
  tool?: string | null;
  view?: "archive" | Edition | null;
  chatCount?: number;
  photo?: boolean;
  staff?: boolean;
  outcome?: "won" | "lost" | null;
  /** An ending's scene (FLT-11): `takeover` (the autopilot at work), `thanks`, or `front-<id>` (the last front page). */
  ending?: string;
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
  /** Today's Drama (absent: nothing fetched yet, the window shut). */
  drama?: "feed" | "intro" | "empty" | "fresh" | "added";
  /** FLT-57: a streak, a friend's challenge (and whether its banner is up), the Memo extra already read. */
  social?: Partial<NonNullable<HudInput["social"]>>;
  /** FLT-65: the Save/Load window open on a full shelf, "Welcome back", the question about mods, or no storage at all. */
  saves?: "window" | "welcome" | "prompt" | "private";
}

/** A World with a papers or collusion moment staged on it, through the same code the `?moment=` links use. */
export function fixtureStaged(o: Pick<FixtureOptions, "papers" | "collusion">): GameState {
  const w = createTestCampus(3);
  if (o.papers) stagePapers(w, o.papers === "panel" ? "paper-scoop" : `paper-${o.papers}`);
  if (o.collusion) stageCollusion(w, `collusion-${o.collusion}`);
  return w;
}

export function fixtureSnapshot(o: FixtureOptions = {}): Snapshot {
  const w = o.world ?? (o.ending ? fixtureEnding(o.ending) : o.audit ? fixtureAudit(o.audit) : o.leapfrog ? fixtureLeapfrog().world : o.factions ? fixtureFactions() : o.bird ? fixtureBird(o.bird) : o.papers || o.collusion ? fixtureStaged(o) : o.disaster ? fixtureDisaster() : o.circus ? fixtureCircus(o.circus) : o.senate ? fixtureSenate(o.senate) : fixtureWorld());
  const selected = o.selected === undefined ? (w.walkers.find((x) => x.kind === "researcher" && (!o.factions || x.faction))?.id ?? null) : o.selected;
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
    senateOpen: o.senateOpen ?? false,
    zone: null,
    factionsOpen: o.factionsOpen ?? false,
    birdAppOpen: o.birdOpen ?? false,
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
    drama: o.drama ? fixtureDrama(o.drama) : undefined,
    saves: o.saves ? fixtureSaves(o.saves) : undefined,
    viewport: { width: o.width ?? 1440, height: o.height ?? 900 },
    social: { streak: 0, challenge: null, challengeOpen: false, memoSeen: null, linkBase: "https://frontier.example/", ...o.social },
  };
}

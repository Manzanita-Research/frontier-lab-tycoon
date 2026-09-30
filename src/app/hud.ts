// What the HUD reads: a small plain snapshot of the World, refreshed at about 5 Hz instead of every tick.
import { coachOf } from "../sim/coach";
import { progressOf, visibleHud } from "../sim/progression";
import type { CoachMark } from "../content/coach";
import type { ProgressView, UnlockCard, HudPanel } from "../content/progression";
import type { PlaceableKind } from "../content/buildings";
import { runwayMonths } from "../sim/format";
import { protesterCount } from "../sim/protest";
import { inspectWalker, type Inspect } from "../sim/inspect";
import { thoughtBoard, type ThoughtRow } from "../sim/mind";
import { computePerDay, trainingEtaDays } from "../sim/training";
import { openEventOf } from "../sim/events";
import { opsView, type OpsView } from "../sim/opsView";
import { talking } from "../sim/meetings";
import { leapfrogView, type LeapfrogView } from "../sim/race/leapfrog/view";
import { papersView, type PapersView } from "../sim/race/papers/view";
import { collusionView, type CollusionView } from "../sim/collusion/view";
import { hearingView, type HearingView } from "../sim/hearing/view";
import { yachtView, type YachtView } from "../sim/yacht/view";
import { raceView, type RaceView } from "../sim/race/view";
import { auditView, type AuditView } from "../sim/auditors/view";
import { memberById } from "../sim/groups";
import { outcomeOf, releaseGoalText } from "../sim/goals";
import { estimateLedger } from "../sim/economy";
import { assistantOf, type AssistantMessage } from "../sim/tutorial";
import { pendingConfirmOf, persistentWarnings, type PendingConfirm } from "../sim/guardrails";
import { calmStart, CALM_START_DAY, disasterMenu, disastersView, type MenuRow, type RunView } from "../sim/disasters/driver";
import type { Risk } from "../sim/disasters/types";
import type { Building, GameState, GoalProgress, OpenEvent, Outcome, Pop, StaffJob, Thought, Tone, Vibes } from "../sim/types";

export type Tool = "path" | PlaceableKind | "security" | "bulldoze";
/** Hotkeys 1-9 pick these in order. */
export const TOOLS: Tool[] = ["path", "cluster", "hall", "gateway", "kombucha", "nap", "snack", "demo", "bulldoze"];
/** The race's buildings: in the palette (between the core buildings and Bulldoze, no hotkey) once an auction unlocks them. */
export const RACE_TOOLS: Tool[] = ["datacenter", "gas", "solar"];
/** Offices (FLT-32): in the palette once the ladder earns them (Scrutiny), no hotkey. */
export const OFFICE_TOOLS: Tool[] = ["security"];
export const SPEEDS = [0, 1, 3, 10] as const;
export type Speed = (typeof SPEEDS)[number];

/** What the player has selected: it lives in the app machine, and the World only reads it to build the snapshot. */
export interface UiSelection {
  /** The walker whose card is open. */
  selected: number | null;
  /** The camera is tracking `selected`. */
  follow: boolean;
  /** The Thoughts row (`kind|text`) whose walkers are lit up. */
  highlight: string | null;
}

export const NO_SELECTION: UiSelection = { selected: null, follow: false, highlight: null };

/** How many Thoughts rows the panel gets. */
export const BOARD_ROWS = 14;

export interface Snapshot {
  progress: ProgressView;
  coach: CoachMark | null;
  unlockCard: UnlockCard | null;
  hud: { visible: Record<HudPanel, boolean> };
  tick: number;
  day: number;
  cash: number;
  net: number;
  income: number;
  expenses: number;
  runway: number | null;
  capability: number;
  hype: number;
  vibes: Vibes;
  labName: string;
  hasHall: boolean;
  computePerDay: number;
  training: { name: string; run: number; pct: number; /** Days left at today's pace, or null. */ etaDays: number | null };
  /** The newest model's name ("Frontier-2"), or null before the first release. */
  latestModel: string | null;
  /** The day of the last release, for the "SHIPPED!" sticker. */
  lastRelease: number | null;
  /** Who is thinking each bubble: walker id → name. */
  speakers: Record<number, string>;
  /** Gross income and expenses per day (the ledger), for the Finance tab. */
  ledger: { income: number; expenses: number };
  thoughts: Thought[];
  pops: Pop[];
  version: number;
  /** Same array identity until the grid or buildings change. */
  buildings: Building[];
  models: number;
  walkers: number;
  hasGateway: boolean;
  goals: GoalProgress[];
  outcome: Outcome;
  event: OpenEvent | null;
  protesters: number;
  discourse: number;
  /** The Thoughts panel: everyone's thought, counted, most common first. */
  board: ThoughtRow[];
  /** The open inspector card, if a walker is selected and still here. */
  inspect: Inspect | null;
  /** The selection this snapshot was built for: the app only trusts `inspect: null` if it matches its own. */
  selectedId: number | null;
  /** The Race: multiplier, era, the Arena, the open-weights drop, power. */
  race: RaceView;
  /** Release Leapfrog (FLT-27): the benchmark leaderboard, the share-of-voice meter and the last launch. `enabled: false` when the pack is off. */
  leapfrog: LeapfrogView;
  /** Publishing Papers (FLT-28): list, review timers and publication policy. */
  papers: PapersView;
  /** Agent collusion (FLT-18): packets, the night gathering, the inquiry and the ending's front page. No stage before an ending reaches the UI as text. */
  collusion: CollusionView;
  /** The Hearing (FLT-21): the witness table, the senators, the Trust and Capture meters. `enabled: false` when the pack is off. */
  hearing: HearingView;
  /** The yacht summit (FLT-24): the RSVP, the leaked group chat, the ending. */
  yacht: YachtView;
  /** Operations: staff, slop, broken buildings, queues. */
  ops: OpsView;
  /** Meetings in progress (a VC and your researcher by the Kombucha Bar, FLT-26): who, and what they say, visitor first. */
  /** Meetings in their talking phase; `names` is who says it, guest (their role, e.g. "Venture Capitalist") then host. */
  chats: { id: number; hostId: number; guestId: number; names: [string, string]; lines: string[] }[];
  assistant: AssistantMessage | null;
  firstBuildPending: boolean;
  pendingConfirm: PendingConfirm | null;
  warnings: string[];
  releaseGoal: string;
  disasters: DisastersSnapshot;
  /** Evals Without Borders (FLT-19): the countdown, the tour and the last report card. `enabled: false` before Scrutiny. */
  audit: AuditView;
}

/** Disasters (FLT-32): the menu, what is under way, who it has pulled off their post, and the two meters it moves. */
export interface DisastersSnapshot {
  risk: Risk;
  /** The calm start holds the dice (no release yet, or before `calmDay`). */
  calm: boolean;
  calmDay: number;
  menu: MenuRow[];
  runs: RunView[];
  /** Public trust and regulatory heat, 0 to 100. */
  trust: number;
  heat: number;
  /** Per job with anyone pulled off their post: how many, of how many, and by which disaster. */
  diverted: { job: StaffJob; diverted: number; total: number; by: string }[];
  /** Rivals a weights leak lifted, while it is still under way (the Arena marks them). */
  leaked: string[];
  /** Staffers pulled off their post (their map tags go red). */
  divertedIds: number[];
  /** Where each disaster has sent people: a building id, or 0 for the gate. The map puts the cleanup's progress there. */
  sites: { owner: string; to: number; job: StaffJob }[];
}

export interface UiToast {
  id: number;
  text: string;
  tone: Tone;
}

function disastersOf(s: GameState): DisastersSnapshot {
  const d = s.disasters;
  const diverted: DisastersSnapshot["diverted"] = [];
  const divertedIds: number[] = [];
  const sites: DisastersSnapshot["sites"] = [];
  for (const o of s.staff) {
    if (o.machine.value === "leaving") continue;
    let row = diverted.find((r) => r.job === o.job);
    if (!row) diverted.push((row = { job: o.job, diverted: 0, total: 0, by: "" }));
    row.total++;
    if (o.divert) {
      row.diverted++;
      row.by ||= o.divert.owner;
      divertedIds.push(o.id);
      if (!sites.some((x) => x.owner === o.divert!.owner && x.to === o.divert!.to)) sites.push({ owner: o.divert.owner, to: o.divert.to, job: o.job });
    }
  }
  return {
    risk: d.risk,
    calm: calmStart(s),
    calmDay: CALM_START_DAY,
    menu: disasterMenu(s),
    runs: disastersView(s),
    trust: d.trust,
    heat: d.heat,
    diverted: diverted.filter((r) => r.diverted > 0),
    leaked: d.runs.flatMap((r) => (r.id === "weightsLeak" && r.vars.leapRivalId && r.machine.value !== "done" ? [r.vars.leapRivalId] : [])),
    divertedIds,
    sites,
  };
}

/** Names of the walkers who are thinking out loud, so a bubble can say who said it. */
function speakersOf(s: GameState): Record<number, string> {
  const out: Record<number, string> = {};
  if (s.thoughts.length === 0) return out;
  const names = new Map<number, string>();
  for (const w of s.walkers) names.set(w.id, w.name);
  // Visitor groups (the auditors) are not walkers: their names come from the group.
  for (const t of s.thoughts) out[t.walkerId] = names.get(t.walkerId) ?? memberById(s, t.walkerId)?.member.name ?? "";
  return out;
}

export function makeSnapshot(s: GameState, prev?: Snapshot, ui: UiSelection = NO_SELECTION): Snapshot {
  const books = estimateLedger(s);
  return {
    progress: progressOf(s), coach: coachOf(s), unlockCard: s.unlockCards?.[0] ?? null, hud: visibleHud(s),
    tick: s.tick,
    day: s.day,
    cash: s.cash,
    net: books.net,
    income: books.income,
    expenses: books.expenses,
    runway: runwayMonths(s.cash, books.net),
    capability: s.capability,
    hype: s.hype,
    vibes: { ...s.vibes },
    labName: s.labName,
    hasHall: s.buildings.some((b) => b.kind === "hall"),
    computePerDay: computePerDay(s),
    training: { name: s.training.context.name, run: s.training.context.run, pct: Math.min(1, s.training.context.progress / s.training.context.cost), etaDays: trainingEtaDays(s) },
    latestModel: s.models.at(-1) ?? null,
    lastRelease: s.flags.lastRelease ?? null,
    speakers: speakersOf(s),
    ledger: { income: s.ledger.income, expenses: s.ledger.expenses },
    thoughts: s.thoughts.slice(),
    pops: s.pops.slice(),
    version: s.version,
    buildings: prev && prev.version === s.version ? prev.buildings : s.buildings.slice(),
    models: s.models.length,
    walkers: s.walkers.length,
    hasGateway: s.buildings.some((b) => b.kind === "gateway"),
    goals: s.goals.context.goals.map((g) => ({ ...g })),
    outcome: outcomeOf(s),
    event: openEventOf(s),
    protesters: protesterCount(s),
    discourse: s.waterDiscourse,
    board: thoughtBoard(s).slice(0, BOARD_ROWS),
    inspect: ui.selected === null ? null : inspectWalker(s, ui.selected),
    selectedId: ui.selected,
    race: raceView(s),
    leapfrog: leapfrogView(s),
    papers: papersView(s),
    collusion: collusionView(s),
    hearing: hearingView(s),
    yacht: yachtView(s),
    ops: opsView(s),
    chats: talking(s).map((m) => {
      const guest = s.walkers.find((w) => w.id === m.guestId);
      const host = s.walkers.find((w) => w.id === m.hostId);
      return { id: m.id, hostId: m.hostId, guestId: m.guestId, names: [guest?.role || guest?.name || "", host?.name ?? ""], lines: m.lines.slice() };
    }),
    assistant: assistantOf(s),
    firstBuildPending: !!s.coach && s.flags.started === undefined && s.flags.firstBuild === undefined,
    pendingConfirm: pendingConfirmOf(s),
    warnings: persistentWarnings(s),
    releaseGoal: releaseGoalText(s),
    disasters: disastersOf(s),
    audit: auditView(s),
  };
}

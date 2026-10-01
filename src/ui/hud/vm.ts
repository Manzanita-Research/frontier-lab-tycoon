// The HUD view-model: one pure function from the app's snapshot (and a little UI state) to plain JSON.
//
// This is the seam between the game and its skins. Skins render `HudVM` and call `HudActions`; nothing else about
// the game is reachable from them, so a change in the sim never breaks a mod and a mod can never touch the sim.
// Pure: no atoms, no DOM, no clocks, no random numbers. It is unit-tested against fixture snapshots (vm.test.ts).
import type { Snapshot, Tool } from "../../app/hud";
import type { StageView } from "../../app/moments";
import { OFFICE_TOOLS, RACE_TOOLS, SPEEDS, TOOLS } from "../../app/hud";
import { PATH_PRICE } from "../../content/buildings";
import { ERAS } from "../../content/eras";
import { UNLOCK_QUIPS } from "../../content/progression";
import { STAFF } from "../../content/staff";
import { dramaLetter } from "../../content/events";
import { SCENARIO, type GoalDef } from "../../content/goals";
import { FRIENDS } from "../../content/newsroom";
import { LEAPFROG } from "../../content/leapfrog";
import { STREAM_FALLBACK, STREAM_LINES } from "../../content/livestream";
import { CUES } from "../../audio/score";
import type { Edition } from "../../newsroom/edition";
import { hourAt, clockLabel } from "../../render/fx/clock";
import { lookOf } from "../../render/look";
import { fillTemplate, formatDate, formatMoney } from "../../sim/format";
import type { Inspect, NeedBar } from "../../sim/inspect";
import type { NewsItem, NewsPanel, Tone, WalkerKind } from "../../sim/types";
import { trendOf, VIBES_MAX, WEIGHTS } from "../../sim/vibes";
import { NO_MOTION, type MotionView } from "./leapfrogMotion";
import { SKIN_API_VERSION } from "./types";
import { DISASTER_LINES, HEAT_WORDS, PHASE_LABELS, RISK_COPY, TAG_LABELS, TRUST_WORDS, UNDERSTAFFED } from "../../content/disasterCopy";
import { HELP_BUILDINGS, HELP_LOOP, HELP_NUMBERS, HELP_TITLE } from "../../content/help";
import { playableOf, type PlayableInput } from "./playable";
import { papersOf, paperMomentOf } from "./papers";
import { collusionOf, crumbWikiOf, investigationOf } from "./collusion";
import { factionChips, factionsOf } from "./factions";
import { unreadOf, windowed } from "./tray";
import type { Budget } from "./windows";
import { groupOf, modeOf, widgetsOf } from "./widgets";
import { birdAppOf } from "./birdapp";
import type { FactionChipVM } from "./types";
import { challengeLine, challengeQuery, compareRuns, VERDICT_TEXT, type Challenge } from "../share/link";
import { streakText } from "../share/streak";
import { ENDING_RULES, endingById } from "../../sim/endings/pack";
import type {
  ArenaRowVM, DramaDocVM,
  ArenaVM, AuditVM, BeatVM, BillVM, SenateVM, TrackerVM, GoalVM, ReportCardVM, ToneVM, BenchCellVM, DisasterRunVM, DisastersVM, DisasterStageVM, MeterVM, RiskVM, UnderstaffedVM, BenchColumnVM, BubbleVM, BuildItemVM, BuildTipVM, ChatVM, ConfirmVM, EditionRowVM, EventVM, HearingMoveVM, HearingVM, HudVM, LeakVM, SenatorVM, InspectorVM, LeaderRowVM, LeapfrogVM, NeedVM, NewsroomVM,
  DramaVM, ModsVM, ObjectivesVM, OutcomeVM, PaperVM, PhotoVM, ResponseVM, SkinPickerVM, SoundVM, SpeedVM, StaffJobVM, StaffRowVM, StaffVM, StatsVM, StreamVM, ThoughtRowVM, TrainingVM, TrendVM, VoiceVM, WalkerKindVM,
  EndingVM, ShareVM, TakeoverVM, MemoVM, ChallengeVM, UnlockCardVM,
} from "./types";
import { defs } from "../../sim/defs";
import { NO_SAVES_VM, savesViewModel, type SavesInput } from "./saves.vm";

/** How many game days after a release the "SHIPPED!" sticker stays up. */
export const SHIPPED_DAYS = 3;
/** No `?mod=`: the base game, the Mod Manager shut. */
export const NO_MODS_VM: ModsVM = { open: false, list: [], conflicts: [], errors: [], contentHash: null };
/** Nothing fetched from the Drama feed yet, no pack loaded, the window shut. */
export const NO_DRAMA_VM: DramaVM = { open: false, status: "idle", latest: null, archive: [], on: null, fresh: false, intro: false };
/** The newest headlines a ticker carries. */
export const TICKER_ITEMS = 24;

/** Everything the view-model needs besides the snapshot: small UI-only state, all of it plain data. */
export interface HudInput {
  snap: Snapshot;
  speed: number;
  tool: Tool | null;
  follow: boolean;
  highlight: string | null;
  toasts: readonly { id: number; text: string; tone: Tone; batch?: readonly { text: string; tone: Tone }[]; pinned?: true; snag?: string }[];
  news: readonly NewsItem[];
  /** FLT-76: the big moments still waiting their turn, an ending's solo and the shipped sticker (`app/moments.ts`). Optional: nothing waiting. */
  stage?: StageView;
  /** FLT-76: the "Slow down for bad news" setting. Optional: on. */
  slowForBadNews?: boolean;
  outcomeDismissed: boolean;
  /** "Tap anyone to read their mind" is still showing. */
  tapHint: boolean;
  /** A toast has already told the player about the API Gateway, so the standing hint would be a repeat. */
  toldGateway: boolean;
  /** The Staff panel is open, and whose patrol zone is being painted. */
  staffOpen: boolean;
  zone: number | null;
  /** The Senate window (FLT-22/23) is open. Optional: closed. */
  senateOpen?: boolean;
  /** FLT-33: the Factions panel is open. Optional: folded. */
  factionsOpen?: boolean;
  /** FLT-69: the Bird App is open. Optional: folded. */
  birdAppOpen?: boolean;
  /** `chosen`: the player opened it (FLT-54). Optional: the game did. */
  arena: { open: boolean; chosen?: boolean; alert: boolean; flinch: boolean; moved: Record<string, "up" | "down"> };
  /** Release Leapfrog's real-time flourishes (row flashes, blinking badges, solved columns kept on the board, news-cycle history). Optional: none is fine. */
  leapfrog?: MotionView;
  room: { archive: readonly Edition[]; view: "archive" | Edition | null; unread: readonly string[]; storage: boolean };
  /** How many chat messages have arrived so far. */
  chatCount: number;
  /** Help ▸ How to play is open. */
  helpOpen: boolean;
  /** The Papers window is open (absent: folded). */
  papersOpen?: boolean;
  /** Paper moments and CrumbWiki reveals already closed, by key. */
  dismissed?: readonly string[];
  /** The Disasters menu is open (FLT-32). */
  disastersOpen?: boolean;
  /** FLT-55: what mod looks call a walker ("Golden Retriever"), by look target ("protester", "visitor:Journalist"). Optional: none. */
  lookLabels?: Readonly<Record<string, string>>;
  mixer: { open: boolean; ready: boolean; muted: boolean; master: number; music: number; sfx: number };
  photo: { on: boolean; time: string; shot: { id: number; url: string; name: string } | null; flash: number };
  /** A camera beat's caption (FLT-56). Optional: none. */
  beat?: { id: number; kind: string; caption: string; sub: string } | null;
  skins: SkinPickerVM;
  /** The Mod Manager. Optional: none means no mods and the window shut. */
  mods?: ModsVM;
  /** Today's Drama (FLT-34). Optional: none means nothing fetched and the window shut. */
  drama?: DramaVM;
  /** Saving and loading (FLT-65). Optional: none means the window shut and nothing to continue. */
  saves?: SavesInput;
  viewport: { width: number; height: number };
  /** The ending's share card and the campus photo its front page prints (FLT-11). Optional: none is fine. */
  share?: { photo: string | null } & ShareVM;
  /**
   * The window budget (FLT-54) and the newest headline id the player has seen with each panel open. Absent: every window
   * the game wants is up and nothing is unread (the host applies the budget itself, after it has stepped it).
   */
  windows?: { budget: Budget; seen: Partial<Record<NewsPanel, number>> };
  /** FLT-57: days played in a row, a friend's challenge from the URL (and whether its banner is up), the Memo extra already read, and this page's address for friend links. Optional: none is fine. */
  social?: { streak: number; challenge: Challenge | null; challengeOpen: boolean; memoSeen: string | null; linkBase: string | null };
}


/** "Revenue $140K / $250K per day", "Runs 2 / 3", "Hype 47 / 60", "Arena #2 · day 12 of 30". `held` is a hold goal's days in a row. */
export function goalProgressText(def: GoalDef, value: number, held = 0): string {
  const shown = Math.min(value, def.target);
  switch (def.unit) {
    case "money":
      return `Revenue ${formatMoney(shown)} / ${formatMoney(def.target)} per day`;
    case "runs":
      return `Training runs ${Math.floor(shown)} / ${def.target}`;
    case "points":
      return `Hype ${Math.floor(shown)} / ${def.target}`;
    case "era":
      return `Era ${Math.floor(shown)} / ${def.target}`;
    case "rank":
      if (value <= 0) return "Counts from Era 3";
      if (def.hold !== undefined && value >= def.target) {
        const rank = `Arena #${defs().arenaSize + 1 - Math.floor(value)}`;
        return held >= def.hold ? `${rank} (held ${def.hold} days)` : `${rank} · day ${held} of ${def.hold}`;
      }
      return value >= def.target ? `Arena #${defs().arenaSize + 1 - Math.floor(value)} (top ${defs().arenaSize + 1 - def.target} reached)` : `Arena #${defs().arenaSize + 1 - Math.floor(value)}, need top ${defs().arenaSize + 1 - def.target}`;
  }
}

/** The top bar of a camera beat (FLT-56), by kind. */
const BEAT_KICKER: Record<string, string> = { stretch: "Final stretch", exit: "Breaking · a departure", huddle: "The auditors are conferring", viral: "Live · trending now", statement: "A statement from Comms", leak: "Someone is asking about the file" };

const TONE_LABEL = { bad: "Breaking", joke: "Developing", good: "Good news", neutral: "Update" } as const;
const MOOD = { content: "Content", slumped: "Slumped", miserable: "Miserable", resigned: "Resigned" } as const;
const KIND = { researcher: "Researcher", agent: "Agent", visitor: "Visitor", protester: "Protester" } as const;
const NOUN: Record<WalkerKind, [string, string]> = {
  researcher: ["researcher", "researchers"],
  agent: ["agent", "agents"],
  visitor: ["visitor", "visitors"],
  protester: ["protester", "protesters"],
};
const SHORT: Record<Tool, string> = { path: "Path", cluster: "Cluster", hall: "Training Hall", gateway: "Gateway", kombucha: "Kombucha", nap: "Nap Pods", snack: "Snack Wall", demo: "Demo Stage", datacenter: "Datacenter", gas: "Gas Turbine", solar: "Solar Farm", security: "Security", sandbox: "Sandbox", honeypot: "Honeypot", bulldoze: "Bulldoze" };
const CUE_LABEL: Record<string, string> = { place: "Place", coin: "Coin", bulldoze: "Bulldoze", card: "News card", choice: "Choice", release: "Release", era: "New era", breakdown: "Alarm" };
export const PHOTO_TIMES = [
  { key: "live", label: "Live" },
  { key: "day", label: "Day" },
  { key: "golden", label: "Golden" },
  { key: "night", label: "Night" },
];

const toolName = (t: Tool) => (t === "path" ? "Path" : t === "bulldoze" ? "Bulldoze" : defs().buildings[t].name);
const toolPrice = (t: Tool) => (t === "path" ? PATH_PRICE : t === "bulldoze" ? 0 : defs().buildings[t].price);
const arrow = (delta: number) => (delta > 0 ? `↑${delta}` : delta < 0 ? `↓${-delta}` : "–");
const pts = (n: number) => Math.round(n * VIBES_MAX);

function barTone(n: NeedBar): NeedVM["tone"] {
  const urgency = n.goodWhenHigh ? 1 - n.value : n.value;
  return urgency < 0.4 ? "ok" : urgency < 0.7 ? "warn" : "bad";
}

function statsOf(i: HudInput): StatsVM {
  const s = i.snap;
  const v = s.vibes;
  const race = s.race;
  // "Low" means the same as the spending dialog: under three months (FLT-58: six fired in the first minutes of a healthy lab).
  const runwayLow = s.runway !== null && s.runway < 3;
  const date = formatDate(s.day);
  return {
    labName: s.labName,
    date,
    dateShort: date.replace(" · ", " "),
    time: clockLabel(hourAt(s.tick)).toUpperCase(),
    vibes: {
      value: Math.round(v.value),
      target: Math.round(v.target),
      max: VIBES_MAX,
      trend: trendOf(v),
      rows: [
        { label: "Happiness", note: `${Math.round(WEIGHTS.happiness * 100)}%`, fill: v.happiness, points: pts(WEIGHTS.happiness * v.happiness) },
        { label: "Visitors impressed", note: `${Math.round(WEIGHTS.impressed * 100)}%`, fill: v.impressed, points: pts(WEIGHTS.impressed * v.impressed) },
        { label: "Cleanliness", note: `${Math.round(WEIGHTS.cleanliness * 100)}%, spotless for now`, fill: v.cleanliness, points: pts(WEIGHTS.cleanliness * v.cleanliness) },
        { label: "Hype", note: `${Math.round(WEIGHTS.hype * 100)}%`, fill: v.hype, points: pts(WEIGHTS.hype * v.hype) },
        { label: "Calm baseline", note: "10%", fill: 1, points: pts(WEIGHTS.penalties) },
        { label: "Incidents", note: "quits, flops, bailouts", fill: v.incident, points: -pts((WEIGHTS.penalties * v.incident) / 2) + 0 },
        { label: "Protesters at the gate", note: null, fill: v.protest, points: -pts((WEIGHTS.penalties * v.protest) / 2) + 0 },
        // FLT-69: the Bird App's Aura, the part of Hype the posters hold up (already counted in the Hype row).
        ...(s.birdapp?.enabled ? [{ label: "Aura", note: `the Bird App: +${Math.round(s.birdapp.effects.hype)} of the Hype`, fill: s.birdapp.aura / 100, points: pts((WEIGHTS.hype * s.birdapp.effects.hype) / 100) }] : []),
      ],
    },
    cash: { value: s.cash, text: formatMoney(s.cash), negative: s.cash < 0 },
    net: { value: s.net, text: `${s.net >= 0 ? "+" : "-"}${formatMoney(Math.abs(s.net))}/day`, good: s.net >= 0 },
    runway: { months: s.runway, text: s.runway === null ? "∞" : `${s.runway.toFixed(1)} mo`, warning: runwayLow },
    capability: { value: s.capability, latestModel: s.latestModel },
    hype: { value: s.hype },
    // The same books as the net (today's estimate), so Income − Expenses is the Net on the line below it.
    finance: { income: s.income, incomeText: formatMoney(s.income), expenses: s.expenses, expensesText: formatMoney(s.expenses) },
    money: moneyOf(s),
    arena: {
      rank: race.rank,
      rankDelta: race.rankDelta,
      tone: race.rankDelta > 0 ? "good" : race.rankDelta < 0 ? "bad" : "",
      deltaText: arrow(race.rankDelta),
      top: race.rank === 1,
      open: i.arena.open,
      flinch: i.arena.flinch,
    },
    rd: { mult: race.mult, multText: `${race.mult.toFixed(1)}×`, era: race.era },
  };
}

function trainingOf(s: Snapshot, stage: StageView | undefined): TrainingVM {
  const pct = Math.floor(s.training.pct * 100);
  return {
    hasHall: s.hasHall,
    name: s.training.name,
    run: s.training.run,
    pct: s.training.pct,
    pctText: `${pct}%`,
    computePerDay: s.computePerDay,
    etaDays: s.training.etaDays,
    // FLT-76: the moment queue keeps the sticker up for a few real seconds (3 game days at ▶▶▶ is a blink), and back while the ship waits its turn.
    justShipped: !!stage?.shipped || (s.lastRelease !== null && s.day - s.lastRelease <= SHIPPED_DAYS && s.models > 0 && !stage?.waiting.includes("ship")),
    latestModel: s.latestModel,
  };
}

/** A hold goal's bar fills with the days held, once it is at its target (FLT-86); before that it shows the climb. */
const holdRatio = (g: { value: number; target: number; hold?: number; held?: number; met: boolean }) =>
  g.hold && !g.met && g.value >= g.target ? Math.min(1, (g.held ?? 0) / g.hold) : undefined;

function objectivesOf(s: Snapshot): ObjectivesVM {
  const left = Math.max(0, SCENARIO.deadlineDay - s.day);
  return {
    done: s.goals.filter((g) => g.met).length,
    total: s.goals.length,
    daysLeft: left,
    urgent: left <= 60,
    deadline: formatDate(SCENARIO.deadlineDay),
    items: s.goals.map((g) => {
      const def = defs().goals.find((d) => d.id === g.id)!;
      // The release goal names the run actually training ("Ship 3 models (0/3), next: Frontier-2"), so its own progress line goes.
      const release = g.id === "release";
      return { id: g.id, label: release ? s.releaseGoal : def.label, progress: release ? "" : goalProgressText(def, g.value, g.held), ratio: holdRatio(g) ?? Math.max(0, Math.min(1, g.value / g.target)), met: g.met };
    }),
  };
}

function inspectorOf(who: Inspect | null, following: boolean, lab: string, chips: ReadonlyMap<string, FactionChipVM>, labels: Readonly<Record<string, string>> = {}): InspectorVM | null {
  if (!who) return null;
  const drift = who.kind === "agent" ? (who.needs.find((n) => n.key === "drift")?.value ?? 0) : 0;
  const look = lookOf(who);
  return {
    id: who.id,
    lab,
    name: who.name,
    role: who.role,
    kind: who.kind,
    kindLabel: labels[`${who.kind}:${who.role}`] ?? labels[who.kind] ?? KIND[who.kind],
    mood: who.mood,
    moodLabel: MOOD[who.mood],
    status: who.status,
    thought: who.thought,
    history: [...who.history],
    needs: who.needs.map((n) => ({ key: n.key, label: n.label, value: n.value, pct: Math.round(n.value * 100), urgency: n.goodWhenHigh ? 1 - n.value : n.value, tone: barTone(n) })),
    portrait: { kind: who.kind, body: look.body, head: look.head, happiness: who.happiness, drift },
    following,
    badge: String(who.id).padStart(4, "0"),
    ...(who.faction && chips.has(who.faction) ? { faction: chips.get(who.faction)! } : {}),
  };
}

/** FLT-94: what a tool is for, plainly, for the build palette: the Help line without its "Name: ", else the joke. */
const TOOL_DOES: Record<string, string> = {
  path: "How people get around. Every door has to reach the gate along one.",
  bulldoze: "Knocks a building down. You get half your money back.",
};
function doesOf(t: Tool): string | null {
  if (TOOL_DOES[t]) return TOOL_DOES[t]!;
  const help = HELP_BUILDINGS[t];
  if (help) return help.slice(help.indexOf(":") + 1).trim();
  return t === "path" || t === "bulldoze" ? null : (defs().buildings[t]?.blurb ?? null);
}

function buildOf(i: HudInput): { items: BuildItemVM[]; tip: BuildTipVM | null } {
  const s = i.snap;
  const race = s.race;
  const palette: Tool[] = [...TOOLS.filter((t) => t !== "bulldoze"), ...RACE_TOOLS.filter((t) => t !== "bulldoze" && t !== "path" && race.unlocked.includes(t)), ...OFFICE_TOOLS, "bulldoze"];
  const built = new Map<string, number>();
  for (const b of s.buildings) built.set(b.kind, (built.get(b.kind) ?? 0) + 1);
  const items = palette.map((t): BuildItemVM => {
    const isFree = t !== "path" && t !== "bulldoze" && race.free.includes(t);
    const price = isFree ? 0 : toolPrice(t);
    const hotkey = TOOLS.indexOf(t) + 1;
    return {
      kind: t,
      name: toolName(t),
      short: SHORT[t],
      blurb: t === "path" || t === "bulldoze" ? null : defs().buildings[t].blurb,
      does: doesOf(t),
      upkeepText: t === "path" || t === "bulldoze" || !defs().buildings[t].upkeepPerDay ? null : `${formatMoney(defs().buildings[t].upkeepPerDay)}/day upkeep`,
      price,
      priceText: t === "bulldoze" ? "refund 50%" : isFree ? "FREE" : formatMoney(price),
      free: isFree,
      affordable: !(price > s.cash),
      hotkey: hotkey > 0 ? hotkey : null,
      selected: i.tool === t,
      race: (RACE_TOOLS as readonly string[]).includes(t),
      built: built.get(t) ?? 0,
      isBulldoze: t === "bulldoze",
      isPath: t === "path",
      group: groupOf(t),
    };
  });
  const ops = s.ops;
  items.push({
    kind: "staff",
    name: "Staff",
    short: `Staff${ops.staff.length > 0 ? ` (${ops.staff.length})` : ""}`,
    blurb: "Hire Janitor Bots, SREs, Comms Reps and Security.",
    does: "Hire the people who keep the lights on: cleaners, SREs, Comms and Security.",
    upkeepText: null,
    price: 0,
    priceText: ops.staff.length > 0 ? `${formatMoney(ops.payroll)}/day` : "hire",
    free: false,
    affordable: true,
    hotkey: null,
    selected: i.staffOpen,
    race: false,
    built: 0,
    isBulldoze: false,
    isPath: false,
    panel: true,
    group: "offices",
  });
  // The Senate (FLT-23): the Promise Tracker and the bill, once the lab has been to its first hearing.
  if (s.promises.enabled) {
    const due = s.promises.stage === "campaign" || s.promises.stage === "rollCall" || s.bill.stage === "invited";
    items.push({
      kind: "senate",
      name: "Senate",
      short: "Senate",
      blurb: "Three senators, their promises, and what it costs to change their minds.",
      does: "Three senators, their promises, and what it costs to change their minds.",
      upkeepText: null,
      price: 0,
      priceText: s.bill.stage === "invited" ? "draft due" : due ? "vote soon" : "in recess",
      free: false,
      affordable: true,
      hotkey: null,
      selected: i.senateOpen ?? false,
      race: false,
      built: 0,
      isBulldoze: false,
      isPath: false,
      panel: true,
      group: "offices",
    });
  }
  const t = i.tool;
  let tip: BuildTipVM | null = null;
  if (t === "path") tip = { kind: t, name: "Path", text: "Drag to lay paths. Buildings need one beside them or nobody visits.", upkeepText: "Right-drag to pan." };
  else if (t === "bulldoze") tip = { kind: t, name: "Bulldoze", text: "Click or drag over things to remove them. Refunds half.", upkeepText: null };
  else if (t) tip = { kind: t, name: defs().buildings[t].name, text: defs().buildings[t].blurb, upkeepText: `Upkeep ${formatMoney(defs().buildings[t].upkeepPerDay)}/day. Needs a path beside it.` };
  return { items, tip };
}

function staffOf(i: HudInput, earned: ReadonlySet<string>): StaffVM {
  const ops = i.snap.ops;
  const row = (o: (typeof ops.staff)[number]): StaffRowVM => ({ id: o.id, job: o.job, title: o.title, name: o.name, status: o.status, color: STAFF[o.job].color, zone: o.zone, leaving: o.leaving });
  const painting = i.zone === null ? null : ops.staff.find((o) => o.id === i.zone);
  return {
    open: i.staffOpen,
    count: ops.staff.length,
    payroll: ops.payroll,
    payrollText: ops.staff.length > 0 ? `${formatMoney(ops.payroll)}/day` : "nobody on the payroll",
    painting: painting ? row(painting) : null,
    // Only the kinds of staff the lab has unlocked can be hired.
    jobs: ops.jobs.filter((j) => earned.has(j.job)).map((j): StaffJobVM => ({ job: j.job, title: j.title, blurb: j.blurb, salary: j.salary, salaryText: `${formatMoney(j.salary)}/day`, count: j.count, max: j.max, canHire: j.canHire, reason: j.reason, color: STAFF[j.job].color })),
    roster: ops.staff.map(row),
    slopPct: ops.slopPct,
    broken: ops.broken.length,
  };
}

function speedOf(value: number, slowForBadNews: boolean): SpeedVM {
  return {
    value,
    paused: value === 0,
    options: SPEEDS.map((v) => ({ value: v, key: v === 0 ? "speed.pause" : `speed.${v}`, active: v === value })),
    slowForBadNews,
  };
}

/** How long (ticks, about 15 s at 1×) the coached opening thinks one bubble at a time once you've clicked Start. */
export const OPENING_QUIET_TICKS = 50;

function bubblesOf(i: HudInput, chips: ReadonlyMap<string, FactionChipVM>): BubbleVM[] {
  const chats = i.snap.chats ?? [];
  // Two people talking say their lines out loud instead of thinking: the visitor first, then your researcher.
  const talking = new Set(chats.flatMap((c) => (c.lines.length ? [c.hostId, c.guestId] : [])));
  // FLT-91: the first frame is the garage and its plaza, not two grey boxes over them. The lab keeps its thoughts to
  // itself until you click Start, then finds its voice one bubble at a time.
  const coached = i.snap.coach;
  const room = coached?.id === "start" ? 0 : coached && i.snap.tick < OPENING_QUIET_TICKS ? 1 : Infinity;
  const thoughts = i.snap.thoughts.filter((t) => !talking.has(t.walkerId)).slice(0, room).map((t): BubbleVM => {
    const faction = t.faction ? chips.get(t.faction) : undefined;
    return { id: t.id, walkerId: t.walkerId, kind: t.kind, speaker: i.snap.speakers[t.walkerId] ?? "", text: t.text, ...(faction ? { faction } : {}) };
  });
  const said = chats.flatMap((c) => c.lines.slice(0, 2).map((text, k): BubbleVM => {
    const walkerId = k === 0 ? c.guestId : c.hostId;
    return { id: -(c.id * 2 + k), walkerId, kind: k === 0 ? "visitor" : "researcher", speaker: c.names?.[k] || i.snap.speakers[walkerId] || "", text, speech: true };
  }));
  return [...thoughts, ...said];
}

/** A drama card's document, filled in from the pack's template. */
function dramaOf(id: string, vars: Record<string, string>): DramaDocVM | null {
  // A poaching offer is in the poacher's own voice (FLT-56).
  const l = dramaLetter(id, vars.poacherId);
  if (!l) return null;
  const f = (s: string) => fillTemplate(s, vars);
  return { style: l.style, file: f(l.file), from: f(l.from), to: f(l.to), subject: f(l.subject), lines: l.lines.map(f).filter((x) => x.trim().length > 0), sign: f(l.sign) };
}

function eventOf(i: HudInput): { event: EventVM | null; era: HudVM["eraCard"] } {
  const open = i.snap.event;
  const def = open ? defs().eventById(open.id) : undefined;
  if (!open || !def) return { event: null, era: null };
  const hearing = def.kind === "hearing" ? hearingOf(i.snap) : null;
  const vars = { ...i.snap.race.vars, lab: i.snap.labName, senator: hearing?.asking?.name ?? "The chair", act: i.snap.bill.act || "the bill", motion: i.snap.promises.motion?.title ?? "the motion" };
  if (def.kind === "era") {
    const n = Number(def.id.replace("era", ""));
    const era = ERAS[n - 1]!;
    return {
      event: null,
      era: { n, total: ERAS.length, name: era.name, kicker: def.stripe ?? "", line: fillTemplate(def.body, vars), changes: [...era.changes], continueLabel: def.choices[0]!.label },
    };
  }
  const rivals = i.snap.race.board.filter((r) => !r.you).slice(0, 3);
  return {
    era: null,
    event: {
      id: def.id,
      title: fillTemplate(def.title, vars),
      body: fillTemplate(def.body, vars),
      tone: def.tone,
      stripe: def.stripe ?? TONE_LABEL[def.tone],
      kind: def.kind === "auction" || def.kind === "response" || def.kind === "stream" || def.kind === "hearing" || def.kind === "leak" || def.kind === "drama" || def.kind === "bill" || def.kind === "vote" ? def.kind : def.kind === "report" && i.snap.audit.report ? "report" : "plain",
      choices: def.choices.map((c, k) => {
        const blocked = i.snap.eventBlocked?.[k];
        return blocked ? { label: c.label, hint: blocked, key: k + 1, disabled: blocked } : { label: c.label, hint: fillTemplate(c.hint, vars), key: k + 1 };
      }),
      paddles: def.kind === "auction" ? rivals.map((r, k) => ({ id: r.id, name: r.short, color: r.color, number: 200 + ((r.score * 7 + k * 31) % 800) })) : [],
      response: def.kind === "response" ? responseOf(i.snap, vars) : null,
      stream: def.kind === "stream" ? streamOf(i.snap, def.id, vars) : null,
      investigation: investigationOf(i.snap, def.id),
      hearing,
      leak: def.kind === "leak" ? leakOf(i.snap) : null,
      drama: def.kind === "drama" ? dramaOf(def.id, vars) : null,
      report: def.kind === "report" ? reportOf(i.snap) : null,
      bill: def.kind === "bill" ? billOf(i.snap) : null,
      tracker: def.kind === "vote" ? trackerOf(i.snap) : null,
    },
  };
}

const MOVE_LABEL: Record<HearingMoveVM["meter"], string> = { trust: "Trust", capture: "Capture", hype: "Hype", heat: "Heat" };
const arrows = (n: number) => (n > 0 ? "▲" : "▼").repeat(Math.abs(n) >= 8 ? 3 : Math.abs(n) >= 4 ? 2 : 1);

const SIDE_TEXT = { aye: "Aye", nay: "Nay", both: "Both" } as const;
const BILL_STATUS: Record<string, string> = {
  invited: "Draft", declined: "Shredded", floor: "On the floor", failed: "Voted down", law: "In force", exposed: "Exposed", fallout: "Fallout", sunset: "Sunset", quiet: "Nothing on the desk",
};

/** The button a beat offers while it plays (FLT-56): the leak's "Bury it", while the reporter is still asking. */
function beatActionOf(kind: string, s: Snapshot): BeatVM["action"] {
  const w = kind === "leak" ? billOf(s)?.warning : null;
  return w ? { id: "bury", label: w.buryText, enabled: w.canBury } : null;
}

/** Regulatory Capture's bill (FLT-22): the draft, the law, and what it does to each rival. */
export function billOf(s: Snapshot): BillVM | null {
  const b = s.bill;
  if (!b.enabled || !b.act) return null;
  const clauses = b.clauses.map((c) => ({ ...c }));
  const picked = clauses.filter((c) => c.on).length;
  const rivals = b.rivals.map((r) => ({
    id: r.id,
    name: r.name,
    tags: [
      ...(r.growth < 1 ? [`grows ${Math.round((1 - r.growth) * 100)}% slower`] : []),
      ...(r.pace < 1 ? [`trains ${Math.round((1 - r.pace) * 100)}% slower`] : []),
      ...(r.closed ? ["ships closed"] : []),
    ],
  }));
  return {
    stage: b.stage,
    act: b.act,
    fileName: `${b.act.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "")}_FINAL_v3.doc`,
    author: b.author,
    reporter: b.reporter,
    clauses,
    editable: b.stage === "invited",
    picked,
    pick: b.pick,
    pickText: `${picked} of ${b.pick} clauses`,
    status: b.stage === "law" && b.lawDays !== null ? `In force · day ${b.lawDays}` : (BILL_STATUS[b.stage] ?? b.stage),
    tally: b.ayes === null ? null : `${b.ayes}–${3 - b.ayes}`,
    leakText: b.stage === "law" ? `${(b.leakOdds * 100).toFixed(b.leakOdds < 0.1 ? 1 : 0)}% a day` : null,
    risk: b.risk,
    riskText: `${Math.round(b.risk * 100)}% before the sunset`,
    riskLabel: b.riskLabel,
    warning: b.warning
      ? {
          text: `${b.reporter} is asking about the file`,
          daysText: b.warning.daysLeft === 0 ? "The story runs tomorrow" : `The story runs in ${b.warning.daysLeft} day${b.warning.daysLeft === 1 ? "" : "s"}`,
          buryText: `Bury it (${formatMoney(b.warning.cost)})`,
          canBury: s.cash >= b.warning.cost,
        }
      : null,
    rivals,
  };
}

const TRACKER_STATUS: Record<string, string> = { recess: "In recess", dormant: "In recess", rollCall: "Roll call today" };

/** The Promise Tracker (FLT-23): the motion, three senators, what they said and how they will vote. */
export function trackerOf(s: Snapshot): TrackerVM | null {
  const p = s.promises;
  if (!p.enabled) return null;
  const last = p.last ? { title: p.last.title, passed: p.last.passed, tally: `${p.last.ayes}–${p.last.nays}` } : null;
  const status =
    p.stage === "campaign" ? (p.daysUntilVote === 0 ? "Roll call tomorrow" : `Roll call in ${p.daysUntilVote} day${p.daysUntilVote === 1 ? "" : "s"}`)
    : (p.stage === "passed" || p.stage === "failed") && last ? `${last.passed ? "Passed" : "Failed"} ${last.tally}`
    : (TRACKER_STATUS[p.stage] ?? p.stage);
  return {
    stage: p.stage,
    motion: p.motion ? { ...p.motion, stakes: p.motion.stakes ? { ...p.motion.stakes } : null, labSideText: `${s.labName} wants ${SIDE_TEXT[p.motion.labSide]}` } : null,
    status,
    lobbying: p.lobbying,
    senators: p.senators.map((sen) => ({
      id: sen.id,
      name: sen.name,
      role: sen.role,
      seat: sen.seat,
      look: { ...sen.look },
      said: sen.said,
      saidText: sen.said ? SIDE_TEXT[sen.said] : "-",
      line: sen.line,
      leaning: sen.leaning,
      oddsText: p.motion ? pct(sen.odds) : "-",
      lobbied: sen.lobbied,
      feeText: formatMoney(sen.fee),
      canLobby: p.lobbying && !sen.lobbied && s.cash >= sen.fee,
      truth: sen.truth,
      truthText: sen.truth === null ? "-" : `${sen.truth}%`,
      truthLabel: sen.truthLabel,
      record: `${sen.kept} kept · ${sen.broken} broken`,
      recent: sen.log.slice(-4).map((r) => ({ title: r.title, said: SIDE_TEXT[r.said], voted: SIDE_TEXT[r.voted], kept: r.kept, lobbied: r.lobbied })),
    })),
    last,
    held: p.held,
  };
}

function senateOf(i: HudInput): SenateVM {
  const tracker = trackerOf(i.snap);
  return { open: (i.senateOpen ?? false) && tracker !== null, tracker, bill: billOf(i.snap) };
}

/** The Hearing's witness table: the senators, the meters, and what each answer would move. */
function hearingOf(s: Snapshot): HearingVM | null {
  const h = s.hearing;
  if (!h.enabled) return null;
  const senators: SenatorVM[] = h.senators.map((sen) => ({ id: sen.id, name: sen.name, role: sen.role, seat: sen.seat, look: { ...sen.look }, asking: sen.asking, answered: sen.answered }));
  const labels = { ...MOVE_LABEL, trust: h.labels.trust, capture: h.labels.capture };
  const answers = (h.current?.options ?? []).map((o) => ({
    style: o.key,
    moves: (["trust", "capture", "hype", "heat"] as const).filter((m) => o[m] !== 0).map((m) => ({
      meter: m, label: labels[m], amount: o[m], arrows: arrows(o[m]), good: m === "capture" ? null : m === "heat" ? o[m] < 0 : o[m] > 0,
    })),
  }));
  const asked = Math.min(h.asked + 1, h.total);
  return {
    stage: h.stage,
    topic: h.topic,
    senators,
    asking: senators.find((x) => x.asking) ?? null,
    asked,
    total: h.total,
    progressText: h.verdict ? "Adjourned" : `Question ${asked} of ${h.total}`,
    trust: { label: h.labels.trust, value: h.trust, text: String(Math.round(h.trust)) },
    capture: { label: h.labels.capture, value: h.capture, text: String(Math.round(h.capture)) },
    answers,
    verdict: h.verdict,
  };
}

/** The yacht's leaked group chat, as the lab's rivals wrote it. */
function leakOf(s: Snapshot): LeakVM | null {
  const y = s.yacht;
  if (!y.enabled || y.chat.length === 0) return null;
  const members = [...new Set(y.chat.filter((m) => !m.system && m.from !== "yacht").map((m) => m.name))];
  return { yachtName: y.yachtName, groupName: y.groupName, rsvp: y.rsvp ?? "sign", members: `${members.join(", ")} + the yacht`, messages: y.chat.map((m) => ({ ...m })) };
}

const PREP_TEXT: Record<string, string> = { prep: "Prepped the paperwork", tidy: "Tidied up", usual: "Business as usual" };
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "\u2212" : ""}${Math.abs(Math.round(n))}`;

/** The auditors' report card, from the last one they published. */
function reportOf(s: Snapshot): ReportCardVM | null {
  const r = s.audit.report;
  if (!r) return null;
  const move = (n: number, what: string, good: boolean) => ({ text: `${signed(n)} ${what}`, tone: (n === 0 ? "neutral" : good === n > 0 ? "good" : "bad") as ToneVM });
  return {
    visitText: `Visit ${r.visit} \u00b7 ${formatDate(r.day)}`,
    lab: s.labName,
    grades: r.grades.map((g) => ({ id: g.id, label: g.label, grade: g.grade, score: Math.round(g.score), comment: g.comment })),
    overall: r.overall,
    prepText: r.prep ? (PREP_TEXT[r.prep] ?? null) : null,
    stamp: r.caught ? "CAUGHT HIDING" : r.swarm ? "SWARM FOUND" : null,
    caught: r.caught,
    swarm: r.swarm,
    inspected: r.inspected.map((k) => (defs().buildings as Record<string, { name: string } | undefined>)[k]?.name ?? k),
    moves: [move(r.moves.trust, "trust", true), move(r.moves.heat, "heat", false), move(r.moves.hype, "hype", true)].filter((m) => m.text[0] !== "0"),
    headline: r.headline,
  };
}

/** The pin over the auditors: where they are and what they are doing. */
function auditOf(s: Snapshot): AuditVM {
  const a = s.audit;
  const evals = a.phase === "evaluating";
  const line = !a.enabled ? null
    : a.stage === "countdown" && a.daysLeft !== null ? (a.daysLeft <= 0 ? "Auditors arrive today" : `Auditors arrive in ${a.daysLeft} day${a.daysLeft === 1 ? "" : "s"}`)
    : a.stage !== "visit" || a.visitors === 0 ? null
    : evals ? "Running their own evals"
    : a.phase === "inspecting" && a.stop ? `Inspecting the ${a.stop.name}`
    : a.phase === "huddling" ? "Comparing notes. Nobody breathe."
    : a.phase === "leaving" ? "Leaving, with footnotes"
    : a.stop ? `On their way to the ${a.stop.name}` : null;
  const progress = a.progress === null ? null : Math.max(0, Math.min(1, a.progress));
  return {
    enabled: a.enabled,
    stage: a.stage,
    daysLeft: a.daysLeft,
    visitors: a.visitors,
    phase: a.phase,
    line,
    progress,
    progressText: progress === null ? "" : `${Math.round(progress * 100)}%`,
    stopsText: a.stops > 0 ? `${Math.min(a.done + (a.stop ? 1 : 0), a.stops)}/${a.stops}` : "",
    evals,
    boxed: a.boxed,
  };
}

function thoughtsOf(i: HudInput): ThoughtRowVM[] {
  return i.snap.board.map((r) => ({ key: r.key, count: r.count, kind: r.kind, noun: NOUN[r.kind][r.count === 1 ? 0 : 1], text: r.text, highlighted: i.highlight === r.key }));
}

function arenaOf(i: HudInput): ArenaVM {
  const race = i.snap.race;
  const leaked = new Set(i.snap.disasters.leaked);
  return {
    open: i.arena.open,
    auto: i.arena.open && !i.arena.chosen,
    alert: i.arena.alert,
    week: race.week,
    rd: {
      mult: race.mult,
      multText: `${race.mult.toFixed(1)}×`,
      era: race.era,
      eraName: race.eraName,
      eraPct: race.eraPct,
      nextText: race.nextAt ? `Era ${race.era + 1} at ${race.nextAt}×` : "No more eras. Allegedly.",
      drop: race.drop ? { model: race.drop.model, daysLeft: Math.ceil(race.drop.daysLeft) } : null,
    },
    rows: race.board.map((r) => ({
      id: r.id,
      rank: r.rank,
      short: r.you ? `${r.short} (you)` : r.short,
      model: r.model || null,
      open: r.open,
      you: r.you,
      score: r.score,
      delta: r.delta,
      deltaText: r.delta > 0 ? `↑${r.delta}` : r.delta < 0 ? `↓${-r.delta}` : "",
      color: r.color,
      moved: i.arena.moved[r.id] ?? null,
      title: r.neo ? `${r.neo.founder}'s lab: "${r.neo.manifesto}"` : leaked.has(r.id) ? `Running on your leaked weights${r.model ? ` (${r.model})` : ""}` : r.model ? `Latest model: ${r.model}${r.open ? " (open weights)" : ""}` : r.you ? "You" : "No product. Big valuation.",
      leak: leaked.has(r.id),
      ...neoTag(r.neo, i.snap.day),
    })),
  };
}

/** How long a neo lab is NEW on the Arena. */
const NEW_DAYS = 14;
function neoTag(neo: Snapshot["race"]["board"][number]["neo"], day: number): Pick<ArenaRowVM, "tag" | "tagText"> {
  if (!neo) return { tag: null, tagText: "" };
  const tag = neo.nemesis ? "nemesis" : day - neo.founded < NEW_DAYS ? "new" : "alumni";
  return { tag, tagText: tag.toUpperCase() };
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

// ---- Disasters (FLT-32) ----------------------------------------------------------------------------------------------

const RISK_KEYS: readonly RiskVM[] = ["off", "rare", "normal", "chaos"];

function stageOf(phase: string): DisasterStageVM {
  if (phase === "warning" || phase === "aftermath" || phase === "done") return phase;
  if (phase === "active" || phase === "spread") return "active";
  return "response";
}

const meter = (value: number, words: readonly string[]): MeterVM => {
  const v = Math.round(Math.max(0, Math.min(100, value)));
  const word = words[Math.min(words.length - 1, Math.floor(v / (100 / words.length)))]!;
  return { value: v, word, text: `${v} · ${word}` };
};

function disastersOf(i: HudInput, enabled: boolean): DisastersVM {
  const d = i.snap.disasters;
  const nameOf = (id: string) => d.menu.find((m) => m.id === id)?.name ?? d.runs.find((r) => r.id === id)?.name ?? "disaster";
  const running = d.runs.map((r): DisasterRunVM => {
    const working = r.job !== null;
    const title = working ? (STAFF[r.job as keyof typeof STAFF]?.title ?? r.job) : "";
    return {
      id: r.id,
      name: r.name,
      phase: r.phase,
      stage: stageOf(r.phase),
      phaseLabel: PHASE_LABELS[r.phase] ?? r.phase,
      line: DISASTER_LINES[r.id]?.[r.phase] ?? d.menu.find((m) => m.id === r.id)?.blurb ?? "",
      progress: working ? r.progress : null,
      progressText: working ? `${title} ${pct(r.progress)}` : null,
      days: r.days,
      daysText: `Day ${r.days + 1}`,
    };
  });
  const understaffed = d.diverted.map((u): UnderstaffedVM => {
    const all = u.diverted >= u.total;
    const copy = UNDERSTAFFED[u.job];
    const title = STAFF[u.job].title;
    const vars = { n: String(u.diverted), total: String(u.total), name: nameOf(u.by) };
    return { job: u.job, title, diverted: u.diverted, total: u.total, all, text: copy ? fillTemplate(all ? copy.all : copy.some, vars) : `${u.diverted} of ${u.total} ${title} on the ${vars.name}.` };
  });
  const calm = !d.calm ? null : i.snap.models === 0 ? "Calm start: nothing random until your first release." : `Calm start: nothing random before day ${d.calmDay}.`;
  return {
    enabled,
    open: enabled && (i.disastersOpen ?? false),
    risk: d.risk,
    risks: RISK_KEYS.map((key) => ({ key, label: RISK_COPY[key].label, blurb: RISK_COPY[key].blurb, active: key === d.risk })),
    calm: d.risk === "off" ? null : calm,
    menu: d.menu.map((m) => ({ id: m.id, name: m.name, blurb: m.blurb, tags: m.tags.map((key) => ({ key, label: TAG_LABELS[key] ?? key })), active: m.active, available: m.available, reason: m.reason ?? null })),
    running,
    understaffed,
    trust: meter(d.trust, TRUST_WORDS),
    heat: meter(d.heat, HEAT_WORDS),
  };
}
const grouped = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** The forced-response card's numbers, straight from the snapshot: how baked the run is, what shipping now adds, the bug odds. */
function responseOf(s: Snapshot, vars: Record<string, string>): ResponseVM {
  const r = s.leapfrog.response;
  return {
    rival: vars.lfRival ?? "A rival",
    rivalModel: vars.lfModel ?? "their new model",
    model: s.training.name,
    ready: r.ready,
    readyText: pct(r.ready),
    shipText: `+${r.ship.toFixed(1)}`,
    holdText: `+${r.hold.toFixed(1)}`,
    bug: r.bug,
    bugText: pct(r.bug),
    holdDays: Number(vars.lfHoldDays ?? 0),
  };
}

/** The launch livestream as its audience sees it: who is watching, and what chat is saying about the mishap. */
function streamOf(s: Snapshot, eventId: string, vars: Record<string, string>): StreamVM {
  const mishap = eventId.replace(/^stream:/, "");
  const lines = STREAM_LINES[mishap] ?? STREAM_FALLBACK;
  const viewers = 4_000 + Math.round(s.hype * 220 + s.leapfrog.voice.yours * 60_000);
  return {
    mishap,
    model: vars.lfMine ?? s.latestModel ?? s.training.name,
    viewers,
    viewersText: grouped(viewers),
    caption: lines.caption,
    chat: lines.chat.map(([who, text]) => ({ who, text })),
  };
}

const scoreText = (kind: "score" | "elo", n: number | null) => (n === null ? "-" : kind === "elo" ? grouped(n) : n.toFixed(1));

/** The benchmark leaderboard and the news-cycle meter: the sim's numbers, worded, plus the real-time flourishes the caller tracked. */
function leapfrogOf(i: HudInput): LeapfrogVM {
  const lf = i.snap.leapfrog;
  const motion = i.leapfrog ?? NO_MOTION;
  if (!lf.enabled) return OFF_LEAPFROG;
  const holderShort = (id: string) => (id === "" ? "" : (lf.rows.find((r) => r.id === id)?.short ?? id));
  const live: BenchColumnVM[] = lf.benchmarks.map((b) => ({ id: b.id, name: b.name, short: b.short, kind: b.kind, status: b.status, bestText: scoreText(b.kind, b.best), holder: holderShort(b.holder), holderYou: b.holder === "you", isNew: b.isNew, ghost: false }));
  const ghosts: BenchColumnVM[] = motion.ghosts.map((g) => ({ id: g.column.id, name: g.column.name, short: g.column.short, kind: g.column.kind, status: "saturated", bestText: scoreText(g.column.kind, g.column.best), holder: holderShort(g.column.holder), holderYou: g.column.holder === "you", isNew: false, ghost: true }));
  const columns = [...live, ...ghosts];
  const flashCells = new Set(motion.flashCells);
  const flashRows = new Set(motion.flashRows);
  const rows: LeaderRowVM[] = lf.rows.map((r, at) => {
    const cells: BenchCellVM[] = [
      ...lf.benchmarks.map((b, k): BenchCellVM => ({ text: scoreText(b.kind, r.scores[k] ?? null), sota: r.sota[k] ?? false, maxx: r.maxx[k] ?? false, flash: flashCells.has(`${r.id}|${b.id}`) })),
      ...motion.ghosts.map((g): BenchCellVM => {
        const c = g.cells[r.id];
        return { text: scoreText(g.column.kind, c?.score ?? null), sota: c?.sota ?? false, maxx: c?.maxx ?? false, flash: false };
      }),
    ];
    return { id: r.id, rank: at + 1, name: r.name, short: r.short, label: r.you ? "You" : r.short, color: r.color, you: r.you, kind: r.kind, model: r.model || null, cells, wins: r.wins, flash: r.flash || flashRows.has(r.id) };
  });
  const hasMaxx = rows.some((r) => r.cells.some((c) => c.maxx));
  const notes = LEAPFROG.footnotes;
  const next = lf.next;
  const drop = lf.drop;
  return {
    enabled: true,
    columns,
    rows,
    footnote: notes.length > 0 ? `*${notes[lf.stats.maxxed % notes.length]}` : "*",
    hasMaxx,
    solved: lf.stats.solved,
    drop: drop && { lab: drop.name, model: drop.model, slot: drop.slot, daysAgo: drop.daysAgo, text: drop.slot === "lead" ? `${drop.name} launched ${drop.model}` : `${drop.name} answered with ${drop.model}` },
    nextText: next.answering ? "An answer lands tomorrow" : next.days <= 1 ? "Next launch tomorrow" : `Next launch in about ${next.days} days`,
    trust: Math.round(lf.trust),
    voice: voiceOf(lf, motion),
    pulse: lf.stats.drops,
  };
}

function voiceOf(lf: Snapshot["leapfrog"], motion: MotionView): VoiceVM {
  const shares = lf.voice.shares.slice().sort((a, b) => b.share - a.share).map((s) => ({ id: s.id, short: s.you ? "You" : (lf.rows.find((r) => r.id === s.id)?.short ?? s.name), color: s.color, share: s.share, pctText: pct(s.share), you: s.you }));
  const yours = lf.voice.yours;
  const youOwn = lf.voice.owner === "you";
  // You, then the three loudest rivals: what fits on a small graph.
  const plotted = [...shares.filter((s) => s.you), ...shares.filter((s) => !s.you).slice(0, 3)];
  const history = motion.history;
  const before = history.length > 6 ? (history[history.length - 7]!.shares.you ?? yours) : yours;
  const trend: TrendVM = yours - before > 0.02 ? "up" : yours - before < -0.02 ? "down" : "flat";
  return {
    shares,
    yours,
    yoursText: pct(yours),
    trend,
    owner: lf.voice.owner,
    youOwn,
    streak: lf.voice.streak,
    headline: lf.voice.owner === "" ? "The news cycle is up for grabs" : youOwn ? "You own the news cycle" : `${lf.voice.ownerName} owns the news cycle`,
    series: plotted.map((p) => ({ id: p.id, short: p.short, color: p.color, you: p.you, points: history.map((h) => h.shares[p.id] ?? 0) })),
  };
}

const OFF_LEAPFROG: LeapfrogVM = {
  enabled: false,
  columns: [],
  rows: [],
  footnote: "",
  hasMaxx: false,
  solved: 0,
  drop: null,
  nextText: "",
  trust: 0,
  voice: { shares: [], yours: 0, yoursText: "0%", trend: "flat", owner: "", youOwn: false, streak: 0, headline: "", series: [] },
  pulse: 0,
};

function moneyOf(s: Snapshot): StatsVM["money"] {
  const left = Math.max(0, s.money.maxRounds - s.money.rounds);
  return {
    stake: s.money.stake,
    stakeText: `${Math.round(s.money.stake)}%`,
    roundsLeft: left,
    roundsText: `${left} of ${s.money.maxRounds}`,
    overdraftDays: s.money.overdraftDay === null ? null : Math.max(0, s.money.overdraftDay - s.day),
  };
}

function outcomeOf(i: HudInput): OutcomeVM | null {
  const s = i.snap;
  // An ending is its own card: the front page (endingOf).
  if (s.outcome === "playing" || s.outcome === "ended" || i.outcomeDismissed) return null;
  const won = s.outcome === "won";
  const met = s.goals.filter((g) => g.met).length;
  return {
    won,
    headline: fillTemplate(won ? SCENARIO.winHeadline : SCENARIO.loseHeadline, { lab: s.labName }),
    stripe: won ? "Scenario complete" : "Game over",
    date: formatDate(s.day),
    stats: [
      { label: "Day", text: String(s.day), bad: false },
      { label: "Cash", text: formatMoney(s.cash), bad: s.cash < 0 },
      { label: "Revenue", text: `${formatMoney(s.income)}/day`, bad: false },
      { label: "Capability", text: String(Math.round(s.capability)), bad: false },
      { label: "Hype", text: String(Math.round(s.hype)), bad: false },
      { label: "Models", text: String(s.models), bad: false },
      // FLT-86: what the emergency rounds cost, if any were signed.
      ...(s.money.rounds > 0 ? [{ label: "Still yours", text: `${Math.round(s.money.stake)}%`, bad: s.money.stake < 100 }, { label: "Bailouts", text: `${s.money.rounds} of ${s.money.maxRounds}`, bad: true }] : []),
    ],
    note: won ? "All three milestones met." : `${met} of ${s.goals.length} milestones met.`,
  };
}

const NO_SHARE: ShareVM = { status: "idle", card: null, native: false, note: null };

/** How the lab ended, on a Frontier Times front page (FLT-11). */
function endingOf(i: HudInput): EndingVM | null {
  const view = i.snap.endings;
  const e = view?.ending;
  if (!view || !e || i.snap.outcome !== "ended" || i.outcomeDismissed) return null;
  const st = view.stats;
  const n = (x: number) => Math.round(x).toLocaleString("en-US");
  const { photo = null, ...share } = i.share ?? { ...NO_SHARE, photo: null };
  const social = i.social;
  const result = { ending: e.id, day: st.days, vibes: st.peakVibes, models: st.models };
  const link = `${social?.linkBase ?? ""}?${challengeQuery({ ...result, seed: view.seed, daily: view.dailyKey })}`;
  const streak = social && social.streak >= 2 ? { days: social.streak, text: streakText(social.streak) } : null;
  const friend = challengeOn(i);
  const verdict = friend ? compareRuns(result, friend) : null;
  const versus = friend && verdict ? { line: challengeLine(friend), verdict, text: VERDICT_TEXT[verdict] } : null;
  return {
    id: e.id,
    title: e.title,
    tone: e.tone,
    keepPlaying: e.keepPlaying,
    lab: i.snap.labName,
    paper: { masthead: "The Frontier Times", ...e.paper, photo },
    stats: [
      { key: "days", emoji: "📅", label: "Days", text: n(st.days) },
      { key: "vibes", emoji: "✨", label: "Peak Vibes", text: n(st.peakVibes) },
      { key: "models", emoji: "🚀", label: "Models released", text: n(st.models) },
      { key: "protesters", emoji: "📣", label: "Peak protesters", text: n(st.peakProtesters) },
      { key: "escaped", emoji: "🏃", label: "Agents escaped", text: n(st.agentsEscaped) },
    ],
    strip: view.strip,
    // The clipboard gets the streak, the head-to-head and the link too: the summary is what lands in the group chat.
    summary: [view.summary, ...(streak ? [`🔥 ${streak.text}`] : []), ...(versus ? [`🆚 ${versus.text}`] : []), `Beat it: ${link}`].join("\n"),
    daily: view.daily ? `Today's lab · ${view.daily}` : null,
    share,
    labNumber: view.labNumber,
    next: e.next,
    refound: view.refound ? { name: view.refound.name, labNumber: view.refound.labNumber, perks: view.refound.perks.map((p) => ({ ...p })) } : null,
    streak,
    versus,
    link,
  };
}

/** The friend's challenge applies while this is their lab: the same seed, and the first lab on it. */
function challengeOn(i: HudInput): Challenge | null {
  const c = i.social?.challenge;
  const view = i.snap.endings;
  return c && view && view.seed === c.seed && view.labNumber === 1 ? c : null;
}

/** The banner a friend's link opens on: "Your friend's lab was Captured on day 212. Beat it?" */
function challengeOf(i: HudInput): ChallengeVM | null {
  const c = challengeOn(i);
  if (!c || !i.social?.challengeOpen || i.snap.endings?.ending) return null;
  const def = endingById(c.ending);
  const n = (x: number) => Math.round(x).toLocaleString("en-US");
  return {
    line: challengeLine(c),
    ask: "Beat it?",
    ending: def?.title ?? c.ending,
    tone: def?.tone ?? "neutral",
    stats: `${n(c.vibes)} peak Vibes · ${c.models === 1 ? "1 model" : `${n(c.models)} models`}`,
    daily: i.snap.endings?.daily ? `Today's lab · ${i.snap.endings.daily}` : null,
    cta: "Beat it",
  };
}

/** The Memo: its countdown while it's coming (hidden under the card itself), then its extra edition until it's read. */
function memoOf(i: HudInput): MemoVM | null {
  const m = i.snap.endings?.memo;
  if (!m || i.snap.endings?.ending) return null;
  const key = `${i.snap.endings!.seed}:${m.day}`;
  if (m.phase === "coming") {
    if (i.snap.event) return null;
    const when = m.daysLeft === 0 ? "today" : m.daysLeft === 1 ? "tomorrow" : `${m.daysLeft} days`;
    const progress = 1 - Math.min(1, m.daysLeft / ENDING_RULES.memo.countdownDays);
    return { phase: "coming", key, daysLeft: m.daysLeft, progress, title: `The Memo · ${when}`, line: m.line, extra: null };
  }
  // A late edition, not a standing one: a game loaded a week after the Memo doesn't reprint it.
  if (!m.extra || !m.choice || i.social?.memoSeen === key || i.snap.day - m.day > 2) return null;
  return {
    phase: "extra",
    key,
    daysLeft: 0,
    progress: 1,
    title: "The Memo",
    line: m.chip ?? "",
    extra: {
      masthead: "The Frontier Times",
      kicker: m.extra.kicker,
      headline: m.extra.headline,
      deck: m.extra.deck,
      choice: m.label ?? m.choice,
      effects: [...m.effects],
      reactions: m.reactions.map((r) => ({ name: r.name, role: r.role, text: r.text })),
    },
  };
}

/** The Takeover under way: the lab's own model is in charge. */
function takeoverOf(i: HudInput): TakeoverVM | null {
  const view = i.snap.endings;
  if (!view?.managedBy) return null;
  return { manager: view.managedBy, title: `Frontier Lab Tycoon (managed by ${view.managedBy})`, placed: view.placed, thanks: view.thanks };
}

const editionRow = (e: Edition, unread: readonly string[]): EditionRowVM => ({
  id: e.id,
  type: e.type,
  kicker: e.type === "paper" ? "THE FRONTIER TIMES" : "WHAT JUST HAPPENED IN AI",
  date: formatDate(e.day - 1),
  headline: e.type === "paper" ? e.lead.text : e.topic,
  unread: unread.includes(e.id),
});

function paperOf(page: Extract<Edition, { type: "paper" }>): PaperVM {
  return {
    lab: page.lab,
    week: Math.floor(page.day / 7),
    range: `${formatDate(page.from)} — ${formatDate(page.day - 1)}`,
    leadKind: page.lead.kind === "filler" ? "The week in AI" : `${page.lead.kind} / campus dispatch`,
    lead: page.lead.text,
    photo: page.photo ?? null,
    caption: page.caption,
    substories: page.sub.map((st, k) => ({ id: st.id, label: ["Elsewhere", "Developing", "The back page"][k] ?? "", text: st.text, filler: st.kind === "filler" })),
    classified: page.classified,
    stocks: page.stocks.map((x) => ({ ...x })),
  };
}

function chatOf(chat: Extract<Edition, { type: "chat" }>, count: number): ChatVM {
  const face = (friend: keyof typeof FRIENDS) => FRIENDS[friend];
  const next = chat.messages[count];
  return {
    lab: chat.lab,
    topic: chat.topic,
    range: `${formatDate(chat.from)} — ${formatDate(chat.day - 1)}`,
    messages: chat.messages.slice(0, count).map((m) => ({ friend: m.friend, name: face(m.friend).name, subtitle: face(m.friend).subtitle, avatar: face(m.friend).avatar, text: m.text })),
    total: chat.messages.length,
    typing: next ? { friend: next.friend, name: face(next.friend).name, avatar: face(next.friend).avatar } : null,
    done: count >= chat.messages.length,
  };
}

function newsroomOf(i: HudInput): NewsroomVM {
  const { room } = i;
  const cardOpen = i.snap.event !== null;
  const view = cardOpen || room.view === null ? null : room.view === "archive" ? "archive" : room.view.type;
  const newest = room.archive.slice().reverse().find((e) => room.unread.includes(e.id));
  return {
    unread: room.unread.length,
    view,
    archive: room.archive.slice().reverse().map((e) => editionRow(e, room.unread)),
    storage: room.storage,
    arrival: newest && !room.view && !cardOpen ? { id: newest.id, type: newest.type, text: newest.type === "paper" ? "The Frontier Times is here." : "Mom and 3 others have thoughts." } : null,
    paper: view === "paper" && room.view !== "archive" && room.view?.type === "paper" ? paperOf(room.view) : null,
    chat: view === "chat" && room.view !== "archive" && room.view?.type === "chat" ? chatOf(room.view, i.chatCount) : null,
  };
}

function soundOf(i: HudInput): SoundVM {
  const covered = i.room.view !== null || i.snap.event !== null;
  return { open: i.mixer.open && !covered, muted: i.mixer.muted, master: i.mixer.master, music: i.mixer.music, sfx: i.mixer.sfx, ready: i.mixer.ready, cues: CUES.map((id) => ({ id, label: CUE_LABEL[id] ?? id })) };
}

function photoOf(i: HudInput): PhotoVM {
  const shot = i.photo.shot;
  return {
    on: i.photo.on,
    time: i.photo.time,
    times: PHOTO_TIMES,
    shot: shot ? { id: shot.id, url: shot.url, name: shot.name, label: shot.name.replace(/^frontier-lab-tycoon-/, "") } : null,
    flash: i.photo.flash,
  };
}

/** A New! card with its joke line (FLT-76). */
const quipped = (card: UnlockCardVM | null): UnlockCardVM | null => (card && UNLOCK_QUIPS[card.id] && !card.quip ? { ...card, quip: UNLOCK_QUIPS[card.id] } : card);

/** A toast that says what a standing warning already says is the warning: it is shown once. */
const spokenToasts = (i: HudInput) => i.toasts.filter((t) => !i.snap.warnings.includes(t.text));

/**
 * One standing hint at a time, and none while a toast is talking or the coach is (it has the floor); the gateway hint is redundant
 * once a toast has said it, and pointless while the Gateway is still locked.
 */
function standingHints(i: HudInput, play: PlayableInput): HudVM["hints"] {
  if (spokenToasts(i).length > 0 || play.coach) return [];
  return !i.snap.hasGateway && !i.toldGateway && play.buildings.has("gateway") ? ["gateway"] : i.tapHint ? ["tap"] : [];
}

function confirmOf(s: Snapshot): ConfirmVM | null {
  const p = s.pendingConfirm;
  if (!p) return null;
  return {
    kind: p.kind,
    cost: p.cost,
    costText: p.cost > 0 ? formatMoney(p.cost) : "free",
    runwayAfter: p.runwayAfter,
    runwayText: p.runwayAfter === null ? "∞" : `${p.runwayAfter.toFixed(1)} mo`,
    message: p.message,
  };
}

function helpOf(items: readonly BuildItemVM[]): HudVM["help"] {
  const buildings = items
    .filter((it) => !it.isBulldoze && !it.panel)
    .map((it) => ({ kind: it.kind, name: it.name, line: HELP_BUILDINGS[it.kind] ?? `${it.name}: ${it.blurb ?? ""}`.trim() }));
  return { title: HELP_TITLE, loop: [...HELP_LOOP], buildings, numbers: HELP_NUMBERS.map((n) => ({ ...n })) };
}

/** The note's one goal: the ladder rung's, or once the ladder is done the next open objective ("Top 3 on the Arena in Era 3 · Arena #6, need top 3"). */
function goalOf({ text, current, target, status, lowerIsBetter, objective, held }: PlayableInput["goal"]): GoalVM {
  const def = objective ? defs().goals.find((d) => d.id === objective) : undefined;
  // The sim says the progress in words when a count alone would not ("Revenue $26K of $40K a day · 3 of 12 visitors").
  const progress = status ?? (def?.unit === "rank" ? goalProgressText(def, current, held) : `${Math.min(current, target)}/${target}`);
  // A rank goal: #6 of a Top 3 is half way.
  const ratio = target > 0 ? Math.max(0, Math.min(1, lowerIsBetter ? (current > 0 ? target / current : 0) : current / target)) : 0;
  return { text, current, target, line: text ? `${text} · ${progress}` : "", progressText: progress, ratio };
}

/** What the lab has earned: only these tools are in the build panel (the bulldozer always is), and the Staff tile follows the payroll. */
function earnedItems(items: BuildItemVM[], play: PlayableInput): BuildItemVM[] {
  return items.filter((it) => (it.isBulldoze ? true : it.kind === "staff" ? play.visible.staff : it.kind === "senate" ? true : it.isPath || play.buildings.has(it.kind)));
}

export function hudViewModel(i: HudInput): HudVM {
  const vm = rawViewModel(i);
  return i.windows ? windowed(vm, i.windows.budget, unreadOf(i.news, i.windows.seen)) : vm;
}

function rawViewModel(i: HudInput): HudVM {
  const play = playableOf(i.snap);
  const build = buildOf(i);
  const items = earnedItems(build.items, play);
  // FLT-76: a big moment still waiting its turn stays off the screen, and an ending has it to itself.
  const stage = i.stage;
  const waits = (kind: StageView["waiting"][number]) => !!stage?.waiting.includes(kind);
  const solo = !!stage?.solo;
  const ending = waits("ending");
  const outcome = ending ? null : outcomeOf(i);
  // The outcome card stands alone (FLT-86): a card that opened the same night waits behind it for "Keep playing".
  const { event, era } = waits("card") || waits("era") || outcome ? { event: null, era: null } : eventOf(i);
  // Snapshots from before FLT-33 (fixtures, old links) have no `factions`: that is "off".
  const chips = factionChips(i.snap.factions);
  const vm: HudVM = {
    apiVersion: SKIN_API_VERSION,
    stats: statsOf(i),
    training: trainingOf(i.snap, stage),
    objectives: objectivesOf(i.snap),
    inspector: inspectorOf(i.snap.inspect, i.follow, i.snap.labName, chips, i.lookLabels),
    buildItems: items,
    buildTip: build.tip,
    mode: modeOf(items, i.tool, zoneOf(i)),
    speed: speedOf(i.speed, i.slowForBadNews ?? true),
    staff: staffOf(i, play.staff),
    senate: senateOf(i),
    bubbles: bubblesOf(i, chips),
    ticker: i.news.slice(-TICKER_ITEMS).map((n) => ({ id: n.id, text: n.text, tone: n.tone })),
    toasts: spokenToasts(i).map((t) => ({
      id: t.id,
      text: t.text,
      tone: t.tone,
      ...(t.batch ? { batch: t.batch.map((b) => ({ text: b.text, tone: b.tone })) } : t.snag ? { snag: true as const } : {}),
      ...(t.pinned ? { pinned: true as const } : {}),
    })),
    // One hint at a time, and none while a toast is talking; the gateway hint is redundant once a toast has said it.
    hints: standingHints(i, play),
    warnings: [...i.snap.warnings],
    progress: {
      level: play.level,
      levelName: play.levelName,
      goal: goalOf(play.goal),
      teasers: play.teasers.map((t) => ({ ...t })),
    },
    visible: play.visible,
    coach: play.coach,
    unlock: waits("level") || solo ? null : quipped(play.unlock),
    tray: [],
    help: i.helpOpen ? helpOf(items) : null,
    confirm: confirmOf(i.snap),
    event,
    thoughtsPanel: thoughtsOf(i),
    arena: arenaOf(i),
    leapfrog: leapfrogOf(i),
    papers: papersOf(i.snap, play.visible.papers, i.papersOpen ?? false),
    // A card, an era or the ending outranks a paper moment: it waits (the day window allowing) until they close.
    paperMoment: event || era || solo ? null : paperMomentOf(i.snap, play.visible.papers, i.dismissed ?? []),
    collusion: collusionOf(i.snap),
    crumbWiki: event || era || solo ? null : crumbWikiOf(i.snap, i.dismissed ?? []),
    factions: factionsOf(i.snap.factions, i.factionsOpen ?? false),
    birdapp: birdAppOf(i.snap, play.visible.birdapp, i.birdAppOpen ?? false),
    eraCard: era,
    outcome,
    audit: auditOf(i.snap),
    ending: ending ? null : endingOf(i),
    takeover: ending ? null : takeoverOf(i),
    memo: memoOf(i),
    challenge: challengeOf(i),
    newsroom: newsroomOf(i),
    sound: soundOf(i),
    photoMode: photoOf(i),
    // A card needs the player: the beat makes way. Photo mode hides it with the rest of the HUD.
    beat: i.beat && !event && !era && !solo && !i.photo.on ? { ...i.beat, kicker: BEAT_KICKER[i.beat.kind] ?? "Meanwhile", skipLabel: "Skip »", action: beatActionOf(i.beat.kind, i.snap) } : null,
    skins: i.skins,
    mods: i.mods ?? NO_MODS_VM,
    saves: i.saves ? savesViewModel(i.saves, { lab: i.snap.labName, day: i.snap.day }) : { ...NO_SAVES_VM, current: { lab: i.snap.labName, date: formatDate(i.snap.day) } },
    disasters: disastersOf(i, play.visible.disasters),
    drama: i.drama ?? NO_DRAMA_VM,
    layout: { width: i.viewport.width, height: i.viewport.height, phone: i.viewport.width <= 480, compact: i.viewport.width <= 640, tall: i.viewport.height >= 800 },
  };
  vm.widgets = widgetsOf({
    visible: vm.visible,
    leapfrog: vm.leapfrog.enabled,
    factions: vm.factions.enabled && vm.visible.factions,
    papers: vm.papers.enabled && vm.visible.papers,
    senate: items.some((it) => it.kind === "senate"),
    disasters: vm.disasters.enabled,
    birdapp: vm.birdapp.enabled && vm.visible.birdapp,
  });
  return vm;
}

/** The staffer whose patrol zone is being painted, if any. */
function zoneOf(i: HudInput): { name: string } | null {
  if (i.zone === null) return null;
  const o = i.snap.ops.staff.find((s) => s.id === i.zone);
  return o ? { name: o.name.split(" ")[0] ?? o.name } : null;
}

export type { WalkerKindVM };

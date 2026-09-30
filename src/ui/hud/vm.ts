// The HUD view-model: one pure function from the app's snapshot (and a little UI state) to plain JSON.
//
// This is the seam between the game and its skins. Skins render `HudVM` and call `HudActions`; nothing else about
// the game is reachable from them, so a change in the sim never breaks a mod and a mod can never touch the sim.
// Pure: no atoms, no DOM, no clocks, no random numbers. It is unit-tested against fixture snapshots (vm.test.ts).
import type { Snapshot, Tool } from "../../app/hud";
import { RACE_TOOLS, SPEEDS, TOOLS } from "../../app/hud";
import { BUILDINGS, PATH_PRICE } from "../../content/buildings";
import { ERAS } from "../../content/eras";
import { STAFF } from "../../content/staff";
import { TUTORIAL_STEPS } from "../../content/tutorial";
import { eventById } from "../../content/events";
import { GOALS, SCENARIO, type GoalDef } from "../../content/goals";
import { FRIENDS } from "../../content/newsroom";
import { ARENA_SIZE } from "../../content/rivals";
import { CUES } from "../../audio/score";
import type { Edition } from "../../newsroom/edition";
import { hourAt, clockLabel } from "../../render/fx/clock";
import { lookOf } from "../../render/look";
import { fillTemplate, formatDate, formatMoney } from "../../sim/format";
import type { Inspect, NeedBar } from "../../sim/inspect";
import type { NewsItem, Tone, WalkerKind } from "../../sim/types";
import { trendOf, VIBES_MAX, WEIGHTS } from "../../sim/vibes";
import { SKIN_API_VERSION } from "./types";
import type {
  ArenaVM, AssistantVM, BubbleVM, BuildItemVM, BuildTipVM, ChatVM, EditionRowVM, EventVM, HudVM, InspectorVM, NeedVM, NewsroomVM,
  ObjectivesVM, OutcomeVM, PaperVM, PauseReasonVM, PauseVM, PhotoVM, SkinPickerVM, SoundVM, SpeedVM, StaffJobVM, StaffRowVM, StaffVM, StatsVM, ThoughtRowVM, TrainingVM, WalkerKindVM,
} from "./types";

/** How many game days after a release the "SHIPPED!" sticker stays up. */
export const SHIPPED_DAYS = 3;
/** The newest headlines a ticker carries. */
export const TICKER_ITEMS = 24;

/** Everything the view-model needs besides the snapshot: small UI-only state, all of it plain data. */
export interface HudInput {
  snap: Snapshot;
  speed: number;
  tool: Tool | null;
  follow: boolean;
  highlight: string | null;
  toasts: readonly { id: number; text: string; tone: Tone }[];
  news: readonly NewsItem[];
  outcomeDismissed: boolean;
  /** Why the app is holding time (null while it runs): the pause button, a tutorial message, a menu, a card. */
  pauseReason: PauseReasonVM | null;
  /** "Tap anyone to read their mind" is still showing. */
  tapHint: boolean;
  /** A toast has already told the player about the API Gateway, so the standing hint would be a repeat. */
  toldGateway: boolean;
  /** The Staff panel is open, and whose patrol zone is being painted. */
  staffOpen: boolean;
  zone: number | null;
  arena: { open: boolean; alert: boolean; flinch: boolean; moved: Record<string, "up" | "down"> };
  room: { archive: readonly Edition[]; view: "archive" | Edition | null; unread: readonly string[]; storage: boolean };
  /** How many chat messages have arrived so far. */
  chatCount: number;
  mixer: { open: boolean; ready: boolean; muted: boolean; master: number; music: number; sfx: number };
  photo: { on: boolean; time: string; shot: { id: number; url: string; name: string } | null; flash: number };
  skins: SkinPickerVM;
  viewport: { width: number; height: number };
}

const goalDefs = new Map(GOALS.map((g) => [g.id, g]));

/** "Revenue $140K / $250K per day", "Runs 2 / 3", "Hype 47 / 60". */
export function goalProgressText(def: GoalDef, value: number): string {
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
      return value >= def.target ? `Arena #${ARENA_SIZE + 1 - Math.floor(value)} (top ${ARENA_SIZE + 1 - def.target} reached)` : `Arena #${ARENA_SIZE + 1 - Math.floor(value)}, need top ${ARENA_SIZE + 1 - def.target}`;
  }
}

const TONE_LABEL = { bad: "Breaking", joke: "Developing", good: "Good news", neutral: "Update" } as const;
const MOOD = { content: "Content", slumped: "Slumped", miserable: "Miserable", resigned: "Resigned" } as const;
const KIND = { researcher: "Researcher", agent: "Agent", visitor: "Visitor", protester: "Protester" } as const;
const NOUN: Record<WalkerKind, [string, string]> = {
  researcher: ["researcher", "researchers"],
  agent: ["agent", "agents"],
  visitor: ["visitor", "visitors"],
  protester: ["protester", "protesters"],
};
const SHORT: Record<Tool, string> = { path: "Path", cluster: "Cluster", hall: "Training Hall", gateway: "Gateway", kombucha: "Kombucha", nap: "Nap Pods", snack: "Snack Wall", demo: "Demo Stage", datacenter: "Datacenter", gas: "Gas Turbine", solar: "Solar Farm", bulldoze: "Bulldoze" };
const CUE_LABEL: Record<string, string> = { place: "Place", coin: "Coin", bulldoze: "Bulldoze", card: "News card", choice: "Choice", release: "Release", era: "New era", breakdown: "Alarm" };
export const PHOTO_TIMES = [
  { key: "live", label: "Live" },
  { key: "day", label: "Day" },
  { key: "golden", label: "Golden" },
  { key: "night", label: "Night" },
];

const toolName = (t: Tool) => (t === "path" ? "Path" : t === "bulldoze" ? "Bulldoze" : BUILDINGS[t].name);
const toolPrice = (t: Tool) => (t === "path" ? PATH_PRICE : t === "bulldoze" ? 0 : BUILDINGS[t].price);
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
  const runwayLow = s.runway !== null && s.runway < 6;
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
      ],
    },
    cash: { value: s.cash, text: formatMoney(s.cash), negative: s.cash < 0 },
    net: { value: s.net, text: `${s.net >= 0 ? "+" : "-"}${formatMoney(Math.abs(s.net))}/day`, good: s.net >= 0 },
    runway: { months: s.runway, text: s.runway === null ? "∞" : `${s.runway.toFixed(1)} mo`, warning: runwayLow },
    capability: { value: s.capability, latestModel: s.latestModel },
    hype: { value: s.hype },
    finance: { income: s.ledger.income, incomeText: formatMoney(s.ledger.income), expenses: s.ledger.expenses, expensesText: formatMoney(s.ledger.expenses) },
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

function trainingOf(s: Snapshot): TrainingVM {
  const pct = Math.floor(s.training.pct * 100);
  return {
    hasHall: s.hasHall,
    name: s.training.name,
    run: s.training.run,
    pct: s.training.pct,
    pctText: `${pct}%`,
    computePerDay: s.computePerDay,
    etaDays: s.training.etaDays,
    justShipped: s.lastRelease !== null && s.day - s.lastRelease <= SHIPPED_DAYS && s.models > 0,
    latestModel: s.latestModel,
  };
}

function objectivesOf(s: Snapshot): ObjectivesVM {
  const left = Math.max(0, SCENARIO.deadlineDay - s.day);
  return {
    done: s.goals.filter((g) => g.met).length,
    total: s.goals.length,
    daysLeft: left,
    urgent: left <= 60,
    deadline: formatDate(SCENARIO.deadlineDay),
    items: s.goals.map((g) => {
      const def = goalDefs.get(g.id)!;
      return { id: g.id, label: def.label, progress: goalProgressText(def, g.value), ratio: Math.max(0, Math.min(1, g.value / g.target)), met: g.met };
    }),
  };
}

function inspectorOf(who: Inspect | null, following: boolean, lab: string): InspectorVM | null {
  if (!who) return null;
  const drift = who.kind === "agent" ? (who.needs.find((n) => n.key === "drift")?.value ?? 0) : 0;
  const look = lookOf(who);
  return {
    id: who.id,
    lab,
    name: who.name,
    role: who.role,
    kind: who.kind,
    kindLabel: KIND[who.kind],
    mood: who.mood,
    moodLabel: MOOD[who.mood],
    status: who.status,
    thought: who.thought,
    history: [...who.history],
    needs: who.needs.map((n) => ({ key: n.key, label: n.label, value: n.value, pct: Math.round(n.value * 100), urgency: n.goodWhenHigh ? 1 - n.value : n.value, tone: barTone(n) })),
    portrait: { kind: who.kind, body: look.body, head: look.head, happiness: who.happiness, drift },
    following,
    badge: String(who.id).padStart(4, "0"),
  };
}

function buildOf(i: HudInput): { items: BuildItemVM[]; tip: BuildTipVM | null } {
  const s = i.snap;
  const race = s.race;
  const palette: Tool[] = [...TOOLS.filter((t) => t !== "bulldoze"), ...RACE_TOOLS.filter((t) => t !== "bulldoze" && t !== "path" && race.unlocked.includes(t)), "bulldoze"];
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
      blurb: t === "path" || t === "bulldoze" ? null : BUILDINGS[t].blurb,
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
    };
  });
  const ops = s.ops;
  items.push({
    kind: "staff",
    name: "Staff",
    short: `Staff${ops.staff.length > 0 ? ` (${ops.staff.length})` : ""}`,
    blurb: "Hire Janitor Bots, SREs, Comms Reps and Security.",
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
  });
  const t = i.tool;
  let tip: BuildTipVM | null = null;
  if (t === "path") tip = { kind: t, name: "Path", text: "Drag to lay paths. Buildings need one beside them or nobody visits.", upkeepText: "Right-drag to pan." };
  else if (t === "bulldoze") tip = { kind: t, name: "Bulldoze", text: "Click or drag over things to remove them. Refunds half.", upkeepText: null };
  else if (t) tip = { kind: t, name: BUILDINGS[t].name, text: BUILDINGS[t].blurb, upkeepText: `Upkeep ${formatMoney(BUILDINGS[t].upkeepPerDay)}/day. Needs a path beside it.` };
  return { items, tip };
}

/** The two hires the tutorial's "hire" step accepts (the same two `sim/commands.ts` counts). */
const STARTER_HIRES: ReadonlySet<string> = new Set(["janitor", "sre"]);

function staffOf(i: HudInput): StaffVM {
  const ops = i.snap.ops;
  const row = (o: (typeof ops.staff)[number]): StaffRowVM => ({ id: o.id, job: o.job, title: o.title, name: o.name, status: o.status, color: STAFF[o.job].color, zone: o.zone, leaving: o.leaving });
  const painting = i.zone === null ? null : ops.staff.find((o) => o.id === i.zone);
  return {
    open: i.staffOpen,
    count: ops.staff.length,
    payroll: ops.payroll,
    payrollText: ops.staff.length > 0 ? `${formatMoney(ops.payroll)}/day` : "nobody on the payroll",
    painting: painting ? row(painting) : null,
    jobs: ops.jobs.map((j): StaffJobVM => ({ job: j.job, title: j.title, blurb: j.blurb, salary: j.salary, salaryText: `${formatMoney(j.salary)}/day`, count: j.count, max: j.max, canHire: j.canHire, reason: j.reason, color: STAFF[j.job].color, starter: STARTER_HIRES.has(j.job) })),
    roster: ops.staff.map(row),
    slopPct: ops.slopPct,
    broken: ops.broken.length,
  };
}

function speedOf(value: number): SpeedVM {
  return {
    value,
    paused: value === 0,
    options: SPEEDS.map((v) => ({ value: v, key: v === 0 ? "speed.pause" : `speed.${v}`, active: v === value })),
  };
}

function bubblesOf(i: HudInput): BubbleVM[] {
  return i.snap.thoughts.map((t) => ({ id: t.id, walkerId: t.walkerId, kind: t.kind, speaker: i.snap.speakers[t.walkerId] ?? "", text: t.text }));
}

function eventOf(i: HudInput): { event: EventVM | null; era: HudVM["eraCard"] } {
  const open = i.snap.event;
  const def = open ? eventById(open.id) : undefined;
  if (!open || !def) return { event: null, era: null };
  const vars = { ...i.snap.race.vars, lab: i.snap.labName };
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
      kind: def.kind === "auction" ? "auction" : "plain",
      choices: def.choices.map((c, k) => ({ label: c.label, hint: fillTemplate(c.hint, vars), key: k + 1 })),
      paddles: def.kind === "auction" ? rivals.map((r, k) => ({ id: r.id, name: r.short, color: r.color, number: 200 + ((r.score * 7 + k * 31) % 800) })) : [],
    },
  };
}

function thoughtsOf(i: HudInput): ThoughtRowVM[] {
  return i.snap.board.map((r) => ({ key: r.key, count: r.count, kind: r.kind, noun: NOUN[r.kind][r.count === 1 ? 0 : 1], text: r.text, highlighted: i.highlight === r.key }));
}

function arenaOf(i: HudInput): ArenaVM {
  const race = i.snap.race;
  return {
    open: i.arena.open,
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
      title: r.model ? `Latest model: ${r.model}${r.open ? " (open weights)" : ""}` : r.you ? "You" : "No product. Big valuation.",
    })),
  };
}

function outcomeOf(i: HudInput): OutcomeVM | null {
  const s = i.snap;
  if (s.outcome === "playing" || i.outcomeDismissed) return null;
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
    ],
    note: won ? "All three milestones met." : `${met} of ${s.goals.length} milestones met.`,
  };
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

/** One standing hint at a time, and none while a toast or the tutorial is talking; the gateway hint is redundant once a toast has said it. */
function standingHints(i: HudInput): HudVM["hints"] {
  if (i.toasts.length > 0 || i.snap.assistant) return [];
  return !i.snap.hasGateway && !i.toldGateway ? ["gateway"] : i.tapHint ? ["tap"] : [];
}

function assistantOf(snap: Snapshot): AssistantVM | null {
  const a = snap.assistant;
  if (!a) return null;
  return {
    step: a.step,
    number: TUTORIAL_STEPS.indexOf(a.step) + 1,
    total: TUTORIAL_STEPS.length,
    message: a.message,
    highlight: a.highlight,
    paused: a.paused,
    waitingForBuild: snap.firstBuildPending,
    canSkip: a.canSkip,
  };
}

function pauseOf(reason: PauseReasonVM | null): PauseVM {
  return { paused: reason !== null, reason, auto: reason !== null && reason !== "player" };
}

export function hudViewModel(i: HudInput): HudVM {
  const build = buildOf(i);
  const { event, era } = eventOf(i);
  return {
    apiVersion: SKIN_API_VERSION,
    stats: statsOf(i),
    training: trainingOf(i.snap),
    objectives: objectivesOf(i.snap),
    inspector: inspectorOf(i.snap.inspect, i.follow, i.snap.labName),
    buildItems: build.items,
    buildTip: build.tip,
    speed: speedOf(i.speed),
    staff: staffOf(i),
    bubbles: bubblesOf(i),
    ticker: i.news.slice(-TICKER_ITEMS).map((n) => ({ id: n.id, text: n.text, tone: n.tone })),
    toasts: i.toasts.map((t) => ({ id: t.id, text: t.text, tone: t.tone })),
    // One hint at a time, and none while a toast is talking; the gateway hint is redundant once a toast has said it.
    hints: standingHints(i),
    assistant: assistantOf(i.snap),
    pause: pauseOf(i.pauseReason),
    event,
    thoughtsPanel: thoughtsOf(i),
    arena: arenaOf(i),
    eraCard: era,
    outcome: outcomeOf(i),
    newsroom: newsroomOf(i),
    sound: soundOf(i),
    photoMode: photoOf(i),
    skins: i.skins,
    layout: { width: i.viewport.width, height: i.viewport.height, phone: i.viewport.width <= 480, compact: i.viewport.width <= 640, tall: i.viewport.height >= 800 },
  };
}

export type { WalkerKindVM };

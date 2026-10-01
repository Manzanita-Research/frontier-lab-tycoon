// The modding contract: everything a skin may know about the game, as plain JSON, and everything it may ask for.
//
// A skin gets `vm` (a slice of `HudVM`) and `actions` (`HudActions`) and nothing else. It never imports `src/sim/**`,
// the app store or three. This file therefore imports nothing from the game either: every type here is written out,
// so a skin author (or an agent) can read this one file and know the whole surface. Bump `SKIN_API_VERSION` (and
// every skin's `apiVersion`) when a change here is not additive.

export const SKIN_API_VERSION = 1;

export type ToneVM = "neutral" | "good" | "bad" | "joke";
export type TrendVM = "up" | "down" | "flat";
export type WalkerKindVM = "researcher" | "agent" | "visitor" | "protester";
export type MoodVM = "content" | "slumped" | "miserable" | "resigned";

/** What can be placed. `path` and `bulldoze` are tools too. */
export type BuildKindVM = string;

export interface VibesRowVM {
  label: string;
  note: string | null;
  /** 0 to 1, for a mini bar. */
  fill: number;
  /** Signed points toward the total. */
  points: number;
}

export interface StatsVM {
  labName: string;
  /** "Y1 · Feb 1" */
  date: string;
  /** Short form of the date for a taskbar clock: "Y1 Feb 1". */
  dateShort: string;
  /** Campus time of day: "10:12 AM". */
  time: string;
  vibes: { value: number; target: number; max: number; trend: TrendVM; rows: VibesRowVM[] };
  cash: { value: number; text: string; negative: boolean };
  /** Net cash per day. */
  net: { value: number; text: string; good: boolean };
  runway: { months: number | null; text: string; warning: boolean };
  capability: { value: number; latestModel: string | null };
  hype: { value: number };
  finance: { income: number; incomeText: string; expenses: number; expensesText: string };
  arena: { rank: number; rankDelta: number; tone: "good" | "bad" | ""; deltaText: string; top: boolean; open: boolean; flinch: boolean };
  rd: { mult: number; multText: string; era: number };
}

export interface TrainingVM {
  hasHall: boolean;
  /** "Frontier-3-Reasoner" */
  name: string;
  run: number;
  /** 0 to 1 */
  pct: number;
  pctText: string;
  computePerDay: number;
  /** Days left at today's pace, or null. */
  etaDays: number | null;
  /** A release landed in the last few game days: show a "SHIPPED!" sticker. */
  justShipped: boolean;
  latestModel: string | null;
}

export interface ObjectiveVM {
  id: string;
  label: string;
  /** "Training runs 1 / 3" */
  progress: string;
  /** 0 to 1 */
  ratio: number;
  met: boolean;
}

export interface ObjectivesVM {
  done: number;
  total: number;
  daysLeft: number;
  urgent: boolean;
  /** "Y4 · Jan 1" */
  deadline: string;
  items: ObjectiveVM[];
}

export interface NeedVM {
  key: string;
  label: string;
  /** 0 to 1 */
  value: number;
  pct: number;
  /** How much it is shouting, 0 (fine) to 1 (desperate); this is what `tone` is cut from. */
  urgency: number;
  /** "ok" is fine, "warn" is nagging, "bad" is shouting. */
  tone: "ok" | "warn" | "bad";
}

export interface PortraitVM {
  kind: WalkerKindVM;
  /** CSS colours of the body and head of the 3D walker. */
  body: string;
  head: string;
  /** 0 to 1 */
  happiness: number;
  /** 0 to 1, agents only. */
  drift: number;
}

export interface InspectorVM {
  id: number;
  /** The lab they work for (or are visiting). */
  lab: string;
  name: string;
  role: string;
  kind: WalkerKindVM;
  kindLabel: string;
  mood: MoodVM;
  moodLabel: string;
  status: string;
  thought: string;
  /** Three lines of personnel file. */
  history: string[];
  needs: NeedVM[];
  portrait: PortraitVM;
  following: boolean;
  /** "0042" */
  badge: string;
  /** FLT-33: the faction they side with, for a chip on the card. Absent (or null) for nobody's, and before Level 4. */
  faction?: FactionChipVM | null;
}

export interface BuildItemVM {
  /** "path", "cluster", "hall", ... "bulldoze". Also the icon id. */
  kind: BuildKindVM;
  name: string;
  short: string;
  blurb: string | null;
  price: number;
  priceText: string;
  free: boolean;
  affordable: boolean;
  /** 1 to 9, or null. The game handles the key; this is for the label. */
  hotkey: number | null;
  selected: boolean;
  /** An auction prize (Datacenter, Gas Turbine, Solar Farm). */
  race: boolean;
  /** How many of it stand on the campus (for "most used" quick-launch). */
  built: number;
  isBulldoze: boolean;
  isPath: boolean;
  /** A tile that opens a window instead of picking a tool ("staff", "senate"): never the tool in your hand. */
  panel?: boolean;
  /**
   * FLT-63: where it goes in the Start menu. `tools` (Path, Bulldoze) stay at the top level; the rest are the groups of
   * the "Facilities ▸" submenu, in this order: `compute`, `research`, `amenities`, `offices`. The kit's `facilityGroups`
   * sorts a list of items into them. Absent: `amenities`.
   */
  group?: FacilityGroupVM;
}

/** FLT-63: the Start menu's groups. See `BuildItemVM.group`. */
export type FacilityGroupVM = "tools" | "compute" | "research" | "amenities" | "offices";

/**
 * FLT-63: the tool in your hand, as a mode: what the hint says and how it ends. `sticky` modes (Path, Bulldoze, painting a
 * patrol zone) stay on after each tile; a building drops out after one placement (Shift keeps it). Esc, a right-click, the
 * tool again or another tool always ends it. The host draws the hint ("Esc to stop building") near the pointer, or a
 * **Done ✕** button on touch screens; a skin only restyles `.mode-hint` / `.mode-done`, and may relabel them (strings
 * `mode.*`).
 */
export interface PlaceModeVM {
  kind: "path" | "bulldoze" | "building" | "zone";
  /** The tool ("path", "hall", ...), or null while painting a zone. */
  tool: BuildKindVM | null;
  /** "Path", "Training Hall", "Kevin's patrol". */
  name: string;
  sticky: boolean;
}

/**
 * FLT-63: a UI widget the Start menu's "Run…" can open (the Run dialog in Frontier 95): a window, a panel or a tab.
 * `actions.openWidget(id)` opens it (never shuts it), and a slot that keeps its own open state hears about it through
 * the kit's `useWidget(id, open)`. Only what the lab has earned is listed.
 */
export interface WidgetVM {
  /** "properties", "finance", "arena", "benchmarks", "thoughts", "traffic", "discourse", "papers", "news", "staff", "senate", "disasters", "drama", "mods", "help", "display", "sound". */
  id: string;
  /** "Thoughts" */
  name: string;
  /** What to type in a Run box: "thoughts.txt", "arena.exe". */
  file: string;
  /** One line for the list. */
  blurb: string;
  /** An icon id (the build icons' ids plus the widgets' own: "arena", "thoughts", "news", ...). */
  icon: string;
  /** Other names a Run box accepts ("finance", "money"). Lower case. */
  aliases: string[];
}

export interface BuildTipVM {
  name: string;
  text: string;
  upkeepText: string | null;
  kind: BuildKindVM;
}

export interface SpeedOptionVM {
  value: number;
  /** Strings key that names it: "speed.pause", "speed.1", "speed.3" or "speed.10". */
  key: string;
  active: boolean;
}

export interface SpeedVM {
  value: number;
  paused: boolean;
  options: SpeedOptionVM[];
}

export interface BubbleVM {
  id: number;
  walkerId: number;
  kind: WalkerKindVM;
  /** Who is thinking it (their name). */
  speaker: string;
  text: string;
  /** Said out loud to the person beside them, not thought (a VC's pitch by the Kombucha Bar): a skin may draw a speech balloon. */
  speech?: boolean;
  /** FLT-33: said as a member of this faction: tint the bubble with `faction.color` if you like. Absent for everyone else. */
  faction?: FactionChipVM | null;
}

export interface StaffRowVM {
  id: number;
  /** "janitor" | "sre" | "comms" | "security" */
  job: string;
  title: string;
  name: string;
  /** What they are up to. */
  status: string;
  /** A CSS colour for the job's swatch. */
  color: string;
  /** Tiles in their patrol zone (0: the whole campus). */
  zone: number;
  leaving: boolean;
}

export interface StaffJobVM {
  job: string;
  title: string;
  blurb: string;
  salary: number;
  salaryText: string;
  count: number;
  max: number;
  canHire: boolean;
  /** Why not, when `canHire` is false. */
  reason: string;
  color: string;
}

/** The payroll: hire and fire, and paint patrol zones. It opens from the build palette's "staff" tile. */
export interface StaffVM {
  open: boolean;
  count: number;
  payroll: number;
  payrollText: string;
  /** The staffer whose patrol zone is being painted on the map, if any. */
  painting: StaffRowVM | null;
  jobs: StaffJobVM[];
  roster: StaffRowVM[];
  /** Whole percent of the paths that are slopped, and how many buildings are out of order. */
  slopPct: number;
  broken: number;
}

export interface TickerItemVM {
  id: number;
  text: string;
  tone: ToneVM;
}

export interface ToastVM {
  id: number;
  text: string;
  /**
   * "hint" is a standing tip ("Build an API Gateway...") that is not dismissed, only goes away when it comes true.
   * "warn" is a standing warning ("Your entrance isn't connected...") that stays until the cause is fixed.
   */
  tone: ToneVM | "hint" | "warn";
  /**
   * A batch summary (FLT-51): the `you` notices that piled up while the one-per-15-seconds window was shut, oldest first.
   * `text` already says how many and leads with the worst, so a skin that ignores this still reads fine; a skin with room
   * can list them.
   */
  batch?: { text: string; tone: ToneVM }[];
  /**
   * FLT-84: the game hit a bug, caught it and kept going. Say so in the skin's voice (strings `snag.text`, `snag.copy`)
   * and offer `copySnag(id)`, which puts a bug report (the error, its stack, seed, tick, build, skin) on the clipboard.
   * A skin that ignores this still shows `text`.
   */
  snag?: true;
}

export type HintId = "gateway" | "tap";

/**
 * A spend the game wants confirmed before it goes through: it would leave the lab under three months of runway. Time is held
 * (a "card" pause) until it is answered, with `confirmSpend()` (do it anyway) or `cancelSpend()`.
 */
export interface ConfirmVM {
  kind: "hire" | "build";
  cost: number;
  /** "$600K", or "free". */
  costText: string;
  /** Months of runway it would leave, or null (no burn). */
  runwayAfter: number | null;
  /** "1.8 mo" */
  runwayText: string;
  /** "This leaves 1.8 months of runway. The board will have questions." */
  message: string;
}

// ---- Playable v1: what the player has unlocked, the coach marks, and the "New!" card ----

/** The HUD panels the player earns as the lab grows (a hidden panel is simply not drawn). */
export type HudPanelId = "revenue" | "vibes" | "arena" | "rnd" | "thoughts" | "news" | "staff" | "events" | "papers" | "disasters" | "factions" | "birdapp";
export type VisibleVM = Record<HudPanelId, boolean>;

/** What the build panel teases as locked: one row per milestone, how many it unlocks and the goal that earns them ("2 more · Ship your first model"). */
export interface TeaserVM {
  label: string;
  hint: string;
}

export interface GoalVM {
  /** "Ship your first model" */
  text: string;
  current: number;
  target: number;
  /** "Ship your first model · 0/1" */
  line: string;
  /** Just the progress, for a skin that shows it on its own line: "0/1", "$26K of $40K a day · 3 of 12 visitors". */
  progressText: string;
  /** 0 to 1 */
  ratio: number;
}

export interface ProgressVM {
  /** 1 to 5: "Garage", "Open for business", "Growing team", "The Race", "Scrutiny". */
  level: number;
  levelName: string;
  goal: GoalVM;
  teasers: TeaserVM[];
}

/**
 * One coach mark: a dimmed screen with a spotlight on `[data-coach="<target>"]`, and a line of copy. It waits for the player to do
 * the thing (never a Continue button, never a pause). `suggest` says where the map's ghost tiles are.
 */
export interface CoachVM {
  id: string;
  /** 1-based, of `of` ("3 of 7"). */
  step: number;
  of: number;
  text: string;
  /** "start", "build:path", "build:hall", "speed", "map:researcher", "training", "build:gateway", "stat:runway", "goals" or "map:suggest". */
  target: string;
  /** Dim everything but the target (a build step). Otherwise only the ring shows: nothing is dimmed while you wait. */
  dim?: boolean;
  /** An "info" line (waitFor "timer") fades on its own; the others wait for the action. */
  waitFor: "action" | "timer";
  canSkip: boolean;
}

/** The small "New!" card that comes with a level-up. */
export interface UnlockCardVM {
  id: string;
  title: string;
  body: string;
  items: string[];
}

/** Help ▸ How to play. Only present while the window is open. */
export interface HelpVM {
  title: string;
  /** The loop in five lines. */
  loop: string[];
  /** One line for each building you have unlocked. */
  buildings: { kind: string; name: string; line: string }[];
  /** What cash, runway, Vibes and hype mean. */
  numbers: { name: string; line: string }[];
}

export interface ChoiceVM {
  label: string;
  hint: string;
  /** 1 to 3: pressing the key picks it. */
  key: number;
  /** Why it can't be taken right now (a bid bigger than the bank): draw it greyed out, with this as its hint. */
  disabled?: string;
}

export interface AuctionPaddleVM {
  id: string;
  name: string;
  color: string;
  number: number;
}

/** The forced-response card ("Ship now at 94% ready or lose the news cycle"), with the live numbers behind its choices. */
export interface ResponseVM {
  /** The lab that just launched, and what. */
  rival: string;
  rivalModel: string;
  /** Your run's model, and how baked it is: 0 to 1, and "94%". */
  model: string;
  ready: number;
  readyText: string;
  /** Capability an early-access preview adds now ("+4.2"), and what the whole release would add ("+6.0"). */
  shipText: string;
  holdText: string;
  /** Odds of an embarrassing launch bug: 0 to 1, and "16%". */
  bug: number;
  bugText: string;
  /** Days a counter-launch has to land. */
  holdDays: number;
}

/** The launch livestream mishap card: the dog, the wrong chart, the frozen spinner. */
export interface StreamVM {
  /** The mishap's id in the Leapfrog pack ("dog", "wrongChart", ...). Mods add their own. */
  mishap: string;
  /** Your model, as the stream is titled. */
  model: string;
  viewers: number;
  viewersText: string;
  /** The one line a dialog says ("The demo has stopped responding. The dog has not."). */
  caption: string;
  /** What chat is saying, oldest first. */
  chat: { who: string; text: string }[];
}

/** One senator at the witness table (FLT-21). `look` is colours for a capsule portrait (the kit's `Senator` draws it). */
export interface SenatorVM {
  id: string;
  name: string;
  role: string;
  seat: string;
  look: { skin: string; suit: string; hair: string; tie: string; glasses: boolean };
  /** Asking the question on the table now. */
  asking: boolean;
  /** How the lab answered them this session ("earnest", "slick", "chaotic"), or null. */
  answered: string | null;
}

/** What one answer would move, beside its button: signed points, and arrows ("▲▲", "▼"). */
export interface HearingMoveVM {
  meter: "trust" | "capture" | "hype" | "heat";
  label: string;
  amount: number;
  arrows: string;
  /** Good for the lab's image (more trust, more hype, less heat). Capture is neither: it reads as "sly". */
  good: boolean | null;
}

/** The Hearing's card (a question, or the gavel at the end). The card's `choices` are the answers, in order. */
export interface HearingVM {
  /** "inSession" while questions are asked; the verdict id ("viral", "captured", "commended", "grilled") at the gavel. */
  stage: string;
  topic: string;
  senators: SenatorVM[];
  /** The senator asking, or null at the gavel. */
  asking: SenatorVM | null;
  /** "Question 2 of 3". */
  asked: number;
  total: number;
  progressText: string;
  /** The two meters, 0 to 100. */
  trust: { label: string; value: number; text: string };
  capture: { label: string; value: number; text: string };
  /** Per answer (same order as `choices`): its style ("earnest", "slick", "chaotic") and what it would move. */
  answers: { style: string; moves: HearingMoveVM[] }[];
  /** At the gavel: how it went. */
  verdict: { id: string; title: string; line: string } | null;
}

/** One clause of the bill (FLT-22): the legalese, what it really means, what it does to the race, and how shameless it is (1 to 3). */
export interface BillClauseVM {
  id: string;
  title: string;
  legal: string;
  plain: string;
  effect: string;
  shame: number;
  /** Ticked on the draft, or in the bill once it has gone to the floor. */
  on: boolean;
}
/** What the law in force does to one rival: short tags ("grows 45% slower", "ships closed"), empty when untouched. */
export interface BillRivalVM {
  id: string;
  name: string;
  tags: string[];
}
/** Regulatory Capture (FLT-22): the bill the lab was asked to "take a first pass" at. */
export interface BillVM {
  /** "invited" (the draft), "floor", "law", "exposed", or a resting stage ("quiet", "declined", "failed", "fallout", "sunset"). */
  stage: string;
  act: string;
  /** "The_Frontier_Freedom_Act_FINAL_v3.doc" */
  fileName: string;
  /** Who the file properties say wrote it, and the paper that will read them. */
  author: string;
  reporter: string;
  clauses: BillClauseVM[];
  /** The draft can be edited (clauses ticked with `actions.draftClause`). */
  editable: boolean;
  picked: number;
  pick: number;
  /** "1 of 2 clauses" */
  pickText: string;
  /** "Draft", "On the floor", "In force · day 21", "Exposed", ... */
  status: string;
  /** Ayes out of three at the last roll call ("2–1"), or null. */
  tally: string | null;
  /** The chance a day that someone opens the file properties ("0.4% a day"), while the law stands. */
  leakText: string | null;
  /**
   * FLT-56, the leak-risk meter: 0 to 1, the odds the file properties leak before the law sunsets (the draft as ticked,
   * at today's heat and trust; the law's days left once it stands), its text ("34% before the sunset") and a label.
   */
  risk: number;
  riskText: string;
  riskLabel: string;
  /** FLT-56: a reporter is asking about the file ("The story runs in 7 days") and the bury button (`actions.buryLeak`). Null: nobody is. */
  warning: { text: string; daysText: string; buryText: string; canBury: boolean } | null;
  /** What the law does to each rival, while it stands. */
  rivals: BillRivalVM[];
}

/** One senator on the Promise Tracker (FLT-23). */
export interface TrackerSenatorVM {
  id: string;
  name: string;
  role: string;
  seat: string;
  look: { skin: string; suit: string; hair: string; tie: string; glasses: boolean };
  /** What they promised about the motion on the docket, and the quote from the headline. */
  said: "aye" | "nay" | "both" | null;
  saidText: string;
  line: string;
  /** How they would vote today ("aye"/"nay"), and the odds they vote the lab's way ("62%"). */
  leaning: "aye" | "nay" | null;
  oddsText: string;
  lobbied: boolean;
  /** The lobbyists' fee, and whether it can be paid now (in session, not yet lobbied, the lab has the cash). */
  feeText: string;
  canLobby: boolean;
  /** Truth-o-meter: 0 to 100 (null before any vote), its label ("Pants Ablaze") and the score ("3 kept · 5 broken"). */
  truth: number | null;
  truthText: string;
  truthLabel: string;
  record: string;
  /** Their last votes, newest last: the motion, what they said, how they voted. */
  recent: { title: string; said: string; voted: string; kept: boolean; lobbied: boolean }[];
}
/** The Promise Tracker (FLT-23): the motion on the docket and three senators' promises, votes and Truth-o-meters. */
export interface TrackerVM {
  /** "recess", "campaign", "rollCall", "passed", "failed" (or "dormant"). */
  stage: string;
  /** `stakes` (FLT-56): what passing and failing would do, a line each (null: the motion does not say). */
  motion: { id: string; title: string; summary: string; labSide: "aye" | "nay"; labSideText: string; stakes: { pass: string; fail: string } | null } | null;
  /** "Roll call in 3 days", "In recess", "Passed 2–1" */
  status: string;
  /** Lobbying is open: `actions.lobby(id)`. */
  lobbying: boolean;
  senators: TrackerSenatorVM[];
  last: { title: string; passed: boolean; tally: string } | null;
  held: number;
}
/** The Senate window (a build-bar tile opens it once the Promise Tracker is awake). */
export interface SenateVM {
  open: boolean;
  tracker: TrackerVM | null;
  bill: BillVM | null;
}

/** The leaked group chat (FLT-24): the yacht's name, the group's, and who said what. */
export interface LeakVM {
  yachtName: string;
  groupName: string;
  /** "sign", "intern" or "decline": which chat leaked. */
  rsvp: string;
  members: string;
  messages: { from: string; name: string; color: string; you: boolean; system: boolean; time: string; text: string }[];
}

/** One subject on the auditors' report card. */
export interface ReportGradeVM {
  id: string;
  /** "Eval honesty" */
  label: string;
  grade: "A" | "B" | "C" | "D" | "F";
  /** 0 to 100. */
  score: number;
  /** The auditors' remark in the margin ("They brought their own evals. We brought ours. Ours were better."). */
  comment: string;
}

/** Evals Without Borders' report card (FLT-19): opens instead of EventCard for `event.kind === "report"`. */
export interface ReportCardVM {
  /** "Visit 2 · Day 131" */
  visitText: string;
  lab: string;
  grades: ReportGradeVM[];
  overall: "A" | "B" | "C" | "D" | "F";
  /** What the lab chose on the warning card ("Tidied up"), or null. */
  prepText: string | null;
  /** A stamp across the card: "CAUGHT HIDING", "SWARM FOUND", or null. */
  stamp: string | null;
  caught: boolean;
  swarm: boolean;
  /** Where they went, in order ("Compute Cluster", "Kombucha Bar", ...). */
  inspected: string[];
  /** What it did to you: ["+4 trust", "−3 heat", "+2 hype"]. */
  moves: { text: string; tone: ToneVM }[];
  /** The Frontier Times' headline about it. */
  headline: string;
}

/** The auditors on campus, for the pin over their heads (and anything else that wants to know). */
export interface AuditVM {
  /** Scrutiny is reached and the auditors exist. */
  enabled: boolean;
  /** "quiet" | "notice" | "countdown" | "visit" | "report" */
  stage: string;
  /** During the countdown: days until they arrive. */
  daysLeft: number | null;
  /** Auditors on campus. */
  visitors: number;
  /** "walking" | "inspecting" | "evaluating" | "leaving", or null when nobody is here. */
  phase: string | null;
  /** The pin's one line: "Inspecting Kombucha Bar", "Running their own evals", "Arriving in 3 days". Null: no pin. */
  line: string | null;
  /** 0 to 1 while they stand at a stop, and "60%". */
  progress: number | null;
  progressText: string;
  /** Stops finished of the plan: "2/4". */
  stopsText: string;
  /** They are running their own evals right now. */
  evals: boolean;
  /** The agents are in cardboard boxes. */
  boxed: boolean;
}

export interface EventVM {
  id: string;
  title: string;
  body: string;
  tone: ToneVM;
  /** The top-stripe text: "Breaking", "Developing", ... */
  stripe: string;
  /** "response" and "stream" are Release Leapfrog's cards: `response` / `stream` carry their extra data. "hearing" (FLT-21) and "leak" (FLT-24) carry `hearing` / `leak`; "drama" (FLT-26, FLT-20) carries `drama`; "report" is the auditors' report card (FLT-19, `report`); "bill" (FLT-22) and "vote" (FLT-23) carry `bill` / `tracker`. */
  kind: "plain" | "auction" | "response" | "stream" | "hearing" | "leak" | "drama" | "report" | "bill" | "vote";
  choices: ChoiceVM[];
  paddles: AuctionPaddleVM[];
  response: ResponseVM | null;
  stream: StreamVM | null;
  /** The collusion-sign card's evidence (FLT-46). Absent or null on every other card. */
  investigation?: InvestigationVM | null;
  /** The Hearing's witness table, on its question and gavel cards (optional: older fixtures leave it out). */
  hearing?: HearingVM | null;
  /** The leaked group chat, on the yacht's leak card. */
  leak?: LeakVM | null;
  /** The document a drama card is about: the resignation letter, the recruiter's email, the manifesto. */
  drama?: DramaDocVM | null;
  /** The auditors' report card (FLT-19), on its `report` card. */
  report?: ReportCardVM | null;
  /** The bill, on Regulatory Capture's draft and leak cards. */
  bill?: BillVM | null;
  /** The Promise Tracker, on its whip and roll-call cards. */
  tracker?: TrackerVM | null;
}

/** A drama card's document (Defection, the Poaching War). Every string is filled in; `lines` are paragraphs. */
export interface DramaDocVM {
  /** letter: a resignation letter someone is still drafting. email: a recruiter's offer. manifesto: a new lab's one-pager. */
  style: "letter" | "email" | "manifesto";
  /** What the file would be called ("resignation_DRAFT_v7.doc", "MANIFESTO.txt"). */
  file: string;
  from: string;
  to: string;
  subject: string;
  lines: string[];
  /** The sign-off; may contain a line break. */
  sign: string;
}

export interface ThoughtRowVM {
  key: string;
  count: number;
  kind: WalkerKindVM;
  /** "researchers" */
  noun: string;
  text: string;
  highlighted: boolean;
}

export interface ArenaRowVM {
  id: string;
  rank: number;
  short: string;
  model: string | null;
  open: boolean;
  you: boolean;
  score: number;
  /** Places gained (positive) or lost (negative) since last week. */
  delta: number;
  deltaText: string;
  color: string;
  moved: "up" | "down" | null;
  title: string;
  /** Lifted by a weights leak of yours that is still under way (FLT-32): mark it. */
  leak: boolean;
  /** A lab your own people founded (FLT-26, FLT-20): NEW for its first two weeks, NEMESIS once it has it in for you, ALUMNI after. */
  tag?: "new" | "nemesis" | "alumni" | null;
  /** "NEW", "NEMESIS", "ALUMNI" */
  tagText?: string;
}

export interface ArenaVM {
  open: boolean;
  /**
   * Open because the game opened it (at the start, or a rank drop called it), not the player (FLT-54): keep it narrow and
   * at the edge of the screen. Opened by the player, it takes its full width. Optional: the player's.
   */
  auto?: boolean;
  /** Headlines about the race since the player last had the Arena open (FLT-54): badge the folded window with a dot and the count. */
  unread?: number;
  alert: boolean;
  week: number;
  rd: {
    mult: number;
    multText: string;
    era: number;
    eraName: string;
    /** 0 to 1 */
    eraPct: number;
    nextText: string;
    drop: { model: string; daysLeft: number } | null;
  };
  rows: ArenaRowVM[];
}

// ---- Release Leapfrog (FLT-31): the benchmark leaderboard and the share-of-voice meter.

export interface BenchColumnVM {
  id: string;
  /** "MMLU-Pro-Max-Ultra" */
  name: string;
  /** "MMLU-PMU": what fits in a column head. */
  short: string;
  kind: "score" | "elo";
  /** live: open. crowded: a photo finish near the ceiling. saturated: declared solved (strike it through, stamp SOLVED). */
  status: "live" | "crowded" | "saturated";
  /** The best score on the board, formatted ("87.3", "1,412"). */
  bestText: string;
  /** Who holds it: their short name ("" when nobody), and whether that is you. */
  holder: string;
  holderYou: boolean;
  /** A harder replacement that joined in the last few days. */
  isNew: boolean;
  /** The sim has already retired it; it stays on the board a few seconds longer so the SOLVED stamp gets seen. */
  ghost: boolean;
}

export interface BenchCellVM {
  /** "87.3", "1,412", or "-" when the lab has no product to score. */
  text: string;
  /** Holds the record in this column. */
  sota: boolean;
  /** ...and the record was tuned for (a custom prompt, best of 64): show the asterisk. */
  maxx: boolean;
  /** The record just changed hands: blink the badge. */
  flash: boolean;
}

export interface LeaderRowVM {
  id: string;
  /** 1 = leads the most columns. */
  rank: number;
  name: string;
  short: string;
  /** What a narrow table prints: "You" for your row, else `short`. */
  label: string;
  color: string;
  you: boolean;
  kind: "you" | "frontier" | "neo" | "open" | "bigco";
  /** Their latest model, or null when they have no product. */
  model: string | null;
  /** One per entry of `columns`, in order. */
  cells: BenchCellVM[];
  /** How many columns they lead. */
  wins: number;
  /** They launched a moment ago: flash the row. */
  flash: boolean;
}

export interface VoiceShareVM {
  id: string;
  short: string;
  color: string;
  /** 0 to 1; everyone's add up to 1. */
  share: number;
  pctText: string;
  you: boolean;
}

export interface VoiceSeriesVM {
  id: string;
  short: string;
  color: string;
  you: boolean;
  /** Shares (0 to 1) at the end of each of the last game days, oldest first. Empty until the game has run a day. */
  points: number[];
}

/** The news cycle: whose launches, stunts and scandals people are talking about. It decays 15% a day. */
export interface VoiceVM {
  /** Biggest share first. */
  shares: VoiceShareVM[];
  yours: number;
  yoursText: string;
  trend: TrendVM;
  /** Who owns the cycle right now, or "" when it is up for grabs. */
  owner: string;
  youOwn: boolean;
  streak: number;
  /** "You own the news cycle", "Vast Sea Labs owns the news cycle", "The news cycle is up for grabs". */
  headline: string;
  /** You first, then the biggest rivals: what a "Network Traffic" graph plots. */
  series: VoiceSeriesVM[];
}

export interface LeapfrogVM {
  /** false when the pack is off (`?leapfrog=off`): draw nothing. */
  enabled: boolean;
  columns: BenchColumnVM[];
  rows: LeaderRowVM[];
  /** "*pass@256": the excuse for the latest benchmaxxed record, shown under the table while any cell carries an asterisk. */
  footnote: string;
  hasMaxx: boolean;
  solved: number;
  /** The latest launch, or null before the first. */
  drop: { lab: string; model: string; slot: "lead" | "answer"; daysAgo: number; text: string } | null;
  /** "Next launch in about 6 days" / "An answer lands tomorrow". */
  nextText: string;
  /** 0 to 100. */
  trust: number;
  voice: VoiceVM;
  /** Goes up by one with every launch: key an animation on it. */
  pulse: number;
}

export interface EraCardVM {
  n: number;
  total: number;
  name: string;
  kicker: string;
  line: string;
  changes: string[];
  continueLabel: string;
}

export interface OutcomeStatVM {
  label: string;
  text: string;
  bad: boolean;
}

export interface OutcomeVM {
  won: boolean;
  headline: string;
  stripe: string;
  date: string;
  stats: OutcomeStatVM[];
  note: string;
}

/** One number on the run summary: "📅 412 days". */
export interface EndingStatVM {
  key: "days" | "vibes" | "models" | "protesters" | "escaped";
  emoji: string;
  label: string;
  text: string;
}

/**
 * How the lab ended (FLT-11): a Frontier Times front page, the run summary, and the share card. Only while the front
 * page is up (`outcome === "ended"` and not waved away with Keep watching).
 */
export interface EndingVM {
  /** "takeover" | "regulated" | "acquihired" | "captured" | "pivot" (more may come from mods). */
  id: string;
  /** "The Takeover". */
  title: string;
  tone: "good" | "bad" | "neutral";
  /** Keep watching is offered (time goes on); otherwise only New lab / Today's lab. */
  keepPlaying: boolean;
  lab: string;
  paper: {
    masthead: string;
    kicker: string;
    headline: string;
    deck: string;
    /** The campus as it looked when the paper went to press (a data URL), or null until the photo is in. */
    photo: string | null;
    caption: string;
    subs: string[];
    classified: string;
    /** The last line: "Thanks for playing. We'll take it from here." */
    signoff: string;
    /** "Y3 · Mar 4". */
    date: string;
    /** "Vol. 3 · No. 64". */
    issue: string;
  };
  /** Days, peak Vibes, models released, peak protesters, agents escaped. */
  stats: EndingStatVM[];
  /** 🟦🟦🟩🟨🟥🤖: the run by era, in squares. */
  strip: string;
  /** The whole run summary, as `copySummary()` puts it on the clipboard. */
  summary: string;
  /** "Today's lab · Sep 30, 2026", or null for an ordinary seed. */
  daily: string | null;
  /** The share card (1200×630 PNG): its preview once made, and what the last share did. */
  share: ShareVM;
  /** Lab #1, #2, ... (FLT-57): a lab founded after the last one ended says so on the card. */
  labNumber: number;
  /**
   * What to do now (FLT-57): every ending ends on one clear action. "refound": Found a new lab, one button per perk in
   * `refound.perks` (`actions.foundLab(perk.id)`); "keepPlaying": time goes on (`actions.keepPlaying()`).
   */
  next: { action: "refound" | "keepPlaying"; label: string; prompt: string };
  /** The next lab's name ("Reward Hacking Holdings 2: This Time It's Aligned") and the perks it may keep. Null unless `next.action` is "refound". */
  refound: { name: string; labNumber: number; perks: RefoundPerkVM[] } | null;
  /** Days played in a row on this device, from 2 up ("7-day streak"); null otherwise. */
  streak: { days: number; text: string } | null;
  /** This run was a friend's challenge: their result, and who won. */
  versus: { line: string; verdict: "win" | "lose" | "tie"; text: string } | null;
  /** The friend link: this seed and this result, nothing personal (`actions.copyLink()` copies it). */
  link: string;
}

export interface RefoundPerkVM {
  /** "founder" | "loyal" | "seed". */
  id: string;
  /** "Famous founder". */
  label: string;
  /** "The press knows your name now. Hype starts 25 higher." */
  blurb: string;
}

/**
 * The Memo (FLT-57). "coming": the countdown, one line a day until the card lands (not modal; hide it under a card).
 * "extra": the extra edition, once a box is ticked: modal, holds time, closed with `actions.dismissMemo(key)`.
 */
export interface MemoVM {
  phase: "coming" | "extra";
  key: string;
  daysLeft: number;
  /** How far along the countdown is, 0 (the rumour) to 1 (on your desk). */
  progress: number;
  /** "The Memo · 3 days", "The Memo · tomorrow", "The Memo · today". */
  title: string;
  /** "Page two is the same chart, steeper." */
  line: string;
  extra: {
    masthead: string;
    kicker: string;
    headline: string;
    deck: string;
    /** "Race" or "Slow Down": the box that was ticked. */
    choice: string;
    /** From now on: "Training +25%", "The protest grows every day". */
    effects: string[];
    /** Three named staff, out loud. */
    reactions: { name: string; role: string; text: string }[];
  } | null;
}

/** A friend's challenge (FLT-57), from the link they sent: shown when the game opens on their seed. Holds time until answered. */
export interface ChallengeVM {
  /** "Your friend's lab was Captured on day 212." */
  line: string;
  ask: string;
  /** "Captured". */
  ending: string;
  tone: "good" | "bad" | "neutral";
  /** "88 peak Vibes · 7 models". */
  stats: string;
  /** "Today's lab · Sep 30, 2026", or null. */
  daily: string | null;
  /** The button: "Beat it" (`actions.dismissChallenge()`). */
  cta: string;
}

export interface ShareVM {
  /** "idle" | "making" | "ready" (the card is made) | "shared" | "saved" (downloaded) | "copied" (the summary) | "linked" (the friend link, FLT-57) | "error". */
  status: "idle" | "making" | "ready" | "shared" | "saved" | "copied" | "linked" | "error";
  /** The card, as an object URL, once made. */
  card: string | null;
  /** This device shares files (a phone): the button says Share, not Download. */
  native: boolean;
  /** A line to show under the buttons ("Saved frontier-lab-takeover.png"), or null. */
  note: string | null;
}

/** The Takeover while it plays: the lab is managed by its own model, and the cursor is not yours. */
export interface TakeoverVM {
  /** "Frontier-9". */
  manager: string;
  /** "Frontier Lab Tycoon (managed by Frontier-9)": the title bar, the tab and the banner. */
  title: string;
  /** Buildings the manager has placed. */
  placed: number;
  /** The last card: "Thanks for playing. We'll take it from here.", or null before it. */
  thanks: string | null;
}

export interface EditionRowVM {
  id: string;
  type: "paper" | "chat";
  /** "THE FRONTIER TIMES" */
  kicker: string;
  date: string;
  headline: string;
  unread: boolean;
}

export interface PaperVM {
  lab: string;
  week: number;
  range: string;
  leadKind: string;
  lead: string;
  photo: string | null;
  caption: string;
  substories: { id: number; label: string; text: string; filler: boolean }[];
  classified: string;
  stocks: { name: string; price: string; change: number }[];
}

export interface ChatMessageVM {
  friend: string;
  name: string;
  subtitle: string;
  avatar: string;
  text: string;
}

export interface ChatVM {
  lab: string;
  topic: string;
  range: string;
  /** The messages shown so far (they arrive one by one). */
  messages: ChatMessageVM[];
  total: number;
  /** Who is typing next, if anyone. */
  typing: { friend: string; name: string; avatar: string } | null;
  done: boolean;
}

export interface NewsroomVM {
  unread: number;
  /** What is open: nothing, the archive list, a paper or the chat. */
  view: null | "archive" | "paper" | "chat";
  archive: EditionRowVM[];
  /** false when localStorage is blocked, so editions live only for this visit. */
  storage: boolean;
  /** A fresh edition is waiting to be read. */
  arrival: { id: string; type: "paper" | "chat"; text: string } | null;
  paper: PaperVM | null;
  chat: ChatVM | null;
}

// ---- Papers (FLT-45, for FLT-28): publish or perish. Earned at Level 5 (`visible.papers`).

export type PublicationPolicyVM = "Open" | "Selective" | "Closed";

export interface PaperRowVM {
  id: string;
  /** "arXive:0010.04217": a fake-but-stable preprint number. */
  arxiveId: string;
  title: string;
  /** "A. Gradient, K. Backprop, Agent-0042 'Sparky' and 397 others" */
  byline: string;
  venue: string;
  status: "draft" | "review" | "published" | "criticized" | "awarded";
  /** "Draft", "In review · 12 days", "Published", "Scooped", "Best Paper" */
  statusText: string;
  tone: ToneVM;
  /** 0 to 1 through review, or null. */
  reviewPct: number | null;
  /** "1,204 citations" */
  citationsText: string;
  award: string | null;
  scoopedBy: string | null;
  /** A draft: it can go to arXive now, or into review. */
  canPublish: boolean;
}

export interface PublicationPolicyOptionVM {
  id: PublicationPolicyVM;
  label: string;
  blurb: string;
  active: boolean;
}

export interface PapersVM {
  /** false until papers are earned (and when the pack is off): draw nothing. */
  enabled: boolean;
  open: boolean;
  /** Headlines about your papers since the window was last open (FLT-54). */
  unread?: number;
  policy: PublicationPolicyVM;
  policies: PublicationPolicyOptionVM[];
  /** Reputation points, rounded (it only grows with good papers). */
  reputation: number;
  /** "Recruiting pull 1.25×" */
  recruitingText: string;
  /** 0 to 1: how loudly the researchers want to publish. */
  pressure: number;
  /** "Researchers are restless" and friends. */
  pressureText: string;
  /** "2 drafts · 1 in review · 5 out" */
  summary: string;
  drafts: number;
  /** Drafts first, then newest. */
  papers: PaperRowVM[];
}

/** The screenshot moments: a preprint on arXive, getting scooped, a Best Paper. Dismissed with `dismissPaperMoment(key)`. */
export interface PaperMomentVM {
  key: string;
  kind: "drop" | "scoop" | "award";
  paper: PaperRowVM;
  /** The drop: the arXive listing around yours ("New submissions for Tue"). */
  listing: { arxiveId: string; title: string; byline: string; you: boolean }[];
  /** The scoop: whose paper, and the two timestamps ("18 hours before you"). */
  rival: string | null;
  theirTitle: string | null;
  theirStamp: string | null;
  yourStamp: string | null;
  gapText: string | null;
  /** The award's name, for the certificate. */
  award: string | null;
  headline: string;
  /** A line of small print: arXive's load banner on a drop, the certificate's foot on an award. */
  note: string | null;
  /** Buttons that only close it, with jokes on them. The last one is the plain close. */
  buttons: string[];
}

// ---- Agent collusion (FLT-46, for FLT-18): signs, the investigation and the CrumbWiki reveal.

/** The evidence inside the collusion-sign card (present on `event.investigation` while it is open). */
export interface InvestigationVM {
  /** "+14%" */
  bonusText: string;
  /** Security staff who would go ("3 guards"), and for how long. */
  guards: number;
  guardsText: string;
  days: number;
  /** The packet log: "03:12  POST definitely-not-the-internet.local/wiki/Talk:Very_Normal_Sourdough  200 OK". */
  log: string[];
  /** One line from Security, straight-faced. */
  note: string;
}

/** A page of the wiki the agents have been running. */
export interface WikiPageVM {
  name: string;
  /** Lines of the page. */
  lines: string[];
}

/** The reveal once the Swarm ends (contained, partly contained or exposed). Close with `closeCrumbWiki(key)`. */
export interface CrumbWikiVM {
  key: string;
  ending: "contained" | "partlyContained" | "exposed";
  /** "CrumbWiki: the free sourdough encyclopedia anyone can edit" */
  site: string;
  url: string;
  title: string;
  /** The banner at the top: what happened. */
  banner: string;
  tone: ToneVM;
  talk: WikiPageVM;
  /** "rev 3,702 · Agent-0042 'Sparky' · reverted a revert of a revert" */
  history: string[];
  heartbeat: string;
  pages: string[];
  /** What it cost: "Capability −2", "Results withdrawn for 30 days". */
  consequences: string[];
  /** Exposed only: the Frontier Times front page. */
  frontPage: { masthead: string; headline: string; dek: string; classified: string } | null;
  closeLabel: string;
}

/** Collusion signs a skin may show (the world overlay draws the traffic itself). Present while the Swarm is on. */
export interface CollusionVM {
  enabled: boolean;
  /** An inquiry is under way: "Inquiry · day 3 of 7 · 2 guards on site". */
  inquiry: string | null;
  /** The agents' night out: "Kombucha After Dark · 12 agents". */
  gathering: string | null;
}

export interface SoundVM {
  open: boolean;
  muted: boolean;
  master: number;
  music: number;
  sfx: number;
  ready: boolean;
  cues: { id: string; label: string }[];
}

/**
 * A camera beat (FLT-56) on screen: letterbox bars and a caption while the camera makes its move. Time is still
 * running underneath; `actions.skipBeat()` (or Esc) ends it. `kind` is `exit` (a defection's conga line out of the
 * gate), `huddle` (the auditors conferring before the report card) or `viral` (the hearing clip).
 */
export interface BeatVM {
  id: number;
  kind: string;
  /** The small line in the top bar ("Breaking: a departure"). */
  kicker: string;
  caption: string;
  /** A second line, or "". */
  sub: string;
  skipLabel: string;
  /** FLT-56: a button the beat offers while it plays (the leak's "Bury it"): `actions.beatAction(id)`. Null: none. */
  action: { id: string; label: string; enabled: boolean } | null;
}

export interface PhotoVM {
  on: boolean;
  /** "live" | "day" | "golden" | "night" | "" (pinned by a link) */
  time: string;
  times: { key: string; label: string }[];
  /** The last photo taken, for the polaroid. */
  shot: { id: number; url: string; name: string; label: string } | null;
  /** Changes every time the shutter fires, for a flash. */
  flash: number;
}

/** FLT-33: how a faction feels about the lab. `protesting` is "Marching" once protests are unlocked (Level 5), "Furious online" before. */
export type FactionMoodVM = "calm" | "fan" | "upset" | "protesting";

/** A faction, small: enough for a chip on an inspector card or a tint on a bubble. */
export interface FactionChipVM {
  id: string;
  name: string;
  /** One short word ("Doom", "VC"). */
  short: string;
  /** CSS colour. */
  color: string;
  mood: FactionMoodVM;
  moodLabel: string;
}

export interface FactionRowVM extends FactionChipVM {
  /** The one thing they carry (a hoodie, a clipboard, a sandwich board). */
  prop: string;
  blurb: string;
  /** −100 (fed up) to 100 (adoring). */
  meter: number;
  /** "+42", "−17". */
  meterText: string;
  /** Their latest reason to feel the way they do ("Rushed launch. The timeline in their spreadsheet moved left."), or null. */
  why: string | null;
  /** Members on campus, and how many are at the gate with a sign. */
  members: number;
  marching: number;
  /** Followers off the map: "40K", "900K". */
  audienceText: string;
}

/** Two factions that are not merely cordial. `schism`: they were allies and have split (the headline). */
export interface FactionRelationVM {
  key: string;
  a: FactionChipVM;
  b: FactionChipVM;
  state: "allied" | "feuding";
  value: number;
  schism: boolean;
  /** "Doomers and Safetyists: allies", "Safetyists and Doomers: schism". */
  text: string;
}

/** The lab's position on one axis every faction has an opinion about. */
export interface StanceVM {
  axis: string;
  label: string;
  /** −1 to 1, and the words at each end ("Careful" … "Fast"). */
  value: number;
  low: string;
  high: string;
}

export interface FactionLogVM {
  id: number;
  day: number;
  text: string;
  tone: ToneVM;
  /** The colours of the factions it is about, for dots. */
  colors: string[];
}

/** The safety budget: a daily cost, a slower training run, and the Safetyists' attention. */
export interface SafetyOptionVM {
  level: number;
  label: string;
  costText: string;
  /** "−12% training" or "". */
  dragText: string;
  active: boolean;
}

/** FLT-69: how a post landed. `live`: still going up, not landed yet. */
export type BirdOutcomeVM = "live" | "flop" | "banger" | "controversy" | "ratioed" | "cancelled";

/** One post on the Bird App timeline. The numbers tick up while it is live and stop where it lands. */
export interface BirdPostVM {
  id: string;
  name: string;
  /** With the @. */
  handle: string;
  /** One character for the avatar. */
  glyph: string;
  archetype: string;
  text: string;
  /** "3:12 AM". */
  time: string;
  likes: number;
  reposts: number;
  replies: number;
  /** "1.2K" and so on, ready to print. */
  likesText: string;
  repostsText: string;
  repliesText: string;
  outcome: BirdOutcomeVM;
  /** "Banger", "Ratioed", "Cancelled"... or "" while live. */
  outcomeText: string;
  tone: "good" | "bad" | "neutral" | "joke";
  /** The "viral" sticker: a banger that has landed, or one taking off right now. */
  viral: boolean;
  /** Replies are outpacing the likes: a ratio (or worse) forming. */
  ratioing: boolean;
  /** The top reply, once there are replies ("" before). */
  reply: string;
  /** Comms read it first. */
  reviewed: boolean;
  /** "Comms got to it" / "It stuck" / "". */
  handledText: string;
  /** "@so_back_twice", when it answers someone (the Duo). */
  replyTo: string | null;
  /** "3am", "launch day"... or "". */
  momentText: string;
}

/** One of the three levers on a poster, with its trade-off printed on the button. */
export interface BirdLeverVM {
  id: "cook" | "comms" | "logoff";
  /** "Let them cook", "Run it by Comms", "Please log off". */
  label: string;
  /** "22% banger · 9% cancel", "no posts · −focus". */
  tradeoff: string;
  active: boolean;
}

/** One researcher's posting profile. */
export interface BirdPosterVM {
  id: number;
  name: string;
  handle: string;
  glyph: string;
  archetypeName: string;
  tier: "recluse" | "occasional" | "big" | "break";
  /** "Big account", "On a posting break (12 days)". */
  tierText: string;
  followersText: string;
  /** The banger↔cancel meter: their odds on an average post as the lever stands (0 on "Please log off"). */
  banger: number;
  cancel: number;
  /** "19% banger · 7% cancel". */
  meterText: string;
  /** Cancelled, still here, and every rival's recruiter knows the name. */
  hot: boolean;
  levers: BirdLeverVM[];
  /** "4 posts · 1 banger · 0 cancels". */
  record: string;
}

/** FLT-69: the Bird App panel. `enabled: false` until Level 3 (and with `?birdapp=off`); draw nothing then. */
export interface BirdAppVM {
  enabled: boolean;
  /** The panel is open (`actions.toggleBirdApp()`). */
  open: boolean;
  /** Bird App headlines since the panel was last open (FLT-54): the folded button's badge. It never opens itself. */
  unread?: number;
  /** The folded chip's line: "3 live · Aura 42". */
  headline: string;
  /** 0 to 100. */
  aura: number;
  auraText: string;
  /** What it does right now: "+6 Hype · visitors ×1.10 · applicants ×1.14". */
  auraEffects: string;
  /** The last 30 midnights, for a sparkline (0 to 100). */
  auraHistory: number[];
  /** Today's moments: "Launch day", "3am", "Water discourse"... */
  moments: string[];
  /** Posts that are up and have not landed, newest first. */
  live: BirdPostVM[];
  /** "@shipping_tmrw is typing…", or null. */
  typing: string | null;
  /** Posts that have landed, newest first. */
  log: BirdPostVM[];
  posters: BirdPosterVM[];
  /** "16 of 23 researchers": the list is the loudest first. */
  postersText: string;
  comms: {
    desk: "calm" | "busy" | "drowning";
    /** "Calm", "Busy: 3 in the queue", "Drowning: the PR team is underwater". */
    deskText: string;
    queue: { id: string; handle: string; kind: "controversy" | "cancelled"; text: string }[];
    /** "2 of 5 today". */
    capacityText: string;
    /** 0 to 1: how full the queue is against where it drowns. */
    load: number;
  };
  /** "142 posts · 12 bangers · 3 cancels". */
  tally: string;
  /** The newest post that landed a banger or a cancel (for a moment's sticker), or null. */
  spotlight: BirdPostVM | null;
}

/** FLT-33: the discourse. `enabled: false` until Level 4 (and with `?factions=off`); draw nothing then. */
export interface FactionsVM {
  enabled: boolean;
  /** The panel is open (`actions.toggleFactions()`). */
  open: boolean;
  /** Headlines about the discourse since the panel was last open (FLT-54). */
  unread?: number;
  /** Protests are unlocked (Level 5): factions march on the gate. */
  protests: boolean;
  rows: FactionRowVM[];
  stance: StanceVM[];
  relations: FactionRelationVM[];
  /** Newest first. */
  log: FactionLogVM[];
  /** Crowds at the gate right now; the water crowd has id "". */
  gate: GateCrowdVM[];
  /** "At the gate: 18 Water Discourse vs 12 Water Truthers Truthers", or "". */
  gateText: string;
  /** The folded panel's one line: "2 fans · 3 upset · Doomers marching". */
  headline: string;
  /** How many factions are fans, and how many are upset or worse (for a badge). */
  fans: number;
  angry: number;
  safety: { level: number; options: SafetyOptionVM[] };
  /** FLT-56: the Comms statement, the lever the gate legend pulls (`actions.issueStatement(faction)`). */
  statement: StatementVM;
}

/** One crowd at the gate (FLT-33), for the panel and the legend by the gate (FLT-56). */
export interface GateCrowdVM {
  id: string;
  name: string;
  color: string;
  count: number;
  /** A faction's crowd can be addressed with a statement; the water crowd is nobody's to address. */
  addressable: boolean;
}

/** FLT-56: what a statement costs and whether Comms can put one out now. */
export interface StatementVM {
  ready: boolean;
  /** "$15K". */
  costText: string;
  /** "Ready", or "Comms needs 3 days". */
  waitText: string;
  /** "Your Comms Rep writes it" or "The intern writes it (no Comms Rep)". */
  writerText: string;
}

export interface SkinInfoVM {
  id: string;
  name: string;
  author: string;
  description: string;
  version: string;
  /** URL of the preview image (may be empty). */
  preview: string;
  /** FLT-55: the name of the mod it came from (`?mod=`), absent for a built-in skin. */
  mod?: string;
}

/** FLT-55: a mod asks to put on its own skin. Nothing changes until the player says yes. */
export interface SkinOfferVM {
  /** The skin's id and name ("good-boy-95", "Good Boy 95"). */
  skin: string;
  name: string;
  /** The mod asking. */
  mod: string;
  modName: string;
  description: string;
  /** Preview image URL (may be empty). */
  preview: string;
}

/** One loaded mod, as the Mod Manager lists it. */
export interface ModInfoVM {
  id: string;
  name: string;
  version: string;
  author?: string;
  description?: string;
  /** The `?mod=` value it came from. */
  source: string;
  /** Content hash of its manifest (8 hex digits), saved with the run. */
  hash: string;
  /** A Daily Drama pack (FLT-34): the Today's Drama window describes it. */
  drama?: boolean;
  /** FLT-78: why Remove needs a fresh start (it reloads into a new lab), e.g. "Brings a look or sounds: needs a fresh start." Absent for a data-only mod, which Remove takes out of the running lab. */
  needsRestart?: string;
}

/** Start ▸ Settings ▸ Mods… (FLT-37): what `?mod=` loaded, what clashed and what failed. Mods only load from the URL. */
export interface ModsVM {
  open: boolean;
  /** In load order; later mods win a clash. */
  list: ModInfoVM[];
  /** "content.rivals.anthro: every-lab-is-steve, then my-mod (later wins)". */
  conflicts: string[];
  /** A mod that failed to load is skipped; the rest still load. */
  errors: string[];
  /** Hash of the whole resolved content, or null when running the base game. */
  contentHash: string | null;
}

/** A save, as the Save/Load window and "Welcome back" show it (FLT-65). */
export interface SaveSummaryVM {
  /** "Gradient Descent Labs" */
  lab: string;
  /** "Y2 · Mar 5" */
  date: string;
  day: number;
  /** "3 hours ago", "just now", "2 days ago" */
  ago: string;
  /** "45K" */
  size: string;
  /** The skin it was saved in ("Frontier 95"), or null. Loading puts it back on. */
  skin: string | null;
  /** Ids of the mods it was made with. */
  mods: string[];
}

/** "Welcome back" (FLT-82): the newest save on the shelf, whichever slot it is in. */
export interface WelcomeVM extends SaveSummaryVM {
  /** "auto", "1", "2", "3": where it is, and what `continueSave` loads. */
  slot: string;
  /** "Autosave", "Slot 2" */
  label: string;
}

/** One row of the Save/Load window: the autosave or a manual slot. */
export interface SaveSlotVM {
  /** "auto", "1", "2", "3": what `saveTo`, `loadFrom`, `deleteSave` and `exportSave` take. */
  slot: string;
  /** "Autosave", "Slot 1" */
  label: string;
  /** Null for an empty slot. */
  save: SaveSummaryVM | null;
  /** Something is there that isn't a readable save ("Scrambled"), or null. */
  broken: string | null;
}

/** A save made with mods this session doesn't have (or without ones it has). */
export interface SaveModPromptVM {
  lab: string;
  /** Mods the save needs that aren't running ("my-mod 1.2.0"). */
  missing: string[];
  /** Mods running now that the save was made without. */
  extra: string[];
  /** Every missing mod came with its `?mod=` link, so "Reload with its mods" can fetch them. */
  canFetch: boolean;
}

/** Saving and loading (FLT-65): the Save/Load window, "Welcome back", and the prompt about mods. */
export interface SavesVM {
  open: boolean;
  /** False when the browser keeps nothing (private browsing): the slots are off, Export and Import still work. */
  available: boolean;
  /** The autosave, then slots 1 to 3. */
  slots: SaveSlotVM[];
  /** The lab playing now: what Save writes. */
  current: { lab: string; date: string };
  /** "Welcome back": the newest save to continue (the autosave or a slot), or null. Time holds while it is up. */
  welcome: WelcomeVM | null;
  /** A load, save or import is under way. */
  busy: boolean;
  /** What just happened ("Saved to slot 2.", "That file isn't a lab save."), or null. */
  status: { text: string; tone: ToneVM } | null;
  modPrompt: SaveModPromptVM | null;
  /** How much of the browser's room the saves take: "92K of about 5 MB", and 0 to 1. */
  storage: { text: string; used: number };
  /** A file is being dragged over the page: show where to drop it. */
  dragging: boolean;
}

/** One published Daily Drama pack (FLT-34): a small parody mod about the day's industry news, merged after review. */
export interface DramaPackVM {
  id: string;
  /** "2026-09-29" */
  date: string;
  /** "Tue 29 Sep" */
  dateText: string;
  /** "today", "yesterday", "3 days ago" */
  ago: string;
  /** "The Perk Arms Race" */
  title: string;
  /** Two sentences on what happened. */
  description: string;
  /** Up to three of its headlines, ready to read. */
  teasers: string[];
  /** Its event card, and the first day it can turn up (`null` when that isn't a plain day). */
  event: { title: string; day: number | null } | null;
  /** "1 event card · 8 headlines · 7 thoughts · 1 rival tweak" */
  summary: string;
  /** Loaded in this run. */
  on: boolean;
}

/**
 * Today's Drama (FLT-34): the published feed, and the pack this lab has. `actions.playDrama(id)` adds a pack to the lab
 * on screen (FLT-78: no reload, no new lab), and `actions.removeMod(id)` takes it out again.
 */
export interface DramaVM {
  /** The Today's Drama window is open. */
  open: boolean;
  /** "idle" before anyone asked, "loading", "ready", or "error" when the feed could not be read. */
  status: "idle" | "loading" | "ready" | "error";
  /** The newest published pack, or null (none published yet, or not fetched yet). */
  latest: DramaPackVM | null;
  /** The older packs, newest first (only once the window has fetched them). */
  archive: DramaPackVM[];
  /** The pack loaded in this run, or null. */
  on: DramaPackVM | null;
  /** The newest pack is neither loaded nor looked at yet: badge the button. */
  fresh: boolean;
  /** The window opened by itself because a pack just loaded: say what's coming, not what's on offer. */
  intro: boolean;
  /** FLT-78: the id of the pack being added right now (fetching it), or null. */
  adding?: string | null;
  /** FLT-78: why the last add didn't happen, or null. */
  problem?: string | null;
}

export interface SkinPickerVM {
  open: boolean;
  /** The player asked for less motion (the Display dialog's switch); the OS setting counts too. */
  reducedMotion: boolean;
  /** The skin showing right now. */
  active: string;
  /** The skin that was showing when the picker opened (Cancel goes back to it). */
  original: string | null;
  list: SkinInfoVM[];
  /** Skins that were refused, with the reason. */
  rejected: { id: string; errors: string[] }[];
  /** FLT-55: a mod's request to switch to its skin, waiting on the player (the `ModSkinOffer` slot). */
  offer?: SkinOfferVM | null;
  /** FLT-73: the picture tube (Display Properties → Settings). Absent in old fixtures: treat as off. */
  crt?: CrtVM;
}

/** FLT-73: the CRT look over the whole game: a shader on the campus, faint glass over the UI. */
export interface CrtVM {
  /** On screen now: the player's pick, else the skin's default. "off" while photo mode is up. */
  mode: "off" | "subtle" | "full";
  /** The player's own pick, or null while the skin's default applies. */
  choice: "off" | "subtle" | "full" | null;
  /** What the campus is drawn with: the full shader, the one-pass version, or plain (the glass over the UI stays). */
  tier: "multi" | "lite" | "flat";
  /** The game turned the campus's shader down to keep the frame rate up. Picking a look again gives it another try. */
  reduced: boolean;
}

export interface LayoutVM {
  width: number;
  height: number;
  /** width ≤ 480 */
  phone: boolean;
  /** width ≤ 640 */
  compact: boolean;
  /** height ≥ 800 */
  tall: boolean;
}

// ---- Disasters (FLT-32): the menu, the alert for what is under way, who it pulled off their post, trust and heat.

export type RiskVM = "off" | "rare" | "normal" | "chaos";

export interface RiskOptionVM {
  key: RiskVM;
  label: string;
  blurb: string;
  active: boolean;
}

export interface DisasterTagVM {
  /** The content's tag ("fire", "rivals", ...): skins pick an icon by it, and show `label` for one they do not know. */
  key: string;
  label: string;
}

/** One row of the Disasters menu. */
export interface DisasterRowVM {
  id: string;
  name: string;
  blurb: string;
  tags: DisasterTagVM[];
  /** Under way right now. */
  active: boolean;
  /** Can be started now; if not, `reason` says why. */
  available: boolean;
  reason: string | null;
}

/** Where a disaster is: a skin can colour by it. The content's own state name is `phase`. */
export type DisasterStageVM = "warning" | "active" | "response" | "aftermath" | "done";

export interface DisasterRunVM {
  id: string;
  name: string;
  phase: string;
  stage: DisasterStageVM;
  /** "Warning", "Spreading", "Cleaning up"... */
  phaseLabel: string;
  /** One line, in the game's voice, about what is happening now. */
  line: string;
  /** Staff-hours done, 0 to 1, while somebody is working on it; null otherwise. */
  progress: number | null;
  /** "Security 42%", or null. */
  progressText: string | null;
  days: number;
  daysText: string;
}

/** A job with people pulled off their post by a disaster: "2 of 3 Security on the swarm. The gate is unguarded." */
export interface UnderstaffedVM {
  job: string;
  title: string;
  diverted: number;
  total: number;
  /** Everyone of the job is away (a gate with no guard, fires nobody fixes). */
  all: boolean;
  text: string;
}

export interface MeterVM {
  /** 0 to 100 */
  value: number;
  /** A word for where it is ("Wary", "Hearings"). */
  word: string;
  text: string;
}

export interface DisastersVM {
  /** Earned yet (Scrutiny). Draw nothing of this while false. */
  enabled: boolean;
  /** The menu is open. */
  open: boolean;
  risk: RiskVM;
  risks: RiskOptionVM[];
  /** Why random disasters are holding off ("...until your first release"), or null once they can come. */
  calm: string | null;
  menu: DisasterRowVM[];
  running: DisasterRunVM[];
  understaffed: UnderstaffedVM[];
  trust: MeterVM;
  heat: MeterVM;
}

/** What can sit on the taskbar (FLT-54): a window the game opened that is waiting its turn, or a panel with unread news. */
export type TrayIdVM = "arena" | "news" | "unlock" | "paper" | "wiki" | "papers" | "factions";
export interface TrayItemVM {
  id: TrayIdVM;
  /** The plain name ("Arena", "Frontier Times", the New! card's title). A skin may call it its own thing. */
  label: string;
  /** A window the game opened while two others were up: it waits here, flashing, until clicked (`actions.openTray(id)`). */
  flashing: boolean;
  /** Headlines about it that only reached the ticker since it was last open: draw a dot and the count. 0 for none. */
  unread: number;
}

export interface HudVM {
  apiVersion: typeof SKIN_API_VERSION;
  stats: StatsVM;
  training: TrainingVM;
  objectives: ObjectivesVM;
  inspector: InspectorVM | null;
  buildItems: BuildItemVM[];
  buildTip: BuildTipVM | null;
  /** FLT-63: the mode the pointer is in (a tool in hand, or painting a patrol zone), or null. */
  mode?: PlaceModeVM | null;
  /** FLT-63: what the Start menu's "Run…" can open, in list order. */
  widgets?: WidgetVM[];
  speed: SpeedVM;
  staff: StaffVM;
  /** The Senate window: the Promise Tracker and the bill (FLT-22/23). `tracker` is null until the pack wakes. */
  senate: SenateVM;
  bubbles: BubbleVM[];
  ticker: TickerItemVM[];
  toasts: ToastVM[];
  hints: HintId[];
  /** Standing warnings ("Your entrance isn't connected...", low runway with ways out): they stay until fixed. */
  warnings: string[];
  /** Where the lab is on the ladder, the one goal in front of you, and what the build panel teases. */
  progress: ProgressVM;
  /** Which HUD panels are earned yet. Draw only these. */
  visible: VisibleVM;
  /** The coach mark on screen, or null (none, skipped, or finished). */
  coach: CoachVM | null;
  /** The "New!" card, or null. */
  unlock: UnlockCardVM | null;
  /** The taskbar's waiting windows and unread panels (FLT-54), in the order they arrived. Docked: `WindowTray`. */
  tray: TrayItemVM[];
  /** Help ▸ How to play, while it is open. */
  help: HelpVM | null;
  /** A spend waiting for a yes or a no (also holds time). */
  confirm: ConfirmVM | null;
  event: EventVM | null;
  thoughtsPanel: ThoughtRowVM[];
  arena: ArenaVM;
  /** Release Leapfrog: the benchmark leaderboard and the share-of-voice meter. `enabled: false` when the pack is off. */
  leapfrog: LeapfrogVM;
  /** Papers: the panel, the policy and the list. `enabled: false` until earned. */
  papers: PapersVM;
  /** A paper moment on screen (the arXive drop, the scoop, the award), or null. */
  paperMoment: PaperMomentVM | null;
  /** Agent collusion: the signs, and the CrumbWiki reveal once it ends. */
  collusion: CollusionVM;
  crumbWiki: CrumbWikiVM | null;
  /** FLT-33: the factions and the lab's stance. `enabled: false` until Level 4. */
  factions: FactionsVM;
  /** FLT-69: the Bird App. `enabled: false` until Level 3. */
  birdapp: BirdAppVM;
  eraCard: EraCardVM | null;
  outcome: OutcomeVM | null;
  /** Evals Without Borders: the countdown and the tour. */
  audit: AuditVM;
  /** How the lab ended: the front page, the run summary and the share card (FLT-11). Null until one comes out. */
  ending?: EndingVM | null;
  /** The Takeover under way (or kept watching): who is in charge now. Null otherwise. */
  takeover?: TakeoverVM | null;
  /** The Memo's countdown, then its extra edition (FLT-57). Null otherwise. */
  memo?: MemoVM | null;
  /** A friend's challenge, until it is answered (FLT-57). */
  challenge?: ChallengeVM | null;
  newsroom: NewsroomVM;
  sound: SoundVM;
  photoMode: PhotoVM;
  /** A camera beat's letterbox and caption (FLT-56), or null. */
  beat: BeatVM | null;
  skins: SkinPickerVM;
  mods: ModsVM;
  /** Saving and loading (FLT-65). */
  saves: SavesVM;
  /** Disasters (FLT-32): `enabled: false` until the lab earns them. */
  disasters: DisastersVM;
  /** Today's Drama (FLT-34). */
  drama: DramaVM;
  layout: LayoutVM;
}

/** Everything a skin may ask the game to do. Each one is safe to call at any time; the game ignores what does not apply. */
export interface HudActions {
  /** Pick a build tool ("path", "cluster", ..., "bulldoze"). Picking the selected one puts it away; `null` clears. `"staff"` opens or closes the payroll, `"senate"` the Senate window. */
  place(kind: BuildKindVM | null): void;
  /** FLT-63: open a widget from `vm.widgets` (Run…). Opens, never toggles shut; an unknown or unearned id does nothing. */
  openWidget(id: string): void;
  setSpeed(speed: number): void;
  togglePause(): void;
  /** Answer the open event card. */
  choose(eventId: string, choiceIndex: number): void;
  /** Answer the era card (there is only one thing to press). */
  continueEra(): void;
  /** Open a walker's inspector, or close it with `null`. */
  select(walkerId: number | null): void;
  follow(walkerId: number, on?: boolean): void;
  closeInspector(): void;
  /** Light up who thinks a Thoughts row (`ThoughtRowVM.key`); again to switch off. */
  highlight(key: string): void;
  dismissToast(id: number): void;
  /** FLT-84: a snag toast's bug report onto the clipboard. Resolves false when the clipboard said no (the console has it too). */
  copySnag(id: number): Promise<boolean>;
  /** Answer `vm.confirm`: go ahead with the spend, or keep the runway. */
  confirmSpend(): void;
  cancelSpend(): void;
  /** The coach: skip it for good, or start it again (Start ▸ Help ▸ Replay tutorial). */
  coachSkip(): void;
  coachReplay(): void;
  /** Close the "New!" card. */
  dismissUnlock(): void;
  /** The build panel opened or shut (the coach's first step waits for it opening). Say it whenever yours does. */
  buildPanel(open: boolean): void;
  /** Help ▸ How to play. */
  openHelp(): void;
  closeHelp(): void;
  /** Hold time while a panel of yours is open (`id` names it; `false` lets go). Use `useAutoPause` from the kit. */
  holdTime(id: string, open: boolean): void;
  toggleArena(): void;
  /** A `WindowTray` button: bring up the waiting window, or open the panel (which marks its news read). */
  openTray(id: TrayIdVM): void;
  // Papers.
  togglePapers(): void;
  setPublicationPolicy(policy: PublicationPolicyVM): void;
  /** Send a draft to arXive now ("preprint") or into peer review ("review"). */
  publishPaper(paperId: string, route: "preprint" | "review"): void;
  dismissPaperMoment(key: string): void;
  // Agent collusion.
  closeCrumbWiki(key: string): void;
  // Disasters (FLT-32).
  openDisasters(): void;
  closeDisasters(): void;
  /** Start one now (ask first: the slot's job). Closes the menu. */
  triggerDisaster(id: string): void;
  setRisk(risk: RiskVM): void;
  /** FLT-33: open or fold the Factions panel. */
  toggleFactions(): void;
  /** FLT-69: open or fold the Bird App. */
  toggleBirdApp(): void;
  /** FLT-69: a poster's lever (`BirdPosterVM.id`): "cook", "comms" or "logoff". */
  setBirdLever(id: number, lever: BirdLeverVM["id"]): void;
  /** FLT-33: the safety budget, 0 (none) to 3 (lavish). Costs money every day and slows training; the Safetyists notice. */
  setSafetySpend(level: number): void;
  /** FLT-56: Comms puts out a statement to one faction (the gate legend). Costs money, then a cooldown; the sim may refuse with a toast. */
  issueStatement(faction: string): void;
  /** FLT-56: bury the story a reporter is chasing about the law (Regulatory Capture). */
  buryLeak(): void;
  /** FLT-56: press the button a camera beat offers (`BeatVM.action.id`). */
  beatAction(id: string): void;
  keepPlaying(): void;
  newLab(): void;
  /** Today's lab: a new lab on today's seed, the same campus as everyone else's today. */
  playDaily?(): void;
  /** The ending's share card: the Web Share sheet on phones, a PNG download elsewhere. */
  shareEnding?(): void;
  /** The run summary onto the clipboard. */
  copySummary?(): void;
  /** Found a new lab (FLT-57), keeping one perk (`EndingVM.refound.perks[].id`). */
  foundLab?(perk: string): void;
  /** The friend link onto the clipboard. */
  copyLink?(): void;
  /** Close a friend's challenge banner (and get going). */
  dismissChallenge?(): void;
  /** Close the Memo's extra edition (`MemoVM.key`). */
  dismissMemo?(key: string): void;
  // The payroll.
  closeStaff(): void;
  hire(job: string): void;
  fire(staffId: number): void;
  /** Start painting a staffer's patrol zone on the map (`null` stops). */
  paintZone(staffId: number | null): void;
  clearZone(staffId: number): void;
  // The Senate (FLT-22/23).
  closeSenate(): void;
  /** Send the lobbyists to a senator about the motion on the docket. */
  lobby(senatorId: string): void;
  /** Tick (or untick) a clause on the bill's draft. */
  draftClause(clauseId: string, on: boolean): void;
  // The news room.
  openNews(): void;
  /** Open an edition by id, or the archive with "archive". */
  viewNews(idOrArchive: string): void;
  closeNews(): void;
  skipNews(): void;
  revealChat(): void;
  // Sound.
  openMixer(): void;
  closeMixer(): void;
  setMuted(muted: boolean): void;
  setVolume(channel: "master" | "music" | "sfx", value: number): void;
  playCue(cue: string): void;
  /** End the camera beat on screen now (FLT-56): the bars go and the camera eases back. */
  skipBeat(): void;
  // Photo mode.
  setPhoto(on: boolean): void;
  setPhotoTime(key: string): void;
  takePhoto(): void;
  dismissShot(): void;
  // Skins.
  openSkinPicker(): void;
  /** Try a skin live without keeping it (the picker's dropdown). */
  previewSkin(id: string): void;
  /** Keep the skin showing and close the picker. */
  applySkin(): void;
  /** Go back to the skin the picker opened on and close it. */
  cancelSkinPicker(): void;
  setReducedMotion(on: boolean): void;
  /** FLT-73: pick the picture tube's look (remembered on this device; overrides the skin's default). */
  setCrt(mode: "off" | "subtle" | "full"): void;
  /** FLT-55: say yes to a mod's skin offer (it shows, and is remembered for that mod). */
  acceptSkinOffer(): void;
  /** Say no: the skin stays in the picker, and this mod will not ask again. */
  declineSkinOffer(): void;
  // Mods.
  openMods(): void;
  closeMods(): void;
  /** Switch a mod off. A data-only one leaves the lab on screen (FLT-78); one with `needsRestart` reloads without it (a new lab). */
  removeMod(id: string): void;
  // Today's Drama (FLT-34).
  openDrama(): void;
  closeDrama(): void;
  /** Add a published Drama pack to the lab on screen, by id (FLT-78): no reload, no new lab. Another Drama pack makes way. */
  playDrama(id: string): void;
  // Saves (FLT-65). `slot` is a SaveSlotVM's `slot`.
  openSaves(): void;
  closeSaves(): void;
  /** Save the lab playing now to a slot (over what is there). */
  saveTo(slot: string): void;
  loadFrom(slot: string): void;
  deleteSave(slot: string): void;
  /** Download a slot, or the lab playing now (`"current"`), as a `.fltsave` file. */
  exportSave(slot: string): void;
  /** Load a `.fltsave` file (a file picker's, or a drop's). */
  importSave(file: File): void;
  /** "Welcome back": load the autosave. */
  continueSave(): void;
  /** "Welcome back": play the new lab instead. */
  dismissWelcome(): void;
  /** The mods prompt: reload with the save's mods, then load it. */
  fetchModsAndLoad(): void;
  /** The mods prompt: load it with the mods running now. */
  loadWithoutMods(): void;
  cancelModPrompt(): void;
}

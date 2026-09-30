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
export type HudPanelId = "revenue" | "vibes" | "arena" | "rnd" | "thoughts" | "news" | "staff" | "events" | "papers" | "disasters";
export type VisibleVM = Record<HudPanelId, boolean>;

/** A locked item the build panel teases: "??? · ship your first model". */
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
  /** "start", "build:path", "build:hall", "training", "build:gateway", "stat:runway", "goals" or "map:suggest". */
  target: string;
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

export interface EventVM {
  id: string;
  title: string;
  body: string;
  tone: ToneVM;
  /** The top-stripe text: "Breaking", "Developing", ... */
  stripe: string;
  /** "response" and "stream" are Release Leapfrog's cards: `response` / `stream` carry their extra data. "drama" (FLT-26, FLT-20) carries `drama`. */
  kind: "plain" | "auction" | "response" | "stream" | "drama";
  choices: ChoiceVM[];
  paddles: AuctionPaddleVM[];
  response: ResponseVM | null;
  stream: StreamVM | null;
  /** The document a drama card is about: the resignation letter, the recruiter's email, the manifesto. */
  drama?: DramaVM | null;
}

/** A drama card's document (Defection, the Poaching War). Every string is filled in; `lines` are paragraphs. */
export interface DramaVM {
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
  /** A lab your own people founded (FLT-26, FLT-20): NEW for its first two weeks, NEMESIS once it has it in for you, ALUMNI after. */
  tag?: "new" | "nemesis" | "alumni" | null;
  /** "NEW", "NEMESIS", "ALUMNI" */
  tagText?: string;
}

export interface ArenaVM {
  open: boolean;
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

export interface SoundVM {
  open: boolean;
  muted: boolean;
  master: number;
  music: number;
  sfx: number;
  ready: boolean;
  cues: { id: string; label: string }[];
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

export interface SkinInfoVM {
  id: string;
  name: string;
  author: string;
  description: string;
  version: string;
  /** URL of the preview image (may be empty). */
  preview: string;
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

export interface HudVM {
  apiVersion: typeof SKIN_API_VERSION;
  stats: StatsVM;
  training: TrainingVM;
  objectives: ObjectivesVM;
  inspector: InspectorVM | null;
  buildItems: BuildItemVM[];
  buildTip: BuildTipVM | null;
  speed: SpeedVM;
  staff: StaffVM;
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
  /** Help ▸ How to play, while it is open. */
  help: HelpVM | null;
  /** A spend waiting for a yes or a no (also holds time). */
  confirm: ConfirmVM | null;
  event: EventVM | null;
  thoughtsPanel: ThoughtRowVM[];
  arena: ArenaVM;
  /** Release Leapfrog: the benchmark leaderboard and the share-of-voice meter. `enabled: false` when the pack is off. */
  leapfrog: LeapfrogVM;
  eraCard: EraCardVM | null;
  outcome: OutcomeVM | null;
  newsroom: NewsroomVM;
  sound: SoundVM;
  photoMode: PhotoVM;
  skins: SkinPickerVM;
  layout: LayoutVM;
}

/** Everything a skin may ask the game to do. Each one is safe to call at any time; the game ignores what does not apply. */
export interface HudActions {
  /** Pick a build tool ("path", "cluster", ..., "bulldoze"). Picking the selected one puts it away; `null` clears. `"staff"` opens or closes the payroll. */
  place(kind: BuildKindVM | null): void;
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
  keepPlaying(): void;
  newLab(): void;
  // The payroll.
  closeStaff(): void;
  hire(job: string): void;
  fire(staffId: number): void;
  /** Start painting a staffer's patrol zone on the map (`null` stops). */
  paintZone(staffId: number | null): void;
  clearZone(staffId: number): void;
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
}

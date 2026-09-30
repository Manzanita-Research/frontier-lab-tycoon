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
  /** One of the hires the guided opening asks for (the Janitor Bot, the SRE): a skin lights its Hire button while the tutorial points at "staff:hire". */
  starter: boolean;
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

/**
 * The guided opening, one step at a time. `highlight` is what the step points at: "build:path", "build:hall",
 * "build:gateway", "staff:hire" or "training". A slot lights the thing with `useHighlight(target)` (from the kit).
 */
export interface AssistantVM {
  /** The step's id ("path", "hall", "gateway", "hire" or "release"). */
  step: string;
  /** 1-based position among `total` steps, for "Step 2 of 5". */
  number: number;
  total: number;
  /** One sentence. */
  message: string;
  highlight: string;
  /** The game is holding time until the player taps Next or does the thing. */
  paused: boolean;
  /** The message is read, but the very first build is still to come: the clock starts on it. */
  waitingForBuild: boolean;
  canSkip: boolean;
}

/** Why time is standing still (null while it runs). Card: an event, era or outcome card is up. */
export type PauseReasonVM = "card" | "player" | "tutorial" | "build" | "menu" | "inspector";

export interface PauseVM {
  paused: boolean;
  reason: PauseReasonVM | null;
  /** The game paused it (a message, a menu, an inspector, a card), as opposed to the player pressing Pause. */
  auto: boolean;
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

export interface EventVM {
  id: string;
  title: string;
  body: string;
  tone: ToneVM;
  /** The top-stripe text: "Breaking", "Developing", ... */
  stripe: string;
  kind: "plain" | "auction";
  choices: ChoiceVM[];
  paddles: AuctionPaddleVM[];
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
  /** The tutorial's current step, or null once it is done or skipped. */
  assistant: AssistantVM | null;
  pause: PauseVM;
  /** Standing warnings ("Your entrance isn't connected...", low runway with ways out): they stay until fixed. */
  warnings: string[];
  /** A spend waiting for a yes or a no (also holds time). */
  confirm: ConfirmVM | null;
  event: EventVM | null;
  thoughtsPanel: ThoughtRowVM[];
  arena: ArenaVM;
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
  /** The tutorial: Next (also done by picking the highlighted build tool) and Skip. */
  continueTutorial(): void;
  skipTutorial(): void;
  /** Answer `vm.confirm`: go ahead with the spend, or keep the runway. */
  confirmSpend(): void;
  cancelSpend(): void;
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

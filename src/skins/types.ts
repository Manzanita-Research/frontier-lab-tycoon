// What a skin is, and what each of its slots is handed. Skins import types from here and from `../ui/hud/types`, and
// nothing else in the game: no `src/sim/**`, no store, no three.
import type { ComponentType, ReactNode } from "react";
import type {
  ArenaVM, AuditVM, BeatVM, BirdAppVM, BillVM, TrackerVM, ReportCardVM, BubbleVM, FactionsVM, BuildItemVM, BuildTipVM, ChatVM, CoachVM, ConfirmVM, DramaDocVM, DramaVM, SaveSummaryVM, SavesVM, EraCardVM, EventVM, HearingVM, HudActions, HudVM, LeakVM, InspectorVM, LayoutVM, LeapfrogVM, StreamVM,
  ModsVM, SkinOfferVM, NewsroomVM, ObjectivesVM, OutcomeVM, PaperVM, PhotoVM, SkinPickerVM, SoundVM, SpeedVM, StatsVM, ThoughtRowVM, TickerItemVM,
  StaffVM, TeaserVM, ProgressVM, ToastVM, TrainingVM, UnlockCardVM, VisibleVM, HelpVM, PapersVM, PaperMomentVM, CrumbWikiVM, DisastersVM,
  EndingVM, TakeoverVM, WidgetVM, PlaceModeVM, MemoVM, ChallengeVM,
} from "../ui/hud/types";
import type { Rect } from "./kit/place";

/** Every slot a skin may replace. `Layout` places the others. */
export const SLOT_NAMES = [
  "Layout",
  "Stats",
  "Training",
  "Objectives",
  "Inspector",
  "BuildBar",
  "Speed",
  "Staff",
  "Bubble",
  "ThoughtsPanel",
  "Ticker",
  "Toast",
  "Assistant",
  "EventCard",
  "Confirm",
  "Coach",
  "UnlockCard",
  "HowToPlay",
  "Arena",
  "Benchmarks",
  "Voice",
  "Factions",
  "BirdApp",
  "Livestream",
  "Hearing",
  "LeakedChat",
  "DramaCard",
  "Bill",
  "PromiseTracker",
  "EraCard",
  "FrontPage",
  "GroupChat",
  "PhotoButton",
  "PhotoOverlay",
  "SkinPicker",
  "Outcome",
  "Ending",
  "Takeover",
  "NewsControls",
  "NewsArrival",
  "NewsRoom",
  "Mixer",
  "ModManager",
  "ModSkinOffer",
  "Papers",
  "PaperMoment",
  "CrumbWiki",
  "DisasterMenu",
  "DisasterAlert",
  "ReportCard",
  "AuditPin",
  "Beat",
  "GateLegend",
  "DramaButton",
  "Drama",
  "Memo",
  "Challenge",
  "Welcome",
  "SaveLoad",
] as const;
export type SlotName = (typeof SLOT_NAMES)[number];

/** The slots that sit in the HUD all the time, already rendered, for the Layout to place. */
export const DOCKED_SLOTS = ["Stats", "Training", "Objectives", "Inspector", "BuildBar", "Speed", "Staff", "ThoughtsPanel", "Ticker", "Toasts", "Assistant", "Arena", "Benchmarks", "Voice", "Factions", "BirdApp", "NewsControls", "NewsArrival", "PhotoButton", "Papers", "DisasterAlert", "DramaButton"] as const;
export type DockedSlot = (typeof DOCKED_SLOTS)[number];

/** What the Layout receives: the docked slots as elements (or null when there is nothing to show) plus the whole VM. */
export interface LayoutProps {
  vm: HudVM;
  actions: HudActions;
  slots: Record<DockedSlot, ReactNode>;
}

/** Props of every slot. Each gets its slice of the view-model and the actions. */
export interface SlotPropsMap {
  Layout: LayoutProps;
  /** `visible` (absent means everything) says which numbers are earned yet: at level 1 only cash, runway and the date show. */
  Stats: { stats: StatsVM; layout: LayoutVM; visible?: VisibleVM; actions: HudActions; /** Trust and regulator heat live here too (FLT-32), once `disasters.enabled`. */ disasters?: DisastersVM };
  Training: { training: TrainingVM; actions: HudActions };
  /** `progress.goal` is the one goal in front of you ("Ship your first model · 0/1"); the scenario list is `objectives`, shown once `visible.arena`. */
  Objectives: { objectives: ObjectivesVM; progress?: ProgressVM; visible?: VisibleVM; layout: LayoutVM; actions: HudActions };
  Inspector: { inspector: InspectorVM; layout: LayoutVM; actions: HudActions };
  /** The build panel: `items` are only what is unlocked, `teasers` the locked ones, one row per milestone ("2 more · Ship your first model"). Report each opening with `actions.buildPanel(true)`. */
  BuildBar: { items: BuildItemVM[]; tip: BuildTipVM | null; teasers?: TeaserVM[]; layout: LayoutVM; actions: HudActions; /** For a Start menu with a Disasters entry (FLT-32): `disasters.enabled` says it is earned. */ disasters?: DisastersVM; /** FLT-63: what "Run…" can open (`vm.widgets`). */ widgets?: WidgetVM[]; /** FLT-63: the mode the pointer is in, so the tool in hand can say how to put it down. */ mode?: PlaceModeVM | null };
  Speed: { speed: SpeedVM; stats: StatsVM; actions: HudActions };
  /** The payroll panel (hire, fire, paint patrol zones). Only rendered while `staff.open`. */
  Staff: { staff: StaffVM; actions: HudActions };
  /** One bubble. The game pins whatever this renders to the walker, every frame. */
  Bubble: { bubble: BubbleVM; actions: HudActions };
  ThoughtsPanel: { rows: ThoughtRowVM[]; layout: LayoutVM; actions: HudActions };
  Ticker: { items: TickerItemVM[]; actions: HudActions };
  /** One toast. */
  Toast: { toast: ToastVM; actions: HudActions };
  /** Hints and the tips host. Needs the whole view-model to be helpful. */
  Assistant: { vm: HudVM; actions: HudActions };
  EventCard: { event: EventVM; actions: HudActions };
  /** A spend waiting for a yes or a no (it would leave under three months of runway). Modal; time is held while it is up. */
  Confirm: { confirm: ConfirmVM; actions: HudActions };
  /**
   * The coach mark's balloon (the paperclip in Frontier 95). The host draws the dimming and the ring; `anchor` is where the spotlit
   * thing is on screen (or null), and `panel` the popup it sits in if that popup is marked `data-coach-panel` (a build menu): keep
   * the balloon off all of it. `avoid` is the open windows it should keep off as well (pass it to `placeBalloon`).
   */
  Coach: { coach: CoachVM; anchor: Rect | null; panel?: Rect | null; avoid?: Rect[]; layout: LayoutVM; actions: HudActions };
  /** The small "New!" card that comes with a level-up. */
  UnlockCard: { unlock: UnlockCardVM; actions: HudActions };
  /** Help ▸ How to play: one window. `actions.closeHelp()`, and `actions.coachReplay()` for "Replay tutorial". */
  HowToPlay: { help: HelpVM; actions: HudActions };
  /** The R&D multiplier, era and the Arena. Also gets the Release Leapfrog data, so a skin can host the leaderboard in a tab (Frontier 95's Task Mangler does): compose `useSlots().Benchmarks`. */
  Arena: { arena: ArenaVM; leapfrog: LeapfrogVM; layout: LayoutVM; actions: HudActions };
  /** The benchmark leaderboard: labs down the side, benchmarks across, SOTA badges, SOLVED stamps. Docked (a Layout may place it) and composable by Arena. */
  Benchmarks: { leapfrog: LeapfrogVM; layout: LayoutVM; actions: HudActions };
  /** The share-of-voice meter: who has the news cycle, and the last sixty days of it. Docked. */
  Voice: { leapfrog: LeapfrogVM; layout: LayoutVM; actions: HudActions };
  /**
   * FLT-33: the discourse. Each faction's meter and mood (and why), the lab's stance on five axes, who is allied or
   * feuding, who is at the gate, and the safety budget (`actions.setSafetySpend(level)`). Folded to `factions.headline`
   * until `factions.open` (`actions.toggleFactions()`). Docked; only rendered once `factions.enabled` and `visible.factions`.
   */
  Factions: { factions: FactionsVM; layout: LayoutVM; actions: HudActions };
  /**
   * FLT-69: the Bird App. Folded to `birdapp.headline` (and the Aura) until `birdapp.open` (`actions.toggleBirdApp()`);
   * open, the live timeline with its numbers ticking up, the landed log, every poster's banger↔cancel meter and three
   * levers (`actions.setBirdLever(id, lever)`, the trade-off printed on each), and the Comms desk's queue. Docked;
   * only rendered once `birdapp.enabled` and `visible.birdapp`.
   */
  BirdApp: { birdapp: BirdAppVM; layout: LayoutVM; actions: HudActions };
  /** The launch livestream mishap card (the dog, the wrong chart). Opens instead of EventCard for `event.kind === "stream"`; answer it with `actions.choose`. */
  Livestream: { event: EventVM; stream: StreamVM; actions: HudActions };
  /** The Hearing (FLT-21): a senator's question at the witness table (three senators, the Trust and Capture meters, answers that show what they move), and the gavel with the verdict. Opens instead of EventCard for `event.kind === "hearing"`; answer with `actions.choose`. */
  Hearing: { event: EventVM; hearing: HearingVM; actions: HudActions };
  /** The yacht summit's leaked group chat (FLT-24): the rivals' messages with a LEAKED stamp, and the three replies. Opens instead of EventCard for `event.kind === "leak"`; answer with `actions.choose`. */
  LeakedChat: { event: EventVM; leak: LeakVM; actions: HudActions };
  /** A drama card (Defection's resignation letter and manifesto, the Poaching War's recruiter email). Opens instead of `EventCard` for `event.kind === "drama"`; answer it with `actions.choose` (up to four choices). */
  DramaCard: { event: EventVM; drama: DramaDocVM; actions: HudActions };
  /**
   * Regulatory Capture's bill (FLT-22): the draft the lab was asked to write (tick clauses with `actions.draftClause`,
   * up to `bill.pick`), and the leak ("Author: {lab} Legal"). Opens instead of EventCard for `event.kind === "bill"`;
   * answer with `actions.choose`.
   */
  Bill: { event: EventVM; bill: BillVM; actions: HudActions };
  /**
   * The Promise Tracker (FLT-23): the motion on the docket and three senators (what they promised, how they lean, the
   * lobbyists' fee through `actions.lobby`, their Truth-o-meter). Opens instead of EventCard for `event.kind === "vote"`
   * (answer with `actions.choose`), and as a window from the build palette's "senate" tile with `event` null (close with
   * `actions.closeSenate`). `bill` is the law in force, if any, for a skin that shows it alongside.
   */
  PromiseTracker: { event: EventVM | null; tracker: TrackerVM; bill: BillVM | null; layout: LayoutVM; actions: HudActions };
  EraCard: { era: EraCardVM; actions: HudActions };
  FrontPage: { paper: PaperVM; actions: HudActions };
  GroupChat: { chat: ChatVM; actions: HudActions };
  PhotoButton: { photo: PhotoVM; actions: HudActions };
  PhotoOverlay: { photo: PhotoVM; actions: HudActions };
  /**
   * A camera beat (FLT-56): letterbox bars top and bottom and the caption, while the camera makes its move over the
   * running game. Drawn over the docked HUD and under the cards. Offer a skip (`actions.skipBeat()`; Esc does it too)
   * and keep the bars still under reduced motion.
   */
  Beat: { beat: BeatVM; actions: HudActions };
  /**
   * Who is at the gate (FLT-56): the game pins it over the gate while a faction marches there. One row per crowd in
   * `factions.gate` (its colour, count and name); an `addressable` one offers `actions.issueStatement(id)`, which costs
   * `factions.statement.costText` and is off while `!factions.statement.ready`.
   */
  GateLegend: { factions: FactionsVM; actions: HudActions };
  SkinPicker: { skins: SkinPickerVM; actions: HudActions };
  Outcome: { outcome: OutcomeVM; actions: HudActions };
  /**
   * How the lab ended (FLT-11): the Frontier Times front page, the run summary and the share card. Modal; time is held.
   * `actions.shareEnding()` (share sheet on phones, a PNG download elsewhere), `copySummary()`, `keepPlaying()` (only if
   * `ending.keepPlaying`), `newLab()`, `playDaily()`.
   */
  Ending: { ending: EndingVM; layout: LayoutVM; actions: HudActions };
  /** The Takeover while it plays: "Frontier Lab Tycoon (managed by Frontier-9)", and its last card (`takeover.thanks`). Not modal. */
  Takeover: { takeover: TakeoverVM; layout: LayoutVM; actions: HudActions };
  /** The Memo (FLT-57): `memo.phase` "coming" is a small countdown (not modal); "extra" is the extra edition (modal, holds time). */
  Memo: { memo: MemoVM; layout: LayoutVM; actions: HudActions };
  /** A friend's challenge (FLT-57): "Your friend's lab was Captured on day 212. Beat it?" Modal, holds time; `actions.dismissChallenge()`. */
  Challenge: { challenge: ChallengeVM; layout: LayoutVM; actions: HudActions };
  /** The News Room button is earned (`visible.news`); mute, the mixer and the skin picker are not. */
  NewsControls: { newsroom: NewsroomVM; sound: SoundVM; skins: SkinPickerVM; visible?: VisibleVM; actions: HudActions };
  NewsArrival: { arrival: NonNullable<NewsroomVM["arrival"]>; actions: HudActions };
  NewsRoom: { newsroom: NewsroomVM; actions: HudActions };
  Mixer: { sound: SoundVM; actions: HudActions };
  /** Start ▸ Settings ▸ Mods… while `mods.open`: what `?mod=` loaded, clashes and failures. Close with `actions.closeMods()`. */
  ModManager: { mods: ModsVM; actions: HudActions };
  /** FLT-55: a mod asks to switch to its skin. Yes is `actions.acceptSkinOffer()`, no (and Escape) `actions.declineSkinOffer()`. */
  ModSkinOffer: { offer: SkinOfferVM; actions: HudActions };
  /**
   * Papers (FLT-45): a chip that opens a window with the publication policy and the list; drafts go to arXive or peer review from
   * here. Docked, and only rendered once earned (`visible.papers` and `papers.enabled`). `papers.open` says which to draw.
   */
  Papers: { papers: PapersVM; layout: LayoutVM; actions: HudActions };
  /** The screenshot moments: the arXive listing, the scoop (their timestamp and yours) and the award certificate. Modal. */
  PaperMoment: { moment: PaperMomentVM; actions: HudActions };
  /** The CrumbWiki reveal when the agents' collusion ends: the talk page, the revision history and (exposed) the front page. Modal. */
  CrumbWiki: { wiki: CrumbWikiVM; actions: HudActions };
  /** The Disasters menu (FLT-32): the random-disaster setting, and a list to start one from (ask first). Modal, while `disasters.open`; time is held. */
  DisasterMenu: { disasters: DisastersVM; actions: HudActions };
  /** What is going wrong now (FLT-32): disasters under way, their stage and cleanup, who is pulled off their post. Docked, once `disasters.enabled`; with nothing running it may be the way into the menu (the base's is), or nothing. */
  DisasterAlert: { disasters: DisastersVM; layout: LayoutVM; actions: HudActions };
  /** Evals Without Borders' report card (FLT-19): opens instead of EventCard for `event.kind === "report"`; answer it with `actions.choose`. */
  ReportCard: { event: EventVM; report: ReportCardVM; actions: HudActions };
  /** The sign over the auditors (over the gate during the countdown). The game pins it to them every frame; drawn only while `audit.line` is set. */
  AuditPin: { audit: AuditVM; actions: HudActions };
  /** Today's Drama (FLT-34): the button that opens the window (`actions.openDrama()`). Docked. `drama.fresh` is a pack the player hasn't opened yet; `drama.on` the one playing. */
  DramaButton: { drama: DramaVM; actions: HudActions };
  /** Today's Drama while `drama.open`: the newest pack, the archive, Play (`actions.playDrama(id)`, a new lab) and switch off (`actions.removeMod(on.id)`). `drama.intro` is the "now playing" card for a pack that has just loaded. Close with `actions.closeDrama()`. */
  Drama: { drama: DramaVM; actions: HudActions };
  /**
   * "Welcome back" (FLT-65), while `saves.welcome` is set: `actions.continueSave()` loads the autosave, `actions.dismissWelcome()`
   * plays the new lab behind it. Modal; time is held.
   */
  Welcome: { welcome: SaveSummaryVM; saves: SavesVM; actions: HudActions };
  /**
   * The Save/Load window (FLT-65), drawn while `saves.open`, `saves.modPrompt` or `saves.dragging`: the slots (`saveTo`, `loadFrom`,
   * `deleteSave`, `exportSave`), Export and Import (`exportSave("current")`, `importSave(file)`), the question about a save's mods
   * (`fetchModsAndLoad`, `loadWithoutMods`, `cancelModPrompt`), and where to drop a file. Modal; time is held.
   */
  SaveLoad: { saves: SavesVM; actions: HudActions };
}

export type SlotComponents = { [K in SlotName]: ComponentType<SlotPropsMap[K]> };
/** What a skin's `slots.tsx` default-exports: any subset of the slots. The base fills in the rest. */
export type SkinSlots = Partial<SlotComponents>;

/** A skin as loaded and ready to render. */
export interface LoadedSkin {
  id: string;
  name: string;
  slots: SlotComponents;
  /** Base strings with the skin's overrides. */
  strings: Record<string, string>;
}

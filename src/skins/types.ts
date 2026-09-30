// What a skin is, and what each of its slots is handed. Skins import types from here and from `../ui/hud/types`, and
// nothing else in the game: no `src/sim/**`, no store, no three.
import type { ComponentType, ReactNode } from "react";
import type {
  ArenaVM, BubbleVM, BuildItemVM, BuildTipVM, ChatVM, CoachVM, ConfirmVM, EraCardVM, EventVM, HudActions, HudVM, InspectorVM, LayoutVM, LeapfrogVM, StreamVM,
  NewsroomVM, ObjectivesVM, OutcomeVM, PaperVM, PhotoVM, SkinPickerVM, SoundVM, SpeedVM, StatsVM, ThoughtRowVM, TickerItemVM,
  StaffVM, TeaserVM, ProgressVM, ToastVM, TrainingVM, UnlockCardVM, VisibleVM, HelpVM,
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
  "Livestream",
  "EraCard",
  "FrontPage",
  "GroupChat",
  "PhotoButton",
  "PhotoOverlay",
  "SkinPicker",
  "Outcome",
  "NewsControls",
  "NewsArrival",
  "NewsRoom",
  "Mixer",
] as const;
export type SlotName = (typeof SLOT_NAMES)[number];

/** The slots that sit in the HUD all the time, already rendered, for the Layout to place. */
export const DOCKED_SLOTS = ["Stats", "Training", "Objectives", "Inspector", "BuildBar", "Speed", "Staff", "ThoughtsPanel", "Ticker", "Toasts", "Assistant", "Arena", "Benchmarks", "Voice", "NewsControls", "NewsArrival", "PhotoButton"] as const;
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
  Stats: { stats: StatsVM; layout: LayoutVM; visible?: VisibleVM; actions: HudActions };
  Training: { training: TrainingVM; actions: HudActions };
  /** `progress.goal` is the one goal in front of you ("Ship your first model · 0/1"); the scenario list is `objectives`, shown once `visible.arena`. */
  Objectives: { objectives: ObjectivesVM; progress?: ProgressVM; visible?: VisibleVM; layout: LayoutVM; actions: HudActions };
  Inspector: { inspector: InspectorVM; layout: LayoutVM; actions: HudActions };
  /** The build panel: `items` are only what is unlocked, `teasers` the locked ones, one row per milestone ("2 more · Ship your first model"). Report each opening with `actions.buildPanel(true)`. */
  BuildBar: { items: BuildItemVM[]; tip: BuildTipVM | null; teasers?: TeaserVM[]; layout: LayoutVM; actions: HudActions };
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
  /** The launch livestream mishap card (the dog, the wrong chart). Opens instead of EventCard for `event.kind === "stream"`; answer it with `actions.choose`. */
  Livestream: { event: EventVM; stream: StreamVM; actions: HudActions };
  EraCard: { era: EraCardVM; actions: HudActions };
  FrontPage: { paper: PaperVM; actions: HudActions };
  GroupChat: { chat: ChatVM; actions: HudActions };
  PhotoButton: { photo: PhotoVM; actions: HudActions };
  PhotoOverlay: { photo: PhotoVM; actions: HudActions };
  SkinPicker: { skins: SkinPickerVM; actions: HudActions };
  Outcome: { outcome: OutcomeVM; actions: HudActions };
  /** The News Room button is earned (`visible.news`); mute, the mixer and the skin picker are not. */
  NewsControls: { newsroom: NewsroomVM; sound: SoundVM; skins: SkinPickerVM; visible?: VisibleVM; actions: HudActions };
  NewsArrival: { arrival: NonNullable<NewsroomVM["arrival"]>; actions: HudActions };
  NewsRoom: { newsroom: NewsroomVM; actions: HudActions };
  Mixer: { sound: SoundVM; actions: HudActions };
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

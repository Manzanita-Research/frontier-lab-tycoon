// What a skin is, and what each of its slots is handed. Skins import types from here and from `../ui/hud/types`, and
// nothing else in the game: no `src/sim/**`, no store, no three.
import type { ComponentType, ReactNode } from "react";
import type {
  ArenaVM, BubbleVM, BuildItemVM, BuildTipVM, ChatVM, ConfirmVM, EraCardVM, EventVM, HudActions, HudVM, InspectorVM, LayoutVM,
  NewsroomVM, ObjectivesVM, OutcomeVM, PaperVM, PhotoVM, SkinPickerVM, SoundVM, SpeedVM, StatsVM, ThoughtRowVM, TickerItemVM,
  StaffVM, ToastVM, TrainingVM,
} from "../ui/hud/types";

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
  "Arena",
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
export const DOCKED_SLOTS = ["Stats", "Training", "Objectives", "Inspector", "BuildBar", "Speed", "Staff", "ThoughtsPanel", "Ticker", "Toasts", "Assistant", "Arena", "NewsControls", "NewsArrival", "PhotoButton"] as const;
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
  Stats: { stats: StatsVM; layout: LayoutVM; actions: HudActions };
  Training: { training: TrainingVM; actions: HudActions };
  Objectives: { objectives: ObjectivesVM; layout: LayoutVM; actions: HudActions };
  Inspector: { inspector: InspectorVM; layout: LayoutVM; actions: HudActions };
  BuildBar: { items: BuildItemVM[]; tip: BuildTipVM | null; layout: LayoutVM; actions: HudActions };
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
  Arena: { arena: ArenaVM; actions: HudActions };
  EraCard: { era: EraCardVM; actions: HudActions };
  FrontPage: { paper: PaperVM; actions: HudActions };
  GroupChat: { chat: ChatVM; actions: HudActions };
  PhotoButton: { photo: PhotoVM; actions: HudActions };
  PhotoOverlay: { photo: PhotoVM; actions: HudActions };
  SkinPicker: { skins: SkinPickerVM; actions: HudActions };
  Outcome: { outcome: OutcomeVM; actions: HudActions };
  NewsControls: { newsroom: NewsroomVM; sound: SoundVM; skins: SkinPickerVM; actions: HudActions };
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

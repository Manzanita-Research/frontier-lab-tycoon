// The base skin: a complete implementation of every slot, styled entirely through tokens (base.css). Every other skin
// starts from this and replaces only the slots it wants to.
import type { SlotComponents } from "../types";
import "./base.css";
import "./race.css";
import "./news.css";
import "./ops.css";
import "./compact.css";
import "./tutorial.css";
import { Arena } from "./slots/Arena";
import { Assistant } from "./slots/Assistant";
import { BuildBar } from "./slots/BuildBar";
import { Bubble } from "./slots/Bubble";
import { EraCard } from "./slots/EraCard";
import { Confirm } from "./slots/Confirm";
import { EventCard } from "./slots/EventCard";
import { FrontPage } from "./slots/FrontPage";
import { GroupChat } from "./slots/GroupChat";
import { Inspector } from "./slots/Inspector";
import { Mixer } from "./slots/Mixer";
import { NewsArrival } from "./slots/NewsArrival";
import { NewsControls } from "./slots/NewsControls";
import { NewsRoom } from "./slots/NewsRoom";
import { Objectives } from "./slots/Objectives";
import { Outcome } from "./slots/Outcome";
import { PhotoButton } from "./slots/PhotoButton";
import { PhotoOverlay } from "./slots/PhotoOverlay";
import { SkinPicker } from "./slots/SkinPicker";
import { Speed } from "./slots/Speed";
import { Staff } from "./slots/Staff";
import { Stats } from "./slots/Stats";
import { ThoughtsPanel } from "./slots/ThoughtsPanel";
import { Ticker } from "./slots/Ticker";
import { Toast } from "./slots/Toast";
import { Training } from "./slots/Training";
import { Layout } from "./Layout";

export const baseSlots: SlotComponents = {
  Layout, Stats, Training, Objectives, Inspector, BuildBar, Speed, Staff, Bubble, ThoughtsPanel, Ticker, Toast, Assistant,
  EventCard, Confirm, Arena, EraCard, FrontPage, GroupChat, PhotoButton, PhotoOverlay, SkinPicker, Outcome, NewsControls,
  NewsArrival, NewsRoom, Mixer,
};

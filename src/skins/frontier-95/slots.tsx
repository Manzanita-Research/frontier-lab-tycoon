// Frontier 95's components. Every slot is replaced, so the whole 2D UI is a 1995 desktop.
import type { SkinSlots } from "../types";
import { Layout } from "./Layout";
import { Arena, Inspector, Objectives, Stats, ThoughtsPanel, Training } from "./windows";
import { BuildBar, NewsControls, PhotoButton, Speed, Ticker } from "./taskbar";
import { Assistant, Bubble, EraCard, EventCard, NewsArrival, Outcome, Toast } from "./messages";
import { FrontPage, GroupChat, Mixer, NewsRoom, PhotoOverlay, SkinPicker } from "./apps";

const slots: SkinSlots = {
  Layout, Stats, Training, Objectives, Inspector, BuildBar, Speed, Bubble, ThoughtsPanel, Ticker, Toast, Assistant,
  EventCard, Arena, EraCard, FrontPage, GroupChat, PhotoButton, PhotoOverlay, SkinPicker, Outcome, NewsControls,
  NewsArrival, NewsRoom, Mixer,
};
export default slots;

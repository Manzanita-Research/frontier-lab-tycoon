// Frontier 95's components. Every slot is replaced, so the whole 2D UI is a 1995 desktop.
import type { SkinSlots } from "../types";
import { Layout } from "./Layout";
import { Arena, Inspector, Objectives, Staff, Stats, ThoughtsPanel, Training } from "./windows";
import { BuildBar, NewsControls, PhotoButton, Speed, Ticker } from "./taskbar";
import { Assistant, Bubble, EraCard, EventCard, NewsArrival, Outcome, Toast } from "./messages";
import { FrontPage, GroupChat, Mixer, NewsRoom, PhotoOverlay, SkinPicker } from "./apps";
import { Benchmarks, Livestream, Voice } from "./leapfrog";

const slots: SkinSlots = {
  Layout, Stats, Training, Objectives, Inspector, BuildBar, Speed, Staff, Bubble, ThoughtsPanel, Ticker, Toast, Assistant,
  EventCard, Arena, Benchmarks, Voice, Livestream, EraCard, FrontPage, GroupChat, PhotoButton, PhotoOverlay, SkinPicker, Outcome, NewsControls,
  NewsArrival, NewsRoom, Mixer,
};
export default slots;

// Frontier 95's components. Every slot is replaced, so the whole 2D UI is a 1995 desktop.
import type { SkinSlots } from "../types";
import { Layout } from "./Layout";
import { Arena, Inspector, Objectives, Staff, Stats, ThoughtsPanel, Training } from "./windows";
import { BuildBar, NewsControls, PhotoButton, Speed, Ticker } from "./taskbar";
import { Assistant, Bubble, Coach, Confirm, EraCard, EventCard, HowToPlay, NewsArrival, Outcome, Toast, UnlockCard } from "./messages";
import { FrontPage, GroupChat, Mixer, NewsRoom, PhotoOverlay, SkinPicker } from "./apps";
import { Benchmarks, Livestream, Voice } from "./leapfrog";
import { AuditPin, ReportCard } from "./audit";

const slots: SkinSlots = {
  Layout, Stats, Training, Objectives, Inspector, BuildBar, Speed, Staff, Bubble, ThoughtsPanel, Ticker, Toast, Assistant,
  EventCard, Confirm, Coach, UnlockCard, HowToPlay, Arena, Benchmarks, Voice, Livestream, EraCard, FrontPage, GroupChat, PhotoButton, PhotoOverlay, SkinPicker, Outcome, NewsControls,
  NewsArrival, NewsRoom, Mixer, ReportCard, AuditPin,
};
export default slots;

// Frontier 95's components. Every slot is replaced, so the whole 2D UI is a 1995 desktop.
import type { SkinSlots } from "../types";
import { Layout } from "./Layout";
import { Arena, Inspector, Objectives, Staff, Stats, ThoughtsPanel, Training } from "./windows";
import { BuildBar, NewsControls, PhotoButton, Speed, Ticker } from "./taskbar";
import { Assistant, Bubble, Coach, Confirm, EraCard, EventCard, HowToPlay, NewsArrival, Outcome, Toast, UnlockCard } from "./messages";
import { FrontPage, GroupChat, Mixer, ModManager, NewsRoom, PhotoOverlay, SkinPicker } from "./apps";
import { Benchmarks, Livestream, Voice } from "./leapfrog";
import { CrumbWiki, PaperMoment, Papers } from "./papers";
import { DisasterAlert, DisasterMenu } from "./disasters";
import { Hearing, LeakedChat } from "./circus";
import { Drama } from "./drama";
import { AuditPin, ReportCard } from "./audit";

const slots: SkinSlots = {
  Layout, Stats, Training, Objectives, Inspector, BuildBar, Speed, Staff, Bubble, ThoughtsPanel, Ticker, Toast, Assistant,
  EventCard, Confirm, Coach, UnlockCard, HowToPlay, Arena, Benchmarks, Voice, Livestream, Hearing, LeakedChat, Drama, EraCard, FrontPage, GroupChat, PhotoButton, PhotoOverlay, SkinPicker, Outcome, NewsControls,
  NewsArrival, NewsRoom, Mixer, ModManager, Papers, PaperMoment, CrumbWiki, DisasterMenu, DisasterAlert, ReportCard, AuditPin,
};
export default slots;

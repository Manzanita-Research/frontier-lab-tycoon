// The base skin: a complete implementation of every slot, styled entirely through tokens (base.css). Every other skin
// starts from this and replaces only the slots it wants to.
import type { SlotComponents } from "../types";
import "./base.css";
import "./race.css";
import "./news.css";
import "./ops.css";
import "./leapfrog.css";
import "./factions.css";
import "./compact.css";
import "./notices.css";
import "./playable.css";
import "./disasters.css";
import "./circus.css";
import "./drama.css";
import "./audit.css";
import { Arena } from "./slots/Arena";
import { AuditPin } from "./slots/AuditPin";
import { ReportCard } from "./slots/ReportCard";
import { Benchmarks } from "./slots/Benchmarks";
import { Assistant } from "./slots/Assistant";
import { BuildBar } from "./slots/BuildBar";
import { Bubble } from "./slots/Bubble";
import { EraCard } from "./slots/EraCard";
import { Coach } from "./slots/Coach";
import { Confirm } from "./slots/Confirm";
import { HowToPlay } from "./slots/HowToPlay";
import { UnlockCard } from "./slots/UnlockCard";
import { EventCard } from "./slots/EventCard";
import { Factions } from "./slots/Factions";
import { FrontPage } from "./slots/FrontPage";
import { GroupChat } from "./slots/GroupChat";
import { Inspector } from "./slots/Inspector";
import { Mixer } from "./slots/Mixer";
import { ModManager } from "./slots/ModManager";
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
import { Voice } from "./slots/Voice";
import { Livestream } from "./slots/Livestream";
import { Hearing } from "./slots/Hearing";
import { LeakedChat } from "./slots/LeakedChat";
import { DramaCard } from "./slots/DramaCard";
import { Bill } from "./slots/Bill";
import { PromiseTracker } from "./slots/PromiseTracker";
import { Training } from "./slots/Training";
import { Papers } from "./slots/Papers";
import { PaperMoment } from "./slots/PaperMoment";
import { CrumbWiki } from "./slots/CrumbWiki";
import "./papers.css";
import { DisasterAlert } from "./slots/DisasterAlert";
import { DisasterMenu } from "./slots/DisasterMenu";
import { Layout } from "./Layout";

export const baseSlots: SlotComponents = {
  Layout, Stats, Training, Objectives, Inspector, BuildBar, Speed, Staff, Bubble, ThoughtsPanel, Ticker, Toast, Assistant,
  EventCard, Confirm, Coach, UnlockCard, HowToPlay, Arena, Benchmarks, Voice, Factions, Livestream, Hearing, LeakedChat, DramaCard, Bill, PromiseTracker, EraCard, FrontPage, GroupChat, PhotoButton, PhotoOverlay, SkinPicker, Outcome, NewsControls,
  NewsArrival, NewsRoom, Mixer, ModManager, Papers, PaperMoment, CrumbWiki, DisasterMenu, DisasterAlert, ReportCard, AuditPin,
};

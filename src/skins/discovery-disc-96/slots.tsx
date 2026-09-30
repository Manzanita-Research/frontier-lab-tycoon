// Discovery Disc '96's components. The rest (Arena, Staff, the News Room, the mixer, ...) are the base's, dressed by skin.css.
import type { SkinSlots } from "../types";
import { Layout } from "./Layout";
import { Objectives, Training } from "./chart";
import { Stats } from "./stats";
import { Inspector } from "./badge";
import { BuildBar } from "./stamps";
import { NewsArrival, NewsControls, PhotoButton, Speed, Ticker } from "./tools";
import { Assistant, Bubble, Toast } from "./guide";
import { EraCard, EventCard, Outcome } from "./cards";

const slots: SkinSlots = { Layout, Stats, Training, Objectives, Inspector, BuildBar, Speed, Bubble, Ticker, Toast, Assistant, EventCard, EraCard, Outcome, NewsControls, NewsArrival, PhotoButton };
export default slots;

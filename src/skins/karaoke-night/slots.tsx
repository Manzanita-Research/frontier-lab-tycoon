// Karaoke Night's components. The rest (Arena, Staff, the News Room, the mixer, photo mode, ...) are the base's, dressed by skin.css.
import type { SkinSlots } from "../types";
import { Layout } from "./Layout";
import { Stats } from "./stats";
import { Objectives, Training } from "./queue";
import { Inspector } from "./card";
import { BuildBar } from "./tray";
import { NewsArrival, NewsControls, PhotoButton, Speed } from "./deck";
import { Ticker } from "./ticker";
import { Bubble, Toast } from "./toast";
import { EraCard, EventCard, Outcome } from "./cards";

const slots: SkinSlots = { Layout, Stats, Training, Objectives, Inspector, BuildBar, Speed, Bubble, Ticker, Toast, EventCard, EraCard, Outcome, NewsControls, NewsArrival, PhotoButton };
export default slots;

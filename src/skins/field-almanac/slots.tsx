// The Field Almanac's components. The rest (the Arena, the payroll, the News Room, the mixer, the event and era cards,
// photo mode, the skin picker) are the base's, dressed by skin.css.
import type { SkinSlots } from "../types";
import { Layout } from "./Layout";
import { Stats } from "./header";
import { Objectives, Training } from "./notes";
import { Bubble, Inspector } from "./specimen";
import { BuildBar } from "./shelf";
import { Ticker, Toast } from "./dispatch";
import { NewsControls, PhotoButton, Speed, ThoughtsPanel } from "./controls";

const slots: SkinSlots = { Layout, Stats, Training, Objectives, Inspector, BuildBar, Speed, Bubble, ThoughtsPanel, Ticker, Toast, NewsControls, PhotoButton };
export default slots;

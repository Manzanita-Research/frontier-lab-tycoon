// Swag Drop's components: the lab's desk merch. Everything the mockup made out of objects is a slot here; the rest
// (payroll, News Room and dialogs) is the base markup dressed in skin.css.
import type { SkinSlots } from "../types";
import { Arena } from "./arena";
import { Inspector } from "./badge";
import { BuildBar, DramaButton, NewsControls, PhotoButton, Speed } from "./keys";
import { Layout } from "./Layout";
import { Objectives, ThoughtsPanel } from "./notes";
import { Bubble, EraCard, EventCard, Outcome, Ticker, Toast } from "./paper";
import { Stats, Training } from "./plaque";

const slots: SkinSlots = {
  Layout,
  Arena,
  Stats,
  Training,
  Objectives,
  Inspector,
  BuildBar,
  Speed,
  Bubble,
  ThoughtsPanel,
  Ticker,
  Toast,
  EventCard,
  EraCard,
  Outcome,
  PhotoButton,
  NewsControls,
  DramaButton,
};
export default slots;

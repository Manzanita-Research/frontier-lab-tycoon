// Homepage '98's components: the lab's home page, from the header's hit counter to the WebRing along the bottom.
// The slots not listed here (Staff, the News Room and its papers, the mixer, photo mode, the skin picker) are the base's,
// dressed by skin.css.
import type { SkinSlots } from "../types";
import { Layout } from "./Layout";
import { Arena, Inspector, Objectives, Stats, ThoughtsPanel, Training } from "./pages";
import { BuildBar, NewsControls, PhotoButton, Speed, Ticker } from "./webring";
import { Bubble, EraCard, EventCard, NewsArrival, Outcome, Toast } from "./popups";

const slots: SkinSlots = { Layout, Stats, Training, Objectives, Inspector, BuildBar, Speed, Bubble, ThoughtsPanel, Ticker, Toast, EventCard, Arena, EraCard, Outcome, NewsControls, NewsArrival, PhotoButton };
export default slots;

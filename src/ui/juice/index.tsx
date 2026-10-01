import { Sky } from "./Sky";
import { Tube } from "./Tube";
import "./juice.css";

// What is left of the juice layer's UI: the sky behind the canvas and the CRT tube over everything (FLT-73, see crt.ts).
// The camera button and photo mode's controls are the skin's (PhotoButton, PhotoOverlay slots); night thoughts are
// ordinary thoughts now (see sim/thoughts.ts).
export { Sky, Tube };

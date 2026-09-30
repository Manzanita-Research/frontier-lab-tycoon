import { NightThoughts } from "./NightThoughts";
import { Sky } from "./Sky";
import "./juice.css";

export { Sky };

/** What the juice layer adds beside the HUD: night thoughts (their bubbles are drawn by the skin's Bubble slot). */
export function Juice() {
  return <NightThoughts />;
}

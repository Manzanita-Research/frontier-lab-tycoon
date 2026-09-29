import { NightThoughts } from "./NightThoughts";
import { PhotoButton, PhotoUI } from "./Photo";
import { Sky } from "./Sky";
import "./juice.css";

export { Sky };

/** Everything the juice layer adds on top of the HUD: night thoughts, the camera button, photo mode's controls. */
export function Juice() {
  return (
    <>
      <NightThoughts />
      <PhotoButton />
      <PhotoUI />
    </>
  );
}

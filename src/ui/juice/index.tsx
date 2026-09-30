import { PhotoButton, PhotoUI } from "./Photo";
import { Sky } from "./Sky";
import "./juice.css";

export { Sky };

/** Everything the juice layer adds on top of the HUD: the camera button, photo mode's controls. */
export function Juice() {
  return (
    <>
      <PhotoButton />
      <PhotoUI />
    </>
  );
}

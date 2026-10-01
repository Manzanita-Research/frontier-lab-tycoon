// FLT-95: how our box is built, as plain data. Closed, it is one printed volume: the lid is a cap over the whole box
// (front, four sides and back), so no edge of the tray or the lid can show as a seam or a white sliver at any angle.
// The tray sits just inside it and only shows once the lid is off. The shrinkwrap hugs the lid.
import { BOX_TIMES } from "./rig";

/** What's printed on each face of the lid, in BoxGeometry's face order (+x, -x, +y, -y, +z, -z). */
export const LID_FACES = ["side", "side", "top", "top", "front", "back"] as const;
export type LidFace = (typeof LID_FACES)[number];

/** How far inside the lid the tray's faces sit (metres): enough that they never fight the lid's faces for a pixel. */
export const TRAY_INSET = 0.0015;
/** How far the shrinkwrap stands off the box on each side (metres). */
export const WRAP_GAP = 0.001;

/** True while the contents are still shut inside the box: until the unwrap lifts the lid off. */
export function contentsHidden(beat: string, t: number): boolean {
  if (beat === "shelf" || beat === "pulling" || beat === "held") return true;
  return beat === "unwrapping" && t < BOX_TIMES.lidOff;
}

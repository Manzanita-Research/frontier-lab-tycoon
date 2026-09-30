// Ending and skipping a camera beat (FLT-56): the bars and caption go, and a skipped shot eases the camera home.
// Time never stopped for it, so there is nothing to resume.
import { registry } from "../../app/game";
import { beatAtom, beatRun } from "./beatState";
import { cinema } from "./state";

export const isBeat = () => registry.get(beatAtom) !== null;

export function endBeat() {
  if (!isBeat()) return;
  registry.set(beatAtom, null);
  beatRun.follow = [];
  beatRun.until = 0;
  beatRun.camera = false;
}

/** The player's Skip (the button, or Esc). */
export function skipBeat() {
  if (!isBeat()) return;
  const camera = beatRun.camera;
  endBeat();
  if (camera) cinema.release();
}

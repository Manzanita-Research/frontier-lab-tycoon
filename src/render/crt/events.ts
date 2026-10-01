// R3F's pointer events, aimed through the tube (FLT-73): with the canvas bowed, the ground under the cursor is the
// scene at `warp(pointer)`, so the ray goes there. Flat canvas: the stock compute, unchanged.
import { events, type RootState } from "@react-three/fiber";
import { warp } from "./looks";
import { crtView } from "./state";

type Store = Parameters<typeof events>[0];

export function crtEvents(store: Store) {
  const manager = events(store);
  return {
    ...manager,
    compute(event: { offsetX: number; offsetY: number }, state: RootState) {
      let x = (event.offsetX / state.size.width) * 2 - 1;
      let y = -(event.offsetY / state.size.height) * 2 + 1;
      if (crtView.curve !== 0) [x, y] = warp(crtView.curve, x, y);
      state.pointer.set(x, y);
      state.raycaster.setFromCamera(state.pointer, state.camera);
    },
  };
}

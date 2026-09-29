import { debugParams } from "../../app/game";
import { rectCenter } from "../coords";
import { FloatModel } from "./FloatModel";

/** FLT-13: the parade float is scenery that is not in the sim yet, so `?float=x,z` parks one on the lawn for shots. */
export function Showcase() {
  if (!debugParams.float) return null;
  const [x, z] = debugParams.float;
  const [cx, cz] = rectCenter({ x, z, w: 3, d: 2 });
  return (
    <group position={[cx, 0, cz]}>
      <FloatModel />
    </group>
  );
}

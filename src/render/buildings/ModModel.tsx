import { CREAM, CREAM_DARK } from "../materials";
import { B, Cyl } from "./Parts";

/**
 * A building a mod added (FLT-37) and the renderer has no model for: a flat-packed kit in the mod's colour, still in its
 * box, with the instructions pinned to a pole. It fills the footprint, so placement and paths read right.
 */
export function ModModel({ color, size: [w, d] }: { color: string; size: readonly [number, number] }) {
  const bw = w - 0.12;
  const bd = d - 0.12;
  const h = 0.55 + 0.15 * Math.min(w, d);
  return (
    <group>
      <B s={[w - 0.08, 0.08, d - 0.08]} c={CREAM_DARK} />
      <B p={[0, 0.08, 0]} s={[bw * 0.86, h, bd * 0.86]} c={color} />
      <B p={[0, 0.08 + h, 0]} s={[bw * 0.9, 0.06, bd * 0.9]} c={CREAM} />
      <B p={[0, 0.08 + h * 0.45, bd * 0.43 + 0.005]} s={[bw * 0.5, h * 0.3, 0.02]} c={CREAM} />
      <Cyl p={[bw * 0.42, 0.08, bd * 0.42]} r={0.03} h={h + 0.5} c={CREAM_DARK} />
      <B p={[bw * 0.42 - 0.13, h + 0.36, bd * 0.42]} s={[0.24, 0.18, 0.02]} c="#fff8e6" />
    </group>
  );
}

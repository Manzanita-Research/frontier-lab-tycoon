import { CREAM_DARK } from "../materials";
import { B, Ball, Cyl } from "./Parts";

const WOOD = "#b07a45";

/** A kids' sandbox (FLT-59): a wooden frame, sand, a castle, a red bucket and a blue spade stuck in it. */
export function SandboxModel({ color }: { color: string }) {
  return (
    <group>
      <B s={[1.9, 0.06, 1.9]} c={CREAM_DARK} />
      {/* The frame, and the sand in it. */}
      <B p={[0, 0.06, -0.86]} s={[1.8, 0.2, 0.12]} c={WOOD} />
      <B p={[0, 0.06, 0.86]} s={[1.8, 0.2, 0.12]} c={WOOD} />
      <B p={[-0.86, 0.06, 0]} s={[0.12, 0.2, 1.6]} c={WOOD} />
      <B p={[0.86, 0.06, 0]} s={[0.12, 0.2, 1.6]} c={WOOD} />
      <B p={[0, 0.06, 0]} s={[1.6, 0.14, 1.6]} c={color} />
      {/* A sandcastle. */}
      <B p={[-0.3, 0.2, -0.25]} s={[0.46, 0.18, 0.46]} c={color} />
      <Cyl p={[-0.48, 0.38, -0.43]} r={0.08} h={0.2} c={color} />
      <Cyl p={[-0.12, 0.38, -0.43]} r={0.08} h={0.2} c={color} />
      <Cyl p={[-0.48, 0.38, -0.07]} r={0.08} h={0.2} c={color} />
      <Cyl p={[-0.12, 0.38, -0.07]} r={0.08} h={0.2} c={color} />
      <Cyl p={[-0.3, 0.38, -0.25]} r={0.1} h={0.34} c={color} />
      <Cyl p={[-0.3, 0.72, -0.25]} r={0.01} h={0.2} c="#555" />
      <B p={[-0.23, 0.84, -0.25]} s={[0.12, 0.07, 0.01]} c="#ff5fa2" />
      {/* The bucket, and the spade. */}
      <Cyl p={[0.42, 0.2, 0.35]} r={0.14} h={0.26} c="#e5484d" />
      <Ball p={[0.42, 0.47, 0.35]} r={0.02} c="#e5484d" />
      <B p={[0.3, 0.2, -0.35]} s={[0.04, 0.5, 0.04]} c="#3b78d8" rotY={0.3} />
      <B p={[0.3, 0.2, -0.35]} s={[0.16, 0.12, 0.03]} c="#3b78d8" rotY={0.3} />
    </group>
  );
}

import { useMemo } from "react";
import { Flag } from "../fx/Flag";
import { lanternMat } from "../fx/glow";
import { CREAM, CREAM_DARK, boxGeo, labelTexture, std } from "../materials";
import { B, Ball } from "./Parts";

/** The lab's front gate on the south edge; the sign shows the lab name on both sides. */
export function GateModel({ labName }: { labName: string }) {
  const tex = useMemo(() => labelTexture(labName, { w: 1024, h: 200, bg: "#3a2a1c", fg: "#fff3d0" }), [labName]);
  return (
    <group>
      {[-1.02, 1.02].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <B s={[0.38, 1.9, 0.44]} c={CREAM} />
          <B s={[0.46, 0.16, 0.52]} c="#ff8a4c" />
          <B p={[0, 1.9, 0]} s={[0.46, 0.12, 0.52]} c="#ff8a4c" />
          <Ball p={[0, 2.16, 0]} r={0.14} mat={lanternMat} />
          <Flag position={[0, 2.28, 0]} color={x < 0 ? "#ff8a4c" : "#4f8ff0"} pole={0.62} width={0.46} height={0.26} phase={x} rotationY={x < 0 ? Math.PI : 0} />
        </group>
      ))}
      <B p={[0, 1.55, 0]} s={[2.5, 0.28, 0.4]} c={CREAM_DARK} />
      <mesh geometry={boxGeo} material={std("#3a2a1c")} position={[0, 2.28, 0]} scale={[2.3, 0.62, 0.12]} castShadow />
      {[0.065, -0.065].map((z) => (
        <mesh key={z} position={[0, 2.28, z]} rotation-y={z < 0 ? Math.PI : 0} scale={[2.22, 0.5, 1]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial map={tex} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

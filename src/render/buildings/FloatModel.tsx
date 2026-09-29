import { Suspense } from "react";
import { CREAM, CREAM_DARK, INK, boxGeo, cylGeo, sphereGeo, std } from "../materials";
import { GenModel } from "../gen/GenModel";
import { genPath } from "../gen/variants";
import { B, Cyl } from "./Parts";

const WATER = "#7fd3f0";
const BANNER = "#ff8a4c";

/**
 * The Water Discourse parade float: a flatbed carrying a giant papier-mache water bottle in sunglasses, with banners.
 * Scenery in a 3x2 footprint, long side along x, the bottle looking down +z. (FLT-13: this is the procedural
 * blockout, the baseline the generated float is measured against.)
 */
function ProceduralFloat() {
  return (
    <group>
      {/* flatbed and wheels */}
      <B p={[0, 0.22, 0]} s={[2.86, 0.16, 1.5]} c={CREAM_DARK} />
      <B p={[-1.25, 0.22, 0]} s={[0.3, 0.42, 1.5]} c={BANNER} />
      {[-0.95, 0.95].flatMap((x) =>
        [-0.66, 0.66].map((z) => (
          <mesh key={`${x}${z}`} geometry={cylGeo} material={std(INK)} position={[x, 0.2, z]} rotation-x={Math.PI / 2} scale={[0.22, 0.14, 0.22]} castShadow />
        )),
      )}
      {/* bottle */}
      <Cyl p={[0.1, 0.38, 0]} r={0.6} h={1.05} c={WATER} />
      <mesh geometry={sphereGeo} material={std(WATER)} position={[0.1, 1.43, 0]} scale={[0.6, 0.34, 0.6]} castShadow />
      <Cyl p={[0.1, 1.68, 0]} r={0.24} h={0.26} c={WATER} />
      <Cyl p={[0.1, 1.94, 0]} r={0.3} h={0.14} c="#ffffff" />
      {/* label band */}
      <Cyl p={[0.1, 0.72, 0]} r={0.615} h={0.34} c={CREAM} />
      {/* sunglasses */}
      <B p={[-0.2, 0.98, 0.5]} s={[0.4, 0.28, 0.14]} c={INK} />
      <B p={[0.4, 0.98, 0.5]} s={[0.4, 0.28, 0.14]} c={INK} />
      <B p={[0.1, 1.18, 0.52]} s={[0.24, 0.06, 0.1]} c={INK} />
      {/* banners */}
      {[-1.25, 1.25].map((x) => (
        <group key={x}>
          <Cyl p={[x, 0.38, 0.55]} r={0.03} h={1.5} c="#8a8fa0" />
          <mesh geometry={boxGeo} material={std(x < 0 ? BANNER : "#ffd24a")} position={[x, 1.55, 0.55]} scale={[0.72, 0.42, 0.04]} castShadow />
        </group>
      ))}
    </group>
  );
}

/** The float, procedural by default or the generated model when `?models=` asks for it. */
export function FloatModel() {
  const url = genPath("float");
  return url ? (
    <Suspense fallback={<ProceduralFloat />}>
      <GenModel url={url} />
    </Suspense>
  ) : (
    <ProceduralFloat />
  );
}

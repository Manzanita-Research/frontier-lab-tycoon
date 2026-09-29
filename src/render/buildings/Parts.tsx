import type { ThreeElements } from "@react-three/fiber";
import { boxGeo, cylGeo, sphereGeo, std } from "../materials";
import type { Material } from "three";

type V3 = [number, number, number];

/** Box with its base centred on `p`. */
export function B({ p = [0, 0, 0], s, c, mat, rotY = 0 }: { p?: V3; s: V3; c?: string; mat?: Material; rotY?: number }) {
  return (
    <mesh
      geometry={boxGeo}
      material={mat ?? std(c ?? "#fff")}
      position={[p[0], p[1] + s[1] / 2, p[2]]}
      scale={s}
      rotation-y={rotY}
      castShadow
      receiveShadow
    />
  );
}

/** Cylinder (radius r, height h) with its base centred on `p`. */
export function Cyl({ p = [0, 0, 0], r, h, c, mat, ...rest }: { p?: V3; r: number; h: number; c?: string; mat?: Material } & Omit<ThreeElements["mesh"], "position" | "scale" | "material" | "geometry">) {
  return (
    <mesh
      geometry={cylGeo}
      material={mat ?? std(c ?? "#fff")}
      position={[p[0], p[1] + h / 2, p[2]]}
      scale={[r, h, r]}
      castShadow
      receiveShadow
      {...rest}
    />
  );
}

export function Ball({ p, r, c, mat }: { p: V3; r: number; c?: string; mat?: Material }) {
  return <mesh geometry={sphereGeo} material={mat ?? std(c ?? "#fff")} position={p} scale={r} castShadow />;
}

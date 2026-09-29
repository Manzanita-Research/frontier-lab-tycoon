import { useFrame } from "@react-three/fiber";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import { sim as game } from "../../app/game";
import { fanSpeed, currentLoad } from "../fx/utilisation";
import { CREAM, CREAM_DARK, boxGeo, glow } from "../materials";
import { GenModel } from "../gen/GenModel";
import { genPath } from "../gen/variants";
import { B, Cyl } from "./Parts";

const TOWERS = [
  { x: -0.45, z: -0.45, h: 1.55 },
  { x: 0.45, z: -0.45, h: 1.05 },
  { x: -0.45, z: 0.45, h: 0.85 },
  { x: 0.45, z: 0.45, h: 1.3 },
];
const LED_ON = ["#5dff9c", "#ffd24a", "#4fd0ff"].map((c) => new THREE.Color(c));
const LED_OFF = new THREE.Color("#1f3b34");

/** Stacked racks with blinking LEDs and a spinning fan on the tallest one. */
export function ClusterModel({ color }: { color: string }) {
  const fan = useRef<THREE.Group>(null);
  const spin = useRef({ angle: 0, speed: 3 });
  const leds = useMemo(() => LED_ON.map((c) => glow("#" + c.getHexString())), []);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    // The fan winds up when the halls are starving the racks and coasts down when there's spare compute.
    const load = currentLoad(game.world);
    const s = spin.current;
    s.speed += (fanSpeed(load) - s.speed) * (1 - Math.exp(-1.8 * dt));
    s.angle += s.speed * Math.min(dt, 0.1);
    if (fan.current) fan.current.rotation.y = s.angle;
    const busy = 1 + Math.min(1.5, load.util);
    leds.forEach((m, i) => m.color.copy(Math.sin(t * (2.1 + i * 1.7) * busy + i * 2.3) > 0.1 ? LED_ON[i]! : LED_OFF));
  });

  const url = genPath("cluster");
  const procedural = (
    <group>
      <B p={[0, 0, 0]} s={[1.86, 0.12, 1.86]} c={CREAM_DARK} />
      {TOWERS.map((t, i) => (
        <group key={i} position={[t.x, 0.12, t.z]}>
          <B s={[0.8, t.h, 0.8]} c={CREAM} />
          <B p={[0, t.h, 0]} s={[0.86, 0.08, 0.86]} c={color} />
          <B p={[0, 0.1, 0]} s={[0.84, 0.09, 0.84]} c={color} />
          {[0, 1, 2].map((level) => {
            const y = 0.32 + level * 0.3;
            if (y > t.h - 0.2) return null;
            return [
              [0.405, y, 0, 0.03, 0.07, 0.5],
              [-0.405, y, 0, 0.03, 0.07, 0.5],
              [0, y, 0.405, 0.5, 0.07, 0.03],
              [0, y, -0.405, 0.5, 0.07, 0.03],
            ].map(([x, yy, z, sx, sy, sz], f) => (
              <mesh
                key={`${level}-${f}`}
                geometry={boxGeo}
                material={leds[(i + level + f) % 3]}
                position={[x!, yy!, z!]}
                scale={[sx!, sy!, sz!]}
              />
            ));
          })}
        </group>
      ))}
      <group position={[TOWERS[0]!.x, 0.12 + TOWERS[0]!.h + 0.08, TOWERS[0]!.z]}>
        <Cyl r={0.3} h={0.1} c="#5b6675" />
        <group ref={fan} position={[0, 0.16, 0]}>
          <B s={[0.56, 0.03, 0.1]} c="#dfe7f2" />
          <B s={[0.1, 0.03, 0.56]} c="#dfe7f2" />
          <Cyl r={0.06} h={0.06} c={color} />
        </group>
      </group>
    </group>
  );

  // FLT-13: a generated cluster replaces the whole thing. It is one static mesh, so the fan and the LEDs are gone.
  return url ? (
    <Suspense fallback={procedural}>
      <GenModel url={url} />
    </Suspense>
  ) : (
    procedural
  );
}

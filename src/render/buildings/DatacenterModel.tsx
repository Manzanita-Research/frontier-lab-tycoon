import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { sim as game } from "../../app/game";
import { powerOf } from "../../sim/race/power";
import { CREAM, CREAM_DARK, boxGeo, glow } from "../materials";
import { B, Cyl } from "./Parts";

const ON = ["#5dff9c", "#4fd0ff", "#5dff9c"].map((c) => new THREE.Color(c));
const AMBER = new THREE.Color("#ffb020");
const OFF = new THREE.Color("#3b2f22");
const STRIPS = [-1.35, -0.81, -0.27, 0.27, 0.81, 1.35];
const FANS: [number, number][] = [
  [-0.95, -0.6],
  [0.95, -0.6],
  [-0.95, 0.6],
  [0.95, 0.6],
];

/**
 * The big one (4x4): a long cream shed with rows of blinking rack lights along the front and four roof fans. It has
 * to be plugged in: with too few Gas Turbines or Solar Farms the lights go amber and the fans stop.
 */
export function DatacenterModel({ color }: { color: string }) {
  const fans = useRef<(THREE.Group | null)[]>([]);
  const spin = useRef({ angle: 0, speed: 0 });
  const leds = useMemo(() => ON.map((c) => glow("#" + c.getHexString())), []);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    const p = powerOf(game.world);
    const live = p.gas + p.solar >= p.datacenters;
    const s = spin.current;
    s.speed += ((live ? 9 : 0) - s.speed) * (1 - Math.exp(-1.6 * dt));
    s.angle += s.speed * Math.min(dt, 0.1);
    for (const g of fans.current) if (g) g.rotation.y = s.angle;
    leds.forEach((m, i) => {
      if (live) m.color.copy(Math.sin(t * (2.3 + i * 1.9) + i * 2.1) > -0.2 ? ON[i]! : OFF);
      else m.color.copy(Math.sin(t * 1.4) > 0 ? AMBER : OFF);
    });
  });

  return (
    <group>
      <B s={[3.86, 0.12, 3.86]} c={CREAM_DARK} />
      <B p={[0, 0.12, 0]} s={[3.5, 1.15, 3.5]} c={CREAM} />
      <B p={[0, 0.12, 0]} s={[3.56, 0.14, 3.56]} c={color} />
      <B p={[0, 1.2, 0]} s={[3.62, 0.1, 3.62]} c={color} />
      {[0, 1].map((row) =>
        STRIPS.map((x, i) => (
          <mesh key={`${row}-${i}`} geometry={boxGeo} material={leds[(i + row) % 3]} position={[x, 0.55 + row * 0.32, 1.77]} scale={[0.4, 0.1, 0.03]} />
        )),
      )}
      {FANS.map(([x, z], i) => (
        <group key={i} position={[x, 1.3, z]}>
          <Cyl r={0.4} h={0.12} c="#5b6675" />
          <group ref={(g) => void (fans.current[i] = g)} position={[0, 0.17, 0]}>
            <B s={[0.68, 0.03, 0.12]} c="#dfe7f2" />
            <B s={[0.12, 0.03, 0.68]} c="#dfe7f2" />
            <Cyl r={0.07} h={0.07} c={color} />
          </group>
        </group>
      ))}
      <Cyl p={[-1.55, 1.3, 1.55]} r={0.24} h={0.5} c="#c9d3e0" />
      <Cyl p={[1.55, 1.3, 1.55]} r={0.24} h={0.5} c="#c9d3e0" />
    </group>
  );
}

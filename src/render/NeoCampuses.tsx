// FLT-56: each neo lab your people found builds a tiny campus on the lawn beyond the fence: a glass box in its colour,
// its name on the roof, an empty plinth where the product will go, and a balloon that swells with the lab's valuation
// (the seed round times the hype; zero product). The valuation's label is the world overlay's (ui/WorldOverlay.tsx).
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type * as THREE from "three";
import { atoms } from "../app/game";
import { useApp } from "../app/hooks";
import { NEO_PLINTH } from "../content/neocampus";
import type { NeoCampusView } from "../sim/neolabs/view";
import { reducedMotion } from "../skins/kit/motion";
import { NEO_LOTS } from "./coords";
import { boxGeo, cylGeo, labelTexture, sphereGeo, std } from "./materials";

const ROOF = 0.9;
const HQ: readonly [number, number] = [-0.35, -0.22];

/** The balloon's radius for a valuation in $B: its volume grows with the money, so a 8x round is a 2x balloon. */
export const balloonRadius = (valuation: number) => Math.min(0.62, 0.2 * Math.cbrt(Math.max(0.2, valuation) / 2));

/** Where lot `i`'s balloon floats at time `t` (seconds), in scene units. The overlay pins the valuation to it. */
export function balloonAt(i: number, t: number, radius: number): [number, number, number] {
  const [cx, cz] = NEO_LOTS[i]!;
  const still = reducedMotion();
  const bob = still ? 0 : Math.sin(t * 1.3 + i * 1.7) * 0.07;
  const sway = still ? 0 : Math.sin(t * 0.7 + i) * 0.05;
  return [cx + HQ[0] + sway, ROOF + 1.5 + radius + bob, cz + HQ[1]];
}

function Campus({ lab, i }: { lab: NeoCampusView; i: number }) {
  const [cx, cz] = NEO_LOTS[i]!;
  const balloon = useRef<THREE.Mesh>(null);
  const string = useRef<THREE.Mesh>(null);
  // Inflates from nothing the day the lab is founded, and puffs up (with a little overshoot) when its hype does.
  const puff = useRef({ r: 0, v: 0 });
  const sign = useMemo(() => labelTexture(lab.short, { w: 1024, h: 256, bg: lab.color, fg: "#fffaf0" }), [lab.short, lab.color]);
  const plinth = useMemo(() => labelTexture(NEO_PLINTH, { w: 512, h: 128, bg: "#fffaf0", fg: "#3a2a1c", weight: 700 }), []);
  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const goal = balloonRadius(lab.valuation);
    const p = puff.current;
    if (reducedMotion()) p.r = goal;
    else {
      p.v += ((goal - p.r) * 40 - p.v * 7) * dt;
      p.r = Math.max(0, p.r + p.v * dt);
    }
    const [bx, by, bz] = balloonAt(i, clock.elapsedTime, p.r);
    balloon.current?.position.set(bx, by, bz);
    balloon.current?.scale.set(p.r, p.r * 1.12, p.r);
    const low = by - p.r * 1.12;
    if (string.current) {
      string.current.position.set((bx + cx + HQ[0]) / 2, (low + ROOF) / 2, (bz + cz + HQ[1]) / 2);
      string.current.scale.set(0.012, Math.max(0.01, low - ROOF), 0.012);
    }
  });
  const color = std(lab.color, 0.5);
  return (
    <group>
      {/* The lot: a slab of fresh concrete on the lawn. */}
      <mesh geometry={boxGeo} material={std("#d8d2c4")} position={[cx, 0.03, cz]} scale={[2.2, 0.06, 1.6]} receiveShadow />
      {/* The HQ: one storey of glass in the lab's colour, the name on the roof. */}
      <mesh geometry={boxGeo} material={color} position={[cx + HQ[0], ROOF / 2 + 0.03, cz + HQ[1]]} scale={[1, ROOF, 0.66]} castShadow receiveShadow />
      {[0.34, 0.7].map((y) => (
        <mesh key={y} geometry={boxGeo} material={std("#26314d", 0.25)} position={[cx + HQ[0], y, cz + HQ[1]]} scale={[1.02, 0.17, 0.68]} />
      ))}
      <mesh geometry={boxGeo} material={std("#26314d", 0.25)} position={[cx + HQ[0] + 0.2, 0.17, cz + HQ[1] + 0.335]} scale={[0.2, 0.26, 0.02]} />
      <mesh geometry={boxGeo} material={std("#fffaf0")} position={[cx + HQ[0], ROOF + 0.2, cz + HQ[1] + 0.2]} scale={[1.02, 0.3, 0.04]} castShadow />
      <mesh position={[cx + HQ[0], ROOF + 0.2, cz + HQ[1] + 0.222]}>
        <planeGeometry args={[0.98, 0.26]} />
        <meshBasicMaterial map={sign} toneMapped={false} />
      </mesh>
      {/* The product: an empty plinth behind a velvet rope. */}
      <mesh geometry={boxGeo} material={std("#fffaf0")} position={[cx + 0.62, 0.2, cz + 0.12]} scale={[0.3, 0.34, 0.3]} castShadow />
      <mesh position={[cx + 0.62, 0.2, cz + 0.271]}>
        <planeGeometry args={[0.28, 0.07]} />
        <meshBasicMaterial map={plinth} toneMapped={false} />
      </mesh>
      {[0.36, 0.88].map((x) => (
        <mesh key={x} geometry={cylGeo} material={std("#d8b23a", 0.35)} position={[cx + x, 0.17, cz + 0.52]} scale={[0.025, 0.28, 0.025]} castShadow />
      ))}
      <mesh geometry={boxGeo} material={std("#b3263a")} position={[cx + 0.62, 0.26, cz + 0.52]} scale={[0.5, 0.025, 0.025]} />
      {/* The balloon, on a string from the roof. */}
      <mesh ref={string} geometry={cylGeo} material={std("#fffaf0")} />
      <mesh ref={balloon} geometry={sphereGeo} material={color} castShadow scale={0} />
    </group>
  );
}

/** Every neo lab with a lot (the first four); nothing at all until someone walks out and raises a round. */
export function NeoCampuses() {
  const labs = useApp(atoms.neo);
  return (
    <group>
      {labs.slice(0, NEO_LOTS.length).map((lab, i) => (
        <Campus key={lab.id} lab={lab} i={i} />
      ))}
    </group>
  );
}

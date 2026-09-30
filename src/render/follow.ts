// The Follow camera's hook. The inspector's Follow button sets `ui.follow`; anything that moves the camera can ask where
// the followed walker is right now. `Follow` (below) is the default consumer: it eases the MapControls target toward it.
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { send, sim } from "../app/game";
import { HALF } from "./coords";
import { people } from "../sim/ecs/protesters";

/**
 * Writes the world-space position (on the ground) of the walker being followed into `out` and returns true, or returns
 * false when nothing is being followed. Uses the same between-ticks interpolation as the renderer.
 */
export function followPoint(out: THREE.Vector3): boolean {
  const { selected, follow } = sim.ui;
  if (!follow || selected === null) return false;
  const w = people(sim.world).find((o) => o.id === selected);
  if (!w) return false;
  const a = sim.alpha;
  out.set(w.px + (w.x - w.px) * a - HALF, 0, w.pz + (w.z - w.pz) * a - HALF);
  return true;
}

const point = { x: 0, z: 0, set: false };
const want = new THREE.Vector3();

/** The bit of MapControls this needs (drei's controls are three-stdlib's). */
interface Rig {
  target: THREE.Vector3;
  object: THREE.Camera;
}

/** Eases the camera onto the followed walker; a pan by the player (the target moves without us) lets go. */
export function Follow() {
  const controls = useThree((s) => s.controls) as unknown as Rig | null;
  useFrame((_, dt) => {
    if (!controls) return;
    if (!followPoint(want)) {
      point.set = false;
      return;
    }
    const t = controls.target;
    // Somebody panned: the target isn't where we left it. Let go.
    if (point.set && Math.hypot(t.x - point.x, t.z - point.z) > 0.12) {
      point.set = false;
      send({ type: "SET_FOLLOW", follow: false });
      return;
    }
    const k = 1 - Math.exp(-6 * dt);
    const dx = (want.x - t.x) * k;
    const dz = (want.z - t.z) * k;
    t.x += dx;
    t.z += dz;
    controls.object.position.x += dx;
    controls.object.position.z += dz;
    point.x = t.x;
    point.z = t.z;
    point.set = true;
  });
  return null;
}

// FLT-98: the survey stakes on the empty lot and the food truck by the gate. Drawn here and nowhere else: they are not
// in the World, they never take a tap (a ray goes straight through), and a stake is pulled up when you build on it.

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { atoms, registry, sim } from "../app/game";
import { useApp } from "../app/hooks";
import { STAKE_WORDS, TRUCK_WORDS } from "../content/lot";
import { HALF } from "./coords";
import { FONT_STACK, INK } from "./materials";
import { STAKES, STAKE_SIGN_Y, STAKE_YAW, TRUCK, stakeHoverAtom, standingStakes } from "./lot";
import { SURVEY_STAKE, TRUCK_ATLAS, flagGeometry, stakeFacesGeometry, stakeGeometry, truckCardsGeometry, truckGeometry } from "./lotGeo";

const noHit = () => {};

const propMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.02, flatShading: true });

const FACE = { w: 512, h: 300 } as const;

/** Every stake's face, stacked top to bottom in `STAKES` order: an orange-edged card, the head, the name, the small print. */
function stakeAtlas(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = FACE.w;
  canvas.height = FACE.h * STAKES.length;
  const g = canvas.getContext("2d")!;
  g.textAlign = "center";
  g.textBaseline = "middle";
  STAKES.forEach((s, i) => {
    const words = STAKE_WORDS[s.id]!;
    const top = i * FACE.h;
    g.fillStyle = "#ff7a1a";
    g.fillRect(0, top, FACE.w, FACE.h);
    g.fillStyle = "#fffaf0";
    g.fillRect(14, top + 14, FACE.w - 28, FACE.h - 28);
    const mid = FACE.w / 2;
    const room = FACE.w - 64;
    g.fillStyle = "#c2571b";
    g.font = `800 44px ${FONT_STACK}`;
    g.fillText(words.head, mid, top + 62, room);
    g.fillStyle = INK;
    let size = 96;
    g.font = `900 ${size}px ${FONT_STACK}`;
    while (g.measureText(words.name).width > room && size > 40) g.font = `900 ${(size -= 4)}px ${FONT_STACK}`;
    g.fillText(words.name, mid, top + (words.foot ? 148 : 170));
    if (words.foot) {
      g.fillStyle = "#6b4a2e";
      g.font = `italic 700 40px ${FONT_STACK}`;
      g.fillText(words.foot, mid, top + 232, room);
    }
  });
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** The truck's roof sign (its name, a price per token) and the strip of small print under the hatch. */
function truckAtlas(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = TRUCK_ATLAS.w;
  canvas.height = TRUCK_ATLAS.h;
  const g = canvas.getContext("2d")!;
  g.textAlign = "center";
  g.textBaseline = "middle";
  const [, st, sw, sh] = TRUCK_ATLAS.sign;
  g.fillStyle = "#ff6f59";
  g.fillRect(0, st, sw, sh);
  g.fillStyle = "#fff3d0";
  g.fillRect(16, st + 16, sw - 32, sh - 32);
  g.fillStyle = "#c2571b";
  let size = 150;
  g.font = `900 ${size}px ${FONT_STACK}`;
  while (g.measureText(TRUCK_WORDS.name).width > sw - 80 && size > 60) g.font = `900 ${(size -= 6)}px ${FONT_STACK}`;
  g.fillText(TRUCK_WORDS.name, sw / 2, st + sh * 0.42);
  g.fillStyle = INK;
  g.font = `800 52px ${FONT_STACK}`;
  g.fillText(TRUCK_WORDS.price, sw / 2, st + sh * 0.8);
  const [, tt, tw, th] = TRUCK_ATLAS.strip;
  g.fillStyle = "#ffcf4a";
  g.fillRect(0, tt, tw, th);
  g.fillStyle = "#1f6f66";
  size = 76;
  g.font = `800 ${size}px ${FONT_STACK}`;
  while (g.measureText(TRUCK_WORDS.tagline).width > tw - 40 && size > 30) g.font = `800 ${(size -= 4)}px ${FONT_STACK}`;
  g.fillText(TRUCK_WORDS.tagline, tw / 2, tt + th / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const scene = (at: readonly [number, number]) => [at[0] - HALF, at[1] - HALF] as const;

/** The stakes, their flags (which flutter) and their faces: three draws for all of them. */
function Stakes() {
  // A new version is what can pave or build on a stake's tile, or keep its promise elsewhere.
  const version = useApp(atoms.version);
  const tool = useApp(atoms.tool);
  const zone = useApp(atoms.zone);
  const shown = useMemo(() => standingStakes(sim.world), [version]);
  const key = shown.map((s) => s.id).join();
  const geos = useMemo(() => ({ stake: stakeGeometry(), flag: flagGeometry() }), []);
  const atlas = useMemo(stakeAtlas, []);
  const faces = useMemo(
    () => stakeFacesGeometry(shown.map((s) => ({ x: s.at[0] - HALF, z: s.at[1] - HALF, yaw: STAKE_YAW, slot: STAKES.indexOf(s) })), STAKES.length),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  useEffect(() => () => faces.dispose(), [faces]);
  useEffect(() => () => {
    geos.stake.dispose();
    geos.flag.dispose();
    atlas.dispose();
  }, [geos, atlas]);

  const stakes = useRef<THREE.InstancedMesh>(null);
  const flags = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const mesh = stakes.current;
    if (!mesh) return;
    const d = new THREE.Object3D();
    shown.forEach((s, i) => {
      const [x, z] = scene(s.at);
      d.position.set(x, 0, z);
      d.rotation.set(0, STAKE_YAW, 0);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
    });
    mesh.count = shown.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  // The flags stream out on a breeze that gusts now and then, each a beat out of step with the next.
  const tie = useMemo(() => new THREE.Vector3(SURVEY_STAKE.x, SURVEY_STAKE.top - 0.01, SURVEY_STAKE.z).applyAxisAngle(THREE.Object3D.DEFAULT_UP, STAKE_YAW), []);
  const d = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ clock }) => {
    const mesh = flags.current;
    if (!mesh) return;
    const t = clock.elapsedTime;
    shown.forEach((s, i) => {
      const [x, z] = scene(s.at);
      d.position.set(x + tie.x, tie.y, z + tie.z);
      d.rotation.set(0, STAKE_YAW - 0.5 + Math.sin(t * 2.3 + i * 1.7) * 0.35 + Math.sin(t * 5.1 + i) * 0.08, Math.sin(t * 3.1 + i) * 0.12);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
    });
    mesh.count = shown.length;
    mesh.instanceMatrix.needsUpdate = true;
  });

  // Desktop only: a mouse resting on a stake's sign shows its full text. Taps and clicks are never touched.
  const { gl, camera } = useThree();
  useEffect(() => {
    const el = gl.domElement;
    const v = new THREE.Vector3();
    const set = (id: string | null) => registry.get(stakeHoverAtom) !== id && registry.set(stakeHoverAtom, id);
    if (tool || zone !== null) {
      set(null);
      return;
    }
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return set(null);
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const reach = Math.max(14, 0.3 * (camera as THREE.OrthographicCamera).zoom);
      let best: string | null = null;
      let bestD = reach;
      for (const s of standingStakes(sim.world)) {
        const [x, z] = scene(s.at);
        v.set(x, STAKE_SIGN_Y, z).project(camera);
        const sx = (v.x * 0.5 + 0.5) * rect.width;
        const sy = (-v.y * 0.5 + 0.5) * rect.height;
        const dist = Math.hypot(sx - px, sy - py);
        if (dist < bestD) [best, bestD] = [s.id, dist];
      }
      set(best);
    };
    const leave = () => set(null);
    el.addEventListener("pointermove", move, { passive: true });
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
      set(null);
    };
  }, [gl, camera, tool, zone]);

  return (
    <group>
      <instancedMesh ref={stakes} args={[geos.stake, propMat, STAKES.length]} raycast={noHit} castShadow receiveShadow />
      <instancedMesh ref={flags} args={[geos.flag, propMat, STAKES.length]} raycast={noHit} castShadow frustumCulled={false} />
      <mesh geometry={faces} raycast={noHit}>
        <meshBasicMaterial map={atlas} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Tensor Tacos, parked by the road out. Two draws: the van, and its painted cards. */
function FoodTruck() {
  const geos = useMemo(() => ({ body: truckGeometry(), cards: truckCardsGeometry() }), []);
  const atlas = useMemo(truckAtlas, []);
  useEffect(() => () => {
    geos.body.dispose();
    geos.cards.dispose();
    atlas.dispose();
  }, [geos, atlas]);
  return (
    <group position={[TRUCK.at[0], 0, TRUCK.at[1]]} rotation={[0, TRUCK.yaw, 0]}>
      <mesh geometry={geos.body} material={propMat} raycast={noHit} castShadow receiveShadow />
      <mesh geometry={geos.cards} raycast={noHit}>
        <meshBasicMaterial map={atlas} toneMapped={false} />
      </mesh>
    </group>
  );
}

export function LotProps() {
  return (
    <group>
      <Stakes />
      <FoodTruck />
    </group>
  );
}

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { createRng } from "../sim/rng";
import { PLAZA, onPlaza } from "../sim/opening";
import { GRID_SIZE } from "../sim/state";
import { atoms, sim } from "../app/game";
import { useApp } from "../app/hooks";
import { HALF, NEO_LOT_HALF, NEO_LOTS, PLAQUE_AT, worldX, worldZ } from "./coords";
import { boxGeo, CREAM, std } from "./materials";

const BOARD = 28;
const RIM = (BOARD - GRID_SIZE) / 2;

function grassTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = BOARD;
  const g = canvas.getContext("2d")!;
  for (let x = 0; x < BOARD; x++) {
    for (let z = 0; z < BOARD; z++) {
      const inside = x >= RIM && z >= RIM && x < BOARD - RIM && z < BOARD - RIM;
      const alt = (x + z) % 2 === 0;
      g.fillStyle = inside ? (alt ? "#79bf55" : "#72b84f") : alt ? "#6aac4b" : "#66a748";
      g.fillRect(x, z, 1, 1);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}

/** The diorama board: a checkered lawn on a slab of soil. */
export function Ground() {
  const map = useMemo(grassTexture, []);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[BOARD, BOARD]} />
        <meshStandardMaterial map={map} roughness={1} />
      </mesh>
      <mesh geometry={boxGeo} material={std("#5f9b45")} position={[0, -0.12, 0]} scale={[BOARD, 0.2, BOARD]} receiveShadow />
      <mesh geometry={boxGeo} material={std("#8a5d3b")} position={[0, -0.78, 0]} scale={[BOARD - 0.1, 1.14, BOARD - 0.1]} receiveShadow />
      <mesh geometry={boxGeo} material={std("#6f4a30")} position={[0, -1.5, 0]} scale={[BOARD - 0.6, 0.4, BOARD - 0.6]} />
      {/* The road out past the gate. */}
      <mesh geometry={boxGeo} material={std(CREAM)} position={[0, 0.03, HALF + RIM / 2 + 0.5]} scale={[2, 0.06, RIM + 1]} receiveShadow />
    </group>
  );
}

const PATH_MAX = GRID_SIZE * GRID_SIZE;

/** One raised cream slab per path tile (the entrance plaza's are warmer). */
export function Paths() {
  const version = useApp(atoms.version);
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tints = useMemo(() => [new THREE.Color("#f4e9c9"), new THREE.Color("#efe2bd")], []);
  // FLT-91: the entrance plaza is laid in warmer pavers, so the front yard reads as a place and not just more path.
  const pavers = useMemo(() => [new THREE.Color("#ecd2ac"), new THREE.Color("#e4c69c")], []);

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const { grid } = sim.world;
    let n = 0;
    for (let i = 0; i < grid.paths.length; i++) {
      if (!grid.paths[i]) continue;
      const x = i % grid.w;
      const z = Math.floor(i / grid.w);
      dummy.position.set(worldX(x + 0.5), 0.05, worldZ(z + 0.5));
      dummy.scale.set(0.97, 0.1, 0.97);
      dummy.updateMatrix();
      mesh.setMatrixAt(n, dummy.matrix);
      mesh.setColorAt(n, (onPlaza(x, z) ? pavers : tints)[(x + z) % 2]!);
      n++;
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [version, dummy, tints, pavers]);

  return (
    <instancedMesh ref={ref} args={[boxGeo, undefined, PATH_MAX]} receiveShadow castShadow frustumCulled={false}>
      <meshStandardMaterial roughness={0.9} />
    </instancedMesh>
  );
}

/** Trees, bushes and rocks on the rim of the board. Static, seeded locally so it never touches the sim. */
/** Which neo lab lot (FLT-56) a tree or bush stands on, or -1. */
const lotAt = (x: number, z: number) => NEO_LOTS.findIndex(([lx, lz]) => Math.abs(x - lx) < NEO_LOT_HALF[0] && Math.abs(z - lz) < NEO_LOT_HALF[1]);

/**
 * FLT-96: the strip of verge between the camera and the entrance plaza. Its trees stood right in front of the benches
 * by the fence, so they are never planted (the bushes and rocks stay, and the dice are drawn all the same).
 */
const PLAZA_FRONT = { x0: worldX(Math.min(...PLAZA.map((r) => r.x))), x1: worldX(Math.max(...PLAZA.map((r) => r.x + r.w))) + 0.6 };
const inFrontOfPlaza = (x: number, z: number) => z > HALF && x > PLAZA_FRONT.x0 && x < PLAZA_FRONT.x1;

export function Decor() {
  // Trees on a lot a neo lab has built on are felled (scaled to nothing: the instance counts never change).
  const built = useApp(atoms.neo).length;
  // And the few in front of the auditors' plaque, once there is one (FLT-56).
  const plaque = useApp(atoms.plaque) !== null;
  const items = useMemo(() => {
    const rng = createRng(20250929);
    const trees: { x: number; z: number; s: number; c: number }[] = [];
    const bushes: { x: number; z: number; s: number }[] = [];
    const rocks: { x: number; z: number; s: number }[] = [];
    for (let i = 0; i < BOARD; i++) {
      for (let j = 0; j < BOARD; j++) {
        const inside = i >= RIM && j >= RIM && i < BOARD - RIM && j < BOARD - RIM;
        if (inside) continue;
        const x = i - BOARD / 2 + 0.5 + (rng.next() - 0.5) * 0.6;
        const z = j - BOARD / 2 + 0.5 + (rng.next() - 0.5) * 0.6;
        if (Math.abs(x) < 2.4 && z > 0) continue; // keep the road out clear
        const roll = rng.next();
        if (roll < 0.34) trees.push({ x, z, s: 0.8 + rng.next() * 0.6, c: rng.int(0, 2) });
        else if (roll < 0.5) bushes.push({ x, z, s: 0.25 + rng.next() * 0.2 });
        else if (roll < 0.55) rocks.push({ x, z, s: 0.18 + rng.next() * 0.16 });
      }
    }
    return { trees, bushes, rocks };
  }, []);

  const trunk = useRef<THREE.InstancedMesh>(null);
  const low = useRef<THREE.InstancedMesh>(null);
  const high = useRef<THREE.InstancedMesh>(null);
  const bush = useRef<THREE.InstancedMesh>(null);
  const rock = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    const d = new THREE.Object3D();
    const greens = ["#3f8f3e", "#4ea347", "#5cb54f"].map((c) => new THREE.Color(c));
    const put = (mesh: THREE.InstancedMesh | null, i: number, x: number, y: number, z: number, sx: number, sy: number, color?: THREE.Color) => {
      if (!mesh) return;
      const lot = lotAt(x, z);
      const tree = mesh === trunk.current || mesh === low.current || mesh === high.current;
      const felled = (lot >= 0 && lot < built) || (plaque && Math.hypot(x - PLAQUE_AT[0], z - PLAQUE_AT[1]) < 1.5) || (tree && inFrontOfPlaza(x, z));
      d.position.set(x, y, z);
      d.scale.set(felled ? 0 : sx, felled ? 0 : sy, felled ? 0 : sx);
      d.rotation.y = i * 1.7;
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
      if (color) mesh.setColorAt(i, color);
    };
    items.trees.forEach((t, i) => {
      put(trunk.current, i, t.x, 0.3 * t.s, t.z, 0.09 * t.s, 0.6 * t.s);
      put(low.current, i, t.x, 0.85 * t.s, t.z, 0.5 * t.s, 0.85 * t.s, greens[t.c]);
      put(high.current, i, t.x, 1.35 * t.s, t.z, 0.36 * t.s, 0.7 * t.s, greens[t.c]);
    });
    items.bushes.forEach((b, i) => put(bush.current, i, b.x, b.s * 0.6, b.z, b.s, b.s * 0.8));
    items.rocks.forEach((r, i) => put(rock.current, i, r.x, r.s * 0.5, r.z, r.s, r.s * 0.7));
    for (const m of [trunk, low, high, bush, rock]) {
      if (!m.current) continue;
      m.current.instanceMatrix.needsUpdate = true;
      if (m.current.instanceColor) m.current.instanceColor.needsUpdate = true;
    }
  }, [items, built, plaque]);

  return (
    <group>
      <instancedMesh ref={trunk} args={[undefined, undefined, items.trees.length]} castShadow>
        <cylinderGeometry args={[1, 1.3, 1, 6]} />
        <meshStandardMaterial color="#8a5a3a" flatShading />
      </instancedMesh>
      <instancedMesh ref={low} args={[undefined, undefined, items.trees.length]} castShadow>
        <coneGeometry args={[1, 1.2, 7]} />
        <meshStandardMaterial flatShading roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={high} args={[undefined, undefined, items.trees.length]} castShadow>
        <coneGeometry args={[1, 1.1, 7]} />
        <meshStandardMaterial flatShading roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={bush} args={[undefined, undefined, items.bushes.length]} castShadow>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#4a9a47" flatShading />
      </instancedMesh>
      <instancedMesh ref={rock} args={[undefined, undefined, items.rocks.length]} castShadow>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#b8b2a6" flatShading />
      </instancedMesh>
    </group>
  );
}

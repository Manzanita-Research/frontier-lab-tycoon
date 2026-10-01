// FLT-85: where a building's path breaks. For every building with "No path!": its stub of path that goes nowhere (coral),
// an arrow over its door, and the tiles that would join it to the gate, as a pulsing gold ghost. With the path tool in
// hand, the gate's own network lights up too, so the gap between the two is plain. Reads the World; never writes it.
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { atoms, sim } from "../app/game";
import { useApp } from "../app/hooks";
import { getReach } from "../sim/pathfind";
import { pathGaps } from "../sim/pathgap";
import { GRID_SIZE } from "../sim/state";
import { worldX, worldZ } from "./coords";
import { boxGeo } from "./materials";

const MAX = GRID_SIZE * GRID_SIZE;
const arrowGeo = new THREE.ConeGeometry(0.2, 0.42, 4).rotateX(Math.PI);
const joinMat = new THREE.MeshBasicMaterial({ color: "#ffcc1f", transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false });
const stubMat = new THREE.MeshBasicMaterial({ color: "#ff7a66", transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false });
const netMat = new THREE.MeshBasicMaterial({ color: "#3fdc7e", transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false });
const arrowMat = new THREE.MeshBasicMaterial({ color: "#ff5d4d", toneMapped: false });

/** Lays `tiles` out as slabs `h` thick on one instanced mesh, centred `y` up. */
function useTiles(ref: React.RefObject<THREE.InstancedMesh | null>, tiles: readonly (readonly [number, number])[], y: number, h: number, size: number) {
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    tiles.forEach(([x, z], n) => {
      dummy.position.set(worldX(x + 0.5), y, worldZ(z + 0.5));
      dummy.scale.set(size, h, size);
      dummy.updateMatrix();
      mesh.setMatrixAt(n, dummy.matrix);
    });
    mesh.count = tiles.length;
    mesh.instanceMatrix.needsUpdate = true;
  }, [ref, tiles, y, h, size, dummy]);
}

export function PathGaps() {
  const version = useApp(atoms.version);
  const buildings = useApp(atoms.buildings);
  const tool = useApp(atoms.tool);
  const { join, stub, doors, net } = useMemo(() => {
    const gaps = [...pathGaps(sim.world).values()];
    const tiles: [number, number][] = [];
    const reach = getReach(sim.world).tiles;
    if (gaps.length > 0) for (let i = 0; i < reach.length; i++) if (reach[i]) tiles.push([i % sim.world.grid.w, Math.floor(i / sim.world.grid.w)]);
    return {
      join: gaps.flatMap((g) => g.join),
      stub: gaps.flatMap((g) => g.stub),
      doors: gaps.flatMap((g) => (g.door ? [g.door] : [])),
      net: tiles,
    };
    // `version` is what invalidates reachability; `buildings` catches a load that keeps the number.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, buildings]);
  const placing = tool === "path";
  const joinRef = useRef<THREE.InstancedMesh>(null);
  const stubRef = useRef<THREE.InstancedMesh>(null);
  const netRef = useRef<THREE.InstancedMesh>(null);
  const arrows = useRef<THREE.Group>(null);
  const shownNet = useMemo(() => (placing ? net : []), [placing, net]);
  // A ghost of a path slab where the join goes; tints laid just over the top of the real slabs (their tops are at 0.1).
  useTiles(joinRef, join, 0.065, 0.13, 0.9);
  useTiles(stubRef, stub, 0.115, 0.03, 0.97);
  useTiles(netRef, shownNet, 0.112, 0.024, 0.97);

  useFrame(({ clock }) => {
    if (join.length === 0 && doors.length === 0) return;
    const t = clock.elapsedTime;
    // The ghost breathes: brighter with the path tool in hand, so it reads as "here".
    const beat = 0.5 + 0.5 * Math.sin(t * 5);
    joinMat.opacity = placing ? 0.6 + 0.4 * beat : 0.45 + 0.45 * beat;
    const j = joinRef.current;
    if (j) j.scale.y = 1 + 0.6 * beat;
    const g = arrows.current;
    if (g) g.children.forEach((c, i) => (c.position.y = 0.75 + 0.14 * Math.abs(Math.sin(t * 4 + i))));
  });

  return (
    <>
      <instancedMesh ref={netRef} args={[boxGeo, netMat, MAX]} frustumCulled={false} renderOrder={1} />
      <instancedMesh ref={stubRef} args={[boxGeo, stubMat, MAX]} frustumCulled={false} renderOrder={2} />
      <instancedMesh ref={joinRef} args={[boxGeo, joinMat, MAX]} frustumCulled={false} renderOrder={3} />
      <group ref={arrows}>
        {doors.map(([x, z]) => (
          <mesh key={`${x},${z}`} geometry={arrowGeo} material={arrowMat} position={[worldX(x + 0.5), 0.8, worldZ(z + 0.5)]} />
        ))}
      </group>
    </>
  );
}

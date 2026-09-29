import type { ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { BUILDINGS } from "../content/buildings";
import { atoms, send, sim, use } from "../app/game";
import type { Tool } from "../app/hud";
import { useApp } from "../app/hooks";
import { BuildingModel, Ghost } from "./buildings/Buildings";
import { HALF, rectCenter } from "./coords";
import { computeGhost } from "./ghost";
import { boxGeo, ghostMaterials } from "./materials";

/** Where a tool would land for a pointer at continuous grid position (px, pz). */
function anchor(tool: Tool, px: number, pz: number): { x: number; z: number } {
  if (tool === "path" || tool === "bulldoze") return { x: Math.floor(px), z: Math.floor(pz) };
  const [w, d] = BUILDINGS[tool].size;
  return { x: Math.round(px - w / 2), z: Math.round(pz - d / 2) };
}

/** Bresenham-ish walk so a fast drag can't leave gaps in a painted path. */
function tilesBetween(a: { x: number; z: number }, b: { x: number; z: number }) {
  const out: { x: number; z: number }[] = [];
  const n = Math.max(Math.abs(b.x - a.x), Math.abs(b.z - a.z), 1);
  for (let i = 1; i <= n; i++) out.push({ x: Math.round(a.x + ((b.x - a.x) * i) / n), z: Math.round(a.z + ((b.z - a.z) * i) / n) });
  return out;
}

export function Placement() {
  const tool = useApp(atoms.tool);
  const hover = useApp(atoms.hover);
  const version = useApp(atoms.version);
  const cash = useApp(atoms.cashBucket);
  const painting = useRef<{ x: number; z: number } | null>(null);

  useEffect(() => {
    const stop = () => (painting.current = null);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, []);
  useEffect(() => {
    painting.current = null;
  }, [tool]);

  const fromEvent = (e: ThreeEvent<PointerEvent | MouseEvent>) => {
    if (!tool) return null;
    return anchor(tool, e.point.x + HALF, e.point.z + HALF);
  };

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    const at = fromEvent(e);
    send({ type: "SET_HOVER", hover: at });
    if (!at || !tool || !painting.current) return;
    for (const t of tilesBetween(painting.current, at)) use(tool, t.x, t.z, true);
    painting.current = at;
  };
  const onDown = (e: ThreeEvent<PointerEvent>) => {
    if (!tool || (tool !== "path" && tool !== "bulldoze") || e.button !== 0) return;
    const at = fromEvent(e);
    if (!at) return;
    painting.current = at;
    send({ type: "SET_HOVER", hover: at });
    use(tool, at.x, at.z, true);
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (!tool || tool === "path" || tool === "bulldoze") return;
    const at = fromEvent(e);
    if (at) use(tool, at.x, at.z);
  };

  const ghost = useMemo(
    () => computeGhost(sim.world, tool, hover),
    // Recompute when the world or the wallet changes, not just the pointer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tool, hover, version, cash],
  );

  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.001, 0]} onPointerMove={onMove} onPointerDown={onDown} onClick={onClick} onPointerLeave={() => send({ type: "SET_HOVER", hover: null })}>
        <planeGeometry args={[80, 80]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {ghost && (
        <group position={[rectCenter(ghost.rect)[0], 0, rectCenter(ghost.rect)[1]]}>
          {ghost.kind ? (
            <Ghost ok={ghost.ok}>
              <BuildingModel kind={ghost.kind} />
            </Ghost>
          ) : null}
          <mesh
            geometry={boxGeo}
            material={ghost.ok && !ghost.bulldoze ? ghostMaterials.ok : ghostMaterials.bad}
            position={[0, 0.09, 0]}
            scale={[ghost.rect.w, 0.06, ghost.rect.d]}
          />
        </group>
      )}
    </>
  );
}

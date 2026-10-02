// FLT-96: benches, planters and a welcome sign on the entrance plaza. Drawn here and nowhere else: they are not in the
// World, they never take a tap (a tap goes through them to whoever is behind), and they make way when you build.

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { atoms, sim } from "../app/game";
import { useApp } from "../app/hooks";
import { PLAZA_SIGN } from "../content/plaza";
import { HALF } from "./coords";
import { FONT_STACK, INK } from "./materials";
import { PLAZA_PROPS, plazaProps, type PlazaProp, type PropKind } from "./plaza";
import { SIGN_FACE, benchGeometry, planterGeometry, signFaceGeometry, signGeometry } from "./plazaGeo";

/** Props are scenery: a ray passes straight through, so the tile, walker or building under one still gets the tap. */
const noHit = () => {};

const propMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.02, flatShading: true });

/** The sign's face: a little sunrise, then "WELCOME TO", the lab's name as big as it fits, and the small print. */
function signTexture(labName: string): THREE.CanvasTexture {
  const w = 1024;
  const h = Math.round((w * SIGN_FACE.h) / SIGN_FACE.w);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d")!;
  g.fillStyle = "#fff3d0";
  g.fillRect(0, 0, w, h);
  // The sunrise, on the left.
  const sx = 150;
  const sy = h * 0.66;
  g.fillStyle = "#ffbe3d";
  g.strokeStyle = "#ffbe3d";
  g.lineWidth = 14;
  g.lineCap = "round";
  for (let i = 0; i < 7; i++) {
    const a = Math.PI + (Math.PI * (i + 0.5)) / 7;
    g.beginPath();
    g.moveTo(sx + Math.cos(a) * 82, sy + Math.sin(a) * 82);
    g.lineTo(sx + Math.cos(a) * 118, sy + Math.sin(a) * 118);
    g.stroke();
  }
  g.beginPath();
  g.arc(sx, sy, 66, Math.PI, 0);
  g.fill();
  g.fillStyle = "#ff8a4c";
  g.fillRect(40, sy, 220, 14);
  g.fillRect(70, sy + 26, 160, 10);
  // The words, on the right.
  const left = 290;
  const room = w - left - 40;
  const mid = left + room / 2;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = "#c2571b";
  g.font = `800 52px ${FONT_STACK}`;
  g.fillText(PLAZA_SIGN.head, mid, h * 0.17);
  g.fillStyle = INK;
  const lines = nameLines(g, labName, room);
  const size = lines.size;
  g.font = `900 ${size}px ${FONT_STACK}`;
  const top = h * 0.53 - ((lines.text.length - 1) * size * 1.02) / 2;
  lines.text.forEach((line, i) => g.fillText(line, mid, top + i * size * 1.02));
  g.fillStyle = "#6b4a2e";
  let foot = 40;
  g.font = `700 ${foot}px ${FONT_STACK}`;
  while (g.measureText(PLAZA_SIGN.foot).width > room && foot > 18) g.font = `700 ${(foot -= 2)}px ${FONT_STACK}`;
  g.fillText(PLAZA_SIGN.foot, mid, h * 0.89);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** The name on one line if it fits big, else on two, as large as the longer line allows. */
function nameLines(g: CanvasRenderingContext2D, name: string, room: number): { text: string[]; size: number } {
  const fit = (lines: string[], max: number) => {
    let size = max;
    g.font = `900 ${size}px ${FONT_STACK}`;
    while (lines.some((l) => g.measureText(l).width > room) && size > 20) g.font = `900 ${(size -= 4)}px ${FONT_STACK}`;
    return size;
  };
  const one = fit([name], 132);
  const words = name.split(" ");
  if (one >= 96 || words.length < 2) return { text: [name], size: one };
  let best = { text: [name], size: one };
  for (let i = 1; i < words.length; i++) {
    const text = [words.slice(0, i).join(" "), words.slice(i).join(" ")];
    const size = fit(text, 92);
    if (size > best.size) best = { text, size };
  }
  return best;
}

/** All of one kind in a single instanced draw, in `PLAZA_PROPS` order; hidden ones are dropped from the count. */
function Kind({ kind, geometry, shown }: { kind: PropKind; geometry: THREE.BufferGeometry; shown: PlazaProp[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const max = PLAZA_PROPS.filter((p) => p.kind === kind).length;
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const d = new THREE.Object3D();
    let n = 0;
    for (const p of shown) {
      if (p.kind !== kind) continue;
      d.position.set(p.at[0] - HALF, 0, p.at[1] - HALF);
      d.rotation.set(0, p.yaw, 0);
      d.updateMatrix();
      mesh.setMatrixAt(n++, d.matrix);
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [kind, shown]);
  return <instancedMesh ref={ref} args={[geometry, propMat, max]} raycast={noHit} castShadow receiveShadow />;
}

export function PlazaProps() {
  // A new version is what can pave or build across a prop's back.
  const version = useApp(atoms.version);
  const labName = useApp(atoms.labName);
  const shown = useMemo(() => plazaProps(sim.world), [version]);
  const geos = useMemo(() => ({ bench: benchGeometry(), planter: planterGeometry(), sign: signGeometry(), face: signFaceGeometry() }), []);
  const face = useMemo(() => signTexture(labName), [labName]);
  useEffect(() => () => face.dispose(), [face]);
  useEffect(() => () => Object.values(geos).forEach((g) => g.dispose()), [geos]);
  const sign = shown.find((p) => p.kind === "sign");
  return (
    <group>
      <Kind kind="bench" geometry={geos.bench} shown={shown} />
      <Kind kind="planter" geometry={geos.planter} shown={shown} />
      {sign && (
        <group position={[sign.at[0] - HALF, 0, sign.at[1] - HALF]} rotation={[0, sign.yaw, 0]}>
          <mesh geometry={geos.sign} material={propMat} raycast={noHit} castShadow receiveShadow />
          <mesh geometry={geos.face} raycast={noHit}>
            <meshBasicMaterial map={face} toneMapped={false} />
          </mesh>
        </group>
      )}
    </group>
  );
}

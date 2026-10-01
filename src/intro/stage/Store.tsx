// SoftWarehouse '97, Aisle 7: linoleum, pegboard, a metal shelf of big boxes under a fluorescent tube, and the next
// aisle over. The other boxes can be picked up and read (they're display copies); ours is the one at eye level.
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { createRng } from "../../sim/rng";
import { paintFloor, paintShelfFront, paintSign, paintSpine, paintTalker } from "../art";
import { SHELF, type ShelfBox } from "../content";
import { canvasTexture, dampTo, frameDt, pose, SHELF_TOPS, SHELF_W, useClock, type Pose, type StageProps } from "./rig";
import { useArt } from "./textures";

const DEPTH = 0.38;
const TOP = 1.46;

export function Store({ beat, context, send }: StageProps) {
  const tex = useMemo(() => {
    const floor = canvasTexture(paintFloor(), 8);
    floor.wrapS = floor.wrapT = THREE.RepeatWrapping;
    floor.repeat.set(12, 12);
    const peg = canvasTexture(paintPegboard(), 4);
    peg.wrapS = peg.wrapT = THREE.RepeatWrapping;
    peg.repeat.set(4, 3);
    return { floor, peg, sign: canvasTexture(paintSign(), 4), talker: canvasTexture(paintTalker(), 4) };
  }, []);
  useEffect(() => () => Object.values(tex).forEach((t) => t.dispose()), [tex]);
  const metal = useMemo(() => new THREE.MeshStandardMaterial({ color: "#c9ccd2", roughness: 0.45, metalness: 0.3 }), []);
  useEffect(() => () => metal.dispose(), [metal]);

  return (
    <group>
      {/* Floor and walls */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[1, 0, 1]}>
        <planeGeometry args={[14, 14]} />
        <meshStandardMaterial map={tex.floor} roughness={0.35} />
      </mesh>
      <mesh position={[1, 1.6, -0.45]}>
        <planeGeometry args={[14, 3.2]} />
        <meshStandardMaterial color="#d8d2c2" roughness={0.9} />
      </mesh>

      {/* The shelf unit */}
      <mesh position={[0, TOP / 2, -0.17]}>
        <planeGeometry args={[SHELF_W, TOP]} />
        <meshStandardMaterial map={tex.peg} roughness={0.9} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * (SHELF_W + 0.04)) / 2, TOP / 2 + 0.05, 0]} material={metal}>
          <boxGeometry args={[0.04, TOP + 0.1, DEPTH]} />
        </mesh>
      ))}
      <mesh position={[0, 0.05, 0]} material={metal}>
        <boxGeometry args={[SHELF_W, 0.1, DEPTH]} />
      </mesh>
      {SHELF_TOPS.map((y) => (
        <group key={y}>
          <mesh position={[0, y - 0.0125, 0]} material={metal}>
            <boxGeometry args={[SHELF_W, 0.025, DEPTH]} />
          </mesh>
          {/* The price strip along the shelf's edge */}
          <mesh position={[0, y - 0.03, DEPTH / 2 + 0.001]}>
            <planeGeometry args={[SHELF_W, 0.035]} />
            <meshStandardMaterial color="#ffe14d" roughness={0.6} />
          </mesh>
        </group>
      ))}
      {/* The header sign, lit */}
      <mesh position={[0, TOP + 0.2, 0.05]}>
        <boxGeometry args={[SHELF_W + 0.08, 0.32, 0.04]} />
        <meshStandardMaterial color="#8a0a1e" />
      </mesh>
      <mesh position={[0, TOP + 0.2, 0.071]}>
        <planeGeometry args={[SHELF_W, 0.3]} />
        <meshStandardMaterial map={tex.sign} emissive="#ffffff" emissiveMap={tex.sign} emissiveIntensity={0.55} roughness={0.5} />
      </mesh>
      {/* The shelf-talker under our box */}
      <mesh position={[0, SHELF_TOPS[1] - 0.075, DEPTH / 2 + 0.004]} rotation={[-0.08, 0, 0.03]}>
        <planeGeometry args={[0.3, 0.075]} />
        <meshStandardMaterial map={tex.talker} roughness={0.7} />
      </mesh>
      {/* The fluorescent tube */}
      <mesh position={[0.8, 2.75, 0.8]}>
        <boxGeometry args={[3.2, 0.04, 0.12]} />
        <meshStandardMaterial color="#ffffff" emissive="#f4fbff" emissiveIntensity={3} toneMapped={false} />
      </mesh>

      {SHELF.map((b) => (
        <ShelfItem key={b.id} box={b} beat={beat} peeking={context.peek === b.id} anyPeek={!!context.peek} send={send} />
      ))}
      <NextAisle />
    </group>
  );
}

/** Where a shelf box stands: x along the shelf, on its shelf, pushed to the front. */
function shelfPose(b: ShelfBox): Pose {
  const [, h] = b.size;
  const x = b.at * (SHELF_W / 2 - 0.13);
  return pose([x, SHELF_TOPS[b.shelf] + h / 2 + 0.001, 0.04]);
}

function ShelfItem({ box, beat, peeking, anyPeek, send }: { box: ShelfBox; beat: string; peeking: boolean; anyPeek: boolean; send: StageProps["send"] }) {
  const clock = useClock();
  const ref = useRef<THREE.Group>(null);
  const [hover, setHover] = useState(false);
  const [w, h, d] = box.size;
  const cover = useArt()[`shelf-${box.id}`];
  const materials = useMemo(() => {
    // The printed cover (FLT-89) if the box has one; the art cache owns it, so only a painted front is disposed here.
    const painted = cover ? null : canvasTexture(paintShelfFront(box), 4);
    const spine = canvasTexture(paintSpine(box.title, box.colors), 2);
    const plain = new THREE.MeshStandardMaterial({ color: box.colors[1], roughness: 0.6 });
    const side = new THREE.MeshStandardMaterial({ map: spine, roughness: 0.55 });
    const face = new THREE.MeshStandardMaterial({ map: cover ?? painted, roughness: 0.4 });
    return { list: [side, side, plain, plain, face, plain], dispose: () => [painted, spine, plain, side, face].forEach((x) => x?.dispose()) };
  }, [box, cover]);
  useEffect(() => () => materials.dispose(), [materials]);
  const home = useMemo(() => shelfPose(box), [box]);
  const target = useMemo<Pose>(() => ({ p: new THREE.Vector3(), q: new THREE.Quaternion() }), []);
  const active = beat === "shelf";

  useEffect(() => {
    if (!hover || !active) return;
    document.body.style.cursor = "pointer";
    return () => void (document.body.style.cursor = "");
  }, [hover, active]);

  useFrame((state, raw) => {
    const o = ref.current;
    if (!o) return;
    const dt = frameDt(clock.current, raw);
    target.p.copy(home.p);
    target.q.copy(home.q);
    if (peeking && active) {
      // Picked up and turned toward you, a little too close, like you're reading the system requirements.
      target.p.set(home.p.x * 0.45 + 0.1, 1.02, 0.75);
      target.q.setFromEuler(new THREE.Euler(-0.05, -0.18 + Math.sin(state.clock.elapsedTime * 0.8) * 0.05, 0.02));
    } else if (hover && active && !anyPeek) {
      target.p.z += 0.04;
      target.q.setFromEuler(new THREE.Euler(-0.08, 0, 0));
    }
    dampTo(o, target, 7, dt);
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (!active) return;
    e.stopPropagation();
    send({ type: "PEEK", id: peeking ? null : box.id });
  };
  return (
    <group
      ref={ref}
      onClick={onClick}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHover(true);
      }}
      onPointerOut={() => setHover(false)}
    >
      <mesh material={materials.list}>
        <boxGeometry args={[w, h, d]} />
      </mesh>
    </group>
  );
}

/** The aisle over: another shelf, full of boxes nobody picks, in one draw call. */
function NextAisle() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const N = 36;
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    const rng = createRng(1997);
    const o = new THREE.Object3D();
    const col = new THREE.Color();
    const palette = ["#c8102e", "#0b3d91", "#ffe14d", "#58b24f", "#8a5ae2", "#111111", "#f07ab8", "#3aa0ff", "#e08a1e"];
    let i = 0;
    for (let s = 0; s < 3; s++)
      for (let j = 0; j < 12 && i < N; j++, i++) {
        const h = 0.22 + rng.next() * 0.08;
        o.position.set(-2.95 + j * 0.13 + rng.next() * 0.01, SHELF_TOPS[s]! + h / 2, 0.02);
        o.rotation.set(0, (rng.next() - 0.5) * 0.08, 0);
        o.scale.set(0.12 + rng.next() * 0.03, h, 0.06);
        o.updateMatrix();
        m.setMatrixAt(i, o.matrix);
        m.setColorAt(i, col.set(rng.pick(palette)));
      }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, []);
  return (
    <group>
      <instancedMesh ref={ref} args={[undefined, undefined, N]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.6} />
      </instancedMesh>
      {SHELF_TOPS.map((y) => (
        <mesh key={y} position={[-2.2, y - 0.0125, 0]}>
          <boxGeometry args={[1.6, 0.025, DEPTH]} />
          <meshStandardMaterial color="#b5b8be" roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[-2.2, TOP / 2, -0.17]}>
        <planeGeometry args={[1.6, TOP]} />
        <meshStandardMaterial color="#9c8360" roughness={0.9} />
      </mesh>
      <mesh position={[-1.05, 0.25, 0.85]} rotation={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.28, 0.24, 0.5, 20, 1, true]} />
        <meshStandardMaterial color="#c8102e" side={THREE.DoubleSide} roughness={0.6} />
      </mesh>
    </group>
  );
}

/** Brown pegboard: holes in a grid. */
function paintPegboard(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#b08d5f";
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = "#5a4127";
  for (let y = 8; y < 128; y += 16) for (let x = 8; x < 128; x += 16) g.fillRect(x - 2, y - 2, 4, 4);
  return c;
}

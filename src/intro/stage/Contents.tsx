// What's in the box, as a flat lay on the demo counter. Each item damps toward its place: inside the box before the
// unwrap, on the counter after, held up close when focused, and (the disc) into the kiosk's drawer when you insert it.
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { paintCard, paintDisc, paintEula, paintFloppy, paintInsert, paintOverlay } from "../art";
import { ITEMS, type ItemId } from "../content";
import { Book3D } from "./Book3D";
import { Coa } from "./Coa";
import { ITEM_SIZE, REST, REST_TALL } from "./items";
import { canvasTexture, DRAWER_IN_Z, DRAWER_OUT_Z, DRAWER_Y, dampTo, flat, frameDt, HOLD, pose, TOWER, TRAY, useClock, type Pose, type StageProps } from "./rig";

type Props = StageProps & { weightsKey: string };

const HIDDEN_BEATS = new Set(["shelf", "pulling"]);
const IN_KIOSK = new Set(["warmup", "post", "splash", "dive"]);

export function Contents({ beat, context, send, weightsKey }: Props) {
  if (HIDDEN_BEATS.has(beat)) return null;
  return (
    <group>
      {ITEMS.map((item, i) => (
        <Item key={item.id} id={item.id} order={i} beat={beat} context={context} send={send}>
          {renderItem(item.id, context.item === item.id && beat === "focus", context.page, weightsKey)}
        </Item>
      ))}
    </group>
  );
}

function renderItem(id: ItemId, held: boolean, page: number, weightsKey: string): ReactNode {
  const [w, h] = ITEM_SIZE[id];
  switch (id) {
    case "manual":
      return <Book3D page={held ? page : 0} w={w} h={h} />;
    case "coa":
      return <Coa w={w} h={h} weightsKey={weightsKey} held={held} />;
    case "disc":
      return <Disc r={w / 2} />;
    case "floppies":
      return <Floppies w={w} h={h} held={held} />;
    case "card":
      return <Paper w={w} h={h} paint={paintCard} />;
    case "overlay":
      return <Paper w={w} h={h} paint={paintOverlay} />;
    case "eula":
      return <Paper w={w} h={h} paint={paintEula} />;
    case "inserts":
      return <Inserts w={w} h={h} held={held} />;
  }
}

function Item({ id, order, beat, context, send, children }: StageProps & { id: ItemId; order: number; children: ReactNode }) {
  const clock = useClock();
  const ref = useRef<THREE.Group>(null);
  const [hover, setHover] = useState(false);
  const held = beat === "focus" && context.item === id;
  const tall = useThree((s) => s.size.width < s.size.height);
  const pickable = beat === "open" || beat === "focus";
  const inTray = useMemo(() => flat(TRAY.x, TRAY.y - 0.02 + order * 0.003, TRAY.z, 0), [order]);
  const holdPose = useMemo(() => pose(HOLD, id === "manual" ? -0.08 : -0.12, 0, 0), [id]);
  const target = useMemo<Pose>(() => ({ p: new THREE.Vector3(), q: new THREE.Quaternion() }), []);

  useEffect(() => {
    if (!hover || !pickable) return;
    document.body.style.cursor = "pointer";
    return () => void (document.body.style.cursor = "");
  }, [hover, pickable]);

  useFrame((_, raw) => {
    const o = ref.current;
    if (!o) return;
    const c = clock.current;
    const dt = frameDt(c, raw);
    let lambda = 7;
    const rest = (tall ? REST_TALL : REST)[id];
    if (beat === "unwrapping") {
      // The lid comes off at ~1.0 s; then everything slides out, one after another.
      const go = c.t > 1.15 + order * 0.09;
      target.p.copy(go ? rest.p : inTray.p);
      target.q.copy(go ? rest.q : inTray.q);
      if (go) target.p.y += 0.06 * Math.max(0, 1 - (c.t - 1.15 - order * 0.09) * 2);
      lambda = 6;
    } else if (held) {
      target.p.copy(holdPose.p);
      target.q.copy(holdPose.q);
      lambda = 6;
    } else if (id === "disc" && (beat === "disc" || IN_KIOSK.has(beat))) {
      discPath(beat === "disc" ? c.t : 99, target);
      lambda = 9;
    } else {
      target.p.copy(rest.p);
      target.q.copy(rest.q);
      if (hover && pickable) target.p.y += 0.018;
    }
    dampTo(o, target, lambda, dt);
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (!pickable) return;
    e.stopPropagation();
    if (!held) send({ type: "FOCUS", item: id });
  };
  const label = ITEMS.find((i) => i.id === id)!.name;
  return (
    <group
      ref={ref}
      name={label}
      onClick={onClick}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHover(true);
      }}
      onPointerOut={() => setHover(false)}
    >
      {children}
    </group>
  );
}

/** The disc's trip from the counter into the kiosk: up, over the drawer, down into it, and in with the drawer. */
function discPath(t: number, out: Pose) {
  const lying = flat(0, 0, 0, 0).q;
  out.q.copy(lying);
  const x = TOWER.x;
  if (t < 0.55) out.p.set(2.75, DRAWER_Y + 0.12, 0.6);
  else if (t < 1.15) out.p.set(x, DRAWER_Y + 0.07, DRAWER_OUT_Z);
  else if (t < 1.55) out.p.set(x, DRAWER_Y + 0.008, DRAWER_OUT_Z);
  else out.p.set(x, DRAWER_Y + 0.008, DRAWER_IN_Z);
}

function Paper({ w, h, paint }: { w: number; h: number; paint: () => HTMLCanvasElement }) {
  const map = useMemo(() => canvasTexture(paint(), 8), [paint]);
  useEffect(() => () => map.dispose(), [map]);
  return (
    <mesh>
      <planeGeometry args={[w, h]} />
      <meshStandardMaterial map={map} roughness={0.85} side={THREE.DoubleSide} />
    </mesh>
  );
}

function Disc({ r }: { r: number }) {
  const map = useMemo(() => canvasTexture(paintDisc(), 8), []);
  useEffect(() => () => map.dispose(), [map]);
  return (
    <group>
      <mesh position={[0, 0, 0.0008]}>
        <circleGeometry args={[r, 48]} />
        <meshStandardMaterial map={map} transparent alphaTest={0.5} roughness={0.5} />
      </mesh>
      <mesh rotation={[0, Math.PI, 0]}>
        <ringGeometry args={[r * 0.08, r, 48]} />
        <meshStandardMaterial color="#d7dde6" metalness={0.6} roughness={0.15} />
      </mesh>
    </group>
  );
}

function Floppies({ w, h, held }: { w: number; h: number; held: boolean }) {
  const maps = useMemo(() => [1, 2, 3].map((n) => canvasTexture(paintFloppy(n), 4)), []);
  useEffect(() => () => maps.forEach((m) => m.dispose()), [maps]);
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const clock = useClock();
  useFrame((_, raw) => {
    const dt = frameDt(clock.current, raw);
    refs.current.forEach((m, i) => {
      if (!m) return;
      const tx = held ? (i - 1) * w * 1.1 : i * 0.006;
      const tz = held ? 0 : (2 - i) * 0.0035;
      m.position.x += (tx - m.position.x) * (1 - Math.exp(-8 * dt));
      m.position.z += (tz - m.position.z) * (1 - Math.exp(-8 * dt));
      m.position.y = held ? 0 : -i * 0.004;
    });
  });
  return (
    <group>
      {maps.map((map, i) => (
        <mesh key={i} ref={(m) => void (refs.current[i] = m)}>
          <boxGeometry args={[w, h, 0.0033]} />
          <meshStandardMaterial map={map} roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

function Inserts({ w, h, held }: { w: number; h: number; held: boolean }) {
  const maps = useMemo(() => [0, 1, 2, 3, 4].map((i) => canvasTexture(paintInsert(i), 4)), []);
  useEffect(() => () => maps.forEach((m) => m.dispose()), [maps]);
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const clock = useClock();
  useFrame((_, raw) => {
    const dt = frameDt(clock.current, raw);
    const a = 1 - Math.exp(-7 * dt);
    refs.current.forEach((m, i) => {
      if (!m) return;
      const j = i - 2;
      // Fanned in a pile on the counter; fanned out like a hand of cards when held.
      const tx = held ? j * w * 0.52 : j * 0.012;
      const ty = held ? -Math.abs(j) * h * 0.12 : j * 0.01;
      const rz = held ? -j * 0.12 : j * 0.22;
      m.position.x += (tx - m.position.x) * a;
      m.position.y += (ty - m.position.y) * a;
      m.position.z = i * 0.0012;
      m.rotation.z += (rz - m.rotation.z) * a;
    });
  });
  return (
    <group>
      {maps.map((map, i) => (
        <mesh key={i} ref={(m) => void (refs.current[i] = m)}>
          <planeGeometry args={[w, h]} />
          <meshStandardMaterial map={map} roughness={0.85} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

// What's in the box, as a flat lay on the demo counter. Each item damps toward its place: inside the box before the
// unwrap, on the counter after, held up close when focused, and (the disc) into the kiosk's drawer when you insert it.
// FLT-95: the disc held up close turns slowly under the light before you choose to put it in, and you can tilt it yourself.
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { paintCard, paintEula, paintFloppy, paintOverlay } from "../art";
import { ITEMS, type ItemId } from "../content";
import { contentsHidden } from "./box";
import { Book3D } from "./Book3D";
import { Coa } from "./Coa";
import { Disc } from "./Disc";
import { discTurn } from "./disc";
import { INSERT_ART, useArt } from "./textures";
import { ITEM_SIZE, REST, REST_TALL } from "./items";
import { BOX_TIMES, canvasTexture, DRAWER_IN_Z, DRAWER_OUT_Z, DRAWER_Y, dampTo, ease, flat, frameDt, HOLD, pose, TOWER, useClock, type Pose, type StageProps } from "./rig";

type Props = StageProps & { weightsKey: string };

const HIDDEN_BEATS = new Set(["shelf", "pulling", "held"]);
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
  /** Where it lies in the box, stacked by `order`: on top of `clock.tray`, which follows the box until the lid is off. */
  const inTray = useMemo(() => flat(0, -0.02 + order * 0.003, 0, 0), [order]);
  const placed = useRef(false);
  const holdPose = useMemo(() => pose(HOLD, id === "manual" ? -0.08 : -0.12, 0, 0), [id]);
  const target = useMemo<Pose>(() => ({ p: new THREE.Vector3(), q: new THREE.Quaternion() }), []);
  const turn = useMemo(() => new THREE.Quaternion(), []);
  const euler = useMemo(() => new THREE.Euler(), []);

  useEffect(() => {
    if (!hover || !pickable) return;
    document.body.style.cursor = "pointer";
    return () => void (document.body.style.cursor = "");
  }, [hover, pickable]);

  useFrame((state, raw) => {
    const o = ref.current;
    if (!o) return;
    const c = clock.current;
    // Shut in the box, it is out of sight and goes wherever the box goes; and on its first frame it starts where it
    // belongs, never flying in from the middle of the room.
    const hidden = contentsHidden(beat, c.t);
    o.visible = !hidden;
    const dt = hidden || !placed.current ? Infinity : frameDt(c, raw);
    placed.current = true;
    let lambda = 7;
    const rest = (tall ? REST_TALL : REST)[id];
    if (beat === "unwrapping") {
      // The lid comes off; then everything slides out, one after another, each one eased off the mark.
      const at = BOX_TIMES.itemsOut + order * BOX_TIMES.itemGap;
      const go = c.t > at;
      if (go) target.p.copy(rest.p);
      else target.p.copy(inTray.p).add(c.tray);
      target.q.copy(go ? rest.q : inTray.q);
      if (go) target.p.y += 0.06 * Math.max(0, 1 - (c.t - at) * 1.2);
      lambda = go ? 4.5 * ease(c.t - at, 0.4) : 6;
    } else if (held) {
      target.p.copy(holdPose.p);
      target.q.copy(holdPose.q);
      if (id === "disc") {
        // The disc turns slowly under the light, or the way you tilt it, never so far that the label stops being readable.
        const by = discTurn(state.clock.elapsedTime, c.tilt, c.dragging);
        turn.setFromEuler(euler.set(by.x, by.y, 0));
        target.q.multiply(turn);
      }
      lambda = id === "disc" && c.dragging ? 10 : 4;
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
  const [over, down, inside] = BOX_TIMES.disc;
  if (t < over) out.p.set(2.75, DRAWER_Y + 0.12, 0.6);
  else if (t < down) out.p.set(x, DRAWER_Y + 0.07, DRAWER_OUT_Z);
  else if (t < inside) out.p.set(x, DRAWER_Y + 0.008, DRAWER_OUT_Z);
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
  const art = useArt();
  const maps = INSERT_ART.map((key) => art[key]);
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

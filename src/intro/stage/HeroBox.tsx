// Our box: on the shelf at eye level, then held up (front, then back), laid on the counter, shrinkwrap off, lid off.
// It is a tray and a lid from the start, so opening it is just the lid leaving.
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { paintHeroBack, paintHeroFront, paintSpine, paintSticker } from "../art";
import { HERO } from "../content";
import { canvasTexture, dampTo, flat, frameDt, HERO_ON_SHELF, HERO_SIZE, LID_REST, pose, PRESENT, TRAY, useClock, type Pose, type StageProps } from "./rig";

const [W, H, D] = HERO_SIZE;
const LID = 0.012;
const WALL = 0.004;

export function HeroBox({ beat, context, send }: StageProps) {
  const clock = useClock();
  const box = useRef<THREE.Group>(null);
  const lid = useRef<THREE.Group>(null);
  const wrap = useRef<THREE.Mesh>(null);
  const [hover, setHover] = useState(false);

  const art = useMemo(() => {
    const front = canvasTexture(paintHeroFront(), 8);
    const back = canvasTexture(paintHeroBack(), 8);
    const spine = canvasTexture(paintSpine(HERO.title, ["#3aa0ff", "#0b1440", "#ffe14d"]), 4);
    const fresh = canvasTexture(paintSticker("new"), 4);
    const price = canvasTexture(paintSticker("price"), 4);
    const glare = canvasTexture(paintGlare(), 2);
    const side = new THREE.MeshStandardMaterial({ map: spine, roughness: 0.55 });
    const plain = new THREE.MeshStandardMaterial({ color: "#0b1440", roughness: 0.6 });
    const inner = new THREE.MeshStandardMaterial({ color: "#f3efe2", roughness: 0.95 });
    const frontMat = new THREE.MeshStandardMaterial({ map: front, roughness: 0.42 });
    const backMat = new THREE.MeshStandardMaterial({ map: back, roughness: 0.5 });
    return { front, back, spine, fresh, price, glare, side, plain, inner, frontMat, backMat };
  }, []);
  useEffect(
    () => () => {
      for (const v of Object.values(art)) v.dispose();
    },
    [art],
  );

  const shelfPose = useMemo(() => pose(HERO_ON_SHELF), []);
  const target = useMemo<Pose>(() => ({ p: new THREE.Vector3(), q: new THREE.Quaternion() }), []);
  const lidLocal = useMemo(() => new THREE.Matrix4().makeTranslation(0, 0, D / 2 - LID / 2), []);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const lidTarget = useMemo<Pose>(() => ({ p: new THREE.Vector3(), q: new THREE.Quaternion() }), []);
  const lifted = useMemo(() => flat(TRAY.x + 0.05, TRAY.y + 0.2, TRAY.z - 0.1, 0.2), []);
  const lidRest = useMemo(() => flat(LID_REST.x, LID_REST.y, LID_REST.z, -0.35), []);
  const onCounter = useMemo(() => flat(TRAY.x, TRAY.y, TRAY.z, 0), []);

  useEffect(() => {
    if (!hover || beat !== "shelf") return;
    document.body.style.cursor = "pointer";
    return () => void (document.body.style.cursor = "");
  }, [hover, beat]);

  useFrame((state, raw) => {
    const b = box.current;
    const l = lid.current;
    if (!b || !l) return;
    const c = clock.current;
    const dt = frameDt(c, raw);
    const t = c.t;
    let lambda = 6;
    switch (beat) {
      case "shelf":
        target.p.copy(shelfPose.p);
        target.q.copy(shelfPose.q);
        if (hover && !context.peek) {
          // It wants to be picked: leans out and wiggles a little.
          target.p.z += 0.05;
          target.q.setFromEuler(new THREE.Euler(-0.06, Math.sin(state.clock.elapsedTime * 5) * 0.04, 0));
        }
        break;
      case "pulling":
        if (t < 0.45) {
          target.p.copy(shelfPose.p).add(new THREE.Vector3(0, 0.03, 0.32));
          target.q.identity();
        } else {
          target.p.copy(PRESENT);
          target.q.setFromEuler(new THREE.Euler(0, t < 1.15 ? -0.28 : Math.PI - 0.28, 0));
        }
        lambda = t < 0.45 ? 9 : 5;
        break;
      default:
        target.p.copy(onCounter.p);
        target.q.copy(onCounter.q);
        lambda = 5;
    }
    dampTo(b, target, lambda, dt);

    // The lid rides on the box until the unwrap takes it off.
    const off = !(beat === "shelf" || beat === "pulling" || (beat === "unwrapping" && t < 1.0));
    if (!off) {
      m.compose(b.position, b.quaternion, b.scale).multiply(lidLocal);
      m.decompose(l.position, l.quaternion, l.scale);
    } else {
      const src = beat === "unwrapping" && t < 1.45 ? lifted : lidRest;
      lidTarget.p.copy(src.p);
      lidTarget.q.copy(src.q);
      dampTo(l, lidTarget, 7, dt);
    }

    // The shrinkwrap: on until the unwrap tears it (0.55 to 1.0 s), then gone for good.
    const w = wrap.current;
    if (w) {
      const gone = beat !== "shelf" && beat !== "pulling" && !(beat === "unwrapping" && t < 0.55);
      const mat = w.material as THREE.MeshBasicMaterial;
      const aim = gone ? 0 : 0.55;
      mat.opacity += (aim - mat.opacity) * (c.snap ? 1 : 1 - Math.exp(-6 * dt));
      w.scale.setScalar(1 + (0.55 - mat.opacity) * 0.25);
      w.visible = mat.opacity > 0.01;
    }
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (beat !== "shelf") return;
    e.stopPropagation();
    send({ type: "PICK" });
  };
  const events = {
    onClick,
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      setHover(true);
    },
    onPointerOut: () => setHover(false),
  };

  const trayDepth = D - LID;
  const tz = -LID / 2;
  return (
    <>
      <group ref={box} {...events} name="Frontier Lab Tycoon (the box)">
        {/* The tray: a back (with the back-of-box art), four walls and a paper lining. */}
        <group position={[0, 0, tz]}>
          <mesh position={[0, 0, -trayDepth / 2 + WALL / 2]} material={[art.plain, art.plain, art.plain, art.plain, art.inner, art.backMat]}>
            <boxGeometry args={[W, H, WALL]} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={`x${s}`} position={[(s * (W - WALL)) / 2, 0, 0]} material={[art.side, art.inner, art.plain, art.plain, art.plain, art.plain]}>
              <boxGeometry args={[WALL, H, trayDepth]} />
            </mesh>
          ))}
          {[-1, 1].map((s) => (
            <mesh key={`y${s}`} position={[0, (s * (H - WALL)) / 2, 0]} material={[art.plain, art.plain, art.side, art.inner, art.plain, art.plain]}>
              <boxGeometry args={[W - WALL * 2, WALL, trayDepth]} />
            </mesh>
          ))}
          <mesh position={[0, 0, -trayDepth / 2 + WALL + 0.001]}>
            <planeGeometry args={[W - WALL * 2, H - WALL * 2]} />
            <meshStandardMaterial color="#ffe14d" roughness={1} />
          </mesh>
        </group>
        <mesh ref={wrap} name="shrinkwrap">
          <boxGeometry args={[W + 0.006, H + 0.006, D + 0.006]} />
          <meshBasicMaterial map={art.glare} transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
      <group ref={lid} {...events}>
        <mesh material={[art.side, art.side, art.side, art.side, art.frontMat, art.plain]}>
          <boxGeometry args={[W, H, LID]} />
        </mesh>
        <mesh position={[W * 0.3, H * 0.33, LID / 2 + 0.0015]} rotation={[0, 0, 0.2]}>
          <planeGeometry args={[0.075, 0.075]} />
          <meshStandardMaterial map={art.fresh} transparent alphaTest={0.3} roughness={0.4} />
        </mesh>
        <mesh position={[-W * 0.3, -H * 0.4, LID / 2 + 0.0015]} rotation={[0, 0, -0.08]}>
          <planeGeometry args={[0.07, 0.07]} />
          <meshStandardMaterial map={art.price} transparent alphaTest={0.3} roughness={0.4} />
        </mesh>
      </group>
    </>
  );
}

/** Shrinkwrap glare: a few soft diagonal streaks on black, added on top of the box. */
function paintGlare(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, 256, 256);
  for (const [x, w, a] of [[40, 30, 0.35], [95, 10, 0.5], [170, 45, 0.2], [215, 6, 0.6]] as const) {
    const grad = g.createLinearGradient(x - w, 0, x + w, 0);
    grad.addColorStop(0, "rgba(255,255,255,0)");
    grad.addColorStop(0.5, `rgba(255,255,255,${a})`);
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.save();
    g.translate(128, 128);
    g.rotate(-0.5);
    g.translate(-128, -128);
    g.fillStyle = grad;
    g.fillRect(x - w - 80, -80, w * 2, 420);
    g.restore();
  }
  return c;
}

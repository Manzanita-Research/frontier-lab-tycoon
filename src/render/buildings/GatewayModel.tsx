import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Flag } from "../fx/Flag";
import { fx } from "../fx/state";
import { CREAM, CREAM_DARK, boxGeo, labelTexture, std } from "../materials";
import { B, Cyl, Glass } from "./Parts";

function portalTexture(color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 8;
  canvas.height = 128;
  const g = canvas.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, color + "ff");
  grad.addColorStop(1, color + "20");
  g.fillStyle = grad;
  g.fillRect(0, 0, 8, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** An arch with a glowing portal, a lit sign and a coin that never stops spinning. */
export function GatewayModel({ color }: { color: string }) {
  const coin = useRef<THREE.Group>(null);
  const portal = useRef<THREE.MeshBasicMaterial>(null);
  const portalMap = useMemo(() => portalTexture(color), [color]);
  const sign = useMemo(() => labelTexture("API GATEWAY", { w: 512, h: 128, bg: color, fg: "#fffaf0" }), [color]);
  // Both faces of the sign share one material, so one number flickers them together.
  const signMat = useMemo(() => new THREE.MeshBasicMaterial({ map: sign, toneMapped: false }), [sign]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // Payday: the sign stutters like a neon tube and the coin pops, then it all settles.
    const since = fx.time - fx.earnAt;
    const pay = since >= 0 && since < 1.2 ? 1 - since / 1.2 : 0;
    signMat.color.setScalar(pay > 0 ? 1 - pay * (Math.sin(since * 80) > 0.05 ? 0.7 : 0.05) : 1);
    if (coin.current) {
      coin.current.rotation.y = t * 3 + pay * 18;
      coin.current.position.y = 3.05 + Math.sin(t * 2) * 0.05 + pay * 0.25;
      coin.current.scale.setScalar(1 + pay * 0.9);
    }
    if (portal.current) portal.current.opacity = 0.55 + 0.25 * Math.sin(t * 2.4);
  });

  return (
    <group>
      <B s={[1.86, 0.1, 1.86]} c={CREAM_DARK} />
      <B p={[0, 0.1, 0]} s={[1.5, 0.04, 0.9]} c={color} />
      {[-0.72, 0.72].map((x) => (
        <group key={x} position={[x, 0.1, 0]}>
          <B s={[0.32, 1.45, 0.42]} c={CREAM} />
          <B p={[0, 0, 0]} s={[0.38, 0.14, 0.48]} c={color} />
          <B p={[0, 1.45, 0]} s={[0.38, 0.1, 0.48]} c={color} />
        </group>
      ))}
      <mesh position={[0, 1.55, 0]} material={std(CREAM)} castShadow>
        <torusGeometry args={[0.72, 0.14, 8, 20, Math.PI]} />
      </mesh>
      <mesh position={[0, 1.02, 0]} scale={[1.25, 1.2, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial ref={portal} map={portalMap} transparent opacity={0.6} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </mesh>
      {[-0.72, 0.72].flatMap((x) => [0.216, -0.216].map((z) => <Glass key={`${x}${z}`} p={[x, 0.85, z]} s={[0.14, 0.34, 0.02]} />))}
      <Flag position={[0.72, 1.6, 0]} color={color} pole={0.6} width={0.42} height={0.24} phase={2.1} />
      <B p={[0, 2.35, 0]} s={[0.16, 0.25, 0.1]} c={CREAM_DARK} />
      <mesh position={[0, 2.75, 0]} geometry={boxGeo} material={std(CREAM_DARK)} scale={[1.62, 0.42, 0.14]} castShadow />
      {[0.076, -0.076].map((z) => (
        <mesh key={z} position={[0, 2.75, z]} rotation-y={z < 0 ? Math.PI : 0} scale={[1.5, 0.34, 1]}>
          <planeGeometry args={[1, 1]} />
          <primitive object={signMat} attach="material" />
        </mesh>
      ))}
      <group ref={coin} position={[0, 3.05, 0]}>
        <Cyl r={0.2} h={0.05} c="#ffd24a" rotation-x={Math.PI / 2} position-y={0.2} />
      </group>
    </group>
  );
}

// FLT-56: the auditors' last grade on a plaque by the gate, for every visitor to read (and the rivals to photograph).
// An A gets a gold frame; an F hangs crooked; a lab caught hiding agents gets a cardboard box on top.
import { useMemo } from "react";
import { atoms } from "../app/game";
import { useApp } from "../app/hooks";
import { PLAQUE_HEAD, PLAQUE_INK, PLAQUE_SUB } from "../content/plaque";
import { PLAQUE_AT } from "./coords";
import { boxGeo, labelTexture, std } from "./materials";

const CREAM = "#fffaf0";

export function GradePlaque() {
  const report = useApp(atoms.plaque);
  const head = useMemo(() => labelTexture(PLAQUE_HEAD, { w: 1024, h: 160, bg: "#39b54a", fg: CREAM }), []);
  const letter = report?.overall ?? "C";
  const big = useMemo(() => labelTexture(letter, { w: 256, h: 180, bg: CREAM, fg: PLAQUE_INK[letter] }), [letter]);
  const sub = useMemo(() => labelTexture(PLAQUE_SUB[report?.caught ? "caught" : letter], { w: 1024, h: 128, bg: CREAM, fg: "#3a2a1c", weight: 700 }), [letter, report?.caught]);
  if (!report) return null;
  const [x, z] = PLAQUE_AT;
  const tilt = letter === "F" ? 0.14 : 0;
  return (
    <group position={[x, 0, z]} rotation={[0, 0.45, 0]} scale={1.7}>
      {[-0.34, 0.34].map((px) => (
        <mesh key={px} geometry={boxGeo} material={std("#6b4a2e")} position={[px, 0.42, -0.02]} scale={[0.05, 0.84, 0.05]} castShadow />
      ))}
      <group position={[0, 0.72, 0]} rotation={[0, 0, tilt]}>
        <mesh geometry={boxGeo} material={std(letter === "A" ? "#d8b23a" : "#6b4a2e", letter === "A" ? 0.3 : 0.8)} scale={[0.8, 0.64, 0.03]} castShadow />
        <mesh position={[0, 0.235, 0.017]}>
          <planeGeometry args={[0.74, 0.11]} />
          <meshBasicMaterial map={head} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.0, 0.017]}>
          <planeGeometry args={[0.74, 0.34]} />
          <meshBasicMaterial color={CREAM} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.0, 0.018]}>
          <planeGeometry args={[0.5, 0.35]} />
          <meshBasicMaterial map={big} toneMapped={false} />
        </mesh>
        <mesh position={[0, -0.235, 0.017]}>
          <planeGeometry args={[0.74, 0.1]} />
          <meshBasicMaterial map={sub} toneMapped={false} />
        </mesh>
        {report.caught && <mesh geometry={boxGeo} material={std("#b98a4e")} position={[0.18, 0.43, 0]} rotation={[0, 0.3, 0.1]} scale={[0.22, 0.2, 0.2]} castShadow />}
      </group>
    </group>
  );
}

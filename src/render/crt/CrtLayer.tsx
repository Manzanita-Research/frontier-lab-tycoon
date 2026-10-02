// The CRT's foothold in the scene (FLT-73): mounts the lazy CrtFX while a look is on and the canvas can afford a
// shader, and feeds the frame-time governor every frame the tube is on (it steps the tier down on a slow machine).
import { useAtomValue } from "@effect/atom-react";
import { useFrame } from "@react-three/fiber";
import { Suspense, lazy } from "react";
import { registry } from "../../app/game";
import { CRT_TIERS } from "./looks";
import { crtAtom, crtGovernor } from "./state";

const CrtFX = lazy(() => import("./CrtFX"));

export function CrtLayer() {
  const { mode, tier } = useAtomValue(crtAtom);
  useFrame((_, dt) => {
    const g = crtGovernor.current;
    if (!g || g.settled || mode === "off") return;
    const was = g.tier;
    const now = g.frame(dt * 1000);
    if (now === was) return;
    const s = registry.get(crtAtom);
    registry.set(crtAtom, { ...s, tier: now, reduced: CRT_TIERS.indexOf(now) > CRT_TIERS.indexOf(g.start) });
  });
  if (mode === "off" || tier === "flat") return null;
  return (
    <Suspense fallback={null}>
      <CrtFX mode={mode} tier={tier} />
    </Suspense>
  );
}

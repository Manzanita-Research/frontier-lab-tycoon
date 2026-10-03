// FLT-105: the trip on the canvas. Lazy, like PhotoFX and the CRT: mounted only while a trip is on screen, so the
// rest of the game never pays for postprocessing. Reads `tripNow`, which the HUD's TripScreen writes each frame.
import { useFrame, useThree } from "@react-three/fiber";
import { EffectComposer } from "@react-three/postprocessing";
import { useEffect, useMemo } from "react";
import { useSkyBackdrop } from "../fx/useSkyBackdrop";
import { TRIP_LOOK } from "../../ui/juice/trip";
import { tripNow } from "../../ui/juice/tripState";
import { TripEffect } from "./effect";

/** The canvas's pixel ratio while the pass is on (1.75 without): two texture reads a pixel, on a picture already swimming. */
const TRIP_DPR: [number, number] = [1, 1.25];

export default function TripFX() {
  const setDpr = useThree((s) => s.setDpr);
  const size = useThree((s) => s.size);
  const sky = useSkyBackdrop(false);
  const effect = useMemo(() => new TripEffect(sky), [sky]);
  useEffect(() => () => effect.dispose(), [effect]);
  useEffect(() => {
    setDpr(TRIP_DPR);
    return () => setDpr([1, 1.75]);
  }, [setDpr]);
  useFrame(() => {
    effect.set({
      kaleido: tripNow.kaleido,
      segments: TRIP_LOOK.segments,
      spin: tripNow.spin,
      swirl: tripNow.swirl,
      breathe: tripNow.breathe,
      aspect: size.width / Math.max(1, size.height),
    });
  });
  return (
    <EffectComposer multisampling={0}>
      <primitive object={effect} />
    </EffectComposer>
  );
}

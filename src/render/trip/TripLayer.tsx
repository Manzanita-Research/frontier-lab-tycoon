// FLT-105: mounts the trip's canvas pass and trails while a trip is on screen (TripScreen says how strong in
// `tripNow`), and not in photo mode (which has a composer of its own), reduced motion, or on a phone that can't keep up.
import { useAtomValue } from "@effect/atom-react";
import { useFrame } from "@react-three/fiber";
import { Suspense, lazy, useState } from "react";
import { photoAtom } from "../fx/photoState";
import { tripNow } from "../../ui/juice/tripState";
import { TripTrails } from "./TripTrails";

const TripFX = lazy(() => import("./TripFX"));

export function TripLayer() {
  const photo = useAtomValue(photoAtom);
  const [on, setOn] = useState(false);
  useFrame(() => {
    const want = tripNow.level > 0.002 && !tripNow.calm && !tripNow.lite;
    if (want !== on) setOn(want);
  });
  if (!on) return null;
  return (
    <>
      <TripTrails />
      {!photo && (
        <Suspense fallback={null}>
          <TripFX />
        </Suspense>
      )}
    </>
  );
}

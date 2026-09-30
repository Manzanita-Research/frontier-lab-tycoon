import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { probeView } from "../app/game";

/** Lends the probe the camera and canvas (FLT-53): the e2e player projects tiles to the screen with them, on demand. */
export function ProbeView() {
  const camera = useThree((s) => s.camera);
  const canvas = useThree((s) => s.gl.domElement);
  useEffect(() => {
    probeView.view = () => {
      camera.updateMatrixWorld();
      const r = canvas.getBoundingClientRect();
      return { matrix: camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse).elements.slice(), rect: { left: r.left, top: r.top, width: r.width, height: r.height } };
    };
    return () => { probeView.view = null; };
  }, [camera, canvas]);
  return null;
}

import { Html } from "@react-three/drei";
import { atoms, send } from "../app/game";
import { useApp } from "../app/hooks";
import { BUILDINGS } from "../content/buildings";
import { HALF } from "./coords";

/** Suggested construction belongs to the scene; the only DOM is its projected click anchors. */
export function CoachSuggestion() {
  const coach = useApp(atoms.coach);
  const suggestion = coach?.suggest;
  if (!suggestion) return null;
  const tiles: [number, number][] = suggestion.kind === "path" ? suggestion.tiles : [[suggestion.x, suggestion.z]];
  const [w, d] = suggestion.kind === "path" ? [1, 1] : BUILDINGS[suggestion.building].size;
  return <>{tiles.map(([x, z]) => <group key={`${x},${z}`} position={[x + w / 2 - HALF, 0.12, z + d / 2 - HALF]}>
    <mesh>
      <boxGeometry args={[w * 0.95, 0.08, d * 0.95]} />
      <meshBasicMaterial color="#64d8ce" transparent opacity={0.45} depthWrite={false} />
    </mesh>
    <Html center zIndexRange={[50, 0]}>
      <button type="button" data-coach="map:suggest" data-coach-tile={`${x},${z}`}
        aria-label={suggestion.kind === "path" ? `Build path at ${x},${z}` : `Build ${BUILDINGS[suggestion.building].name} at ${x},${z}`}
        onClick={(event) => { event.stopPropagation(); send({ type: "COMMAND", command: suggestion.kind === "path" ? { type: "placePath", x, z } : { type: "placeBuilding", kind: suggestion.building, x, z } }); }}
        style={{ width: 36, height: 36, border: "2px dashed #2b766f", borderRadius: 6, color: "#173e3a", background: "#aaf0dc99", fontSize: 24, cursor: "pointer", pointerEvents: "auto" }}>+</button>
    </Html>
  </group>)}</>;
}

import { useEffect, useMemo } from "react";
import type { LookPartData } from "../../mods/schema";
import { windowMat } from "../fx/glow";
import { std } from "../materials";
import { partGeometry, shaded } from "../modLooks";

/**
 * A mod building drawn from its recipe (FLT-101, `looks["building:<kind>"]`): the walker recipe's primitives, in tiles,
 * centred on the footprint with y up from the ground. `"coat"` is the building's colour and `"window"` is window glass,
 * which lights up at night (and goes dark with `building.lights`). Static: building parts don't move.
 */
export function RecipeModel({ recipe, color }: { recipe: readonly LookPartData[]; color: string }) {
  const parts = useMemo(
    () =>
      recipe.map((part) => ({
        geometry: partGeometry(part),
        material: part.color === "window" ? windowMat : std(`#${shaded(part.color === "coat" ? color : part.color, part.shade).getHexString()}`),
        at: part.at,
      })),
    [recipe, color],
  );
  useEffect(() => () => parts.forEach((p) => p.geometry.dispose()), [parts]);
  return (
    <group>
      {parts.map((p, i) => (
        <mesh key={i} geometry={p.geometry} material={p.material} position={p.at} castShadow receiveShadow />
      ))}
    </group>
  );
}

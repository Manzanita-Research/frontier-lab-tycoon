import { factionAttrs } from "../../kit";
import type { SlotPropsMap } from "../../types";

/**
 * One thought bubble. The game pins whatever this renders to the walker, every frame. The root needs the class
 * `bubble` so photo mode can copy it onto the picture.
 */
export function Bubble({ bubble }: SlotPropsMap["Bubble"]) {
  // Said as a faction (FLT-33): `data-faction` and `--faction` let the CSS give it their colour.
  return (
    <div className={`bubble bubble-${bubble.kind}`} {...factionAttrs(bubble.faction)}>
      {bubble.faction && <b className="bubble-faction">{bubble.faction.short}</b>}
      {bubble.text}
    </div>
  );
}

import type { SlotPropsMap } from "../../types";

/**
 * One thought bubble. The game pins whatever this renders to the walker, every frame. The root needs the class
 * `bubble` so photo mode can copy it onto the picture.
 */
export function Bubble({ bubble }: SlotPropsMap["Bubble"]) {
  return <div className={`bubble bubble-${bubble.kind}${bubble.speech ? " speech" : ""}`}>{bubble.text}</div>;
}

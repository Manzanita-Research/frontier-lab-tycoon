// Where each thing in the box lies on the counter (the flat lay), and how big it is when held up.
import type { ItemId } from "../content";
import { COUNTER_Y, flat, type Pose } from "./rig";

const Y = COUNTER_Y + 0.002;

/** Size (w, h) in metres of each item's face. */
export const ITEM_SIZE: Record<ItemId, [number, number]> = {
  manual: [0.21, 0.27],
  coa: [0.15, 0.107],
  disc: [0.12, 0.12],
  floppies: [0.09, 0.094],
  card: [0.15, 0.1],
  overlay: [0.32, 0.05],
  eula: [0.1, 0.143],
  inserts: [0.14, 0.1],
};

export const REST: Record<ItemId, Pose> = {
  manual: flat(1.74, Y + 0.004, 0.64, 0.07),
  coa: flat(2.57, Y, 0.8, -0.12),
  disc: flat(2.6, Y + 0.001, 0.52, 0),
  floppies: flat(2.3, Y, 0.98, -0.1),
  card: flat(2.04, Y, 0.99, 0.12),
  overlay: flat(2.1, Y, 0.24, 0.03),
  eula: flat(1.76, Y, 0.3, 0.16),
  inserts: flat(1.74, Y, 0.97, -0.18),
};

/** How much room an item needs on screen when held up (the manual opens into a spread). */
export function itemFrame(item: ItemId | null, page: number, sheets: number): [number, number] {
  if (!item) return [0.4, 0.3];
  const [w, h] = ITEM_SIZE[item];
  if (item === "manual") return page > 0 && page < sheets ? [w * 2.05, h] : [w * 1.1, h];
  if (item === "inserts") return [w * 2.4, h * 1.5];
  if (item === "floppies") return [w * 2.3, h];
  return [w, h];
}

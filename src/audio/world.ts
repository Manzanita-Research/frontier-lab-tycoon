import type { GameState } from "../sim/types";
/** Compatibility boundary for the race/operations slices; the current World has neither field yet. */
export function worldEra(w: GameState): string {
  const value: unknown = (w as GameState & { era?: unknown }).era;
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (value && typeof value === "object" && "value" in value && (typeof value.value === "string" || typeof value.value === "number")) return String(value.value);
  return "seed";
}
export function breakdownSignature(w: GameState): string {
  return w.buildings.filter((b) => {
    const extra = b as typeof b & { broken?: unknown; offline?: unknown };
    return extra.broken === true || extra.offline === true;
  }).map((b) => b.id).join(",");
}

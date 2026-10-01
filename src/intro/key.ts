// The Model Weights Key on the Certificate of Authenticity: five groups of five, seeded per visitor, deterministic.
// Invented, like everything else: the alphabet skips the letters and digits people misread, as the real ones did.
import { createRng } from "../sim/rng";

const ALPHABET = "BCDFGHJKMPQRTVWXY2346789";
const VISITOR_KEY = "flt.visitor";

/** The key for a seed: the same seed always gives the same key. */
export function weightsKey(seed: number): string {
  const rng = createRng(seed >>> 0 || 1);
  const group = () => Array.from({ length: 5 }, () => ALPHABET[rng.int(0, ALPHABET.length - 1)]).join("");
  return Array.from({ length: 5 }, group).join("-");
}

/** This visitor's seed: `?seed=` if the URL has one (screenshots), else one remembered in localStorage. */
export function visitorSeed(search: string, storage: Pick<Storage, "getItem" | "setItem"> | null, fresh: () => number): number {
  const fromUrl = Number(new URLSearchParams(search).get("seed"));
  if (Number.isFinite(fromUrl) && fromUrl > 0) return fromUrl >>> 0;
  try {
    const kept = Number(storage?.getItem(VISITOR_KEY));
    if (Number.isFinite(kept) && kept > 0) return kept >>> 0;
    const seed = fresh() >>> 0 || 1;
    storage?.setItem(VISITOR_KEY, String(seed));
    return seed;
  } catch {
    return fresh() >>> 0 || 1;
  }
}

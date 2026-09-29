// FLT-13: which buildings render a generated model instead of the procedural one.
//   ?models=gen                 every generated model, best candidate per subject (public/models/gen/<kind>.glb)
//   ?models=hall,float          just those
//   ?models=hall:tripo-B        a named candidate (public/models/gen/candidates/<kind>-<id>.glb)
// Nothing here touches the sim: it is a render-side switch read once at load.
import { readDebugParams } from "../../debug";

export type GenKind = "hall" | "cluster" | "float";
export const GEN_KINDS: readonly GenKind[] = ["hall", "cluster", "float"];

const base = import.meta.env.BASE_URL;

/** Parses the `models` param into a map of kind to model URL. */
export function parseModels(models: string | null): Partial<Record<GenKind, string>> {
  const out: Partial<Record<GenKind, string>> = {};
  if (!models || models === "proc") return out;
  for (const part of models.split(",")) {
    if (part === "gen") {
      for (const k of GEN_KINDS) out[k] = `${base}models/gen/${k}.glb`;
      continue;
    }
    const [kind, id] = part.split(":") as [GenKind, string | undefined];
    if (!GEN_KINDS.includes(kind)) continue;
    out[kind] = id ? `${base}models/gen/candidates/${kind}-${id}.glb` : `${base}models/gen/${kind}.glb`;
  }
  return out;
}

const chosen = parseModels(readDebugParams().models);

/** The generated model URL for a kind, or null to stay procedural. */
export const genPath = (kind: GenKind): string | null => chosen[kind] ?? null;

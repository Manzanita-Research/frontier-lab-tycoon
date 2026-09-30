import { Effect } from "effect";
import { decodeManifest } from "./schema";
import { composeMods } from "./loader";
import { resolveGameDefinition } from "./game-definition";
import { runHeadless } from "./headless";

export async function checkMod(input: unknown) {
  const manifest = await Effect.runPromise(decodeManifest(input));
  const { layer, conflicts } = composeMods([manifest]);
  const definition = await Effect.runPromise(resolveGameDefinition(layer));
  return { report: runHeadless(definition), replay: runHeadless(definition), conflicts, mod: { id: manifest.id, version: manifest.version } };
}

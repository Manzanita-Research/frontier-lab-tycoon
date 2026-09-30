// Usage: node scripts/flt-75/legacy-check.mjs <checkout> <mod.json>
// FLT-75: flt-mod check's 365-day replay, hashed the way main hashes it (protesters folded back into walkers).
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
const root = process.argv[2]; // a checkout: this branch, or a main worktree for the baseline
const { gameRoot, withGameRuntime } = await import(`${root}/packages/flt-mod-cli/io.mjs`);
const mod = JSON.parse(await readFile(process.argv[3], "utf8"));
await withGameRuntime(async (runner) => {
  const { checkMod } = await runner.import(`${gameRoot}/src/mods/check.ts`);
  const { report } = await checkMod(mod);
  const sha = (x) => createHash("sha256").update(JSON.stringify(x)).digest("hex");
  let legacy = report.state;
  try { legacy = (await runner.import(`${gameRoot}/src/sim/ecs/protesters.ts`)).legacyWorld(report.state); } catch {}
  const protesters = JSON.parse(JSON.stringify(legacy)).walkers.filter((w) => w.kind === "protester").length;
  console.log(JSON.stringify({ raw: sha(report.state), legacy: sha(legacy), protestersAtEnd: protesters }));
});

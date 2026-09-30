// Matched paid playtest scene on the old PR and the fixed branch, using pnpm shot.
// pnpm preview on 4173; serve the old PR (30a5aa4) on 4174.
// node scripts/first-run-shots.mjs [beforeURL] [afterURL]
import { createServer } from "vite";
import { execFileSync } from "node:child_process";
const [before = "http://localhost:4174", after = "http://localhost:4173"] = process.argv.slice(2);
const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
let commands;
try {
  const { jemOpeningCommands } = await server.ssrLoadModule("/src/sim/firstRunDemo.ts");
  commands = jemOpeningCommands(true);
} finally { await server.close(); }
const params = "/?debug=1&speed=0&seed=1&zoom=58&focus=12,17";
const evalJs = `(() => {
  const {sim, tick} = window.__flt;
  sim.applyNow(${JSON.stringify(commands)});
  for (let i = 0; i < 40; i++) tick(sim.world);
  sim.world.toasts = [];
  sim.world.thoughts = [];
})()`.replaceAll("\n", " ");
const shot = (url, name, mobile = false, evaluate = evalJs) => execFileSync("pnpm", ["shot", url,
  `docs/evidence/FLT-16-playtest/${name}.png`, "--size", mobile ? "390x844" : "1566x1600",
  "--wait", "2500", ...(mobile ? ["--mobile"] : []), ...(evaluate ? ["--eval", evaluate] : [])], { stdio: "inherit" });
for (const [label, base] of [["before", before], ["after", after]]) {
  shot(base + params, label);
  shot(base + params, `${label}-phone`, true);
}
shot(after + params + "&moment=jem-confirm", "confirmation", false, null);

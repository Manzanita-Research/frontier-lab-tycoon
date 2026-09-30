#!/usr/bin/env node
import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { basename, extname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { checkArcGraph } from "./graph.mjs";
import { gameRoot, inside, loadManifest, withGameRuntime } from "./io.mjs";

export async function check(input, runner) {
  const { manifest, path } = await loadManifest(input, runner);
  const { checkMod } = await runner.import(`${gameRoot}/src/mods/check.ts`);
  const { composeMods } = await runner.import(`${gameRoot}/src/mods/loader.ts`);
  const { resolveGameDefinition } = await runner.import(`${gameRoot}/src/mods/game-definition.ts`);
  const { decodeManifest } = await runner.import(`${gameRoot}/src/mods/schema.ts`);
  const { Effect } = await runner.import("effect");
  const start = performance.now();
  const decoded = await Effect.runPromise(decodeManifest(manifest));
  const definition = await Effect.runPromise(resolveGameDefinition(composeMods([decoded]).layer));
  const arcsOf = (def) => [...def.content.arcs, ...def.content.events.filter((event) => !("choices" in event))];
  // The base game's own arcs (FLT-25/33) run in every check; the report marks the ones the mod left alone.
  const baseArcs = new Map(arcsOf(await Effect.runPromise(resolveGameDefinition(composeMods([]).layer))).map((arc) => [arc.id, JSON.stringify(arc)]));
  const arcs = arcsOf(definition).map((arc) => ({ ...checkArcGraph(arc), base: baseArcs.get(arc.id) === JSON.stringify(arc) }));
  const { report, replay, conflicts, presentation, mod } = await checkMod(manifest);
  const digest = (state) => createHash("sha256").update(JSON.stringify(state)).digest("hex");
  if (digest(report.state) !== digest(replay.state)) throw new Error("deterministic replay differs");
  const { state, ...numbers } = report;
  return { ok: true, path, mod, ...numbers, conflicts, arcs, presentation, deterministic: true, digest: digest(state), elapsedMs: Math.round(performance.now() - start) };
}
export function printReport(report) {
  console.log(`PASS ${report.mod.id}@${report.mod.version}: ${report.days} days, ${report.ticks} ticks, ${report.cardsAnswered} cards answered, ${report.models} releases`);
  console.log(`Replay identical: ${report.digest}; cash $${Math.round(report.cash)}; ${report.elapsedMs} ms`);
  const base = new Set(report.arcs.filter((arc) => arc.base).map((arc) => arc.id));
  const own = report.arcs.filter((arc) => !arc.base);
  console.log(`Arc reachability: ${report.arcs.length} arcs checked with xstate/graph (structural, guards/actions omitted)${base.size ? `, ${base.size} of them the base game's, unchanged` : ""}`);
  for (const arc of own) console.log(`  ${arc.id}: ${arc.states} states, ${arc.configurations} configurations`);
  const ran = Object.entries(report.arcStates ?? {}).filter(([id]) => !base.has(id));
  if (ran.length > 0) console.log(`Your arcs ran in the sim: ${ran.map(([id, at]) => `${id} ended in "${at}"`).join(", ")}`);
  console.log(`Executed: ${report.coverage.executed.join(", ") || "nothing changed from the base game"} (the real sim ran with your definition)`);
  if (report.coverage.inert.length > 0) console.log(`Validated but not read by any system yet: ${report.coverage.inert.join(", ")}`);
  const p = report.presentation;
  if (!p) return;
  if (p.assets.count > 0) console.log(`Assets: ${p.assets.count} bundled, ${(p.assets.bytes / 1024).toFixed(1)} KB of the 2 MB cap (served as blob: URLs)`);
  if (p.skin) console.log(`Skin: ${p.skin.id} ("${p.skin.name}", extends ${p.skin.extends})${p.skin.asks ? "; asks the player to put it on" : "; in the picker and at ?skin=" + p.skin.id}`);
  if (p.cues.added.length + p.cues.replaced.length > 0) console.log(`Sound: ${[p.cues.added.length ? `adds ${p.cues.added.join(", ")}` : "", p.cues.replaced.length ? `replaces ${p.cues.replaced.join(", ")}` : ""].filter(Boolean).join("; ")}${p.cues.played.length ? `; arcs play ${p.cues.played.join(", ")}` : ""}`);
  for (const look of p.looks) console.log(`Look: ${look.target} is a ${look.form} (${look.detail})`);
}
export async function bundle(directory, output, runner) {
  const { manifest } = await loadManifest(directory, runner);
  const { decodeManifest } = await runner.import(`${gameRoot}/src/mods/schema.ts`);
  const { validateAssets } = await runner.import(`${gameRoot}/src/mods/assets.ts`);
  const { composeMods } = await runner.import(`${gameRoot}/src/mods/loader.ts`);
  const { resolveGameDefinition } = await runner.import(`${gameRoot}/src/mods/game-definition.ts`);
  const { Effect } = await runner.import("effect");
  const decoded = await Effect.runPromise(decodeManifest(manifest));
  validateAssets(decoded.assets ?? {});
  const definition = await Effect.runPromise(resolveGameDefinition(composeMods([decoded]).layer));
  [...definition.content.arcs, ...definition.content.events.filter((event) => !("choices" in event))].forEach(checkArcGraph);
  const path = output ? resolve(output) : resolve(directory, `${decoded.id}.fltmod.json`);
  await writeFile(path, JSON.stringify(decoded, null, 2) + "\n");
  return path;
}
export async function serve(directory, port = 5174) {
  // No browser HMR yet. Each request rereads JSON (or recompiles trusted local TS).
  const server = createServer(async (request, response) => {
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Cache-Control", "no-store");
    if (request.method === "OPTIONS") { response.writeHead(204); response.end(); return; }
    if (request.method !== "GET" && request.method !== "HEAD") { response.writeHead(405); response.end(); return; }
    try {
      const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
      let body;
      if (pathname === "/mod.json") {
        body = await withGameRuntime(async (runner) => JSON.stringify((await loadManifest(directory, runner)).manifest));
        response.setHeader("Content-Type", "application/json");
      } else {
        const file = await inside(directory, `.${pathname}`);
        body = await readFile(file);
        const types = { ".json": "application/json", ".png": "image/png", ".css": "text/css", ".glb": "model/gltf-binary" };
        response.setHeader("Content-Type", types[extname(file)] ?? "application/octet-stream");
      }
      response.end(request.method === "HEAD" ? undefined : body);
    } catch (error) { response.writeHead(400, { "Content-Type": "text/plain" }); response.end(String(error)); }
  });
  await new Promise((ok, fail) => { server.once("error", fail); server.listen(port, "0.0.0.0", ok); });
  return server;
}
export async function main(args = process.argv.slice(2)) {
  const [command, input, output] = args;
  if (!input || !["check", "bundle", "dev"].includes(command) || (command !== "bundle" && output)) throw new Error("Usage: flt-mod check <path> | bundle <dir> [output.fltmod.json] | dev <dir>");
  if (command === "dev") {
    const server = await serve(resolve(input));
    console.log("Serving mod with CORS on http://localhost:5174/mod.json");
    console.log("Open your game with ?mod=http://localhost:5174/mod.json (reload the page to pick up edits)");
    const stop = () => server.close(() => process.exit());
    process.once("SIGINT", stop); process.once("SIGTERM", stop);
    return;
  }
  return withGameRuntime(async (runner) => {
    if (command === "check") printReport(await check(input, runner));
    else console.log(`Bundled ${basename(input)} → ${await bundle(input, output, runner)}`);
  });
}
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(`FAIL ${String(error)}`); process.exitCode = 1; });
}

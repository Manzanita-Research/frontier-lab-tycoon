#!/usr/bin/env node
// Vite's module runner uses the same TS transform and Effect alias as the app. No new runtime dependency.
import { readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import { createServer } from "vite";

const path = process.argv[2];
if (!path) { console.error("Usage: pnpm mod:check <path/to/mod.json>"); process.exitCode = 1; }
else {
  const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
  try {
    const { checkMod } = await server.environments.ssr.runner.import("/src/mods/check.ts");
    const absolute = resolve(path);
    if ((await stat(absolute)).size > 3 * 1024 * 1024) throw new Error("manifest exceeds 3 MB");
    const input = JSON.parse(await readFile(absolute, "utf8"));
    const start = performance.now();
    const { report, replay, conflicts, mod } = await checkMod(input);
    const digest = (state) => createHash("sha256").update(JSON.stringify(state)).digest("hex");
    if (digest(report.state) !== digest(replay.state)) throw new Error("deterministic replay differs");
    const { state, ...numbers } = report;
    console.log(JSON.stringify({ ok: true, path, mod, conflicts, ...numbers, deterministic: true, digest: digest(state), elapsedMs: Math.round(performance.now() - start),
      coverage: "M1a: schema + composition + structural arc/reference validation + existing World injection. Deferred sections are not executed until M1b." }, null, 2));
  } catch (error) {
    console.error(String(error));
    process.exitCode = 1;
  } finally { await server.close(); }
}

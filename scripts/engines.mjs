#!/usr/bin/env node
// FLT-106: does the sim give the same World on every JavaScript engine? Bundles the golden busy-player replay
// (src/sim/golden.ts) and runs it in this Node, in any other Node binaries you name, and in Playwright's Chromium (V8),
// Firefox (SpiderMonkey) and WebKit (JavaScriptCore). Every 10 ticks it hashes the whole GameState as JSON, so state the
// golden digest doesn't project (faction stances, machine contexts) counts too. Any difference fails the run, with the
// first differing tick and the first differing paths in the World.
//
//   pnpm engines                                   # this Node + every Playwright browser that launches
//   pnpm engines --node /path/to/node22 --engines chromium,webkit
//   pnpm engines --seeds 1 --ticks 1000
//
// Browsers: `pnpm exec playwright install chromium firefox webkit` (CI adds --with-deps). A browser that won't launch
// is skipped with a warning, unless it was asked for by name with --engines.
import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const nodes = args.flatMap((a, i) => (a === "--node" ? [args[i + 1]] : []));
const seeds = opt("seeds", "1,2,3").split(",").map(Number);
const ticks = Number(opt("ticks", "4000"));
const every = Number(opt("every", "10"));
const named = opt("engines", null);
const browsers = (named ?? "chromium,firefox,webkit").split(",").filter((e) => e !== "node");

const ENTRY = `
import { play } from "./src/sim/golden";
const fnv = (text: string) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, "0");
};
export function trace(seeds: number[], ticks: number, every: number) {
  const out: Record<number, string[]> = {};
  for (const seed of seeds) {
    const lines: string[] = [];
    let i = 0;
    play(seed, ticks, [], undefined, (s) => { if (++i % every === 0) lines.push(i + " " + fnv(JSON.stringify(s))); });
    out[seed] = lines;
  }
  return out;
}
export function at(seed: number, step: number): string {
  let i = 0, json = "";
  play(seed, step, [], undefined, (s) => { if (++i === step) json = JSON.stringify(s); });
  return json;
}
export function engine(): string {
  const p = (globalThis as any).process;
  if (p?.versions?.bun) return "bun " + p.versions.bun;
  if (p?.versions?.node) return "node " + p.version + " (V8 " + p.versions.v8 + ")";
  return (globalThis as any).navigator?.userAgent ?? "unknown";
}
`;

const bundle = (
  await build({ stdin: { contents: ENTRY, resolveDir: root, loader: "ts" }, bundle: true, format: "iife", globalName: "FLT", platform: "neutral", target: "es2022", write: false, logLevel: "error" })
).outputFiles[0].text;

const call = (expr) => `(() => { ${bundle}; return ${expr}; })()`;
const scratch = mkdtempSync(join(tmpdir(), "flt-engines-"));

/** Each engine: a label and a function evaluating an expression against the bundle. */
const engines = [{ label: `node ${process.version}`, run: async (expr) => (0, eval)(call(expr)) }];
for (const bin of nodes) {
  engines.push({
    label: bin,
    run: async (expr) => {
      const file = join(scratch, "run.cjs");
      writeFileSync(file, `process.stdout.write(JSON.stringify(${call(expr)}));`);
      const r = spawnSync(bin, [file], { encoding: "utf8", maxBuffer: 1 << 28 });
      if (r.status !== 0) throw new Error(`${bin}: ${r.stderr || r.error}`);
      return JSON.parse(r.stdout);
    },
  });
}
const open = [];
if (browsers.length > 0) {
  const pw = await import("playwright");
  for (const name of browsers) {
    try {
      const browser = await pw[name].launch();
      const page = await browser.newPage();
      await page.goto("about:blank");
      open.push(browser);
      engines.push({ label: `${name} ${browser.version()}`, run: (expr) => page.evaluate(call(expr)) });
    } catch (e) {
      if (named) throw e;
      console.warn(`skipping ${name}: ${String(e.message).split("\n")[0]}`);
    }
  }
}

try {
  if (engines.length < 2 && !args.includes("--allow-single")) throw new Error("only one engine ran: nothing to compare (install a browser, pass --node, or --allow-single)");
  const traces = [];
  for (const e of engines) {
    const t0 = Date.now();
    e.name = await e.run("FLT.engine()");
    traces.push(await e.run(`FLT.trace(${JSON.stringify(seeds)}, ${ticks}, ${every})`));
    console.log(`${e.label.padEnd(24)} ${((Date.now() - t0) / 1000).toFixed(1)}s  ${e.name}`);
  }
  let failed = false;
  for (let k = 1; k < engines.length; k++) {
    for (const seed of seeds) {
      const a = traces[0][seed];
      const b = traces[k][seed];
      const i = a.findIndex((line, j) => line !== b[j]);
      if (i < 0) continue;
      failed = true;
      const step = Number(a[i].split(" ")[0]);
      // The hash only says which window; replay to that step on both and name the first fields that differ.
      const [x, y] = await Promise.all([engines[0].run(`FLT.at(${seed}, ${step})`), engines[k].run(`FLT.at(${seed}, ${step})`)]);
      console.log(`\nDIFFERS: ${engines[0].label} vs ${engines[k].label}, seed ${seed}, by step ${step}:`);
      for (const d of diff(JSON.parse(x), JSON.parse(y), "", [])) console.log("  " + d);
    }
  }
  if (failed) {
    console.log("\nThe sim is not engine-independent. Look for a raw Math.* (or other implementation-approximated call) on that path; src/sim/dmath.ts has deterministic versions.");
    process.exitCode = 1;
  } else console.log(`\nsame World on all ${engines.length} engines: seeds ${seeds.join(", ")}, ${ticks} steps, hashed every ${every}`);
} finally {
  for (const b of open) await b.close();
}

function diff(a, b, path, out) {
  if (out.length >= 8) return out;
  if (typeof a !== "object" || a === null || typeof b !== "object" || b === null) {
    if (JSON.stringify(a) !== JSON.stringify(b)) out.push(`${path || "(root)"}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
    return out;
  }
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) diff(a[key], b[key], `${path}.${key}`, out);
  return out;
}

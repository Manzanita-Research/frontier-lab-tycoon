// FLT-67's promise: with accounts off (no VITE_FLT_AUTH=on), the site this checkout builds is byte for byte the one
// `main` builds. This builds both, the way the deploy does (`vite build`), and compares every file's SHA-256.
// dist/deployment.json is left out: the deploy writes the commit into it after the build (scripts/build-deployment.mjs).
//
// Usage: node scripts/accounts-proof.mjs [--base <ref>]   (default origin/main; exits 1 if any file differs)
import { spawnSync, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { values: args } = parseArgs({ options: { base: { type: "string", default: "origin/main" } } });
const git = (...a) => execFileSync("git", a, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
const env = { ...process.env };
delete env.VITE_FLT_AUTH;

function build(cwd, out) {
  const r = spawnSync("pnpm", ["exec", "vite", "build", "--outDir", out, "--emptyOutDir", "--logLevel", "error"], { cwd, env, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`build in ${cwd} failed:\n${r.stdout}\n${r.stderr}`);
}

function hashes(dir) {
  const out = new Map();
  const walk = (d) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (relative(dir, p) !== "deployment.json") out.set(relative(dir, p), createHash("sha256").update(readFileSync(p)).digest("hex"));
    }
  };
  walk(dir);
  return out;
}

const sha = git("rev-parse", "--verify", `${args.base}^{commit}`);
const tmp = mkdtempSync(join(tmpdir(), "flt-accounts-proof-"));
const tree = join(tmp, "base");
try {
  git("worktree", "add", "--detach", "--force", tree, sha);
  const lock = (d) => readFileSync(join(d, "pnpm-lock.yaml"), "utf8");
  if (lock(tree) === lock(root)) symlinkSync(join(root, "node_modules"), join(tree, "node_modules"), "dir");
  else execFileSync("pnpm", ["install", "--frozen-lockfile", "--prefer-offline"], { cwd: tree, stdio: "ignore" });
  build(tree, join(tmp, "base-dist"));
  build(root, join(tmp, "head-dist"));
  const a = hashes(join(tmp, "base-dist"));
  const b = hashes(join(tmp, "head-dist"));
  const diff = [...new Set([...a.keys(), ...b.keys()])].sort().filter((f) => a.get(f) !== b.get(f));
  const head = git("rev-parse", "--short", "HEAD") + (git("status", "--porcelain") ? "+dirty" : "");
  if (diff.length) {
    console.log(`DIFFERENT: ${diff.length} of ${Math.max(a.size, b.size)} files differ between ${args.base}@${sha.slice(0, 7)} and ${head}`);
    for (const f of diff) console.log(`  ${f}  ${a.get(f)?.slice(0, 12) ?? "(missing)"}  ${b.get(f)?.slice(0, 12) ?? "(missing)"}`);
    process.exitCode = 1;
  } else {
    const all = createHash("sha256").update([...a].sort().map(([f, h]) => `${h}  ${f}\n`).join("")).digest("hex");
    console.log(`IDENTICAL: all ${a.size} files match between ${args.base}@${sha.slice(0, 7)} and ${head} with accounts off (sha256 of the manifest ${all.slice(0, 16)})`);
  }
} finally {
  spawnSync("git", ["worktree", "remove", "--force", tree], { cwd: root });
  rmSync(tmp, { recursive: true, force: true });
}

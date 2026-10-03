#!/usr/bin/env node
// FLT-103: the repo is public, so tracked files must not name our private infrastructure: bb machine paths, the bb
// host, Modal hosts, bb project and thread IDs, or a home directory. `pnpm guard` (run by `pnpm check` and CI) fails
// on any of them. Write repo-relative paths, `<builder>`, "the mission-control charter", or read an env var instead.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const PATTERN = String.raw`bb-machines|getbb\.app|modal\.host|proj_[a-z0-9]{10}|thr_[a-z0-9]{10}|/Users/jem`;

/** Files that may match, and why. Keep it tiny. */
export const ALLOW = {
  "scripts/infra-guard.mjs": "the guard has to spell the patterns it looks for",
  "scripts/infra-guard.test.mjs": "the guard's own fixtures",
};

/** `path:line:text` hits in tracked text files, minus the allowlist. */
export function scan(cwd = process.cwd()) {
  const r = spawnSync("git", ["grep", "-nIE", PATTERN, "--", ".", ...Object.keys(ALLOW).map((f) => `:!${f}`)], { cwd, encoding: "utf8", maxBuffer: 64 << 20 });
  if (r.status === 1) return []; // git grep: no match
  if (r.status !== 0) throw new Error(`git grep failed: ${r.stderr.trim()}`);
  return r.stdout.trim().split("\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const hits = scan();
  if (hits.length) {
    console.error(`pnpm guard: ${hits.length} line(s) name private infra (${PATTERN}):`);
    for (const h of hits.slice(0, 40)) console.error(`  ${h.length > 200 ? `${h.slice(0, 200)}…` : h}`);
    if (hits.length > 40) console.error(`  … and ${hits.length - 40} more`);
    console.error("Use repo-relative paths, <builder>, \"the mission-control charter\", or an env var. See scripts/infra-guard.mjs.");
    process.exit(1);
  }
  console.log("pnpm guard: no private infra names in tracked files");
}

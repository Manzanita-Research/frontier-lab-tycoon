// The public-repo guard (FLT-103): private infra names in tracked files fail `pnpm guard`; clean files and the
// allowlist pass.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, test } from "node:test";
import { ALLOW, scan } from "./infra-guard.mjs";

const dirs = [];
after(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

function repo(files) {
  const dir = mkdtempSync(join(tmpdir(), "flt-guard-"));
  dirs.push(dir);
  for (const [f, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, f)), { recursive: true });
    writeFileSync(join(dir, f), text);
  }
  execFileSync("git", ["init", "-q"], { cwd: dir });
  execFileSync("git", ["add", "-A"], { cwd: dir });
  return dir;
}

test("each private name is caught in a tracked file", () => {
  const leaks = [
    '"after": "/root/.bb-machines/host/checkouts/flt/docs/img/a.png"',
    "Preview: https://modal-8--4173.getbb.app/",
    "dns:task-abc.w.modal.host",
    "bb thread spawn --project proj_abcde12345",
    "Lead: thr_abcde12345.",
    "House rules: /Users/jem/CHARTER.md",
  ];
  const dir = repo(Object.fromEntries(leaks.map((l, i) => [`docs/leak-${i}.md`, `${l}\n`])));
  assert.equal(scan(dir).length, leaks.length);
});

test("clean files, untracked files and the allowlist pass", () => {
  const dir = repo({
    "docs/ok.md": "Preview: `<builder>:4173`. Project: `$BB_PROJECT_ID`. A proj_short id and thr_ prose are fine.\n",
    ...Object.fromEntries(Object.keys(ALLOW).map((f) => [f, "bb-machines getbb.app\n"])),
  });
  writeFileSync(join(dir, "untracked.md"), "/Users/jem\n");
  assert.deepEqual(scan(dir), []);
});

test("main is clean", () => {
  assert.deepEqual(scan(join(import.meta.dirname, "..")), []);
});

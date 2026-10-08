// The Daily Drama automation (FLT-113): drama/automation.sh renders the live automation's spawn and prompt from env,
// so a re-upload from the repo can't quietly drop the exact-command rule, the m6 spawn or the `CI: green` rule.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { root } from "./lint.mjs";

const script = join(root, "drama/automation.sh");
const stubEnv = { FLT_BB_PROJECT: "proj-stub", FLT_CHARTER: "/stub/CHARTER.md", FLT_RUNNER_MACHINE: "host_stub" };
const dirs = [];
after(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

function run(env, args = []) {
  const base = { ...process.env };
  for (const k of ["BB_CLI", "BB_PROJECT_ID", "FLT_BB_PROJECT", "FLT_CHARTER", "FLT_RUNNER_MACHINE"]) delete base[k];
  return spawnSync("bash", [script, ...args], { env: { ...base, ...env }, encoding: "utf8" });
}

/** A fake `bb` that records each call's argv, and answers `thread spawn --json` with a thread ID. */
function fakeBb() {
  const dir = mkdtempSync(join(tmpdir(), "flt-drama-bb-"));
  dirs.push(dir);
  const bin = join(dir, "bb");
  writeFileSync(bin, `#!/usr/bin/env bash\nn=$(ls "${dir}/calls" 2>/dev/null | wc -l | tr -d ' ')\nmkdir -p "${dir}/calls"\nprintf '%s\\0' "$@" > "${dir}/calls/$n"\n[ "$1" = thread ] && echo '{"id":"thread-stub"}'\nexit 0\n`);
  chmodSync(bin, 0o755);
  const calls = () => readdirSync(join(dir, "calls")).sort().map((f) => readFileSync(join(dir, "calls", f), "utf8").split("\0").slice(0, -1));
  return { bin, calls };
}

/** The dry run's two parts: the spawn line, and the prompt after it. */
function dryRun() {
  const r = run(stubEnv, ["--dry-run"]);
  assert.equal(r.status, 0, r.stderr);
  const [spawn, ...prompt] = r.stdout.split("\n");
  return { spawn, prompt: prompt.join("\n").replace(/\n$/, ""), date: /Daily Drama (\d{4}-\d{2}-\d{2})/.exec(spawn)[1] };
}

test("the dry run spawns on the runner machine in a fresh worktree, never Modal", () => {
  const { spawn, date } = dryRun();
  assert.match(spawn, /^dry run: bb thread spawn --project proj-stub --new-environment worktree --machine host_stub /);
  assert.match(spawn, / --provider claude-code --model claude-opus-5-5 --reasoning-level high --permission-mode auto /);
  assert.ok(spawn.includes(`--title "explore · Daily Drama ${date}" --prompt "$PROMPT" --json`), spawn);
  assert.doesNotMatch(spawn, /modal/);
});

test("the prompt keeps the exact-command rule, the CI: green rule and the bb comment note", () => {
  const { prompt, date } = dryRun();
  for (const line of [
    "House rules: the mission-control charter (on the Mini at /stub/CHARTER.md).",
    `Task: **FLT-34 Daily Drama run for ${date}.**`,
    // the exact-command rule: m6's settings only let this one command out of the sandbox
    `Then start the pipeline **exactly as** \`node scripts/drama-run.mjs --date ${date}\`, as one background Bash command`,
    "Add nothing to it: no `> file`, no `2>&1`, no `;` or `&&`, no env vars in front, and no dangerouslyDisableSandbox.",
    "m6's Claude settings run that exact command outside the sandbox",
    "If the feeds still come back 0/15, stop and say so. Don't work around it.",
    `start \`node scripts/drama-run.mjs ci --date ${date}\` the same way (exactly that, one background command, nothing added)`,
    // FLT-112: only GitHub's checks are CI
    "**never say every check passed unless it printed `CI: green`** (the local checks before the PR are not CI)",
    "**Never merge a Drama PR**; Jem reviews every one.",
    // FLT-110: the pipeline comments itself; the runner's own bb can't reach the server on m6
    "**About `bb tasks comment`:** inside m6's sandbox, `bb` can't reach the bb server.",
    "If the pipeline already printed `commented on FLT-34`, skip the comment step.",
    "If a `bb tasks comment` fails, don't retry it outside the sandbox. End your turn with the exact comment text, and the lead posts it.",
  ]) assert.ok(prompt.includes(line), `prompt lost: ${line}`);
  assert.doesNotMatch(prompt, /run_in_background|modal/i);
});

test("a real run passes that spawn and prompt to bb, then attaches the thread to FLT-34", () => {
  const { prompt, date } = dryRun();
  const bb = fakeBb();
  const r = run({ ...stubEnv, BB_CLI: bb.bin });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, `Daily Drama ${date}: spawned thread-stub\n`);
  assert.deepEqual(bb.calls(), [
    ["thread", "spawn", "--project", "proj-stub", "--new-environment", "worktree", "--machine", "host_stub",
      "--provider", "claude-code", "--model", "claude-opus-5-5", "--reasoning-level", "high", "--permission-mode", "auto",
      "--title", `explore · Daily Drama ${date}`, "--prompt", prompt, "--json"],
    ["tasks", "attach", "FLT-34", "--thread", "thread-stub"],
  ]);
});

test("each missing env var stops it with exit 2 before anything spawns", () => {
  for (const key of Object.keys(stubEnv)) {
    const bb = fakeBb();
    const env = { ...stubEnv, BB_CLI: bb.bin };
    delete env[key];
    const r = run(env);
    assert.equal(r.status, 2, `${key}: ${r.stderr}`);
    assert.match(r.stderr, new RegExp(`set ${key}`));
    assert.throws(() => bb.calls(), /ENOENT/, `${key}: bb was called`);
  }
});

test("the project falls back to BB_PROJECT_ID", () => {
  assert.match(run({ ...stubEnv, FLT_BB_PROJECT: "", BB_PROJECT_ID: "proj-env" }, ["--dry-run"]).stdout, /--project proj-env /);
});

test("AUTOMATION.md quotes the prompt verbatim", () => {
  const { prompt, date } = dryRun();
  const doc = readFileSync(join(root, "drama/AUTOMATION.md"), "utf8");
  const section = doc.slice(doc.indexOf("## The thread's prompt"), doc.indexOf("\n## ", doc.indexOf("## The thread's prompt") + 1));
  const quoted = section.split("\n").filter((l) => l.startsWith(">")).map((l) => l.replace(/^> ?/, "")).join("\n");
  assert.equal(quoted, prompt.replaceAll(date, "{date}").replace("/stub/CHARTER.md", "{$FLT_CHARTER}"));
});

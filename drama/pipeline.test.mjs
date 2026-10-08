// The Daily Drama pipeline around the linter: feed parsing, the pack's shape rules, and the author's check tool.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { aiScore, parseFeed } from "../scripts/drama-fetch.mjs";
import { blame, CI_JOBS, ciLine, ciStep, commentText, failureFromLog, packText, postComment, report, shapeCheck } from "../scripts/drama-run.mjs";
import { root } from "./lint.mjs";

test("parses RSS items and Atom entries", () => {
  const rss = `<rss><channel><item><title><![CDATA[Lab cuts prices &amp; ships]]></title><link>https://example.org/a</link>
    <pubDate>Tue, 29 Sep 2026 20:15:47 +0000</pubDate><description>&lt;p&gt;Tokens now &lt;b&gt;free&lt;/b&gt;&lt;/p&gt;</description></item></channel></rss>`;
  const atom = `<feed><entry><title>Benchmark retired</title><link rel="alternate" href="https://example.org/b"/>
    <updated>2026-09-30T01:00:00Z</updated><summary>Someone won it.</summary></entry></feed>`;
  assert.deepEqual(parseFeed(rss), [{ title: "Lab cuts prices & ships", link: "https://example.org/a", date: "2026-09-29T20:15:47.000Z", summary: "Tokens now free" }]);
  assert.deepEqual(parseFeed(atom), [{ title: "Benchmark retired", link: "https://example.org/b", date: "2026-09-30T01:00:00.000Z", summary: "Someone won it." }]);
});

test("scores AI-shaped stories above the rest", () => {
  const keywords = JSON.parse(readFileSync(join(root, "drama/sources.json"), "utf8")).aiKeywords;
  assert.ok(aiScore({ title: "Lab's new model tops benchmark", summary: "GPU prices" }, keywords) >= 3);
  assert.equal(aiScore({ title: "Local bakery wins award", summary: "Sourdough" }, keywords), 0);
});

const pack = (day, overrides = {}) => ({
  apiVersion: 1,
  id: `drama-${day}`,
  name: "Daily Drama: Test",
  version: "1.0.0",
  content: {
    events: { add: [{ id: `drama-${day}-card` }] },
    headlines: { add: Array.from({ length: 5 }, (_, i) => ({ id: `drama-${day}-h${i}` })) },
    thoughts: { add: Array.from({ length: 5 }, (_, i) => ({ id: `drama-${day}-t${i}` })) },
    ...overrides,
  },
});

test("shape: one card, 5-10 headlines, 5-10 thoughts, prefixed ids, nothing else", () => {
  const day = "2026-09-30";
  assert.deepEqual(shapeCheck(pack(day), day), []);
  assert.deepEqual(shapeCheck(pack(day, { rivals: { override: [{ id: "anthro", tagline: "x" }] } }), day), []);
  assert.match(shapeCheck(pack(day, { headlines: { add: [] } }), day).join(), /5-10 headlines/);
  assert.match(shapeCheck(pack(day, { events: undefined }), day).join(), /one event card or arc/);
  assert.match(shapeCheck(pack(day, { buildings: { add: [] } }), day).join(), /outside a Drama pack/);
  assert.match(shapeCheck(pack(day, { rivals: { remove: ["anthro"] } }), day).join(), /at most one rival tweak/);
  assert.match(shapeCheck({ ...pack(day), id: "drama-2026-01-01" }, day).join(), /id must be/);
  assert.match(shapeCheck({ ...pack(day), skin: {} }, day).join(), /no skin/);
});

test("the PR body shows the pack's copy", () => {
  const mod = JSON.parse(readFileSync(join(root, "drama/fixtures/good/mod.json"), "utf8"));
  mod.content.events = { add: [{ id: "x", title: "Price War", body: "Line one.\nLine two.", choices: [{ label: "Cut", hint: "Hype +1" }] }] };
  const text = packText(mod);
  assert.match(text, /^\*\*Card: Price War\*\*\n\n> Line one\.\n> Line two\.\n\n- Cut _\(Hype \+1\)_$/m);
  assert.match(text, /^\*\*Headlines\*\*\n\n- /m);
  assert.match(text, /^\*\*Thoughts\*\*\n\n- /m);
});

test("the author's check tool speaks MCP and runs the real checks", async () => {
  const child = spawn(process.execPath, [join(root, "scripts/drama-mcp.mjs"), join(root, "drama/fixtures/good"), "--date", "2026-09-30"], { cwd: root });
  const replies = new Map();
  let buffer = "";
  child.stdout.on("data", (chunk) => {
    buffer += chunk;
    for (let i; (i = buffer.indexOf("\n")) >= 0; buffer = buffer.slice(i + 1)) {
      const message = JSON.parse(buffer.slice(0, i));
      replies.get(message.id)?.(message);
    }
  });
  const call = (id, method, params) => new Promise((ok) => { replies.set(id, ok); child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n"); });
  try {
    const init = await call(1, "initialize", { protocolVersion: "2025-06-18" });
    assert.equal(init.result.serverInfo.name, "drama");
    const list = await call(2, "tools/list");
    assert.deepEqual(list.result.tools.map((t) => t.name), ["check"]);
    const result = await call(3, "tools/call", { name: "check", arguments: {} });
    const text = result.result.content[0].text;
    assert.match(text, /^PASS drama-fixture-price-war/m); // flt-mod check ran for real
    assert.match(text, /drama-lint .*PASS/); // the linter passed
    assert.match(text, /NOT GREEN/); // but the fixture isn't a dated Drama pack
    assert.equal(result.result.isError, true);
  } finally {
    child.kill();
  }
});

// ---------------------------------------------------------------------------------------------------------------
// The FLT-34 comment (FLT-110). `bb` is always a stub here: a test never posts.

const day = "2026-10-05";
const green = { kind: "green", jobs: CI_JOBS };
/** A stub `bb` that records its calls and answers with `code`, and a log that keeps the printed lines. */
function harness(code = 0) {
  const calls = [];
  const lines = [];
  const exec = async (bin, argv) => { calls.push([bin, ...argv]); return { code, out: code ? "bb is not running" : "Commented on FLT-34" }; };
  return { calls, lines, opts: { day, exec, bb: "bb", log: (l) => lines.push(l), stateDir: mkdtempSync(join(tmpdir(), "flt-drama-state-")) } };
}

test("each outcome maps to the runner prompt's comment", () => {
  assert.equal(commentText({ kind: "opened", url: "https://example.org/pr/1", ci: green }, day), "Daily Drama 2026-10-05: https://example.org/pr/1, ready for Jem's review. CI: green (check, engines, deploy, stranger).");
  assert.equal(
    commentText({ kind: "skipped", why: "# Skip\n\nNothing had a joke in it.\nThe big story was a layoff.\n" }, day),
    "Daily Drama 2026-10-05: skipped (quiet day). Nothing had a joke in it. The big story was a layoff.",
  );
  assert.equal(commentText({ kind: "failed", output: "a\nb" }, day), "Daily Drama 2026-10-05: failed\n\n```\na\nb\n```");
  assert.equal(commentText({ kind: "opened", url: "https://example.org/pr/1" }, day), "Daily Drama 2026-10-05: https://example.org/pr/1, opened; CI not checked.");
  assert.throws(() => commentText({ kind: "green" }, day));
});

test("opened and skipped post on FLT-34 and print `commented on FLT-34`", async () => {
  const { calls, lines, opts } = harness();
  assert.equal(await report({ kind: "opened", url: "https://example.org/pr/1", ci: green }, opts), 0);
  assert.equal(await report({ kind: "skipped", why: "Quiet." }, opts), 0);
  assert.deepEqual(calls, [
    ["bb", "tasks", "comment", "FLT-34", "--body", "Daily Drama 2026-10-05: https://example.org/pr/1, ready for Jem's review. CI: green (check, engines, deploy, stranger)."],
    ["bb", "tasks", "comment", "FLT-34", "--body", "Daily Drama 2026-10-05: skipped (quiet day). Quiet."],
  ]);
  assert.deepEqual(lines, ["commented on FLT-34", "commented on FLT-34"]);
});

test("--no-pr is a local run: no comment, exit 0", async () => {
  const { calls, opts } = harness();
  assert.equal(await report({ kind: "green" }, opts), 0);
  assert.deepEqual(calls, []);
});

test("the first failure of the day is silent; the second comments the last 30 lines", async () => {
  const { calls, lines, opts } = harness();
  const output = Array.from({ length: 40 }, (_, i) => `line ${i + 1}`).join("\n");
  const tail = (n) => output.split("\n").slice(-n).join("\n");
  assert.equal(await report({ kind: "failed" }, { ...opts, tail }), 1);
  assert.deepEqual(calls, []);
  assert.deepEqual(lines, ["drama-run 2026-10-05: NOT GREEN (attempt 1 of 2; run the same command again)"]);
  assert.equal(await report({ kind: "failed" }, { ...opts, tail }), 1);
  assert.equal(calls.length, 1);
  const body = calls[0].at(-1);
  assert.match(body, /^Daily Drama 2026-10-05: failed\n\n```\nline 11\n/);
  assert.match(body, /\nline 40\n```$/);
  assert.doesNotMatch(body, /line 10\n/);
  assert.equal(lines.at(-1), "commented on FLT-34");
});

test("a success after a failure comments normally; the counter is per date", async () => {
  const { calls, lines, opts } = harness();
  assert.equal(await report({ kind: "failed" }, opts), 1);
  assert.equal(await report({ kind: "opened", url: "https://example.org/pr/2", ci: green }, opts), 0);
  assert.deepEqual(calls.map((c) => c.at(-1)), ["Daily Drama 2026-10-05: https://example.org/pr/2, ready for Jem's review. CI: green (check, engines, deploy, stranger)."]);
  assert.equal(await report({ kind: "failed" }, { ...opts, day: "2026-10-06" }), 1); // a new day starts at attempt 1
  assert.equal(calls.length, 1);
  assert.match(lines.at(-1), /NOT GREEN \(attempt 1 of 2/);
});

test("--no-comment prints the comment instead of posting it", async () => {
  const { calls, lines, opts } = harness();
  assert.equal(await report({ kind: "opened", url: "https://example.org/pr/3", ci: green }, { ...opts, noComment: true }), 0);
  assert.deepEqual(calls, []);
  assert.deepEqual(lines, ["FLT-34 comment (--no-comment, not posted): Daily Drama 2026-10-05: https://example.org/pr/3, ready for Jem's review. CI: green (check, engines, deploy, stranger)."]);
});

test("a comment that can't be posted is printed, and never fails the run", async () => {
  const { calls, lines, opts } = harness(1);
  assert.equal(await report({ kind: "skipped", why: "Quiet." }, opts), 0);
  assert.equal(calls.length, 1);
  assert.deepEqual(lines, [
    "`bb tasks comment FLT-34` failed (exit 1): bb is not running",
    "FLT-34 comment (not posted): Daily Drama 2026-10-05: skipped (quiet day). Quiet.",
  ]);
  const thrown = [];
  const posted = await postComment("hello", { exec: async () => { throw new Error("spawn bb ENOENT"); }, log: (l) => thrown.push(l) });
  assert.equal(posted, false);
  assert.deepEqual(thrown.at(-1), "FLT-34 comment (not posted): hello");
});

// ---------------------------------------------------------------------------------------------------------------
// The PR's real CI (FLT-112). `gh` is always a stub here: a test never reaches GitHub, and the clock is fake.

const job = (workflow, name, bucket, id = 1) => ({ workflow, name, bucket, state: { pass: "SUCCESS", fail: "FAILURE", pending: "IN_PROGRESS", skipping: "SKIPPED" }[bucket], link: `https://example.org/actions/runs/9/job/${id}` });
const allGreen = [job("CI", "check", "pass"), job("CI", "engines", "pass"), job("Deploy", "check", "pass"), job("Deploy", "deploy", "pass"), job("Deploy", "stranger", "pass"), job("Deploy", "cleanup", "skipping")];
/** A red Deploy `check` log as `gh run view --log-failed` prints it: tab-separated, timestamped, ESC written as "^[". */
const redLog = [
  "check\tUNKNOWN STEP\t\uFEFF2026-10-07T14:32:02.7760957Z Current runner version: '2.337.0'",
  "check\tUNKNOWN STEP\t2026-10-07T14:40:19.2392182Z      ^[[33m^[[2m✓^[[22m^[[39m src/sim/a.test.ts > passes",
  "check\tUNKNOWN STEP\t2026-10-07T14:41:30.1000000Z ^[[41m^[[1m FAIL ^[[22m^[[49m src/sim/perf/busyLab.test.ts^[[2m > ^[[22mthe busy lab^[[2m > ^[[22mkeeps a late lunch inside the same budgets",
  "check\tUNKNOWN STEP\t2026-10-07T14:41:30.1000001Z ##[error]AssertionError: expected 0.194 to be less than 0.12",
  "check\tUNKNOWN STEP\t2026-10-07T14:41:30.1000002Z  ❯ src/sim/perf/busyLab.test.ts:90:33",
  "check\tUNKNOWN STEP\t2026-10-07T14:41:31.0000000Z ##[error]Process completed with exit code 1.",
].join("\n");

/** A stub `gh`: `pr checks` answers with the next snapshot (the last one repeats), `run view` with `log`. */
function fakeGh(snapshots, { log = redLog, logCode = 0 } = {}) {
  const calls = [];
  let i = 0;
  const exec = async (bin, argv) => {
    calls.push([bin, ...argv]);
    if (argv[0] === "pr" && argv[1] === "checks") {
      const next = snapshots[Math.min(i++, snapshots.length - 1)];
      return next ? { code: 0, out: JSON.stringify(next) } : { code: 1, out: "no checks reported on the 'drama-2026-10-05' branch" };
    }
    if (argv[0] === "run" && argv[1] === "view") return { code: logCode, out: log };
    throw new Error(`unexpected gh ${argv.join(" ")}`);
  };
  let t = 0;
  const lines = [];
  return { calls, lines, opts: { exec, day, now: () => t, sleep: async (ms) => { t += ms; }, log: (l) => lines.push(l), everyMs: 30_000, timeoutMs: 25 * 60_000 } };
}

test("CI green: waits for checks to appear and finish, and names the jobs GitHub passed", async () => {
  const pending = allGreen.map((c, i) => (i % 2 ? { ...c, bucket: "pending" } : c));
  const { calls, lines, opts } = fakeGh([null, pending, allGreen]);
  const ci = await ciStep(42, opts);
  assert.deepEqual(ci, { kind: "green", jobs: ["check", "engines", "deploy", "stranger"] });
  assert.deepEqual(calls[0], ["gh", "pr", "checks", "42", "--json", "name,workflow,state,bucket,link"]);
  assert.equal(calls.length, 3);
  assert.deepEqual(lines, ["CI: no checks reported yet", "CI: 3 of 6 checks done"]);
  const url = "https://example.org/pr/42";
  assert.equal(commentText({ kind: "opened", url, ci }, day), "Daily Drama 2026-10-05: https://example.org/pr/42, ready for Jem's review. CI: green (check, engines, deploy, stranger).");
});

test("CI is not green until every expected job has reported, and a skipped one is never green", async () => {
  const early = allGreen.filter((c) => c.name !== "stranger"); // the stranger job not created yet
  const { calls, opts } = fakeGh([early, allGreen]);
  assert.equal((await ciStep(42, opts)).kind, "green");
  assert.equal(calls.length, 2);
  const skipped = allGreen.map((c) => (c.workflow === "Deploy" && c.name === "check" ? { ...c, bucket: "skipping" } : c));
  const ci = await ciStep(42, fakeGh([skipped]).opts);
  assert.equal(ci.kind, "red"); // CI's `check` passing doesn't cover Deploy's `check` being skipped
  assert.match(ciLine(ci), /^CI FAILED: Deploy \/ check — skipped, so CI isn't green\.$/);
  assert.doesNotMatch(commentText({ kind: "opened", url: "u", ci }, day), /ready for Jem's review|CI: green/);
});

test("CI red: the failing job, its first failing test, whether it's the pack, and the log excerpt", async () => {
  const red = [job("CI", "check", "pass"), job("CI", "engines", "pass"), job("Deploy", "check", "fail", 777), job("Deploy", "deploy", "skipping"), job("Deploy", "stranger", "skipping")];
  const { calls, opts } = fakeGh([red]);
  const ci = await ciStep("https://example.org/pr/43", opts);
  assert.deepEqual(calls.at(-1), ["gh", "run", "view", "--job", "777", "--log-failed"]);
  assert.equal(ci.kind, "red");
  assert.equal(ci.job, "Deploy / check");
  assert.equal(ci.what, "src/sim/perf/busyLab.test.ts > the busy lab > keeps a late lunch inside the same budgets");
  assert.match(ci.note, /^Looks unrelated to the pack: src\/sim\/perf\/busyLab\.test\.ts is a perf or timing test outside drama\/ and mods\//);
  const body = commentText({ kind: "opened", url: "https://example.org/pr/43", ci }, day);
  assert.match(body, /^Daily Drama 2026-10-05: https:\/\/example\.org\/pr\/43, CI FAILED: Deploy \/ check — src\/sim\/perf\/busyLab\.test\.ts > the busy lab > keeps a late lunch inside the same budgets\. Looks unrelated/);
  assert.match(body, /\n```\nFAIL  src\/sim\/perf\/busyLab\.test\.ts > /);
  assert.match(body, /##\[error\]AssertionError: expected 0\.194 to be less than 0\.12/);
  assert.doesNotMatch(body, /\^\[|\t|14:41:30|ready for Jem's review|every check passed/);
});

test("CI red in the pack's own files, from a node:test log, and when the log can't be fetched", async () => {
  const nodeLog = ["test\tRun\t2026-10-07T10:00:00Z ✖ the pack has five headlines (3.1ms)", "test\tRun\t2026-10-07T10:00:00Z   test at drama/pipeline.test.mjs:40:1", "test\tRun\t2026-10-07T10:00:01Z ##[error]Process completed with exit code 1."].join("\n");
  const failure = failureFromLog(nodeLog);
  assert.equal(failure.test, "the pack has five headlines");
  assert.equal(failure.file, "drama/pipeline.test.mjs");
  assert.equal(blame(failure, day), "It touches the pack's own files (drama/pipeline.test.mjs).");
  assert.match(blame({ file: "src/content/mods.test.ts", excerpt: `bad id in mods/drama/${day}/mod.json` }, day), /touches the pack's own files/);
  assert.equal(failureFromLog("build\tRun\t2026-10-07T10:00:00Z ##[error]tsc found 2 errors").step, "tsc found 2 errors");
  const ci = await ciStep(44, fakeGh([[job("Deploy", "check", "fail", 5)]], { logCode: 1 }).opts);
  assert.equal(ci.kind, "red");
  assert.match(ciLine(ci), /^CI FAILED: Deploy \/ check — failure\. \(couldn't fetch its log: https:\/\/example\.org\/actions\/runs\/9\/job\/5\)$/);
});

test("CI timeout: still running after 25 min, never called green", async () => {
  const slow = allGreen.map((c) => (c.name === "stranger" ? { ...c, bucket: "pending" } : c));
  const { calls, opts } = fakeGh([slow]);
  const ci = await ciStep(45, opts);
  assert.deepEqual(ci, { kind: "timeout", minutes: 25, waiting: ["Deploy / stranger"] });
  assert.equal(calls.length, 51); // a look every 30 s for 25 min, and one at the deadline
  assert.equal(commentText({ kind: "opened", url: "https://example.org/pr/45", ci }, day), "Daily Drama 2026-10-05: CI still running after 25 min: https://example.org/pr/45 (waiting on Deploy / stranger)");
  // A failure seen before the deadline is reported as red even though other jobs are still running.
  const half = [job("Deploy", "check", "fail", 6), job("CI", "check", "pending")];
  assert.equal((await ciStep(46, fakeGh([half]).opts)).kind, "red");
});

test("a CI wait that breaks is 'unknown', and the run still exits 0 with a comment", async () => {
  const ci = await ciStep(47, { exec: async () => { throw new Error("spawn gh ENOENT"); } });
  assert.deepEqual(ci, { kind: "unknown", error: "spawn gh ENOENT" });
  const { calls, opts } = harness();
  assert.equal(await report({ kind: "opened", url: "https://example.org/pr/47", ci }, opts), 0);
  assert.equal(calls[0].at(-1), "Daily Drama 2026-10-05: CI result unknown (spawn gh ENOENT): https://example.org/pr/47");
  // A red PR is still an opened PR: exit 0 and no attempt counted, so the runner doesn't open it again.
  const red = { kind: "red", job: "Deploy / check", what: "x", note: "", excerpt: "" };
  assert.equal(await report({ kind: "opened", url: "u", ci: red }, opts), 0);
  assert.equal(await report({ kind: "failed" }, opts), 1);
});

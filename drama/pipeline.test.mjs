// The Daily Drama pipeline around the linter: feed parsing, the pack's shape rules, and the author's check tool.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { aiScore, parseFeed } from "../scripts/drama-fetch.mjs";
import { commentText, packText, postComment, report, shapeCheck } from "../scripts/drama-run.mjs";
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
/** A stub `bb` that records its calls and answers with `code`, and a log that keeps the printed lines. */
function harness(code = 0) {
  const calls = [];
  const lines = [];
  const exec = async (bin, argv) => { calls.push([bin, ...argv]); return { code, out: code ? "bb is not running" : "Commented on FLT-34" }; };
  return { calls, lines, opts: { day, exec, bb: "bb", log: (l) => lines.push(l), stateDir: mkdtempSync(join(tmpdir(), "flt-drama-state-")) } };
}

test("each outcome maps to the runner prompt's comment", () => {
  assert.equal(commentText({ kind: "opened", url: "https://example.org/pr/1" }, day), "Daily Drama 2026-10-05: https://example.org/pr/1, ready for Jem's review.");
  assert.equal(
    commentText({ kind: "skipped", why: "# Skip\n\nNothing had a joke in it.\nThe big story was a layoff.\n" }, day),
    "Daily Drama 2026-10-05: skipped (quiet day). Nothing had a joke in it. The big story was a layoff.",
  );
  assert.equal(commentText({ kind: "failed", output: "a\nb" }, day), "Daily Drama 2026-10-05: failed\n\n```\na\nb\n```");
  assert.throws(() => commentText({ kind: "green" }, day));
});

test("opened and skipped post on FLT-34 and print `commented on FLT-34`", async () => {
  const { calls, lines, opts } = harness();
  assert.equal(await report({ kind: "opened", url: "https://example.org/pr/1" }, opts), 0);
  assert.equal(await report({ kind: "skipped", why: "Quiet." }, opts), 0);
  assert.deepEqual(calls, [
    ["bb", "tasks", "comment", "FLT-34", "--body", "Daily Drama 2026-10-05: https://example.org/pr/1, ready for Jem's review."],
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
  assert.equal(await report({ kind: "opened", url: "https://example.org/pr/2" }, opts), 0);
  assert.deepEqual(calls.map((c) => c.at(-1)), ["Daily Drama 2026-10-05: https://example.org/pr/2, ready for Jem's review."]);
  assert.equal(await report({ kind: "failed" }, { ...opts, day: "2026-10-06" }), 1); // a new day starts at attempt 1
  assert.equal(calls.length, 1);
  assert.match(lines.at(-1), /NOT GREEN \(attempt 1 of 2/);
});

test("--no-comment prints the comment instead of posting it", async () => {
  const { calls, lines, opts } = harness();
  assert.equal(await report({ kind: "opened", url: "https://example.org/pr/3" }, { ...opts, noComment: true }), 0);
  assert.deepEqual(calls, []);
  assert.deepEqual(lines, ["FLT-34 comment (--no-comment, not posted): Daily Drama 2026-10-05: https://example.org/pr/3, ready for Jem's review."]);
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

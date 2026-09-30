// The Daily Drama pipeline around the linter: feed parsing, the pack's shape rules, and the author's check tool.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { aiScore, parseFeed } from "../scripts/drama-fetch.mjs";
import { shapeCheck } from "../scripts/drama-run.mjs";
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

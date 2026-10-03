// The parody linter against known bad (and known fine) copy. Run: node --test drama/*.test.mjs
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { distance, lintPack, lintText, readPack, root, squash } from "./lint.mjs";

const fails = (text) => lintText(text).errors.map((e) => e.word);
const warns = (text) => lintText(text).warnings.map((e) => e.word);

test("real orgs, products and people fail, as written", () => {
  for (const [text, word] of [
    ["OpenAI ships a model", "OpenAI"],
    ["Anthropic publishes an essay", "Anthropic"],
    ["Nvidia sells shovels", "Nvidia"],
    ["NVIDIA sells shovels", "NVIDIA"],
    ["Zuckerberg builds a cage", "Zuckerberg"],
    ["Trump signs an order", "Trump"],
    ["Claude is here", "Claude"],
    ["GPT-5 is late", "GPT"],
    ["o3 is here", "o3"],
    ["DeepSeek moment", "DeepSeek"],
    ["SoftBank invests again", "SoftBank"],
    ["Hacker News thread", "Hacker News"],
    ["Microsoft's deal", "Microsoft"],
    ["Safe Superintelligence raises", "Safe Superintelligence"],
  ]) assert.ok(fails(text).includes(word), `${text} → ${fails(text)}`);
});

test("nationalities, states and regulators fail", () => {
  for (const [text, word] of [
    ["Chinese lab ships weights", "Chinese"],
    ["US regulators wake up", "US"],
    ["The FTC calls", "FTC"],
    ["the EU AI Act lands", "EU"],
    ["White House dinner", "White House"],
  ]) assert.ok(fails(text).includes(word), `${text} → ${fails(text)}`);
});

test("disguises fail: spaces, hyphens, leetspeak, typos", () => {
  assert.deepEqual(fails("Open AI ships"), ["Open AI"]);
  assert.deepEqual(fails("Deep-Mind wins"), ["Deep-Mind"]);
  assert.deepEqual(fails("Deep Seek moment"), ["Deep Seek"]);
  assert.deepEqual(fails("0penAI ships"), ["0penAI"]);
  assert.deepEqual(fails("Micro-soft rebrands"), ["Micro-soft"]);
  assert.deepEqual(fails("Gooogle buys everything"), ["Gooogle"]);
  assert.deepEqual(fails("Sam Altmann is sad"), ["Sam Altmann"]);
  assert.deepEqual(fails("Hilton hotel"), ["Hilton"]); // one letter from a real person: fail, rephrase
});

test("URLs, domains, handles and subreddits fail", () => {
  assert.ok(fails("Read more at https://example.org/story").includes("https://example.org/story"));
  assert.ok(fails("Read more at example.com").includes("example.com"));
  assert.ok(fails("see www.example.org").includes("www.example.org"));
  assert.ok(fails("Follow @sama for more").includes("@sama"));
  assert.ok(fails("r/LocalLLaMA meltdown").includes("r/LocalLLaMA"));
});

test("unknown proper nouns fail until the pack declares them", () => {
  assert.deepEqual(fails("Zorblax Industries sues"), ["Zorblax"]);
  assert.deepEqual(fails("Updating my FaceTome"), ["FaceTome"]);
  assert.deepEqual(fails("Kimi K2 ships"), ["Kimi", "K2"]);
  assert.deepEqual(lintText("Zorblax Industries sues", { pack: new Set(["zorblax"]) }).errors, []);
});

test("a declared parody name cannot be a real one", () => {
  const mod = { content: { headlines: { add: [{ id: "x", text: "Altmann Labs sues", tone: "joke" }] } } };
  const report = lintPack(mod, { names: ["Altmann Labs"] });
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((e) => e.path === "glossary.json"));
});

test("everyday words and the game's own names pass", () => {
  for (const text of [
    "us and them",
    "An apple a day",
    "we grok it",
    "the llama is fine",
    "a mistral wind",
    "Who called?",
    "Super Super AI raises $4B at a $30B valuation for a 5GW campus, 100M offers by 3PM",
    "Priya Gradient ships Frontier-4-Mini",
    "Macrohard buys Sirocco; Open-ish AI files a blog post",
    "MetaMeta ships",
    "Very Very Super Super Intelligence raises again",
    "MetaMeta Metaintelligence Labs poaches again",
    "Anthropomorphic declines to join the price war, publishes a 40-page essay on why",
    "Tokens now cheaper than the kombucha used to generate them",
    "the Arena leaderboard is a vibe",
    "AGI by Friday, says CEO, again",
  ]) assert.deepEqual(fails(text), [], text);
});

test("the real labs our old rival names contained fail", () => {
  assert.ok(fails("Very Safe Superintelligence Inc. raises again").length > 0);
  assert.ok(fails("Meta Superintelligence Labs poaches again").length > 0);
});

test("FLT-105: the real gathering and its corner of the internet fail; Vibe Encampment passes", () => {
  for (const [text, word] of [["back from Vibecamp", "Vibecamp"], ["everyone at Vibe Camp", "Vibe Camp"], ["big in TPOT", "TPOT"]])
    assert.ok(fails(text).includes(word), `${text} → ${fails(text)}`);
  assert.deepEqual(fails("Vibe Encampment proposes a medium dose of acid"), []);
});

test("ambiguous words warn instead of failing", () => {
  assert.deepEqual(fails("Scale acquires talent"), []);
  assert.deepEqual(warns("Scale acquires talent"), ["Scale"]);
});

test("the game's own content packs pass", () => {
  for (const dir of ["base-collusion", "base-disasters", "base-leapfrog", "base-papers", "examples/acid-mode"]) {
    const { mod, names } = readPack(join(root, "mods", dir));
    const report = lintPack(mod, { names });
    assert.deepEqual(report.errors, [], dir);
  }
});

test("the known-good fixture passes and lists its new names", () => {
  const { mod, names } = readPack(join(root, "drama/fixtures/good"));
  const report = lintPack(mod, { names });
  assert.equal(report.ok, true, JSON.stringify(report.errors));
  assert.deepEqual(report.newNames, ["Gronkwell Dynamics"]);
});

test("every committed Drama pack passes", () => {
  const dir = join(root, "mods/drama");
  let days = [];
  try { days = readdirSync(dir).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)); } catch {}
  for (const day of days) {
    const { mod, names } = readPack(join(dir, day));
    assert.deepEqual(lintPack(mod, { names }).errors, [], day);
  }
});

test("helpers", () => {
  assert.equal(squash("0pen-A.I."), "openai");
  assert.equal(distance("altmann", "altman"), 1);
  assert.equal(distance("anthropic", "anthrpoic"), 1);
  assert.ok(distance("openish", "openai") > 1);
  assert.ok(JSON.parse(readFileSync(join(root, "drama/denylist.json"), "utf8")).labs.any.includes("OpenAI"));
});

// The published Drama feed: only what main has merged, byte for byte, newest first.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { buildFeed, feedFiles, packsAt, packsIn, publishedRef } from "../scripts/drama-feed.mjs";
import { root } from "./lint.mjs";

const pack = (day, extra = {}) => ({
  apiVersion: 1,
  id: `drama-${day}`,
  name: `Daily Drama: Story of ${day}`,
  version: "1.0.0",
  description: `What happened on ${day}.`,
  content: {
    events: { add: [{ id: `drama-${day}-card`, title: "A Card", when: { stat: "day", atLeast: 30 } }] },
    headlines: { add: [{ id: `drama-${day}-h1`, text: "{lab} wins by losing" }, { id: `drama-${day}-h2`, text: "Plain headline" }] },
    thoughts: { add: [{ id: `drama-${day}-t1`, text: "Hm." }] },
    ...extra,
  },
});

const dirs = [];
after(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

/** A repo with main (two merged packs) and an open Drama branch (a new pack, and an edit to a merged one). */
function repo() {
  const dir = mkdtempSync(join(tmpdir(), "drama-feed-"));
  dirs.push(dir);
  const git = (...args) => execFileSync("git", args, { cwd: dir, stdio: "pipe", encoding: "utf8" });
  const write = (day, mod) => {
    mkdirSync(join(dir, "mods/drama", day), { recursive: true });
    writeFileSync(join(dir, "mods/drama", day, "mod.json"), typeof mod === "string" ? mod : JSON.stringify(mod));
  };
  git("init", "-q", "-b", "main");
  git("config", "user.email", "t@example.invalid");
  git("config", "user.name", "t");
  write("2026-09-28", pack("2026-09-28"));
  write("2026-09-29", pack("2026-09-29"));
  writeFileSync(join(dir, "mods/drama/2026-09-29/CHECK.txt"), "ALL GREEN\n");
  git("add", ".");
  git("commit", "-qm", "merged packs");
  git("checkout", "-qb", "drama-2026-09-30");
  write("2026-09-30", pack("2026-09-30"));
  write("2026-09-28", pack("2026-09-28", { headlines: { add: [{ id: "x", text: "UNREVIEWED EDIT" }] } }));
  git("add", ".");
  git("commit", "-qm", "unmerged Drama PR");
  return { dir, git };
}

test("reads packs from main's tree, never from the working tree or an open Drama branch", () => {
  const { dir } = repo();
  assert.equal(publishedRef(dir), "refs/heads/main");
  const packs = packsAt(publishedRef(dir), dir);
  assert.deepEqual(packs.map((p) => p.date).sort(), ["2026-09-28", "2026-09-29"]);
  const files = feedFiles({ cwd: dir, fixtures: join(dir, "none") });
  assert.ok(!files.has("drama/2026-09-30/mod.json"), "an unmerged pack is never served");
  assert.ok(!files.get("drama/2026-09-28/mod.json").includes("UNREVIEWED EDIT"), "an unmerged edit to a merged pack is never served");
  assert.ok(!files.has("drama/2026-09-29/CHECK.txt"), "only mod.json is served");
  const index = JSON.parse(files.get("drama/index.json"));
  assert.deepEqual(index.packs.map((p) => p.id), ["drama-2026-09-29", "drama-2026-09-28"]);
  assert.equal(JSON.parse(files.get("drama/latest.json")).pack.id, "drama-2026-09-29");
  assert.ok(!files.get("drama/index.json").includes("UNREVIEWED"));
});

test("prefers the remote's main, and publishes nothing when there is no main at all", () => {
  const { dir, git } = repo();
  git("update-ref", "refs/remotes/origin/main", "HEAD~1");
  assert.equal(publishedRef(dir), "refs/remotes/origin/main");
  git("branch", "-qD", "main");
  git("update-ref", "-d", "refs/remotes/origin/main");
  assert.equal(publishedRef(dir), null);
  const warnings = [];
  const files = feedFiles({ cwd: dir, fixtures: join(dir, "none"), warn: (m) => warnings.push(m) });
  assert.deepEqual(JSON.parse(files.get("drama/index.json")).packs, []);
  assert.deepEqual(JSON.parse(files.get("drama/latest.json")), { apiVersion: 1, pack: null });
  assert.equal(files.has("drama/2026-09-30/mod.json"), false);
  assert.match(warnings.join("\n"), /no main branch/);
});

test("an entry says what's in the pack: title, blurb, teasers, the card and its day, counts", () => {
  const { index, latest, files } = buildFeed([{ date: "2026-09-29", text: JSON.stringify(pack("2026-09-29", { rivals: { override: [{ id: "anthro", tagline: "x" }] } })) }]);
  assert.deepEqual(index.packs[0], {
    id: "drama-2026-09-29",
    date: "2026-09-29",
    title: "Story of 2026-09-29",
    description: "What happened on 2026-09-29.",
    url: "/mods/drama/2026-09-29/mod.json",
    teasers: ["Plain headline", "Your lab wins by losing"],
    event: { title: "A Card", day: 30 },
    counts: { events: 1, headlines: 2, thoughts: 1, rivals: 1 },
  });
  assert.deepEqual(latest.pack, index.packs[0]);
  assert.equal(files[0].path, "2026-09-29/mod.json");
});

test("a broken pack is left out with a warning; the rest still publish", () => {
  const warnings = [];
  const { index } = buildFeed([{ date: "2026-09-28", text: "{ nope" }, { date: "2026-09-29", text: JSON.stringify({ hello: 1 }) }, { date: "2026-09-27", text: JSON.stringify(pack("2026-09-27")) }], "/mods/drama", (m) => warnings.push(m));
  assert.deepEqual(index.packs.map((p) => p.date), ["2026-09-27"]);
  assert.equal(warnings.length, 2);
});

test("the fixture feed is the three rehearsal packs, newest first, all loadable paths", () => {
  const packs = packsIn(join(root, "drama/fixtures/feed"));
  assert.equal(packs.length, 3);
  const { index } = buildFeed(packs, "/mods/drama-fixture");
  assert.deepEqual(index.packs.map((p) => p.date), ["2026-09-29", "2026-09-28", "2026-09-27"]);
  for (const p of index.packs) {
    assert.equal(p.url, `/mods/drama-fixture/${p.date}/mod.json`);
    assert.equal(JSON.parse(readFileSync(join(root, "drama/fixtures/feed", p.date, "mod.json"), "utf8")).id, p.id);
    assert.ok(p.teasers.length === 3 && p.event?.title && p.counts.headlines >= 5 && p.counts.thoughts >= 5);
  }
});

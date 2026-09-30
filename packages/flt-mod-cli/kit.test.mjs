import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { bundle, check, serve } from "./cli.mjs";
import { scaffold } from "./create.mjs";
import { checkArcGraph } from "./graph.mjs";
import { gameRoot, loadManifest, withGameRuntime } from "./io.mjs";

test("private modder kit works against the actual game contract", async (t) => {
  const directory = await mkdtemp(resolve(tmpdir(), "flt-kit-test-"));
  try {
    await withGameRuntime(async (runner) => {
      await t.test("both M1a examples replay 365 actual days", async () => {
        for (const example of ["every-lab-is-steve", "headline-pack"]) {
          const report = await check(resolve(gameRoot, `mods/examples/${example}/mod.json`), runner);
          assert.equal(report.days, 365);
          assert.equal(report.ticks, 7300);
          assert.ok(report.cardsAnswered > 0);
          assert.equal(report.deterministic, true);
          assert.ok(report.injection.deferred.length > 0);
        }
      });
      await t.test("SDK, typed template and every section validate", async () => {
        const input = resolve(gameRoot, "templates/create-flt-mod");
        const loaded = await loadManifest(input, runner);
        const json = JSON.parse(await readFile(resolve(input, "mod.json"), "utf8"));
        assert.deepEqual(loaded.manifest, json);
        const report = await check(input, runner);
        assert.equal(report.arcs[0].states, 2);
        const sdk = await runner.import(resolve(gameRoot, "packages/flt-mod-sdk/src/index.ts"));
        assert.throws(() => sdk.defineMod({ apiVersion: 2, id: "broken", name: "Broken", version: "1" }));
      });
      await t.test("skill's ten JSON examples are actual valid manifests", async () => {
        const skill = await readFile(resolve(gameRoot, ".agents/skills/flt-modding/SKILL.md"), "utf8");
        const examples = [...skill.matchAll(/```json\n([\s\S]*?)\n```/g)];
        assert.equal(examples.length, 10);
        const { decodeManifest } = await runner.import(resolve(gameRoot, "src/mods/schema.ts"));
        const { composeMods } = await runner.import(resolve(gameRoot, "src/mods/loader.ts"));
        const { resolveGameDefinition } = await runner.import(resolve(gameRoot, "src/mods/game-definition.ts"));
        const { Effect } = await runner.import("effect");
        for (const [index, [, json]] of examples.entries()) {
          const part = JSON.parse(json);
          const manifest = await Effect.runPromise(decodeManifest({ apiVersion: 1, id: `example-${index}`, name: "Example", version: "1.0.0", ...(part.skin ? part : { content: part }) }));
          const definition = await Effect.runPromise(resolveGameDefinition(composeMods([manifest]).layer));
          definition.content.arcs.forEach(checkArcGraph);
        }
      });
      await t.test("scaffold test command and inlined bundle work outside the workspace", async () => {
        const destination = await scaffold("retriever-pack", directory);
        const jsonPath = resolve(destination, "mod.json");
        const manifest = JSON.parse(await readFile(jsonPath, "utf8"));
        assert.equal(manifest.id, "retriever-pack");
        assert.ok((await readFile(resolve(destination, "SKILL.md"), "utf8")).includes("until green"));
        const pkg = JSON.parse(await readFile(resolve(destination, "package.json"), "utf8"));
        assert.ok(pkg.scripts.test.includes("check mod.json"));
        await assert.rejects(scaffold("retriever-pack", directory), /EEXIST/);
        await assert.rejects(scaffold("../oops", directory), /kebab-case/);
        const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
        await writeFile(resolve(destination, "sign.png"), image);
        manifest.assets = { "sign.png": "sign.png" };
        // Explicit JSON input exercises relative assets; directory input prefers optional TS.
        await rm(resolve(destination, "mod.ts"));
        await writeFile(jsonPath, JSON.stringify(manifest));
        const bundled = await bundle(destination, undefined, runner);
        const data = JSON.parse(await readFile(bundled, "utf8"));
        assert.equal(data.assets["sign.png"], `data:image/png;base64,${image.toString("base64")}`);
        const report = await check(bundled, runner);
        assert.equal(report.days, 365);
        manifest.assets = { "sign.png": "https://tracker.invalid/sign.png" };
        await writeFile(jsonPath, JSON.stringify(manifest));
        await assert.rejects(loadManifest(jsonPath, runner), /remote assets/);
        manifest.assets = { "sign.png": "../outside.png" };
        await writeFile(resolve(directory, "outside.png"), image);
        await writeFile(jsonPath, JSON.stringify(manifest));
        await assert.rejects(loadManifest(jsonPath, runner), /escapes/);
        await symlink(resolve(directory, "outside.png"), resolve(destination, "escape.png"));
        manifest.assets = { "sign.png": "escape.png" };
        await writeFile(jsonPath, JSON.stringify(manifest));
        await assert.rejects(loadManifest(jsonPath, runner), /escapes/);
      });
    });
    await t.test("dev serves CORS JSON, rereads edits and confines files", async () => {
      const path = resolve(directory, "mod.json");
      await writeFile(path, JSON.stringify({ apiVersion: 1, id: "dev-test", name: "First", version: "1.0.0" }));
      await symlink(resolve(gameRoot, "package.json"), resolve(directory, "escape.json"));
      const server = await serve(directory, 0);
      try {
        const url = `http://127.0.0.1:${server.address().port}`;
        const response = await fetch(`${url}/mod.json`);
        assert.equal(response.headers.get("access-control-allow-origin"), "*");
        assert.equal((await response.json()).name, "First");
        await writeFile(path, JSON.stringify({ apiVersion: 1, id: "dev-test", name: "Second", version: "1.0.0" }));
        assert.equal((await (await fetch(`${url}/mod.json`)).json()).name, "Second");
        assert.equal((await fetch(`${url}/escape.json`)).status, 400);
        assert.equal((await fetch(`${url}/mod.json`, { method: "OPTIONS" })).status, 204);
      } finally { await new Promise((done) => server.close(done)); }
    });
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("graph explores guarded alternatives, nesting and ancestor transitions", () => {
  const arc = { id: "branches", initial: "idle", states: {
    idle: { on: { DAY: [{ target: "playing", guard: "chance" }, { target: "done", guard: "flag.is" }] } },
    playing: { initial: "waiting", states: { waiting: { on: { NEXT: "finishing" } }, finishing: {} }, on: { END: "done" } },
    done: { type: "final" },
  } };
  assert.equal(checkArcGraph(arc).states, 5);
  assert.throws(() => checkArcGraph({ ...arc, states: { ...arc.states, orphan: {} } }), /unreachable states: orphan/);
  assert.throws(() => checkArcGraph({ id: "bad", initial: "first", states: { first: { on: { DAY: "typo" } } } }), /typo/);
});

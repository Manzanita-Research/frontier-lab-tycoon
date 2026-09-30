#!/usr/bin/env node
// `pnpm shots`: before/after screenshots for PRs (Jem's rule: a visible change shows the same scene, seed, camera and
// viewport on `main` and on your branch). One command:
//
//   pnpm shots                                     # the four standard scenes: overview, inspector, event, phone
//   pnpm shots --scenes overview,ops,night         # any scenes from scripts/shots.scenes.json (`--list` shows them)
//   pnpm shots --skin frontier-95                  # a skin on both builds (a base without skins ignores it)
//   pnpm shots --skin all                          # a gallery: every skin in src/skins, after-side only
//   pnpm shots --out docs/img/flt-99 --diff        # somewhere committable, plus a third "what changed" panel
//   pnpm shots --scenes overview --query "zoom=70&focus=12,14"   # ad hoc params on top of the scene
//
// What it does: builds `--base` (default `main`, in a temporary git worktree, cached by commit) and the current checkout
// (or `--head <ref>`), serves both from a tiny static server, captures every scene on both with the same Playwright +
// SwiftShader setup as scripts/shot.mjs, and writes
//
//   <out>/before/<scene>.png   <out>/after/<scene>.png   <out>/compare/<scene>.png   <out>/report.md   <out>/report.json
//
// then prints a markdown table for the PR body. `pnpm shots --help` lists every flag. The game is paused (?speed=0), so the
// pairs line up; the compare image says how many pixels differ, and running with `--base HEAD` (a build against itself)
// shows the noise floor.
import { chromium } from "playwright";
import { execFileSync, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const t0 = Date.now();
const secs = (since = t0) => `${((Date.now() - since) / 1000).toFixed(1)}s`;
const log = (...a) => console.error(`[shots +${secs()}]`, ...a);
const die = (msg) => {
  console.error(`pnpm shots: ${msg}`);
  process.exit(2);
};

// ── args ────────────────────────────────────────────────────────────────────────────────────────────────────────────
const HELP = `pnpm shots [flags]: before/after screenshots of the same scenes on \`main\` and on this checkout.

  --scenes <a,b|set|all>  scene names or a set from scripts/shots.scenes.json          [standard]
  --skin <id|all>         add ?skin=<id> to both builds; 'all' = a gallery of every skin in src/skins (after side only)
  --skin-before <id|none> override the skin on the before side (default: same as --skin)
  --base <ref>            what "before" is                                              [main]
  --head <ref>            what "after" is                                               [the working tree, uncommitted changes too]
  --before-url <url>      use an already-running server as "before" (skips the base build)
  --after-url <url>       use an already-running server as "after" (skips the build)
  --no-before             after side only (a new scene, a new skin)
  --out <dir>             output directory                                              [shots]
  --diff                  add a third "what changed" panel to compare images
  --query <a=1&b=2>       extra URL params for every scene (they win over the scene's)
  --frames <n>            rendered frames to wait before a capture (overrides the scene's; default 24)
  --scenes-file <json>    extra scenes, merged over scripts/shots.scenes.json
  --fresh                 rebuild the base even if it is cached (shots/.cache/<sha>)
  --list                  list scenes and sets, then exit
  --verify <png|dir>...   only check that images are not blank (or mostly one colour); exit 1 if any are
  -h, --help
`;
let args, positionals;
try {
  ({ values: args, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      scenes: { type: "string", default: "standard" },
      skin: { type: "string" },
      "skin-before": { type: "string" },
      base: { type: "string", default: "main" },
      head: { type: "string" },
      "before-url": { type: "string" },
      "after-url": { type: "string" },
      "no-before": { type: "boolean", default: false },
      out: { type: "string", default: "shots" },
      diff: { type: "boolean", default: false },
      query: { type: "string", default: "" },
      frames: { type: "string" },
      "scenes-file": { type: "string" },
      fresh: { type: "boolean", default: false },
      list: { type: "boolean", default: false },
      verify: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  }));
} catch (e) {
  die(`${e.message}\n\n${HELP}`);
}
if (args.help) {
  console.log(HELP);
  process.exit(0);
}

const cleanups = [];
const cleanup = () => {
  while (cleanups.length) {
    try {
      cleanups.pop()();
    } catch {}
  }
};
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => (cleanup(), process.exit(130)));
process.on("exit", cleanup);

// ── the blank guard ─────────────────────────────────────────────────────────────────────────────────────────────────
// A screenshot (or a composite) that is a dark frame, or nearly one colour, means the page or the compositor never drew:
// a failure, never evidence. Every capture and every composite is checked, and a blank one fails the run loudly.
const BLANK_DOMINANT = 0.9;  // one 4-bit colour covering more of the image than this = blank
const BLANK_COLORS = 16; //     fewer distinct colours (each on >= 0.1% of pixels) than this = blank
let browser;
async function getBrowser() {
  if (!browser) {
    browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
    cleanups.push(() => browser.close());
  }
  return browser;
}
let probePage;
/** Colour stats for a PNG, or for crops of it ([{ x, y, w, h }] in image pixels; null = the whole image). */
async function analyze(file, crops = [null]) {
  probePage ??= await (await (await getBrowser()).newContext()).newPage();
  return probePage.evaluate(
    async ({ src, crops }) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      return crops.map((c) => {
        const r = c ?? { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight };
        const scale = Math.min(1, 320 / r.w);
        const cw = Math.max(1, Math.round(r.w * scale)), ch = Math.max(1, Math.round(r.h * scale));
        const cv = document.createElement("canvas");
        cv.width = cw;
        cv.height = ch;
        const g = cv.getContext("2d", { willReadFrequently: true });
        g.drawImage(img, r.x, r.y, r.w, r.h, 0, 0, cw, ch);
        const px = g.getImageData(0, 0, cw, ch).data;
        const bins = new Map();
        for (let i = 0; i < px.length; i += 4) {
          const k = ((px[i] >> 4) << 8) | ((px[i + 1] >> 4) << 4) | (px[i + 2] >> 4);
          bins.set(k, (bins.get(k) ?? 0) + 1);
        }
        const n = cw * ch;
        return { dominant: Math.max(...bins.values()) / n, colors: [...bins.values()].filter((v) => v / n >= 0.001).length };
      });
    },
    { src: `data:image/png;base64,${readFileSync(file).toString("base64")}`, crops },
  );
}
const isBlank = (st) => st.dominant > BLANK_DOMINANT || st.colors < BLANK_COLORS;
const describe = (st) => `${(st.dominant * 100).toFixed(0)}% one colour, ${st.colors} colours`;

if (args.verify) {
  const files = positionals.flatMap((p) => {
    const abs = resolve(p);
    if (!existsSync(abs)) die(`--verify: ${p} does not exist`);
    const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : e.name.endsWith(".png") ? [join(d, e.name)] : []));
    return statSync(abs).isDirectory() ? walk(abs) : [abs];
  });
  if (!files.length) die("--verify: no .png files given. Usage: pnpm shots --verify <png|dir>...");
  let bad = 0;
  for (const f of files) {
    const [st] = await analyze(f);
    const blank = isBlank(st);
    bad += blank ? 1 : 0;
    console.log(`${blank ? "BLANK" : "ok   "}  ${relative(process.cwd(), f)}  (${describe(st)})`);
  }
  cleanup();
  console.log(bad ? `\n${bad} of ${files.length} images are blank.` : `\nall ${files.length} images have content.`);
  process.exit(bad ? 1 : 0);
}

// ── scenes ──────────────────────────────────────────────────────────────────────────────────────────────────────────
const sceneData = JSON.parse(readFileSync(join(here, "shots.scenes.json"), "utf8"));
if (args["scenes-file"]) {
  const extra = JSON.parse(readFileSync(resolve(args["scenes-file"]), "utf8"));
  Object.assign(sceneData.scenes, extra.scenes ?? {});
  Object.assign(sceneData.sets, extra.sets ?? {});
  Object.assign(sceneData.defaults, extra.defaults ?? {});
}
if (args.list) {
  console.log("sets:   " + Object.entries(sceneData.sets).map(([k, v]) => `${k} = ${v.join(",")}`).join("\n        "));
  for (const [k, s] of Object.entries(sceneData.scenes)) console.log(`${k.padEnd(10)} ${s.title ?? ""}`);
  process.exit(0);
}
const sceneNames =
  args.scenes === "all"
    ? Object.keys(sceneData.scenes)
    : args.scenes.split(",").flatMap((n) => sceneData.sets[n.trim()] ?? [n.trim()]).filter(Boolean);
for (const n of sceneNames) if (!sceneData.scenes[n]) die(`unknown scene "${n}". Try --list.`);

function sceneUrl(base, scene, skin) {
  const q = new URLSearchParams();
  const put = (obj) => {
    for (const [k, v] of Object.entries(obj ?? {})) {
      q.delete(k);
      // An array repeats the parameter (`"mod": [a, b]` is `?mod=a&mod=b`).
      if (v !== null) for (const x of [v].flat()) q.append(k, String(x));
    }
  };
  put(sceneData.defaults.query);
  put(scene.query);
  if (skin) q.set("skin", skin);
  for (const [k, v] of new URLSearchParams(args.query)) q.set(k, v);
  return `${base.replace(/\/?$/, "/")}?${q}`;
}

// ── git, builds, servers ────────────────────────────────────────────────────────────────────────────────────────────
const git = (...a) => execFileSync("git", a, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const tryGit = (...a) => {
  try {
    return git(...a);
  } catch {
    return null;
  }
};

function resolveRef(ref) {
  // `main` means the freshest main: origin/main if we have it (builders branch from it), else the local branch.
  const candidates = /^[0-9a-f]{7,40}$/.test(ref) || ref.includes("/") || ref === "HEAD" ? [ref] : [`origin/${ref}`, ref];
  for (const c of candidates) {
    const sha = tryGit("rev-parse", "--verify", "--quiet", `${c}^{commit}`);
    if (sha) return { ref: c, sha };
  }
  die(`can't resolve git ref "${ref}" (did you \`git fetch origin\`?)`);
}

function viteBuild(cwd, outDir, label) {
  const t = Date.now();
  // `vite build` only: `pnpm check` owns the typecheck, and this has to be fast.
  const r = spawnSync("pnpm", ["exec", "vite", "build", "--outDir", outDir, "--emptyOutDir", "--logLevel", "warn"], { cwd, encoding: "utf8" });
  if (r.status !== 0) die(`${label} build failed:\n${r.stdout}\n${r.stderr}`);
  log(`built ${label} in ${secs(t)}`);
}

const cacheDir = join(root, "shots", ".cache");
function buildBase(spec) {
  const key = spec.sha.slice(0, 12);
  const dist = join(cacheDir, key);
  if (!args.fresh && existsSync(join(dist, "index.html"))) {
    log(`base ${spec.ref}@${key}: cached build`);
    return dist;
  }
  // A temporary worktree of the base. It shares this checkout's node_modules when the lockfile is unchanged.
  const wt = mkdtempSync(join(tmpdir(), "flt-shots-"));
  const tree = join(wt, "tree");
  git("worktree", "add", "--detach", "--force", tree, spec.sha);
  cleanups.push(() => {
    tryGit("worktree", "remove", "--force", tree);
    rmSync(wt, { recursive: true, force: true });
  });
  const lock = (dir) => (existsSync(join(dir, "pnpm-lock.yaml")) ? createHash("sha1").update(readFileSync(join(dir, "pnpm-lock.yaml"))).digest("hex") : "");
  if (lock(tree) === lock(root) && existsSync(join(root, "node_modules"))) {
    symlinkSync(join(root, "node_modules"), join(tree, "node_modules"), "dir");
  } else {
    log("lockfile differs from base: installing its dependencies");
    const r = spawnSync("pnpm", ["install", "--frozen-lockfile", "--prefer-offline"], { cwd: tree, encoding: "utf8" });
    if (r.status !== 0) die(`pnpm install in the base worktree failed:\n${r.stderr}`);
  }
  viteBuild(tree, dist, `base ${spec.ref}@${key}`);
  return dist;
}

// One tiny static server per build (the game is a single page; `?page=` is a query, not a route).
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff", ".wasm": "application/wasm", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".glb": "model/gltf-binary", ".webp": "image/webp" };
async function serve(dir) {
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    let file = join(dir, path);
    if (!file.startsWith(dir) || !existsSync(file) || statSync(file).isDirectory()) file = join(dir, "index.html");
    res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
    res.end(readFileSync(file));
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  cleanups.push(() => server.close());
  return `http://127.0.0.1:${server.address().port}/`;
}

// ── capture ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const sides = [];
const headSha = tryGit("rev-parse", "--short=7", "HEAD") ?? "?";
const branch = tryGit("rev-parse", "--abbrev-ref", "HEAD") ?? "HEAD";
const dirty = !!tryGit("status", "--porcelain");
let baseSpec = null;
const wantBefore = !args["no-before"] && args.skin !== "all";

if (wantBefore) {
  if (args["before-url"]) sides.push({ side: "before", label: "before", url: args["before-url"] });
  else {
    baseSpec = resolveRef(args.base);
    const dist = buildBase(baseSpec);
    sides.push({ side: "before", label: `\`${args.base}\` @ ${baseSpec.sha.slice(0, 7)}`, url: await serve(dist) });
  }
}
if (args["after-url"]) sides.push({ side: "after", label: "after", url: args["after-url"] });
else if (args.head) {
  const spec = resolveRef(args.head);
  const dist = buildBase(spec);
  sides.push({ side: "after", label: `\`${args.head}\` @ ${spec.sha.slice(0, 7)}`, url: await serve(dist) });
} else {
  const dist = mkdtempSync(join(tmpdir(), "flt-shots-after-"));
  cleanups.push(() => rmSync(dist, { recursive: true, force: true }));
  viteBuild(root, dist, `this checkout (${branch}@${headSha}${dirty ? "+dirty" : ""})`);
  sides.push({ side: "after", label: `\`${branch}\` @ ${headSha}${dirty ? "+" : ""}`, url: await serve(dist) });
}
if (baseSpec && !args.head && !args["after-url"] && baseSpec.sha.startsWith(headSha) && !dirty) log("note: base and head are the same commit, so this is a build compared with itself (a noise check)");

let skins = [null];
if (args.skin === "all") {
  // Every dir under src/skins with a skin.json, on the "after" side's tree.
  skins = args.head
    ? git("ls-tree", "-r", "--name-only", resolveRef(args.head).sha, "src/skins/").split("\n").flatMap((f) => f.match(/^src\/skins\/([^/]+)\/skin\.json$/)?.[1] ?? [])
    : existsSync(join(root, "src", "skins")) ? readdirSync(join(root, "src", "skins")).filter((d) => existsSync(join(root, "src", "skins", d, "skin.json"))) : [];
  skins.sort();
  if (!skins.length) die("--skin all: no skins found (src/skins/*/skin.json). Is the skin system on this branch?");
} else if (args.skin) skins = [args.skin];

const out = resolve(root, args.out);
for (const d of ["before", "after", "compare"]) rmSync(join(out, d), { recursive: true, force: true });
for (const d of ["before", "after", "compare"]) mkdirSync(join(out, d), { recursive: true });

await getBrowser();
const errors = [];
const problems = []; // blank or failed outputs: they fail the run
const results = []; // { scene, skin, file, side, ok, error? }

async function runStep(page, step) {
  if ("wait" in step) return page.waitForTimeout(step.wait);
  if ("tick" in step) return page.evaluate((n) => { const f = window.__flt; for (let i = 0; i < n; i++) f.tick(f.sim.world); }, step.tick);
  if ("send" in step) return page.evaluate((e) => window.__flt.send(e), step.send);
  if ("eval" in step) return page.evaluate(async (src) => (0, eval)(src)(window.__flt, window.__flt.sim.world), step.eval);
  if ("click" in step) {
    try {
      return await page.click(step.click, { timeout: step.optional ? 1500 : 5000 });
    } catch (e) {
      if (!step.optional) throw e;
      return;
    }
  }
  if ("type" in step) {
    // FLT-63: type into a field (the Run box), then press Enter if asked.
    try {
      await page.fill(step.into, step.type, { timeout: step.optional ? 1500 : 5000 });
      if (step.enter) await page.press(step.into, "Enter");
    } catch (e) {
      if (!step.optional) throw e;
    }
    return;
  }
  if ("drag" in step) {
    // FLT-63: a real mouse drag across tiles [x, z] (the path tool laying a run). `hold` keeps the button down for the shot.
    const pts = await page.evaluate((tiles) => {
      const v = window.__fltProbe?.().view;
      const half = window.__flt.sim.world.grid.w / 2;
      if (!v?.rect || v.matrix.length !== 16) return null;
      const m = v.matrix;
      return tiles.map(([x, z]) => {
        const X = x + 0.5 - half, Z = z + 0.5 - half;
        const cx = m[0] * X + m[8] * Z + m[12], cy = m[1] * X + m[9] * Z + m[13], cw = m[3] * X + m[11] * Z + m[15];
        return [v.rect.left + ((cx / cw + 1) / 2) * v.rect.width, v.rect.top + ((1 - cy / cw) / 2) * v.rect.height];
      });
    }, step.drag);
    if (!pts?.length) throw new Error("drag: no camera to aim with (window.__fltProbe().view)");
    await page.mouse.move(pts[0][0], pts[0][1]);
    await page.mouse.down();
    for (const [x, y] of pts.slice(1)) await page.mouse.move(x, y, { steps: 6 });
    if (!step.hold) await page.mouse.up();
    return;
  }
  if ("select" in step) {
    const [kind, name] = step.select.split(":");
    const id = await page.evaluate(([kind, name]) => {
      const ws = window.__flt.sim.world.walkers.filter((x) => x.kind === kind);
      return (ws.find((x) => x.name === name) ?? ws.find((x) => x.machine?.value !== "inside") ?? ws[0])?.id ?? null;
    }, [kind, name]);
    if (id == null) throw new Error(`no ${kind} to select`);
    return page.evaluate((id) => window.__flt.send({ type: "SELECT", id }), id);
  }
  throw new Error(`unknown step ${JSON.stringify(step)}`);
}

// Wait in rendered frames, not milliseconds: SwiftShader draws about 6 fps, and the camera and the juice ease per frame,
// so "24 frames in" means the same thing on a slow builder and a fast one, and on both sides of a pair.
async function settleFrames(page, frames) {
  const start = await page.evaluate(() => window.__shotFrames);
  await page.waitForFunction(([s, n]) => window.__shotFrames >= s + n, [start, frames], { timeout: 120_000, polling: 100 });
}
// Let one-shot CSS animations and transitions (an event card sliding in) finish, then park the looping ones (the news
// ticker) at their first frame, so a DOM animation can't make two identical builds differ.
const calmDom = (page) =>
  page.evaluate(async () => {
    const finite = () => document.getAnimations().filter((a) => a.playState === "running" && a.effect?.getComputedTiming().iterations !== Infinity);
    const t = performance.now();
    while (finite().length && performance.now() - t < 4000) await new Promise((r) => setTimeout(r, 100));
    for (const a of document.getAnimations()) if (a.effect?.getComputedTiming().iterations === Infinity) (a.currentTime = 0), a.pause();
  });

async function capture(side, sceneName, skin) {
  const scene = sceneData.scenes[sceneName];
  const sk = side.side === "before" && args["skin-before"] !== undefined ? (args["skin-before"] === "none" ? null : args["skin-before"]) : skin;
  const [width, height] = (scene.viewport ?? sceneData.defaults.viewport).split("x").map(Number);
  const dsf = scene.dsf ?? (scene.mobile ? 2 : 1);
  const tag = `${side.side}/${sceneName}${skin ? `@${skin}` : ""}`;
  const file = join(out, side.side, `${sceneName}${skin ? `@${skin}` : ""}.png`);
  const t = Date.now();
  let error = "";
  // A blank frame gets one retry (a slow first WebGL context is the usual cause); anything else that throws does not.
  for (let attempt = 1; attempt <= 2; attempt++) {
    const ctx = await (await getBrowser()).newContext({ viewport: { width, height }, deviceScaleFactor: dsf, isMobile: !!scene.mobile, hasTouch: !!scene.mobile });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(`${tag}: ${e}`));
    page.on("console", (m) => m.type() === "error" && errors.push(`${tag}: ${m.text()}`));
    try {
      await page.addInitScript(() => {
        window.__shotFrames = 0;
        const tick = () => (window.__shotFrames++, requestAnimationFrame(tick));
        requestAnimationFrame(tick);
      });
      await page.goto(sceneUrl(side.url, scene, sk), { waitUntil: "networkidle" });
      await page.waitForFunction(() => window.__flt?.sim?.world, null, { timeout: 60_000 });
      const frames = Number(args.frames ?? scene.frames ?? sceneData.defaults.frames);
      await settleFrames(page, frames);
      for (const step of scene.steps ?? []) await runStep(page, step);
      if (scene.steps?.length) await settleFrames(page, Math.ceil(frames / 3));
      await calmDom(page);
      await page.evaluate(() => document.fonts.ready);
      const canvas = await page.evaluate(() => {
        const r = document.querySelector("canvas")?.getBoundingClientRect();
        return r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null;
      });
      // A 2x photo-mode frame is slow to read back on SwiftShader.
      await page.screenshot({ path: file, timeout: dsf > 1 ? 120_000 : 30_000 });
      // The guard: the whole frame and the 3D canvas must both have real content.
      if (!canvas || canvas.w * canvas.h < width * height * 0.25) throw Object.assign(new Error("no full-size <canvas> on the page"), { blank: true });
      const [whole, cv] = await analyze(file, [null, { x: canvas.x * dsf, y: canvas.y * dsf, w: canvas.w * dsf, h: canvas.h * dsf }]);
      if (isBlank(whole)) throw Object.assign(new Error(`blank screenshot (${describe(whole)})`), { blank: true });
      if (isBlank(cv)) throw Object.assign(new Error(`the 3D canvas is blank (${describe(cv)})`), { blank: true });
      results.push({ scene: sceneName, skin, side: side.side, file, ok: true });
      log(`${tag} ${secs(t)}`);
      await ctx.close();
      return;
    } catch (e) {
      error = String(e.message ?? e).split("\n")[0];
      log(`${tag} ${e.blank && attempt === 1 ? "came out blank, retrying once: " : "failed: "}${error}`);
      await ctx.close();
      if (!e.blank) break;
    }
  }
  results.push({ scene: sceneName, skin, side: side.side, file, ok: false, error });
  problems.push(`${tag}: ${error}`);
}

const tCap = Date.now();
for (const skin of skins) for (const name of sceneNames) for (const side of sides) await capture(side, name, skin);
log(`captured ${results.filter((r) => r.ok).length}/${results.length} shots in ${secs(tCap)}`);

// ── compare images: rendered by the same headless Chromium (no image library needed) ────────────────────────────────
const b64 = (f) => `data:image/png;base64,${readFileSync(f).toString("base64")}`;
const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
async function compose(panels, { title, mobile, width, footer, diff, outFile, gallery, dsf: sceneDsf }) {
  const dsf = sceneDsf ?? (mobile ? 2 : 1);
  const ctx = await (await getBrowser()).newContext({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: dsf });
  const page = await ctx.newPage();
  const pw = mobile ? 390 : Math.min(width, gallery ? 620 : 960);
  const html = `<!doctype html><meta charset=utf-8><style>
    body{margin:0;background:#12141a;font:600 15px/1.3 ui-sans-serif,system-ui,sans-serif;color:#e8eaf0}
    #sheet{display:inline-block;padding:18px}
    h1{margin:0 0 12px;font-size:17px;letter-spacing:.02em}
    .row{display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start;max-width:${panels.length > 3 ? (pw + 16) * 3 : 99999}px}
    figure{margin:0}
    figcaption{padding:0 0 6px;font-size:13px;opacity:.85}
    figcaption b{display:inline-block;padding:1px 8px;border-radius:99px;margin-right:6px;background:#2b3040}
    figure.before b{background:#5b3a3a}figure.after b{background:#2f5a3f}
    img,canvas{display:block;width:${pw}px;height:auto;border-radius:6px;outline:1px solid #2b3040}
    footer{margin-top:12px;font-size:12px;opacity:.7;font-weight:500}
  </style><div id=sheet><h1>${esc(title)}</h1><div class=row>${panels
    .map((p, i) => `<figure class="${p.kind}"><figcaption><b>${esc(p.kind === "diff" ? "DIFF" : p.kind.toUpperCase())}</b>${esc(p.label)}</figcaption>${p.kind === "diff" ? `<canvas id=diff></canvas>` : `<img id=i${i} src="${b64(p.file)}">`}</figure>`)
    .join("")}</div><footer id=foot>${esc(footer)}</footer></div>`;
  await page.setContent(html);
  // Wait for the fonts and decode every image before touching pixels (a composite of images that hadn't loaded is a blank).
  const undecoded = await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.allSettled([...document.images].map((i) => i.decode()));
    return [...document.images].filter((i) => !i.complete || i.naturalWidth === 0).length;
  });
  if (undecoded) throw new Error(`${undecoded} panel image(s) did not load`);
  // Pixel diff (before vs after): a pixel "differs" if its channels move by more than a small threshold.
  const stats = await page.evaluate((wantPanel) => {
    const [a, b] = [document.getElementById("i0"), document.getElementById("i1")];
    const size = (i) => `${i.naturalWidth}x${i.naturalHeight}`;
    if (!a || !b || size(a) !== size(b)) return null;
    const w = a.naturalWidth, h = a.naturalHeight;
    const read = (img) => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const g = c.getContext("2d");
      g.drawImage(img, 0, 0);
      return g.getImageData(0, 0, w, h);
    };
    const [da, db] = [read(a), read(b)];
    let changed = 0;
    const dc = wantPanel ? document.getElementById("diff") : null;
    const dg = dc?.getContext("2d");
    if (dc) (dc.width = w), (dc.height = h);
    const od = dg?.createImageData(w, h);
    // A pixel counts as changed only if nothing within one pixel of it in the other image is close: sub-pixel jitter from
    // idle animation is not a change, a moved label or a new colour is.
    const dist = (i, j) => Math.abs(da.data[i] - db.data[j]) + Math.abs(da.data[i + 1] - db.data[j + 1]) + Math.abs(da.data[i + 2] - db.data[j + 2]);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4;
        let best = dist(o, o);
        for (let dy = -1; dy <= 1 && best > 36; dy++) {
          for (let dx = -1; dx <= 1 && best > 36; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            best = Math.min(best, dist(o, (ny * w + nx) * 4), dist((ny * w + nx) * 4, o));
          }
        }
        const hit = best > 36;
        if (hit) changed++;
        if (od) {
          const g = ((db.data[o] + db.data[o + 1] + db.data[o + 2]) / 3) * 0.35;
          od.data[o] = hit ? 255 : g;
          od.data[o + 1] = hit ? 60 : g;
          od.data[o + 2] = hit ? 140 : g;
          od.data[o + 3] = 255;
        }
      }
    }
    if (od) dg.putImageData(od, 0, 0);
    return { changed: changed / (w * h), w, h };
  }, diff);
  if (stats) await page.evaluate((s) => (document.getElementById("foot").textContent += `  ·  ${(s.changed * 100).toFixed(2)}% of pixels differ`), stats);
  const panelRects = await page.evaluate(() => {
    const sheet = document.getElementById("sheet").getBoundingClientRect();
    return [...document.querySelectorAll("figure img, figure canvas")].map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x - sheet.x, y: r.y - sheet.y, w: r.width, h: r.height };
    });
  });
  await page.locator("#sheet").screenshot({ path: outFile });
  await ctx.close();
  // The guard: the composite as a whole and each panel inside it must have real content.
  const seen = await analyze(outFile, [null, ...panelRects.map((r) => ({ x: r.x * dsf, y: r.y * dsf, w: r.w * dsf, h: r.h * dsf }))]);
  const bad = seen.findIndex(isBlank);
  if (bad >= 0) throw new Error(`blank composite: ${bad === 0 ? "the image" : `panel ${bad}`} is ${describe(seen[bad])}`);
  return stats;
}

/** compose(), but a failure (a blank composite, an image that didn't load) is recorded as a problem instead of thrown. */
async function safeCompose(panels, opts) {
  try {
    return { stats: await compose(panels, opts) };
  } catch (e) {
    const error = String(e.message ?? e).split("\n")[0];
    problems.push(`${basename(opts.outFile)}: ${error}`);
    return { error };
  }
}

const NOISE = 0.005; // two builds of one commit differ by ~0.2% of pixels (idle 3D animation), so under 0.5% reads as "unchanged"
const rows = [];
const okFile = (scene, skin, side) => results.find((r) => r.scene === scene && r.skin === skin && r.side === side && r.ok)?.file;
const label = (side) => sides.find((s) => s.side === side)?.label ?? side;
if (args.skin === "all") {
  // Gallery: one image per scene, a panel per skin.
  for (const name of sceneNames) {
    const scene = sceneData.scenes[name];
    const panels = skins.flatMap((s) => (okFile(name, s, "after") ? [{ kind: "after", label: s, file: okFile(name, s, "after") }] : []));
    if (!panels.length) continue;
    const made = await safeCompose(panels, { outFile: join(out, "compare", `gallery-${name}.png`), title: `${scene.title ?? name}: every skin (${label("after")})`, mobile: scene.mobile, width: Number(scene.viewport?.split("x")[0] ?? 1440), footer: "pnpm shots --skin all", gallery: true, dsf: scene.dsf });
    rows.push({ scene: name, gallery: true, count: panels.length, error: made.error });
  }
} else {
  for (const skin of skins) {
    for (const name of sceneNames) {
      const scene = sceneData.scenes[name];
      const [bf, af] = [okFile(name, skin, "before"), okFile(name, skin, "after")];
      const row = { scene: name, skin, before: bf, after: af, title: scene.title };
      if (af && (bf || !wantBefore)) {
        const panels = [...(bf ? [{ kind: "before", label: label("before"), file: bf }] : []), { kind: "after", label: label("after"), file: af }];
        if (bf && args.diff) panels.push({ kind: "diff", label: "what changed", file: af });
        const file = join(out, "compare", `${name}${skin ? `@${skin}` : ""}.png`);
        const made = await safeCompose(panels, { outFile: file, title: `${name}${skin ? ` · skin ${skin}` : ""}: ${scene.title ?? ""}`, mobile: scene.mobile, width: Number(scene.viewport?.split("x")[0] ?? 1440), footer: `${sceneUrl("", scene, skin).replace(/^\//, "")}`, diff: args.diff, dsf: scene.dsf });
        row.compare = file;
        row.changed = made.stats?.changed ?? null;
        if (made.error) row.composeError = made.error;
      }
      const failed = results.filter((r) => r.scene === name && r.skin === skin && !r.ok);
      const errs = [...failed.map((f) => `${f.side}: ${f.error}`), ...(row.composeError ? [`compare: ${row.composeError}`] : [])];
      if (errs.length) row.error = errs.join("; ");
      rows.push(row);
    }
  }
}

// ── report ──────────────────────────────────────────────────────────────────────────────────────────────────────────
const repoUrl = (tryGit("remote", "get-url", "origin") ?? "").replace(/\/\/[^@/]*@/, "//").replace(/\.git$/, "").replace(/^git@github\.com:/, "https://github.com/");
const relOut = relative(root, out).split("\\").join("/");
const ignored = spawnSync("git", ["check-ignore", "-q", join(relOut, "x.png")], { cwd: root }).status === 0;
const inRepo = !relOut.startsWith("..");
const img = (f) => (f ? `![${basename(f, ".png")}](${inRepo ? `${repoUrl}/blob/${branch}/${relOut}/${relative(out, f).split("\\").join("/")}?raw=true` : f})` : "_n/a_");
let md = "";
if (args.skin === "all") {
  md += `| Scene | Gallery (${skins.length} skins) |\n|---|---|\n`;
  for (const r of rows) md += `| ${r.scene}${r.error ? `<br>⚠ ${r.error}` : ""} | ${img(join(out, "compare", `gallery-${r.scene}.png`))} |\n`;
} else if (wantBefore) {
  md += `| Scene | Before (${label("before")}) | After (${label("after")}) |\n|---|---|---|\n`;
  for (const r of rows) {
    const name = `**${r.scene}**${r.skin ? ` (${r.skin})` : ""}${r.changed != null ? `<br>${r.changed < NOISE ? `≈ unchanged (${(r.changed * 100).toFixed(2)}% px)` : `${(r.changed * 100).toFixed(1)}% px differ`}` : ""}${r.error ? `<br>⚠ ${r.error}` : ""}`;
    md += `| ${name} | ${img(r.before)} | ${img(r.after)} |\n`;
  }
} else {
  md += `| Scene | After (${label("after")}) |\n|---|---|\n`;
  for (const r of rows) md += `| **${r.scene}**${r.skin ? ` (${r.skin})` : ""}${r.error ? `<br>⚠ ${r.error}` : ""} | ${img(r.after)} |\n`;
}
const total = secs();
const okCount = results.filter((r) => r.ok).length;
const summary = `_pnpm shots: ${sceneNames.length} scene(s)${skins[0] ? `, ${skins.length} skin(s)` : ""} in ${total} (${okCount}/${results.length} captures ok${problems.length ? `, ${problems.length} PROBLEM(S)` : ""})._`;
const banner = problems.length ? `\n> **⚠ ${problems.length} blank or failed output(s), do not use these as evidence:**\n${problems.map((p) => `> - ${p}`).join("\n")}\n` : "";
writeFileSync(join(out, "report.md"), `${banner}\n${md}\n${summary}\n`);
writeFileSync(join(out, "report.json"), JSON.stringify({ base: baseSpec, head: { branch, sha: headSha, dirty }, seconds: (Date.now() - t0) / 1000, problems, rows, errors: [...new Set(errors)] }, null, 2));
console.log(`\n${md}\n${summary}`);
console.log(`\nfiles: ${relOut}/{before,after,compare}/  ·  report: ${relOut}/report.md`);
if (ignored) console.log(`note: ${relOut}/ is gitignored, so those image links only work once the files are committed. For a PR, write somewhere committable: pnpm shots --out docs/img/<task>`);
if (errors.length) console.log(`\npage errors (${new Set(errors).size} distinct):\n  ${[...new Set(errors)].slice(0, 10).join("\n  ")}`);
cleanup();
if (problems.length) {
  console.error(`\n✖✖✖ pnpm shots FAILED: ${problems.length} blank or failed output(s). These are not evidence:\n${problems.map((p) => `  - ${p}`).join("\n")}\n`);
  process.exit(1);
}
process.exit(0);

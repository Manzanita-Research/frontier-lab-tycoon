#!/usr/bin/env node
// FLT-88: look at the glass (the CRT over the UI through HTML-in-canvas) in a Chrome that has the API, headless.
//
//   node scripts/glass-probe.mjs --chrome /path/to/chrome-headless-shell --url "http://localhost:4173/?crt=subtle" \
//     --out docs/img/flt-88/x.png [--flag] [--size 1440x900] [--frames 120] [--clicks]
//
// --flag launches with --enable-blink-features=CanvasDrawElement (what chrome://flags/#canvas-draw-element turns on).
// Prints what the page detected, `window.__glass` (per-frame costs), rAF frame times, and with --clicks where clicks
// on the Frontier 95 taskbar land. SwiftShader (no GPU): absolute numbers are a CPU rasterizer's, compare ratios.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const argv = process.argv.slice(2);
const opt = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const has = (k) => argv.includes(`--${k}`);
const [width, height] = opt("size", "1440x900").split("x").map(Number);
const args = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];
if (has("flag")) args.push("--enable-blink-features=CanvasDrawElement");
const browser = await chromium.launch({
  executablePath: opt("chrome", undefined),
  args,
});
const page = await browser.newPage({
  viewport: { width, height },
  deviceScaleFactor: Number(opt("dsf", "1")),
});
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(opt("url", "http://localhost:4173/"), {
  waitUntil: "networkidle",
});
// Let it settle, then time frames.
await page.waitForTimeout(Number(opt("settle", "4000")));
const frames = Number(opt("frames", "90"));
const timing = await page.evaluate(
  (n) =>
    new Promise((done) => {
      const ts = [];
      const step = (t) => {
        ts.push(t);
        if (ts.length > n) {
          const d = ts
            .slice(1)
            .map((t, i) => t - ts[i])
            .sort((a, b) => a - b);
          done({
            frames: d.length,
            meanMs: d.reduce((a, b) => a + b, 0) / d.length,
            p50: d[d.length >> 1],
            p95: d[Math.floor(d.length * 0.95)],
          });
        } else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }),
  frames,
);
const report = await page.evaluate(() => {
  const g = window.__glass;
  return {
    ua: navigator.userAgent.match(/Chrome\/[\d.]+/)?.[0],
    glassCanvas: !!document.querySelector("canvas.crt-glass"),
    crtAttr: document.documentElement.dataset.crt ?? null,
    glass: g
      ? {
          api: g.api,
          frames: g.frames,
          hudUploads: g.hudUploads,
          skyUploads: g.skyUploads,
          size: g.size,
          ms: {
            hud: +g.hud.ms.toFixed(2),
            sky: +g.sky.ms.toFixed(2),
            world: +g.world.ms.toFixed(2),
            draw: +g.draw.ms.toFixed(2),
            total: +g.total.ms.toFixed(2),
          },
          errors: g.errors,
        }
      : null,
  };
});
console.log(JSON.stringify({ ...report, raf: timing }, null, 1));

if (has("clicks")) {
  // Where does a click land? Aim at elements by their layout box (what the DOM thinks) and report what was hit.
  const targets = await page.evaluate(() => {
    const pick = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        sel,
        x: r.left + r.width / 2,
        y: r.top + r.height / 2,
        w: r.width,
        h: r.height,
      };
    };
    return [".f95-start", ".f95-taskbar .f95-clock", ".f95-tray", ".f95-window .f95-title"].map(pick).filter(Boolean);
  });
  for (const t of targets) {
    const hit = await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      return el ? `${el.tagName.toLowerCase()}.${[...el.classList].join(".")}` : null;
    }, t);
    console.log(
      `click ${t.sel} at (${t.x.toFixed(0)},${t.y.toFixed(0)}) [${t.w.toFixed(0)}x${t.h.toFixed(0)}] -> elementFromPoint: ${hit}`,
    );
  }
}
if (has("hits")) {
  // The honest test: for every visible button, find where the glass *shows* its centre (the bow moves it, see
  // looks.ts `unwarp`) and ask the DOM what is under that point. A miss means a player clicking what they see
  // would hit something else (or nothing).
  const curve = Number(opt("curve", "0.012"));
  const res = await page.evaluate((c) => {
    const unwarp = (x, y) => {
      let dx = x,
        dy = y;
      for (let i = 0; i < 4; i++) {
        const nx = x / (1 + c * dy * dy),
          ny = y / (1 + c * dx * dx);
        dx = nx;
        dy = ny;
      }
      return [dx, dy];
    };
    const W = innerWidth,
      H = innerHeight;
    const rows = [];
    for (const el of document.querySelectorAll("button, [role=button], a[href], input, .f95-clock")) {
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4 || r.right < 0 || r.bottom < 0 || r.left > W || r.top > H) continue;
      const cx = r.left + r.width / 2,
        cy = r.top + r.height / 2;
      if (document.elementFromPoint(cx, cy) && !el.contains(document.elementFromPoint(cx, cy))) continue; // covered anyway
      const [sx, sy] = unwarp((cx / W) * 2 - 1, (cy / H) * 2 - 1);
      const vx = ((sx + 1) / 2) * W,
        vy = ((sy + 1) / 2) * H;
      const hit = document.elementFromPoint(vx, vy);
      rows.push({
        name: (el.getAttribute("aria-label") || el.title || el.textContent || el.className || el.tagName)
          .trim()
          .slice(0, 28),
        w: Math.round(r.width),
        h: Math.round(r.height),
        off: Math.hypot(vx - cx, vy - cy),
        ok: !!hit && el.contains(hit),
      });
    }
    return rows;
  }, curve);
  const miss = res.filter((r) => !r.ok);
  const maxOff = Math.max(...res.map((r) => r.off));
  console.log(
    `hits (curve ${curve}): ${res.length - miss.length}/${res.length} visible controls hit at their shown centre; largest shift ${maxOff.toFixed(1)}px`,
  );
  for (const m of miss) console.log(`  MISS ${m.name} (${m.w}x${m.h}) shifted ${m.off.toFixed(1)}px`);
}
const press = opt("press", null);
if (press) {
  // A real mouse click where the glass shows the element's centre (`--press ".f95-start"`), then a hover over it.
  const curve = Number(opt("curve", "0.012"));
  const at = await page.evaluate(
    ({ sel, c }) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const x = ((r.left + r.width / 2) / innerWidth) * 2 - 1;
      const y = ((r.top + r.height / 2) / innerHeight) * 2 - 1;
      let dx = x, dy = y;
      for (let i = 0; i < 4; i++) [dx, dy] = [x / (1 + c * dy * dy), y / (1 + c * dx * dx)];
      window.__pressed = [];
      el.addEventListener("click", () => window.__pressed.push("click"), { once: true });
      el.addEventListener("pointerover", () => window.__pressed.push("pointerover"), { once: true });
      return [((dx + 1) / 2) * innerWidth, ((dy + 1) / 2) * innerHeight];
    },
    { sel: press, c: curve },
  );
  if (!at) console.log(`press: ${press} not found`);
  else {
    await page.mouse.move(at[0], at[1]);
    await page.waitForTimeout(300);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(Number(opt("after", "800")));
    console.log(`press ${press} at shown (${at[0].toFixed(0)},${at[1].toFixed(0)}):`, await page.evaluate(() => window.__pressed.join(",")));
  }
}
const out = opt("out", null);
if (out) {
  mkdirSync(dirname(out), { recursive: true });
  await page.screenshot({ path: out });
  console.log(`saved ${out}`);
}
if (errors.length) console.log(`page errors (${errors.length}):\n  ${errors.slice(0, 8).join("\n  ")}`);
await browser.close();

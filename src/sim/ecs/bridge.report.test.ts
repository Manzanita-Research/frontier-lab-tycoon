// FLT-75: the R3F bridge, measured. `FLT75_BRIDGE=1 npx vitest run src/sim/ecs/bridge.report.test.ts --silent=false`.
// What a frame of `Walkers.tsx` reads (no three.js: the matrix work is the same either way), four ways, on the busy lab;
// then what `useTrait` per protester would cost, modelled the way koota/react subscribes (one world.onChange listener
// per component, filtering for its own entity). Node has no DOM here, so a "render" is counted, not drawn.
import { busyLab } from "../perf/busyLab";
import { Body, ecs, ground, OnLab, people } from "./protesters";
import type { Walker } from "../types";

const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};

/** The fields a frame reads per walker; returns a sum so nothing is optimised away. */
const readWalker = (w: Walker) => w.id + w.x + w.z + w.px + w.pz + w.dir + w.route.length + (w.machine.value === "inside" ? 1 : 0);

function time(label: string, frames: number, frame: () => number) {
  for (let i = 0; i < 200; i++) frame();
  let best = Infinity;
  let sink = 0;
  for (let r = 0; r < 5; r++) {
    const t0 = performance.now();
    for (let i = 0; i < frames; i++) sink += frame();
    best = Math.min(best, ((performance.now() - t0) / frames) * 1000);
  }
  return { label, us: best, sink };
}

describe.skipIf(!env.FLT75_BRIDGE)("FLT-75: the R3F bridge", () => {
  it("reads a frame four ways, and counts what useTrait would cost", () => {
    const lab = busyLab();
    for (let i = 0; i < 300; i++) lab.play();
    const s = lab.s;
    const g = ground(s);
    const crowd = g.size;
    const rows: ReturnType<typeof time>[] = [];
    // main's own number (every walker, protesters included, in state.walkers) comes from the same loop run on main.
    rows.push(time("the other walkers alone (state.walkers, no protesters)", 2000, () => { let t = 0; for (const w of s.walkers) t += readWalker(w); return t; }));
    rows.push(time("branch today: for (w of people(sim)), protesters through view getters", 2000, () => { let t = 0; for (const w of people(s)) t += readWalker(w); return t; }));
    rows.push(time("Koota direct: state.walkers, then the protesters' SoA stores (query.useStores)", 2000, () => {
      let t = 0;
      for (const w of s.walkers) t += readWalker(w);
      ecs.query(OnLab(g.lab), Body).useStores(([b], entities) => {
        for (const e of entities) { const i = e & 0xfffff; t += b.id[i]! + b.x[i]! + b.z[i]! + b.px[i]! + b.pz[i]! + b.dir[i]!; }
      });
      return t;
    }));
    rows.push(time("Koota readEach: state.walkers, then a snapshot object per protester", 2000, () => {
      let t = 0;
      for (const w of s.walkers) t += readWalker(w);
      ecs.query(OnLab(g.lab), Body).readEach(([b]) => { t += b.id + b.x + b.z + b.px + b.pz + b.dir; });
      return t;
    }));

    // useTrait(entity, Body) in one <Protester> per entity: koota/react adds world.onChange(Body) (+ onAdd, onRemove)
    // per component. The sim's systems write untracked, so first: does a tick ever tell React?
    let renders = 0;
    let moves = 0;
    let calls = 0;
    const entities = [...ecs.query(OnLab(g.lab), Body)];
    const subs = entities.flatMap((mine) => [
      ecs.onChange(Body, (e) => { calls++; if (e === mine) { renders++; moves++; } }),
      ecs.onAdd(Body, (e) => { calls++; if (e === mine) renders++; }),
      ecs.onRemove(Body, (e) => { calls++; if (e === mine) renders++; }),
    ]);
    const x0 = entities.map((e) => e.get(Body)!.x);
    for (let i = 0; i < 20; i++) lab.play();
    const moved = entities.filter((e, i) => e.isAlive() && e.get(Body)!.x !== x0[i]).length;
    const staleMoves = moves;
    const leaveRenders = renders - moves;
    // Now the tracked version (what the march would have to do for useTrait to see it): a tracked write per protester.
    renders = 0;
    calls = 0;
    const live = [...ecs.query(OnLab(g.lab), Body)];
    const t0 = performance.now();
    for (let k = 0; k < 20; k++) ecs.query(OnLab(g.lab), Body).updateEach(([b]) => { b.px = b.x; b.x += 1e-9; });
    const trackedUs = ((performance.now() - t0) / 20) * 1000;
    const t1 = performance.now();
    for (let k = 0; k < 20; k++) ecs.query(OnLab(g.lab), Body).updateEach(([b]) => { b.px = b.x; b.x += 1e-9; }, { changeDetection: "never" });
    const untrackedUs = ((performance.now() - t1) / 20) * 1000;
    const trackedRenders = renders / 20;
    const trackedCalls = calls / 20;
    for (const u of subs) u();

    console.log(
      `${people(s).length} people, ${crowd} of them protesters (Koota), ${entities.length} <Protester> components subscribed with useTrait\n\n` +
        `| Per frame (read loop only) | µs |\n|---|---:|\n` +
        rows.map((r) => `| ${r.label} | ${r.us.toFixed(1)} |`).join("\n") +
        `\n\n| useTrait(entity, Body) on every protester | value |\n|---|---:|\n` +
        `| protesters that moved over 20 real ticks | ${moved} |\n` +
        `| change renders for those moves (the sim writes untracked: useTrait goes stale) | ${staleMoves} |\n` +
        `| renders from protesters leaving (onRemove still fires) | ${leaveRenders} |\n` +
        `| renders per tick if the march wrote tracked | ${trackedRenders} |\n` +
        `| listener calls per tick (each of ${entities.length} components hears all ${live.length} changes) | ${trackedCalls} |\n` +
        `| tracked write of ${live.length} bodies, with those listeners | ${trackedUs.toFixed(1)} µs |\n` +
        `| the same write untracked | ${untrackedUs.toFixed(1)} µs |`,
    );
    expect(moved).toBeGreaterThan(0);
    expect(staleMoves).toBe(0);
    expect(trackedRenders).toBe(live.length);
    expect(trackedCalls).toBe(entities.length * live.length); // n components x n changes: quadratic
  }, 120_000);
});

// Debug scenes for Operations (`?moment=ops|queue|slop`): the game is staged a moment before something is worth a
// screenshot, so a link or a script lands right on it. Pure sim, deterministic, like sim/race/demo.ts; the game itself
// never uses it.
import { applyNow, tick } from "./tick";
import { addNews } from "./news";
import { createRng } from "./rng";
import { seedWalkers } from "./walkers";
import type { GameState } from "./types";

export const OPS_MOMENTS = ["ops", "queue", "slop"] as const;
export type OpsMoment = (typeof OPS_MOMENTS)[number];
export const isOpsMoment = (s: string | null | undefined): s is OpsMoment => !!s && (OPS_MOMENTS as readonly string[]).includes(s);

/** Slop over the paths near the middle of the campus: deeper toward the spine, thinner at the edges. */
function slopTheCampus(s: GameState, share: number) {
  const w = s.grid.w;
  let n = 0;
  for (let i = 0; i < s.grid.paths.length; i++) {
    if (!s.grid.paths[i]) continue;
    // A stable scatter, so the scene is the same every time.
    const h = ((i * 2654435761) >>> 0) / 4294967296;
    if (h > share) continue;
    const dist = Math.abs((i % w) - 11) + Math.abs(Math.floor(i / w) - 16);
    s.slop[i] = dist < 5 ? 3 : dist < 9 ? 2 : 1;
    n++;
  }
  s.flags.slopRev = (s.flags.slopRev ?? 0) + n;
}

/** Put a staffer somewhere in the World, without the walk there. */
function place(s: GameState, id: number, x: number, z: number) {
  const o = s.staff.find((q) => q.id === id)!;
  o.x = o.px = x;
  o.z = o.pz = z;
  o.route = [];
  o.machine = { value: "idle", context: {} };
  o.timer = 0;
}

export function stageOps(s: GameState, moment: OpsMoment) {
  switch (moment) {
    case "ops": {
      // A path ankle-deep in glittering slop, a lone Janitor Bot mopping, and a Compute Cluster on fire with an SRE jogging toward it.
      s.cash = 12_000_000;
      s.vibes.value = 610;
      // A quiet morning on the campus: a third of the crowd, so the two people doing the work can be seen doing it.
      s.walkers = s.walkers.filter((w, i) => (w.kind === "agent" && i % 2 === 0) || i % 5 === 0);
      s.thoughts = [];
      slopTheCampus(s, 0.85);
      applyNow(s, [{ type: "hire", job: "janitor" }, { type: "hire", job: "sre" }]);
      const [bot, sre] = s.staff;
      place(s, bot!.id, 8.5, 16.5);
      place(s, sre!.id, 11.5, 16.5);
      const cluster = s.buildings.find((b) => b.kind === "cluster")!;
      cluster.broken = true;
      cluster.reliability = 0.4;
      cluster.brokenTick = s.tick;
      s.version++;
      s.news = [];
      addNews(s, "GPU fire contained; GPUs less so.", "bad");
      addNews(s, "Status page: all systems operational.", "joke");
      // A few ticks so the SRE is mid-jog and the Janitor Bot has picked a puddle.
      for (let i = 0; i < 9; i++) tick(s);
      s.toasts = [];
      return;
    }
    case "queue": {
      // The Snack Wall and the Kombucha Bar are full, and the line down the spine is a good deal longer than the bar.
      s.cash = 12_000_000;
      const bar = s.buildings.find((b) => b.kind === "kombucha")!;
      s.walkers = s.walkers.filter((w, i) => w.kind === "researcher" || i % 5 === 0);
      s.thoughts = [];
      for (let i = 0; i < 6; i++) seedWalkers(s, "researcher", 1, createRng(11 + i));
      const rs = s.walkers.filter((w) => w.kind === "researcher");
      for (let i = 0; i < 16; i++) {
        const w = rs[i];
        if (!w) break;
        Object.assign(w, { x: 11.5, z: 19.5, px: 11.5, pz: 19.5, route: [], targetId: bar.id, timer: 500, energy: 0.2, focus: 0.3, fomo: 0.1 });
        w.machine = { value: "seeking", context: {} };
      }
      for (let i = 0; i < 16; i++) tick(s);
      for (const w of s.walkers) if (w.machine.value === "queuing") w.timer = 400;
      s.toasts = [];
      return;
    }
    case "slop":
      s.cash = 12_000_000;
      slopTheCampus(s, 0.95);
      s.toasts = [];
      return;
  }
}

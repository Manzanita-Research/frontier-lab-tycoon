// URL knobs for screenshots and stress tests, e.g. /?seed=3&warp=25&zoom=70&focus=12,14&agents=200&discourse=44&researchers=20&hour=22&photo&moment=shuffle
// and, for disasters (FLT-17): /?disaster=rogueSwarm&dz=14&dzPick=0&risk=chaos
export interface DebugParams {
  seed: number;
  /** Simulate this many game days before the first frame. */
  warp: number;
  speed: number | null;
  zoom: number | null;
  focus: [number, number] | null;
  /** Extra agents on top of the capability-driven count. */
  agents: number;
  /** Start with this much water discourse (and the protesters that come with it). */
  discourse: number;
  /** Pin the campus clock to this hour (0 to 24): `?hour=22` is night, `?hour=18` golden hour. */
  hour: number | null;
  /** Open in photo mode. */
  photo: boolean;
  /** Stage a moment for a link or a screenshot: a race one (shuffle, era, era3, auction, funding: sim/race/demo.ts) an operations one (ops, queue, slop: sim/opsDemo.ts), or a Release Leapfrog one (shipnow, pair, stream[:mishap], solved: sim/race/leapfrog/demo.ts). */
  moment: string | null;
  /** Extra researchers on top of the hall-driven count (for Thoughts-panel and queue screenshots). */
  researchers: number;
  /** Trigger this disaster (`rogueSwarm`, `gpuFire`, `weightsLeak`; see mods/base-disasters) once the lab has loaded. */
  disaster: string | null;
  /** With `disaster`: run this many ticks after it starts. Cards stay open unless `dzPick` answers them. */
  dz: number;
  dzPick: number | null;
  /** The random-disaster setting: off, rare (the game's default), normal or chaos. */
  risk: string | null;
  /** Release Leapfrog (FLT-27) is on unless `?leapfrog=off`. */
  leapfrog: boolean;
  /** Publishing Papers is on unless ?papers=off. */
  papers: boolean;
  /**
   * Preview a rung of the Playable v1 ladder without playing to it (screenshots, skins): `?debug=1&ladder=1` is level 1,
   * `&coach=0` puts the first of the seven coach lines up, `&unlock` the "New!" card. Only with `debug`.
   */
  ladder: { level: 1 | 2 | 3 | 4 | 5; coach: number | null; unlock: boolean } | null;
}

export function readDebugParams(search = typeof window === "undefined" ? "" : window.location.search): DebugParams {
  const q = new URLSearchParams(search);
  const num = (k: string) => (q.has(k) && Number.isFinite(Number(q.get(k))) ? Number(q.get(k)) : null);
  const focus = q.get("focus")?.split(",").map(Number);
  return {
    seed: num("seed") ?? 1,
    warp: num("warp") ?? 0,
    speed: num("speed"),
    zoom: num("zoom"),
    focus: focus && focus.length === 2 && focus.every(Number.isFinite) ? [focus[0]!, focus[1]!] : null,
    agents: num("agents") ?? 0,
    discourse: num("discourse") ?? 0,
    hour: num("hour"),
    photo: q.has("photo"),
    moment: q.get("moment"),
    researchers: num("researchers") ?? 0,
    disaster: q.get("disaster"),
    dz: num("dz") ?? 0,
    dzPick: num("dzPick"),
    risk: q.get("risk"),
    leapfrog: q.get("leapfrog") !== "off",
    papers: q.get("papers") !== "off",
    ladder: q.has("debug") && num("ladder") !== null && num("ladder")! >= 1 && num("ladder")! <= 5 ? { level: Math.round(num("ladder")!) as 1 | 2 | 3 | 4 | 5, coach: num("coach"), unlock: q.has("unlock") } : null,
  };
}

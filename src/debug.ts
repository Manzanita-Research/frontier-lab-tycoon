// URL knobs for screenshots and stress tests, e.g. /?seed=3&warp=25&zoom=70&focus=12,14&agents=200&discourse=44
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
  };
}

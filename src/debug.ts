// URL knobs for screenshots and stress tests, e.g. /?seed=3&warp=25&zoom=70&focus=12,14&agents=200&discourse=44&researchers=20&hour=22&photo&moment=shuffle
// and, for disasters (FLT-17): /?disaster=rogueSwarm&dz=14&dzPick=0&risk=chaos
import { dailySeed, dateKey } from "./sim/daily";

export interface DebugParams {
  seed: number;
  /** `?seed=daily`: Today's lab, the date key its seed came from (the player's local date). */
  daily: string | null;
  /** The endings (FLT-11) are on unless `?endings=off`. */
  endings: boolean;
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
  /** Stage a moment for a link or a screenshot: a race one (shuffle, era, era3, auction, funding: sim/race/demo.ts) an operations one (ops, queue, slop: sim/opsDemo.ts), a Release Leapfrog one (shipnow, pair, stream[:mishap], solved: sim/race/leapfrog/demo.ts), a Circus one (hearing, hearing-verdict, yacht-invite, yacht-leak: sim/circus/demo.ts) or a drama one (defection-chat, defection-card, defection-exit, defection-manifesto, defection-arena, poach-offer: sim/defection/demo.ts) or a Senate one (bill, bill-law, bill-exposed, vote, rollcall: sim/capture/demo.ts) or a discourse one (factions, counterprotest, argue: sim/factions/demo.ts). */
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
  /** Collusion (FLT-45) wakes with its rung unless ?collusion=off. */
  collusion: boolean;
  /** The Hearing (FLT-21) and the yacht summit (FLT-24) wake at Level 5 unless `?hearing=off` / `?yacht=off`. */
  hearing: boolean;
  yacht: boolean;
  /** Defection (FLT-26) and the Poaching War (FLT-20) wake at Level 5 (or at once in a debug world, which has no ladder) unless `?defection=off` / `?poaching=off`. */
  defection: boolean;
  poaching: boolean;
  /** Evals Without Borders (FLT-19) wakes at Level 5 and visits from Era 2, unless ?auditors=off. */
  auditors: boolean;
  /** Regulatory Capture (FLT-22) and the Promise Tracker (FLT-23) wake at Level 5 too, unless `?capture=off` / `?promises=off`. */
  capture: boolean;
  promises: boolean;
  /** Factions (FLT-33) are on unless `?factions=off`. */
  factions: boolean;
  /** The Water Discourse escalation (FLT-25) runs unless `?water=off` (the plain water crowd stays). */
  water: boolean;
  /**
   * Preview a rung of the Playable v1 ladder without playing to it (screenshots, skins): `?debug=1&ladder=1` is level 1,
   * `&coach=0` puts the first of the seven coach lines up, `&unlock` the "New!" card. Only with `debug`.
   */
  ladder: { level: 1 | 2 | 3 | 4 | 5; coach: number | null; unlock: boolean } | null;
}

/** Today's date key on the player's clock ("2026-09-30"), for Today's lab. */
export function todayKey(now = new Date()): string {
  return dateKey(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function readDebugParams(search = typeof window === "undefined" ? "" : window.location.search): DebugParams {
  const q = new URLSearchParams(search);
  const num = (k: string) => (q.has(k) && Number.isFinite(Number(q.get(k))) ? Number(q.get(k)) : null);
  const focus = q.get("focus")?.split(",").map(Number);
  // `&date=2026-09-30` pins the day (screenshots, or yesterday's lab).
  const daily = q.get("seed") === "daily" ? (/^\d{4}-\d\d-\d\d$/.test(q.get("date") ?? "") ? q.get("date")! : todayKey()) : null;
  return {
    seed: daily ? dailySeed(daily) : num("seed") ?? 1,
    daily,
    endings: q.get("endings") !== "off",
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
    collusion: q.get("collusion") !== "off",
    hearing: q.get("hearing") !== "off",
    yacht: q.get("yacht") !== "off",
    defection: q.get("defection") !== "off",
    poaching: q.get("poaching") !== "off",
    auditors: q.get("auditors") !== "off",
    capture: q.get("capture") !== "off",
    promises: q.get("promises") !== "off",
    factions: q.get("factions") !== "off",
    water: q.get("water") !== "off",
    ladder: q.has("debug") && num("ladder") !== null && num("ladder")! >= 1 && num("ladder")! <= 5 ? { level: Math.round(num("ladder")!) as 1 | 2 | 3 | 4 | 5, coach: num("coach"), unlock: q.has("unlock") } : null,
  };
}

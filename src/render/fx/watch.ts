// The juice layer's eyes on the sim. Every frame it compares the World to what it saw last frame and reports what
// changed as FxEvents (a model shipped, a card opened, something was built or bulldozed, a gateway got paid).
// Read-only: it never writes to the World, and there is no new sim event to wire up. The first poll of a World
// (page load, `?warp=`, a new lab) only records the baseline, so nothing fires for what was already there.
import type { BuildingKind } from "../../content/buildings";
import { openEventOf } from "../../sim/events";
import type { Building, GameState } from "../../sim/types";
import { rectCenter, worldX, worldZ } from "./../coords";

export type FxEvent =
  /** A model shipped. x, z are scene coordinates of the Training Hall (or the gate if there isn't one). */
  | { type: "release"; x: number; z: number; count: number }
  /** An event card opened / closed. */
  | { type: "incident"; id: string; x: number; z: number }
  | { type: "incidentClosed" }
  | { type: "placed"; kind: BuildingKind; x: number; z: number; w: number; d: number }
  | { type: "removed"; kind: BuildingKind; x: number; z: number; w: number; d: number }
  | { type: "path"; x: number; z: number; added: boolean }
  /** A gateway got paid. */
  | { type: "earned"; amount: number; x: number; z: number }
  /** The weekly Arena update moved you: `from` and `to` are places (1 is the top). */
  | { type: "rank"; from: number; to: number; x: number; z: number }
  /** A disaster asked for the camera (FLT-17), in scene coordinates; `hold` is seconds. */
  | { type: "focus"; x: number; z: number; zoom: number; hold: number | null }
  /** A disaster shook the screen. */
  | { type: "shake"; strength: number }
  /** A disaster asked for a sound cue (an SFX name from audio/score.ts). */
  | { type: "cue"; cue: string }
  /** FLT-56: a camera beat (letterbox, caption, a slow shot), in scene coordinates; `follow` are walker ids to track. */
  | { type: "beat"; beat: string; caption: string; sub: string; x: number; z: number; zoom: number; hold: number; follow: number[] }
  /**
   * The Sandbox Escape (FLT-59), in scene coordinates: an agent bolts for the fence (`walker` for the camera to follow),
   * the hand picks it up, a guard tackles it, the hand puts it down, or it clears the fence.
   */
  | { type: "escape"; beat: "bolt" | "grab" | "tackle" | "drop" | "out"; walker: number; x: number; z: number }
  /** A different World (new lab): forget everything. */
  | { type: "reset" };

export interface Watch {
  poll(world: GameState): FxEvent[];
}

const NONE: FxEvent[] = [];

export function createWatch(): Watch {
  let seen: GameState | null = null;
  let models = 0;
  let card: string | null = null;
  let rank = 0;
  let version = -1;
  let popId = 0;
  let cueId = 0;
  let paths = new Uint8Array(0);
  let buildings = new Map<number, Building>();
  /** Each runner's last phase, where it was and where the hand is taking it (tiles), by walker id. */
  let runners = new Map<number, Seen>();

  const baseline = (w: GameState) => {
    seen = w;
    models = w.models.length;
    card = openEventOf(w)?.id ?? null;
    rank = w.race.rank;
    version = w.version;
    popId = w.pops.reduce((m, p) => Math.max(m, p.id), 0);
    cueId = w.disasters.cues.reduce((m, c) => Math.max(m, c.id), 0);
    paths = Uint8Array.from(w.grid.paths, (p) => (p ? 1 : 0));
    buildings = new Map(w.buildings.map((b) => [b.id, b]));
    runners = runnersOf(w);
  };

  return {
    poll(w) {
      if (w !== seen) {
        const first = seen === null;
        baseline(w);
        return first ? NONE : [{ type: "reset" }];
      }
      const out: FxEvent[] = [];

      if (w.models.length !== models) {
        if (w.models.length > models) {
          const hall = w.buildings.find((b) => b.kind === "hall");
          const [x, z] = hall ? rectCenter(hall) : rectCenter(w.gate);
          out.push({ type: "release", x, z, count: w.models.length - models });
        }
        models = w.models.length;
      }

      if (w.race.rank !== rank) {
        const hall = w.buildings.find((b) => b.kind === "hall");
        const [x, z] = hall ? rectCenter(hall) : rectCenter(w.gate);
        out.push({ type: "rank", from: rank, to: w.race.rank, x, z });
        rank = w.race.rank;
      }

      const open = openEventOf(w)?.id ?? null;
      if (open !== card) {
        if (open) {
          const [x, z] = rectCenter(w.gate);
          out.push({ type: "incident", id: open, x, z });
        } else out.push({ type: "incidentClosed" });
        card = open;
      }

      if (w.version !== version) {
        version = w.version;
        const now = new Map(w.buildings.map((b) => [b.id, b]));
        for (const b of w.buildings) {
          if (!buildings.has(b.id)) {
            const [x, z] = rectCenter(b);
            out.push({ type: "placed", kind: b.kind, x, z, w: b.w, d: b.d });
          }
        }
        for (const [id, b] of buildings) {
          if (!now.has(id)) {
            const [x, z] = rectCenter(b);
            out.push({ type: "removed", kind: b.kind, x, z, w: b.w, d: b.d });
          }
        }
        buildings = now;
        const grid = w.grid;
        if (paths.length !== grid.paths.length) paths = new Uint8Array(grid.paths.length);
        for (let i = 0; i < grid.paths.length; i++) {
          const on = grid.paths[i] ? 1 : 0;
          if (on !== paths[i]) {
            paths[i] = on;
            out.push({ type: "path", x: worldX((i % grid.w) + 0.5), z: worldZ(Math.floor(i / grid.w) + 0.5), added: on === 1 });
          }
        }
      }

      for (const c of w.disasters.cues) {
        if (c.id <= cueId) continue;
        cueId = c.id;
        if (c.type === "focus") out.push({ type: "focus", x: worldX(c.x), z: worldZ(c.z), zoom: c.zoom, hold: c.hold });
        else if (c.type === "shake") out.push({ type: "shake", strength: c.strength });
        else if (c.type === "beat") out.push({ type: "beat", beat: c.beat, caption: c.caption, sub: c.sub, x: worldX(c.x), z: worldZ(c.z), zoom: c.zoom, hold: c.hold, follow: c.follow });
        else out.push({ type: "cue", cue: c.cue });
      }

      if (runners.size > 0 || (w.escape?.runners.length ?? 0) > 0) {
        const now = runnersOf(w);
        const beat = (b: Extract<FxEvent, { type: "escape" }>["beat"], id: number, r: { x: number; z: number }) =>
          out.push({ type: "escape", beat: b, walker: id, x: worldX(r.x), z: worldZ(r.z) });
        for (const [id, r] of now) {
          const was = runners.get(id)?.phase;
          if (r.phase === was) continue;
          if (r.phase === "running") beat("bolt", id, r);
          else if (r.phase === "carried") beat("grab", id, r);
          else if (r.phase === "tackled") beat("tackle", id, r);
          else if (r.phase === "escaped") beat("out", id, r);
        }
        for (const [id, r] of runners) {
          if (now.has(id)) continue;
          // Gone from the list: put down (if it was in the hand), or over the fence (the walker went with it).
          if (r.phase === "carried") beat("drop", id, { x: r.tx, z: r.tz });
          else if (r.phase === "running" && !w.walkers.some((o) => o.id === id)) beat("out", id, r);
        }
        runners = now;
      }

      for (const p of w.pops) {
        if (p.id > popId) {
          popId = p.id;
          out.push({ type: "earned", amount: p.amount, x: worldX(p.x), z: worldZ(p.z) });
        }
      }
      return out;
    },
  };
}

interface Seen { phase: string; x: number; z: number; tx: number; tz: number }

function runnersOf(w: GameState): Map<number, Seen> {
  const out = new Map<number, Seen>();
  for (const r of w.escape?.runners ?? []) {
    const at = w.walkers.find((o) => o.id === r.walker) ?? r.pace;
    out.set(r.walker, { phase: r.machine.value, x: at.x, z: at.z, tx: r.carry?.x1 ?? at.x, tz: r.carry?.z1 ?? at.z });
  }
  return out;
}

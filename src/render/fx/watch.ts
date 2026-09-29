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
  let paths = new Uint8Array(0);
  let buildings = new Map<number, Building>();

  const baseline = (w: GameState) => {
    seen = w;
    models = w.models.length;
    card = openEventOf(w)?.id ?? null;
    rank = w.race.rank;
    version = w.version;
    popId = w.pops.reduce((m, p) => Math.max(m, p.id), 0);
    paths = Uint8Array.from(w.grid.paths, (p) => (p ? 1 : 0));
    buildings = new Map(w.buildings.map((b) => [b.id, b]));
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

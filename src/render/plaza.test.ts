// FLT-96: the plaza's starter props stand where nobody walks, take no tile from the player, and make way when you build.
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { PLAZA_SIGN } from "../content/plaza";
import { canPlace, applyCommands } from "../sim/commands";
import { onPlaza } from "../sim/opening";
import { createRng } from "../sim/rng";
import { FENCE } from "../sim/staff";
import { createInitialState } from "../sim/state";
import { lampSpots } from "./fx/Night";
import { CREW, PEOPLE } from "./people";
import { PLAZA_PROPS, plazaProps, type PlazaProp } from "./plaza";
import { benchGeometry, planterGeometry, signFaceGeometry, signGeometry, triangles } from "./plazaGeo";

type Box = { x0: number; x1: number; z0: number; z1: number };
const footprint = (p: PlazaProp): Box => ({ x0: p.at[0] - p.half[0], x1: p.at[0] + p.half[0], z0: p.at[1] - p.half[1], z1: p.at[1] + p.half[1] });
const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;
/** Does the segment a→b, thickened by r, touch the box? (Sampled finely enough for props a few tenths across.) */
const crosses = (a: readonly [number, number], b: readonly [number, number], r: number, box: Box) => {
  const steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.02) + 1;
  for (let i = 0; i <= steps; i++) {
    const x = a[0] + ((b[0] - a[0]) * i) / steps;
    const z = a[1] + ((b[1] - a[1]) * i) / steps;
    if (x > box.x0 - r && x < box.x1 + r && z > box.z0 - r && z < box.z1 + r) return true;
  }
  return false;
};

/** A walker stands up to 0.15 off the line (its lane, see Walkers.tsx) and is a 0.13 capsule: 0.28 either side. */
const LANE = 0.15 + 0.13 * PEOPLE;
const SEEDS = [1, 3, 42];

describe("the plaza's starter props", () => {
  it.each(SEEDS)("all stand on a fresh garage's plaza (seed %i)", (seed) => {
    const s = createInitialState(seed);
    expect(plazaProps(s).map((p) => p.id)).toEqual(PLAZA_PROPS.map((p) => p.id));
    for (const p of PLAZA_PROPS) for (const [x, z] of p.on) {
      expect(onPlaza(x, z), `${p.id} on ${x},${z}`).toBe(true);
      expect(s.grid.paths[z * s.grid.w + x]).toBe(true);
    }
    expect(PLAZA_PROPS.filter((p) => p.kind === "bench")).toHaveLength(3);
    expect(PLAZA_PROPS.filter((p) => p.kind === "sign")).toHaveLength(1);
  });

  it("keep inside their tiles, on the verge side, out of every lane and spot a walker can stand in", () => {
    for (const p of PLAZA_PROPS) {
      const f = footprint(p);
      const xs = p.on.map(([x]) => x);
      const zs = p.on.map(([, z]) => z);
      expect(f.x0, p.id).toBeGreaterThanOrEqual(Math.min(...xs));
      expect(f.x1, p.id).toBeLessThanOrEqual(Math.max(...xs) + 1);
      expect(f.z0, p.id).toBeGreaterThanOrEqual(Math.min(...zs));
      expect(f.z1, p.id).toBeLessThanOrEqual(Math.max(...zs) + 1);
      for (const [x, z] of p.on) {
        const cx = x + 0.5;
        const cz = z + 0.5;
        // Standing in the middle of the tile, and walking (or reaching for a door) out of any side but its back.
        const zones: Box[] = [{ x0: cx - LANE, x1: cx + LANE, z0: cz - LANE, z1: cz + LANE }];
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          if (dx === p.back[0] && dz === p.back[1]) continue;
          zones.push(dx !== 0
            ? { x0: Math.min(cx, cx + dx * 0.5), x1: Math.max(cx, cx + dx * 0.5), z0: cz - LANE, z1: cz + LANE }
            : { x0: cx - LANE, x1: cx + LANE, z0: Math.min(cz, cz + dz * 0.5), z1: Math.max(cz, cz + dz * 0.5) });
        }
        for (const zone of zones) expect(overlaps(f, zone), `${p.id} in a lane of ${x},${z}`).toBe(false);
      }
    }
  });

  it("leave the Security guard's beat and the lamps alone", () => {
    const guard = 0.13 * CREW;
    for (const p of PLAZA_PROPS) {
      for (let i = 0; i < FENCE.length; i++) {
        expect(crosses(FENCE[i]!, FENCE[(i + 1) % FENCE.length]!, guard, footprint(p)), `${p.id} on the beat`).toBe(false);
      }
      for (const lamp of lampSpots(createInitialState(3).grid)) {
        expect(crosses([lamp.x, lamp.z], [lamp.x, lamp.z], 0.08, footprint(p)), `${p.id} on a lamp`).toBe(false);
      }
    }
    // Along the fence there is room for both: the guard walks the fence row's middle, the benches sit behind them.
    expect(Math.min(...PLAZA_PROPS.filter((p) => p.back[1] === 1).map((p) => footprint(p).z0))).toBeGreaterThan(23.55 + guard);
  });

  it("are never in a protester's way: no picket line from the gate crosses a bench", () => {
    // protest.ts: they spawn in the gate and walk straight over the lawn to a spot at least 0.45 in from it, up to 3.6
    // tiles either side (a counter-protest's rally goes up to 4 right). Sampled: the gate's corners to every such spot.
    const s = createInitialState(3);
    const g = s.gate;
    const from: [number, number][] = [[g.x + 0.3, g.z + 0.35], [g.x + g.w - 0.3, g.z + 0.35], [g.x + 0.3, g.z + 0.95], [g.x + g.w - 0.3, g.z + 0.95]];
    const cx = g.x + g.w / 2;
    const benches = PLAZA_PROPS.filter((p) => p.kind === "bench" && p.back[1] === 1);
    for (let x = cx - 4.6; x <= cx + 4.6; x += 0.1) {
      for (const z of [g.z - 0.45, g.z - 1.2, g.z - 3]) {
        for (const a of from) for (const b of benches) expect(crosses(a, [x, z], 0.13, footprint(b)), `${b.id} from ${a} to ${x},${z}`).toBe(false);
      }
    }
    // After that they mill about their spot (±0.8 by ±0.6), so never further out than 0.15 into the fence row.
    for (const b of benches) expect(footprint(b).z0).toBeGreaterThan(g.z - 0.45 + 0.6 + 0.13);
  });

  it("take no tile from you: every tile the player could pave or build on still can be", () => {
    const s = createInitialState(3);
    s.cash = 1e9;
    for (const p of PLAZA_PROPS) {
      const [x, z] = p.on[0]!;
      const [bx, bz] = [x + p.back[0], z + p.back[1]];
      if (bz >= s.grid.h) continue; // the fence
      expect(canPlace(s, "path", bx, bz).ok, `${p.id}'s back`).toBe(true);
    }
  });

  it("make way when you pave or build across their back, and nowhere else", () => {
    const s = createInitialState(3);
    s.cash = 1e9;
    const rng = createRng(1);
    const shown = () => plazaProps(s).map((p) => p.id);
    // The first Hall, right of the walk and touching the plaza (opening.test): the bench in front of it steps aside.
    expect(canPlace(s, "hall", 12, 19).ok).toBe(true);
    applyCommands(s, [{ type: "placeBuilding", kind: "hall", x: 12, z: 19 }], rng);
    expect(shown()).not.toContain("bench-north");
    expect(shown()).toContain("sign");
    // A path off the plaza behind the sign.
    applyCommands(s, [{ type: "placePath", x: 16, z: 21 }], rng);
    expect(shown()).not.toContain("sign");
    // Bulldoze the plaza tile a bench stands on: it goes with it.
    applyCommands(s, [{ type: "bulldoze", x: 14, z: 23 }], rng);
    expect(shown()).toEqual(["planter-fence", "bench-fence-e", "planter-east"]);
  });
});

describe("the props' models", () => {
  const models = { bench: benchGeometry(), planter: planterGeometry(), sign: signGeometry(), face: signFaceGeometry() };

  it("are one small geometry each: one draw call, far under FLT-89's 3,000 triangles", () => {
    for (const [id, g] of Object.entries(models)) {
      expect(g, id).toBeInstanceOf(THREE.BufferGeometry);
      expect(g.groups.length, id).toBeLessThanOrEqual(1);
      expect(triangles(g), id).toBeLessThanOrEqual(3000);
      expect(triangles(g), id).toBeGreaterThan(0);
    }
    for (const id of ["bench", "planter", "sign"] as const) expect(models[id].getAttribute("color"), id).toBeDefined();
  });

  it("fit the footprints they are placed by, once turned", () => {
    for (const p of PLAZA_PROPS) {
      const g = models[p.kind].clone().rotateY(p.yaw);
      g.computeBoundingBox();
      const b = g.boundingBox!;
      expect(b.min.y, p.id).toBeGreaterThanOrEqual(-1e-6);
      for (const [lo, hi, half] of [[b.min.x, b.max.x, p.half[0]], [b.min.z, b.max.z, p.half[1]]] as const) {
        expect(-lo, `${p.id} fits`).toBeLessThanOrEqual(half + 1e-3);
        expect(hi, `${p.id} fits`).toBeLessThanOrEqual(half + 1e-3);
      }
    }
  });

  it("the sign says hello in parody-safe words", () => {
    expect(PLAZA_SIGN.head).toBe("WELCOME TO");
    expect(PLAZA_SIGN.foot.length).toBeLessThan(60);
  });
});

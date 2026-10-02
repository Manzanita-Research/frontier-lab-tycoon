// FLT-98: the empty lot's dressing. Survey stakes stand where the first buildings go, on nobody's path, and come out
// when you build; the food truck is parked off the board's grid, clear of the road and everything else by the gate.
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { STAKE_WORDS, TRUCK_WORDS } from "../content/lot";
import { applyCommands, canPlace } from "../sim/commands";
import { onPlaza } from "../sim/opening";
import { createRng } from "../sim/rng";
import { createInitialState } from "../sim/state";
import { HALF, NEO_LOTS, NEO_LOT_HALF, PLAQUE_AT } from "./coords";
import { lampSpots } from "./fx/Night";
import { BOARD, LAWN_PX, PATCHES, RIM, STRIPE, lawnAverage, lawnPixels } from "./lawn";
import { STAKES, STAKE_HALF, STAKE_YAW, TRUCK, standingStakes } from "./lot";
import { flagGeometry, stakeFacesGeometry, stakeGeometry, truckCardsGeometry, truckGeometry } from "./lotGeo";
import { PLAZA_PROPS } from "./plaza";
import { triangles } from "./plazaGeo";

type Box = { x0: number; x1: number; z0: number; z1: number };
const around = ([x, z]: readonly [number, number], hx: number, hz = hx): Box => ({ x0: x - hx, x1: x + hx, z0: z - hz, z1: z + hz });
const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;
const SEEDS = [1, 3, 42];
/** The tiles the coach asks you to pave (opening.ts): a stake there would sit under the tutorial's own highlight. */
const COACH_PATH = [15, 16, 17, 18].map((z) => [11, z] as const);
/** Where protesters picket and mill (protest.ts): homes x 8.4 to 16, z from 17.35, ±0.8 by ±0.6 around them. */
const PICKET: Box = { x0: 7.6, x1: 16.8, z0: 16.75, z1: 24 };
const ids = (s: ReturnType<typeof createInitialState>) => standingStakes(s).map((k) => k.id);

describe("the survey stakes", () => {
  it.each(SEEDS)("all stand on a fresh garage, on open lawn you can still pave and build on (seed %i)", (seed) => {
    const s = createInitialState(seed);
    expect(ids(s)).toEqual(STAKES.map((k) => k.id));
    expect(STAKES.length).toBeGreaterThanOrEqual(3);
    expect(STAKES.length).toBeLessThanOrEqual(5);
    for (const k of STAKES) {
      const [x, z] = k.tile;
      expect(s.grid.paths[z * s.grid.w + x], `${k.id} on a path`).toBe(false);
      expect(onPlaza(x, z), `${k.id} on the plaza`).toBe(false);
      expect(COACH_PATH.some(([cx, cz]) => cx === x && cz === z), `${k.id} on the coach's path`).toBe(false);
      // Decoration only: the tile is exactly as placeable as it was before the stake.
      expect(canPlace(s, "path", x, z).ok, `${k.id}'s tile`).toBe(true);
      // The stake stands inside its own tile, so building next door never leaves it on someone else's roof.
      expect(k.at[0] - STAKE_HALF).toBeGreaterThanOrEqual(x);
      expect(k.at[0] + STAKE_HALF).toBeLessThanOrEqual(x + 1);
      expect(k.at[1] - STAKE_HALF).toBeGreaterThanOrEqual(z);
      expect(k.at[1] + STAKE_HALF).toBeLessThanOrEqual(z + 1);
      expect(STAKE_WORDS[k.id], k.id).toBeDefined();
    }
  });

  it("hint at where the coach puts the first Hall and Gateway", () => {
    // opening.ts prefers the Hall at (12, 16), 3x3, and the Gateway at (12, 20), 2x2.
    const within = (id: string, x: number, z: number, w: number) => {
      const [tx, tz] = STAKES.find((k) => k.id === id)!.tile;
      return tx >= x && tx < x + w && tz >= z && tz < z + w;
    };
    expect(within("hall", 12, 16, 3)).toBe(true);
    expect(within("gateway", 12, 20, 2)).toBe(true);
  });

  it("the jokes stand out on the open lawn, beyond the picket line; none is under a lamp", () => {
    for (const k of STAKES.filter((s) => !s.until)) expect(overlaps(around(k.at, STAKE_HALF), PICKET), k.id).toBe(false);
    for (const k of STAKES) {
      for (const lamp of lampSpots(createInitialState(3).grid)) expect(overlaps(around(k.at, STAKE_HALF), around([lamp.x, lamp.z], 0.08)), `${k.id} on a lamp`).toBe(false);
    }
  });

  it("are pulled up when you pave or build on their tile, or keep their promise elsewhere", () => {
    const s = createInitialState(3);
    s.cash = 1e9;
    const rng = createRng(1);
    // The coach's first path: no stake is touched.
    for (const [x, z] of COACH_PATH) applyCommands(s, [{ type: "placePath", x, z }], rng);
    expect(ids(s)).toEqual(STAKES.map((k) => k.id));
    // The coach's Hall goes up on the Hall's stake.
    applyCommands(s, [{ type: "placeBuilding", kind: "hall", x: 12, z: 16 }], rng);
    expect(ids(s)).toEqual(["cluster", "gateway", "bigger", "ethics"]);
    // A Gateway somewhere else keeps that promise too (it is locked at the first level, so it is put straight in).
    const gateway = { ...s.buildings.find((b) => b.kind === "hall")!, kind: "gateway" as const, x: 17, z: 21, w: 2, d: 2 };
    expect(standingStakes({ ...s, buildings: [...s.buildings, gateway] }).map((k) => k.id)).toEqual(["cluster", "bigger", "ethics"]);
    s.buildings.push(gateway);
    expect(ids(s)).toEqual(["cluster", "bigger", "ethics"]);
    // A path across a joke takes it out, and bulldozing the path plants it again: the lawn is empty again.
    const ethics = STAKES.find((k) => k.id === "ethics")!;
    applyCommands(s, [{ type: "placePath", x: ethics.tile[0], z: ethics.tile[1] }], rng);
    expect(ids(s)).toEqual(["cluster", "bigger"]);
    applyCommands(s, [{ type: "bulldoze", x: ethics.tile[0], z: ethics.tile[1] }], rng);
    expect(ids(s)).toEqual(["cluster", "bigger", "ethics"]);
    // The garage's Cluster is the first; the stake waits for a second.
    s.buildings.push({ ...gateway, kind: "cluster", x: 3, z: 3 });
    expect(ids(s)).toEqual(["bigger", "ethics"]);
  });

  it("the joke words stay short enough to read on a tiny sign", () => {
    for (const [id, w] of Object.entries(STAKE_WORDS)) {
      expect(w.name.length, id).toBeLessThanOrEqual(22);
      expect(w.full.length, id).toBeLessThanOrEqual(90);
    }
  });
});

describe("the food truck", () => {
  const f = around(TRUCK.at, TRUCK.half[0], TRUCK.half[1]);

  it("is parked on the verge by the road out: off the lot's grid, on the board, clear of the road", () => {
    const s = createInitialState(3);
    expect(f.z0).toBeGreaterThan(s.grid.h - HALF); // outside the fence: no tile of yours
    expect(f.z1).toBeLessThan(BOARD / 2); // still on the board
    // Everyone leaving (and the auditors' queue, at x 0) walks down the road, which is the gate's width.
    expect(f.x0).toBeGreaterThan(s.gate.x + s.gate.w - HALF + 0.2);
  });

  it("is clear of the plaque, the welcome sign and the neo labs' lots", () => {
    const plaque = around(PLAQUE_AT, 0.62, 0.32);
    expect(overlaps(f, plaque)).toBe(false);
    const sign = PLAZA_PROPS.find((p) => p.kind === "sign")!;
    expect(overlaps(f, around([sign.at[0] - HALF, sign.at[1] - HALF], sign.half[0], sign.half[1]))).toBe(false);
    for (const lot of NEO_LOTS) expect(overlaps(f, around(lot, NEO_LOT_HALF[0], NEO_LOT_HALF[1])), `lot ${lot[0]}`).toBe(false);
  });

  it("says its name in parody-safe words", () => {
    expect(TRUCK_WORDS.name).toBe("TENSOR TACOS");
    expect(TRUCK_WORDS.tagline.length).toBeLessThan(40);
  });
});

describe("the lot's models", () => {
  const models = {
    stake: stakeGeometry(),
    flag: flagGeometry(),
    faces: stakeFacesGeometry(STAKES.map((_, slot) => ({ x: 0, z: 0, yaw: STAKE_YAW, slot })), STAKES.length),
    truck: truckGeometry(),
    cards: truckCardsGeometry(),
  };

  it("are one small geometry each: one draw call, far under FLT-89's 3,000 triangles", () => {
    for (const [id, g] of Object.entries(models)) {
      expect(g.groups.length, id).toBeLessThanOrEqual(1);
      expect(triangles(g), id).toBeLessThanOrEqual(3000);
      expect(triangles(g), id).toBeGreaterThan(0);
    }
    for (const id of ["stake", "flag", "truck"] as const) expect(models[id].getAttribute("color"), id).toBeDefined();
  });

  it("fit the footprints they are placed by", () => {
    const fits = (id: string, g: THREE.BufferGeometry, hx: number, hz: number) => {
      g.computeBoundingBox();
      const b = g.boundingBox!;
      expect(b.min.y, id).toBeGreaterThanOrEqual(-1e-6);
      expect(Math.max(-b.min.x, b.max.x), `${id} x`).toBeLessThanOrEqual(hx + 1e-3);
      expect(Math.max(-b.min.z, b.max.z), `${id} z`).toBeLessThanOrEqual(hz + 1e-3);
    };
    fits("stake", models.stake.clone().rotateY(STAKE_YAW), STAKE_HALF, STAKE_HALF);
    fits("faces", models.faces, STAKE_HALF, STAKE_HALF);
    fits("truck", models.truck.clone().rotateY(TRUCK.yaw), TRUCK.half[0], TRUCK.half[1]);
  });

  it("give each stake its own face of the atlas", () => {
    const uv = models.faces.getAttribute("uv") as THREE.BufferAttribute;
    const per = uv.count / STAKES.length;
    STAKES.forEach((_, slot) => {
      for (let i = slot * per; i < (slot + 1) * per; i++) {
        expect(uv.getY(i)).toBeGreaterThanOrEqual(1 - (slot + 1) / STAKES.length - 1e-6);
        expect(uv.getY(i)).toBeLessThanOrEqual(1 - slot / STAKES.length + 1e-6);
      }
    });
  });
});

describe("the mowed lawn", () => {
  const px = lawnPixels();
  const digest = (a: Uint8ClampedArray) => a.reduce((h, v, i) => (h * 31 + v * (i % 7 + 1)) >>> 0, 7);
  const sum = (c: readonly number[]) => c[0]! + c[1]! + c[2]!;

  it("is painted the same every time", () => {
    expect(px.length).toBe((BOARD * LAWN_PX) ** 2 * 4);
    expect(digest(lawnPixels())).toBe(digest(px));
  });

  it("is striped a column at a time inside the fence: light, dark, light, every stripe, and subtle", () => {
    const columns = Array.from({ length: BOARD - 2 * RIM }, (_, i) => sum(lawnAverage(px, RIM + i, RIM, 1, BOARD - 2 * RIM)));
    for (let i = 1; i < columns.length; i++) {
      const step = columns[i]! - columns[i - 1]!;
      // Lighter then darker by about twice the stripe, give or take the drift and a patch or two.
      expect(Math.sign(step), `column ${i}`).toBe(i % 2 ? -1 : 1);
      expect(Math.abs(step), `column ${i}`).toBeGreaterThan(sum(STRIPE));
      expect(Math.abs(step), `column ${i}`).toBeLessThan(3 * sum(STRIPE));
    }
  });

  it("stays far quieter than a path: a stripe is a small fraction of the gap between lawn and paving", () => {
    const lot = lawnAverage(px, RIM, RIM, BOARD - 2 * RIM, BOARD - 2 * RIM);
    // The lot still averages the old green (#76bc52), so everything drawn on it reads as it did.
    for (const [k, c] of [118, 188, 82].entries()) expect(Math.abs(lot[k]! - c), `channel ${k}`).toBeLessThan(8);
    const path = sum([0xf4, 0xe9, 0xc9]); // Ground.tsx's path tint
    expect(2 * sum(STRIPE)).toBeLessThan((path - sum(lot)) / 3);
  });

  it("leaves the verge unmowed", () => {
    const columns = Array.from({ length: BOARD }, (_, i) => sum(lawnAverage(px, i, 0, 1, RIM)));
    for (let i = 1; i < columns.length; i++) expect(Math.abs(columns[i]! - columns[i - 1]!), `column ${i}`).toBeLessThan(sum(STRIPE));
    expect(PATCHES.wild).toBeGreaterThan(0);
  });
});

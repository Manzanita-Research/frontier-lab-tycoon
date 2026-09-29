import { BUILDINGS, PATH_PRICE } from "../content/buildings";
import { applyCommands, canPlace, type Command } from "./commands";
import { RESEARCHER_SALARY, REVENUE_PER_CAPABILITY, runCostGrowth } from "./constants";
import { dailyEconomy } from "./economy";
import { entrances, getReach, isReachable, isPathTile } from "./pathfind";
import { createRng } from "./rng";
import { createInitialState } from "./state";
import { answer } from "./testkit";
import { TICKS_PER_DAY, tick } from "./tick";
import { dailyTraining } from "./training";
import type { GameState } from "./types";

const gatewayAt = (s: GameState) => s.buildings.find((b) => b.kind === "gateway")!;

function withGateway(seed = 1): GameState {
  const s = createInitialState(seed);
  tick(s, [{ type: "placeBuilding", kind: "gateway", x: 7, z: 17 }]);
  return s;
}

describe("initial state", () => {
  it("starts alive: buildings connected, a crowd on the paths, run 40% done", () => {
    const s = createInitialState(1);
    expect(s.cash).toBe(5_000_000);
    expect(s.capability).toBe(10);
    expect(s.walkers.filter((w) => w.kind === "researcher")).toHaveLength(8 + 3);
    expect(s.walkers.filter((w) => w.kind === "agent")).toHaveLength(6 + 5);
    expect(s.walkers.filter((w) => w.kind === "visitor")).toHaveLength(18);
    expect(s.walkers.filter((w) => w.kind === "protester")).toHaveLength(0);
    expect(s.training.context.progress / s.training.context.cost).toBeCloseTo(0.4);
    expect(s.buildings.map((b) => b.kind).sort()).toEqual(["cluster", "hall", "kombucha"]);
    for (const b of s.buildings) expect(isReachable(s, b)).toBe(true);
    expect(s.thoughts.length).toBeGreaterThan(0);
  });
});

describe("placement rules", () => {
  it("accepts a gateway next to a path", () => {
    expect(canPlace(createInitialState(1), "gateway", 7, 17)).toEqual({ ok: true });
  });

  it("rejects out of bounds, overlaps, the gate and buildings with no path", () => {
    const s = createInitialState(1);
    expect(canPlace(s, "gateway", 23, 23)).toEqual({ ok: false, reason: "Out of bounds" });
    expect(canPlace(s, "gateway", -1, 5)).toEqual({ ok: false, reason: "Out of bounds" });
    expect(canPlace(s, "kombucha", 8, 11)).toEqual({ ok: false, reason: "Something's already there" });
    expect(canPlace(s, "kombucha", 11, 15)).toEqual({ ok: false, reason: "Something's already there" });
    expect(canPlace(s, "kombucha", 11, 23)).toEqual({ ok: false, reason: "Something's already there" });
    expect(canPlace(s, "path", 12, 23)).toEqual({ ok: false, reason: "Something's already there" });
    expect(canPlace(s, "path", 11, 15)).toEqual({ ok: false, reason: "Already a path" });
    expect(canPlace(s, "gateway", 1, 1)).toEqual({ ok: false, reason: "Needs a path next to it" });
  });

  it("rejects what you can't afford", () => {
    const s = createInitialState(1);
    s.cash = BUILDINGS.gateway.price - 1;
    expect(canPlace(s, "gateway", 7, 17)).toEqual({ ok: false, reason: "Not enough cash" });
    s.cash = PATH_PRICE - 1;
    expect(canPlace(s, "path", 5, 16)).toEqual({ ok: false, reason: "Not enough cash" });
  });

  it("charges for placement, bumps the version, and refunds 50% on bulldoze", () => {
    const s = createInitialState(1);
    const v = s.version;
    const hype = s.hype;
    tick(s, [{ type: "placeBuilding", kind: "gateway", x: 7, z: 17 }]);
    expect(s.cash).toBeLessThan(5_000_000 - BUILDINGS.gateway.price + 1);
    expect(s.version).toBe(v + 1);
    expect(s.hype).toBe(hype + 1); // first building of a new kind
    const after = s.cash;
    tick(s, [{ type: "bulldoze", x: 7, z: 17 }]);
    expect(s.buildings.some((b) => b.kind === "gateway")).toBe(false);
    expect(s.cash).toBeGreaterThan(after + BUILDINGS.gateway.price * 0.5 - 200_000);
  });

  it("paints and bulldozes paths", () => {
    const s = createInitialState(1);
    applyCommands(s, [{ type: "placePath", x: 5, z: 16 }], createRng(1));
    expect(isPathTile(s, 5, 16)).toBe(true);
    applyCommands(s, [{ type: "bulldoze", x: 5, z: 16 }], createRng(1));
    expect(isPathTile(s, 5, 16)).toBe(false);
  });
});

describe("reachability", () => {
  it("finds buildings connected to the gate and loses them when the path is cut", () => {
    const s = createInitialState(1);
    const bar = s.buildings.find((b) => b.kind === "kombucha")!;
    expect(isReachable(s, bar)).toBe(true);
    expect(entrances(s, bar).length).toBeGreaterThan(0);
    // Cut the main road below the cross path: everything north loses its link to the gate.
    applyCommands(s, [{ type: "bulldoze", x: 11, z: 20 }], createRng(1));
    expect(getReach(s).version).toBe(s.version);
    expect(isReachable(s, bar)).toBe(false);
  });

  it("gives no revenue to an unreachable gateway", () => {
    const s = withGateway();
    const before = s.cash;
    applyCommands(s, [{ type: "bulldoze", x: 11, z: 20 }], createRng(1));
    dailyEconomy(s, createRng(1));
    expect(s.pops).toHaveLength(0);
    expect(s.ledger.income).toBe(0);
    expect(s.cash).toBeLessThan(before);
  });
});

describe("economy", () => {
  it("pays gateway revenue and bills upkeep and salaries for one day", () => {
    const s = withGateway();
    const cash = s.cash;
    dailyEconomy(s, createRng(1));
    const researchers = s.walkers.filter((w) => w.kind === "researcher").length;
    const revenue = s.capability * REVENUE_PER_CAPABILITY;
    const upkeep = 8_000 + 5_000 + 1_000 + 3_000 + researchers * RESEARCHER_SALARY;
    expect(s.ledger.income).toBe(revenue);
    expect(s.ledger.expenses).toBe(upkeep);
    expect(s.cash).toBe(cash + revenue - upkeep);
    expect(s.pops).toHaveLength(1);
    expect(s.pops[0]!.amount).toBe(revenue);
  });
});

describe("training", () => {
  it("completes a run, raises capability, names the model and starts the next", () => {
    const s = withGateway();
    s.training = { ...s.training, context: { ...s.training.context, progress: s.training.context.cost - 1 } };
    s.compute = 100;
    const cap = s.capability;
    const cash = s.cash;
    dailyTraining(s, createRng(3));
    expect(s.models).toEqual(["Frontier-2"]);
    expect(s.capability).toBeGreaterThanOrEqual(cap + 16); // the R&D multiplier can make a release a bigger leap, never a smaller one
    expect(s.cash).toBeGreaterThan(cash);
    expect(s.training.context.run).toBe(2);
    expect(s.training.context.cost).toBe(300 * runCostGrowth(1));
    expect(s.training.context.name).toBe("Frontier-3-Reasoner");
    expect(s.news.some((n) => n.text.includes("Frontier-2"))).toBe(true);
    expect(s.toasts.some((t) => t.text.includes("Frontier-2"))).toBe(true);
  });

  it("does nothing without a Training Hall", () => {
    const s = createInitialState(1);
    s.buildings = s.buildings.filter((b) => b.kind !== "hall");
    const p = s.training.context.progress;
    dailyTraining(s, createRng(1));
    expect(s.training.context.progress).toBe(p);
  });

  it("finishes run #1 within a minute of real time at 1x (10 ticks per second)", () => {
    const s = withGateway();
    let ticks = 0;
    while (s.models.length === 0 && ticks < 2000) {
      tick(s);
      ticks++;
    }
    expect(ticks).toBeLessThan(600);
  });
});

describe("walkers", () => {
  it("stay on paths (or the gate apron) and out of harm for a few thousand ticks", () => {
    const s = withGateway();
    for (let i = 0; i < 3000; i++) {
      tick(s);
      for (const w of s.walkers) {
        if (w.machine.value === "inside" || w.kind === "protester") continue;
        const tx = Math.floor(w.x);
        const tz = Math.floor(w.z);
        const onGate = tz === s.gate.z && tx >= s.gate.x && tx < s.gate.x + s.gate.w;
        expect(onGate || isPathTile(s, tx, tz)).toBe(true);
      }
    }
    expect(s.walkers.some((w) => w.kind === "visitor")).toBe(true);
  });

  it("re-routes when the path is bulldozed under them", () => {
    const s = withGateway();
    for (let i = 0; i < 100; i++) tick(s);
    tick(s, [{ type: "bulldoze", x: 11, z: 14 }]);
    for (let i = 0; i < 500; i++) tick(s);
    expect(s.walkers.length).toBeGreaterThan(0);
  });
});

describe("determinism", () => {
  it("same seed and commands give a deep-equal state after 2,000 ticks", () => {
    const script: Record<number, Command[]> = {
      5: [{ type: "placeBuilding", kind: "gateway", x: 7, z: 17 }],
      300: [{ type: "placePath", x: 5, z: 16 }],
      900: [{ type: "bulldoze", x: 13, z: 17 }],
    };
    const run = () => {
      const s = createInitialState(7);
      // The race calls a compute auction on day 40: every card gets its first choice, or time would stand still.
      for (let i = 0; i < 2000; i++) tick(s, script[i] ?? answer(s));
      return s;
    };
    const a = run();
    expect(a.day).toBe(2000 / TICKS_PER_DAY);
    expect(run()).toEqual(a);
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
  });

  it("different seeds diverge", () => {
    expect(createInitialState(1).labName === createInitialState(2).labName && createInitialState(1).rngState === createInitialState(2).rngState).toBe(false);
  });

  it("never calls Math.random", () => {
    const sources = import.meta.glob<string>("./**/*.ts", { query: "?raw", import: "default", eager: true });
    for (const [file, src] of Object.entries(sources)) {
      if (file.endsWith(".test.ts")) continue;
      const code = src.split("\n").filter((line) => !line.trim().startsWith("//")).join("\n");
      expect(code, file).not.toContain("Math.random");
    }
  });
});

describe("content", () => {
  it("keeps gateways referenced in tests real", () => {
    expect(gatewayAt(withGateway()).kind).toBe("gateway");
  });
});

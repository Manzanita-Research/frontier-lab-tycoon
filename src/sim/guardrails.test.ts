import { createInitialState as createOpening } from "./state";
const createInitialState = (seed: number) => { const s = createOpening(seed); delete s.progression; return s; };
import { applyNow, tick, TICKS_PER_DAY } from "./tick";
import { canPlace } from "./commands";
import { entranceConnected, gateAccessTiles, getReach, isReachable } from "./pathfind";
import { jemOpeningCommands } from "./firstRunDemo";
import { newWalker } from "./walkers";
import { createRng } from "./rng";
import { pendingConfirmOf, persistentWarnings, spendingForecast } from "./guardrails";
import { ENTRANCE_WARNING, REDUNDANT_HALL } from "../content/guardrails";
import { runwayNudge } from "../content/bridgeRounds";
import { makeSnapshot } from "../app/hud";

describe("Jem's first run", () => {
  it("keeps three clusters and three fast-built halls connected, and unzoned staff actually patrol", () => {
    const s = createInitialState(1);
    applyNow(s, jemOpeningCommands()); // intentionally confirm overspending to reproduce the same full layout
    expect(s.buildings.filter((b) => b.kind === "cluster")).toHaveLength(3);
    expect(s.buildings.filter((b) => b.kind === "hall")).toHaveLength(3);
    expect(entranceConnected(s)).toBe(true);
    expect(s.buildings.every((b) => isReachable(s, b))).toBe(true);
    for (let i = 0; i < 40; i++) tick(s);
    const staff = s.staff.filter((p) => p.job !== "security");
    expect(new Set(staff.map((p) => `${p.x.toFixed(2)},${p.z.toFixed(2)}`)).size).toBeGreaterThan(1);
    expect(staff.some((p) => p.z < 21)).toBe(true); // baseline dangling-else leaves everyone at z22.5
    expect(entranceConnected(s)).toBe(true);
  });

  it("reserves both entrance access tiles, including after bulldozing their paths", () => {
    const s = createInitialState(1);
    for (const [x, z] of gateAccessTiles(s)) applyNow(s, [{ type: "bulldoze", x, z }]);
    for (const [x, z] of gateAccessTiles(s)) expect(canPlace(s, "kombucha", x, z)).toMatchObject({ ok: false, reason: expect.stringContaining("entrance access") });
    expect(persistentWarnings(s)).toContain(ENTRANCE_WARNING);
    // Unconnected paths elsewhere don't silence the warning.
    applyNow(s, [{ type: "placePath", x: 2, z: 2 }]);
    expect(persistentWarnings(s)).toContain(ENTRANCE_WARNING);
    applyNow(s, [{ type: "placePath", x: 11, z: 22 }]);
    expect(entranceConnected(s)).toBe(true);
    expect(persistentWarnings(s)).not.toContain(ENTRANCE_WARNING);
  });

  it("stranded visitors and staff amble at distinct positions and resume when paths reconnect", () => {
    const s = createInitialState(2);
    applyNow(s, [{ type: "skipTutorial" }, { type: "hire", job: "janitor" }, { type: "hire", job: "sre" }]);
    const rng = createRng(s.rngState);
    for (let i = 0; i < 4; i++) s.walkers.push(newWalker(s, "visitor", 12, 23.6, rng));
    s.rngState = rng.state();
    for (const [x, z] of gateAccessTiles(s)) applyNow(s, [{ type: "bulldoze", x, z }]);
    for (let i = 0; i < 60; i++) tick(s);
    const visitors = s.walkers.filter((p) => p.kind === "visitor");
    expect(visitors).toHaveLength(4);
    expect(new Set([...visitors, ...s.staff].map((p) => `${p.x.toFixed(2)},${p.z.toFixed(2)}`)).size).toBeGreaterThan(4);
    expect(visitors.every((p) => p.z > 21 && p.z < 24)).toBe(true);
    applyNow(s, [{ type: "placePath", x: 11, z: 22 }]);
    for (let i = 0; i < 60; i++) tick(s);
    expect(persistentWarnings(s)).not.toContain(ENTRANCE_WARNING);
    expect(s.staff.some((p) => p.z < 22)).toBe(true);
    expect(getReach(s).buildings.size).toBe(1);
  });

  it("blocks fast overspending without changing cash, IDs or RNG, saves the exact proposal and confirms once", () => {
    const s = createInitialState(1);
    applyNow(s, [{ type: "placePath", x: 11, z: 18 }]);
    s.cash = 1_000_000;
    const before = { cash: s.cash, ids: s.nextId, rng: s.rngState, buildings: s.buildings.length };
    applyNow(s, [{ type: "placeBuilding", kind: "hall", x: 12, z: 18 }]);
    expect({ cash: s.cash, ids: s.nextId, rng: s.rngState, buildings: s.buildings.length }).toEqual(before);
    expect(pendingConfirmOf(s)).toMatchObject({ kind: "build", cost: 900_000, runwayAfter: expect.any(Number), message: expect.stringContaining("board will have questions") });
    const loaded = JSON.parse(JSON.stringify(s));
    tick(loaded);
    expect(loaded.tick).toBe(s.tick); // reading the confirmation does not burn money
    const command = pendingConfirmOf(loaded)!.command;
    applyNow(loaded, [{ ...command, confirmed: true }]);
    expect(pendingConfirmOf(loaded)).toBeNull();
    expect(loaded.cash).toBe(100_000);
    expect(loaded.buildings).toHaveLength(2);
    applyNow(loaded, [{ ...command, confirmed: true }]); // duplicate click cannot purchase the same footprint twice
    expect(loaded.cash).toBe(100_000);
    expect(persistentWarnings(loaded)).toContain(runwayNudge(3));
  });

  it("projects wages and upkeep from fresh books, not a stale paused ledger; cancellation spends nothing", () => {
    const s = createInitialState(1);
    s.cash = 1_500_000;
    s.ledger = { income: 0, expenses: 0, net: 0 };
    const c = { type: "hire", job: "sre" } as const;
    s.cash = 1_000_000;
    const forecast = spendingForecast(s, c);
    expect(forecast.runwayAfter).toBeLessThan(3);
    applyNow(s, [c, { type: "hire", job: "janitor" }]);
    expect(s.staff).toHaveLength(0);
    expect(pendingConfirmOf(s)?.command).toEqual(c); // the first proposal wins, even in a burst
    applyNow(s, [{ type: "cancelConfirm" }]);
    expect(s.cash).toBe(1_000_000);
    expect(s.staff).toHaveLength(0);
    applyNow(s, [{ ...c, confirmed: true }]);
    expect(s.staff).toHaveLength(1);
    expect(s.cash).toBe(1_000_000); // salaries are daily, not an invented upfront hiring fee
  });

  it("explains compute-limited extra halls and keeps the next goal name in lockstep with releases", () => {
    const s = createInitialState(1);
    applyNow(s, [{ type: "placePath", x: 11, z: 18 }, { type: "placePath", x: 11, z: 17 }, { type: "placePath", x: 11, z: 16 },
      { type: "placeBuilding", kind: "hall", x: 12, z: 18, confirmed: true },
      { type: "placeBuilding", kind: "hall", x: 12, z: 15, confirmed: true }]);
    expect(s.toasts.some((t) => t.text === REDUNDANT_HALL)).toBe(true);
    expect(makeSnapshot(s).releaseGoal).toBe("Ship 3 models (0/3), next: Frontier-2");
    s.cash = 50_000_000;
    for (let run = 1; run <= 3; run++) {
      s.training = { ...s.training, context: { ...s.training.context, progress: s.training.context.cost - 1 } };
      for (let i = 0; i < 2 * TICKS_PER_DAY && s.models.length < run; i++) tick(s);
      expect(s.models).toHaveLength(run);
    }
    expect(s.models[0]).toBe("Frontier-2");
    expect(s.models[1]).toBe("Frontier-3-Reasoner");
    expect(s.models[2]).toMatch(/^Frontier-4/);
    expect(makeSnapshot(s).releaseGoal).toContain("shipped");
    expect(s.tick).toBeGreaterThan(0);
  });

  it("guards paid paths too, but credits a reconnection that restores API revenue", () => {
    const s = createInitialState(1);
    applyNow(s, [{ type: "skipTutorial" }, { type: "placeBuilding", kind: "gateway", x: 12, z: 19 }]);
    s.capability = 100;
    applyNow(s, [{ type: "bulldoze", x: 11, z: 21 }]);
    s.cash = 20_000;
    applyNow(s, [{ type: "placePath", x: 5, z: 5 }]);
    expect(pendingConfirmOf(s)).toMatchObject({ kind: "build", cost: 10_000 });
    expect(s.grid.paths[5 * s.grid.w + 5]).toBe(false);
    applyNow(s, [{ type: "cancelConfirm" }, { type: "placePath", x: 11, z: 21 }]);
    expect(pendingConfirmOf(s)).toBeNull();
    expect(entranceConnected(s)).toBe(true);
    expect(makeSnapshot(s).income).toBeGreaterThan(makeSnapshot(s).expenses);
  });

  it("accepts exactly three months of runway and asks below the boundary", () => {
    const s = createInitialState(1);
    const c = { type: "hire", job: "sre" } as const;
    s.cash = 1_000_000;
    const months = spendingForecast(s, c).runwayAfter!;
    const threshold = s.cash / months * 3;
    s.cash = threshold - 1;
    applyNow(s, [c]);
    expect(pendingConfirmOf(s)).not.toBeNull();
    applyNow(s, [{ type: "cancelConfirm" }]);
    s.cash = threshold;
    applyNow(s, [c]);
    expect(pendingConfirmOf(s)).toBeNull();
    expect(s.staff).toHaveLength(1);
  });
});

// FLT-39: the route cache outlives a new World version that leaves the paths alone (a breakdown, a repair), and still
// hands out the route a fresh search finds.
import { busyLab } from "./perf/busyLab";
import { breakBuilding, repairBuilding } from "./breakdowns";
import { answer } from "./testkit";
import { reachablePathTiles, routeToRect } from "./pathfind";
import { applyNow, tick } from "./tick";
import type { GameState } from "./types";

/** Every building from a spread of path tiles, from `s`'s cache and from an empty one (a copy of `s` is a new cache key). */
function sameRoutes(s: GameState) {
  const fresh = { ...s };
  const tiles = reachablePathTiles(s).filter((_, i) => i % 5 === 0);
  for (const b of [...s.buildings, s.gate])
    for (const [x, z] of tiles) for (const gate of [false, true]) expect(routeToRect(s, x + 0.5, z + 0.5, b, gate)).toEqual(routeToRect(fresh, x + 0.5, z + 0.5, b, gate));
}

describe("the route cache", () => {
  it("keeps its routes through a breakdown and a repair, and they stay right", () => {
    const { s, topUp } = busyLab();
    sameRoutes(s);
    const b = s.buildings.find((o) => o.kind === "snack")!;
    const version = s.version;
    breakBuilding(s, b);
    sameRoutes(s);
    repairBuilding(s, b);
    expect(s.version).toBeGreaterThan(version);
    sameRoutes(s);
    for (let day = 0; day < 20; day++) {
      topUp();
      for (let t = 0; t < 20; t++) tick(s, answer(s));
      sameRoutes(s);
    }
  });

  it("drops its routes when a path goes", () => {
    const { s } = busyLab();
    sameRoutes(s);
    const [x, z] = reachablePathTiles(s)[10]!;
    applyNow(s, [{ type: "bulldoze", x, z }]);
    sameRoutes(s);
  });
});

import { COACH } from "../content/coach";
import { coachOf } from "./coach";
import { createInitialState } from "./state";
import { applyNow, tick } from "./tick";

const paths = [18, 17, 16].map((z) => ({ type: "placePath" as const, x: 11, z }));
describe("the coach", () => {
  it("advances on successful actions, release, and game-visible timers", () => {
    const s = createInitialState(1);
    expect(coachOf(s)).toMatchObject({ id: "start", step: 1, of: 7 });
    applyNow(s, [{ type: "coachClick" }, { type: "continueTutorial" }]);
    expect(coachOf(s)?.id).toBe("start");
    applyNow(s, [{ type: "buildPanelOpened" }]);
    expect(coachOf(s)?.id).toBe("path");
    applyNow(s, [{ type: "placePath", x: 5, z: 5 }]);
    expect(coachOf(s)?.id).toBe("path");
    applyNow(s, paths);
    expect(coachOf(s)?.id).toBe("hall");
    applyNow(s, [{ type: "placeBuilding", kind: "hall", x: 12, z: 16 }]);
    expect(coachOf(s)?.id).toBe("training");
    for (let i = 0; i < 800 && !s.models.length; i++) tick(s);
    expect(s.models.length).toBe(1);
    expect(coachOf(s)?.id).toBe("gateway");
    applyNow(s, [{ type: "placeBuilding", kind: "gateway", x: 12, z: 20 }]);
    expect(coachOf(s)?.id).toBe("runway");
    for (let i = 0; i < 19; i++) tick(s);
    expect(coachOf(s)?.id).toBe("runway");
    tick(s); expect(coachOf(s)?.id).toBe("goals");
    applyNow(s, [{ type: "coachClick" }]); expect(coachOf(s)).toBeNull();
    expect(COACH).toHaveLength(7);
  });
  it("skip/replay survive JSON, and applying commands while paused does not advance timers", () => {
    const s = createInitialState(2);
    const rng = s.rngState;
    applyNow(s, [{ type: "coachSkip" }]);
    const loaded = JSON.parse(JSON.stringify(s));
    expect(coachOf(loaded)).toBeNull(); expect(s.rngState).toBe(rng);
    applyNow(loaded, [{ type: "coachReplay" }]); expect(coachOf(loaded)?.id).toBe("start");
    s.coach = { value: "active", context: { index: 5, elapsed: 0 } };
    for (let i = 0; i < 40; i++) applyNow(s, []);
    expect(coachOf(s)?.id).toBe("runway");
    delete loaded.coach; expect(coachOf(loaded)).toBeNull();
  });
  it("replay starts at Start after a built campus, without holding time", () => {
    const s = createInitialState(1);
    applyNow(s, [{ type: "buildPanelOpened" }, ...paths, { type: "placeBuilding", kind: "hall", x: 12, z: 16 }]);
    applyNow(s, [{ type: "coachReplay" }]);
    expect(coachOf(s)?.id).toBe("start");
    const before = s.tick; tick(s);
    expect(s.tick).toBe(before + 1); expect(coachOf(s)?.id).toBe("start");
    applyNow(s, [{ type: "buildPanelOpened" }]);
    expect(coachOf(s)?.id).toBe("training");
  });
  it("replays all machines and RNG exactly after a save/load", () => {
    const s = createInitialState(3);
    applyNow(s, [...paths, { type: "placeBuilding", kind: "hall", x: 12, z: 16 }]);
    const loaded = JSON.parse(JSON.stringify(s));
    for (let i = 0; i < 1000; i++) { tick(s); tick(loaded); }
    expect(loaded).toEqual(s); expect(s.models.length).toBeGreaterThan(0);
  });
});

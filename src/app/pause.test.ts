// Why the clock is standing still, for the "Paused" indicator: the reasons, and which one wins when there are several.
import { describe, expect, it } from "vitest";
import { pauseReasonOf, type AppContext } from "./machine";
import { makeSnapshot } from "./hud";
import { createInitialState } from "../sim/state";
import { createTestCampus } from "../sim/testkit";
import { applyNow } from "../sim/tick";

const opening = makeSnapshot(createInitialState(1));
const campus = makeSnapshot(createTestCampus(1));

/** Just the fields `pauseReasonOf` reads. */
const ctx = (over: Partial<Record<keyof AppContext, unknown>> = {}) =>
  ({ speed: 1, event: null, outcome: "playing", outcomeDismissed: false, selected: null, overlays: [], snap: campus, ...over }) as unknown as AppContext;

describe("pauseReasonOf", () => {
  it("is null while the clock runs", () => {
    expect(pauseReasonOf(ctx())).toBeNull();
  });

  it("names each thing that holds time", () => {
    expect(pauseReasonOf(ctx({ speed: 0 }))).toBe("player");
    expect(pauseReasonOf(ctx({ overlays: ["staff"] }))).toBe("menu");
    expect(pauseReasonOf(ctx({ selected: 4 }))).toBe("inspector");
    expect(pauseReasonOf(ctx({ event: { id: "waterDiscourse", day: 3 } }))).toBe("card");
    expect(pauseReasonOf(ctx({ outcome: "won" }))).toBe("card");
    expect(pauseReasonOf(ctx({ outcome: "won", outcomeDismissed: true }))).toBeNull();
  });

  it("holds the opening in two stages: a message to read, then the first build", () => {
    expect(opening.assistant?.paused).toBe(true);
    expect(opening.firstBuildPending).toBe(true);
    expect(pauseReasonOf(ctx({ snap: opening }))).toBe("tutorial");
    // Acknowledged (Next, or picking the highlighted tool), but nothing is built yet: the clock is still waiting.
    const acknowledged = createInitialState(1);
    applyNow(acknowledged, [{ type: "continueTutorial" }]);
    const snap = makeSnapshot(acknowledged);
    expect(snap.assistant?.paused).toBe(false);
    expect(pauseReasonOf(ctx({ snap }))).toBe("build");
  });

  it("puts a card ahead of the pause button, and the pause button ahead of the automatic holds", () => {
    expect(pauseReasonOf(ctx({ speed: 0, event: { id: "x", day: 1 } }))).toBe("card");
    expect(pauseReasonOf(ctx({ speed: 0, snap: opening, overlays: ["staff"], selected: 2 }))).toBe("player");
    expect(pauseReasonOf(ctx({ snap: opening, overlays: ["staff"], selected: 2 }))).toBe("tutorial");
    expect(pauseReasonOf(ctx({ overlays: ["staff"], selected: 2 }))).toBe("menu");
  });
});

// The walker machine on its own: transition() only.
import { step } from "./run";
import { tourDone, walkerMachine, type WalkerPhase } from "./walker";

const at = (value: WalkerPhase) => ({ value, context: {} });
const go = (from: WalkerPhase, type: string) => step(walkerMachine, at(from), { type } as never).stored.value;

describe("walker machine", () => {
  it("walks the loop: heading -> inside -> (loiter) -> choosing -> heading", () => {
    expect(go("heading", "ARRIVED")).toBe("inside");
    expect(go("inside", "LINGER")).toBe("loitering");
    expect(go("loitering", "NEXT")).toBe("choosing");
    expect(go("choosing", "CHOSE_BUILDING")).toBe("heading");
    expect(go("choosing", "CHOSE_WANDER")).toBe("wandering");
    expect(go("wandering", "NEXT")).toBe("choosing");
  });

  it("can pick the next stop from anywhere they are on their feet, or from inside a building", () => {
    for (const from of ["heading", "inside", "loitering", "wandering"] as const) {
      expect(go(from, "NEXT"), from).toBe("choosing");
      expect(go(from, "TOUR_DONE"), from).toBe("leaving");
    }
  });

  it("sends a protester from the gate to their spot and, later, home and off the map", () => {
    expect(go("wandering", "PROTEST_STARTED")).toBe("picketing");
    expect(go("picketing", "SENT_HOME")).toBe("leaving");
    expect(go("leaving", "EXITED")).toBe("gone");
  });

  it("ignores events that make no sense in a phase", () => {
    expect(go("inside", "ARRIVED")).toBe("inside");
    expect(go("leaving", "NEXT")).toBe("leaving");
    expect(go("picketing", "NEXT")).toBe("picketing");
    expect(go("heading", "SENT_HOME")).toBe("heading");
  });

  it("keeps a visitor touring until no visits are left", () => {
    expect(tourDone("visitor", 2)).toBe(false);
    expect(tourDone("visitor", 0)).toBe(true);
    expect(tourDone("researcher", 0)).toBe(false);
    expect(tourDone("agent", 0)).toBe(false);
  });
});

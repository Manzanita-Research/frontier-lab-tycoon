// The walker machine on its own: transition() only.
import { step } from "./run";
import { stepWalker, tourDone, walkerMachine, type WalkerPhase } from "./walker";

const at = (value: WalkerPhase) => ({ value, context: {} });
const go = (from: WalkerPhase, type: string) => step(walkerMachine, at(from), { type } as never).stored.value;

describe("walker machine", () => {
  it("walks the loop: seeking -> inside -> (loiter) -> choosing -> seeking", () => {
    expect(go("seeking", "ARRIVED")).toBe("inside");
    expect(go("inside", "LINGER")).toBe("loitering");
    expect(go("loitering", "NEXT")).toBe("choosing");
    expect(go("choosing", "CHOSE_BUILDING")).toBe("seeking");
    expect(go("choosing", "CHOSE_WANDER")).toBe("wandering");
    expect(go("wandering", "NEXT")).toBe("choosing");
  });

  it("can pick the next stop from anywhere they are on their feet, in a queue, or inside a building", () => {
    for (const from of ["arriving", "seeking", "queuing", "inside", "loitering", "wandering"] as const) {
      expect(go(from, "NEXT"), from).toBe("choosing");
      expect(go(from, "TOUR_DONE"), from).toBe("leaving");
    }
  });

  it("queues when the building is full, then gets in or gives up", () => {
    expect(go("arriving", "ARRIVED")).toBe("inside");
    expect(go("arriving", "QUEUED")).toBe("queuing");
    expect(go("seeking", "QUEUED")).toBe("queuing");
    expect(go("queuing", "ADMITTED")).toBe("inside");
    expect(go("queuing", "GAVE_UP")).toBe("choosing");
  });

  it("walks a researcher out the gate with a box from any phase they can be in", () => {
    for (const from of ["arriving", "seeking", "queuing", "inside", "loitering", "wandering"] as const) expect(go(from, "QUIT"), from).toBe("quitting");
    expect(go("quitting", "EXITED")).toBe("gone");
    expect(go("quitting", "NEXT")).toBe("quitting");
    expect(go("leaving", "QUIT")).toBe("leaving");
  });

  it("sends a protester from the gate to their spot and, later, home and off the map", () => {
    expect(go("wandering", "PROTEST_STARTED")).toBe("picketing");
    expect(go("picketing", "SENT_HOME")).toBe("leaving");
    expect(go("leaving", "EXITED")).toBe("gone");
  });

  it("hands a drifted agent to the escape driver from anywhere on foot or inside, and back (FLT-59)", () => {
    for (const from of ["arriving", "seeking", "queuing", "inside", "loitering", "wandering"] as const) expect(go(from, "BREAKOUT"), from).toBe("escaping");
    expect(go("escaping", "RETURNED")).toBe("choosing");
    expect(go("escaping", "ESCAPED")).toBe("gone");
    for (const ignored of ["NEXT", "QUIT", "TOUR_DONE", "ARRIVED", "EXITED"]) expect(go("escaping", ignored), ignored).toBe("escaping");
    for (const from of ["leaving", "quitting", "picketing", "choosing"] as const) expect(go(from, "BREAKOUT"), from).toBe(from);
  });

  it("ignores events that make no sense in a phase", () => {
    expect(go("inside", "ARRIVED")).toBe("inside");
    expect(go("leaving", "NEXT")).toBe("leaving");
    expect(go("picketing", "NEXT")).toBe("picketing");
    expect(go("seeking", "SENT_HOME")).toBe("seeking");
  });

  it("keeps a visitor touring until no visits are left or patience is gone", () => {
    expect(tourDone("visitor", 2)).toBe(false);
    expect(tourDone("visitor", 0)).toBe(true);
    expect(tourDone("visitor", 2, 0.5)).toBe(false);
    expect(tourDone("visitor", 2, 0.02)).toBe(true);
    expect(tourDone("researcher", 0, 0)).toBe(false);
    expect(tourDone("researcher", 0)).toBe(false);
    expect(tourDone("agent", 0)).toBe(false);
  });

  it("stepWalker answers exactly what the machine does, for every phase and event", () => {
    const events = ["ARRIVED", "QUEUED", "ADMITTED", "GAVE_UP", "QUIT", "LINGER", "NEXT", "TOUR_DONE", "CHOSE_BUILDING", "CHOSE_WANDER", "PROTEST_STARTED", "SENT_HOME", "EXITED", "BREAKOUT", "RETURNED", "ESCAPED"];
    for (const value of Object.keys(walkerMachine.states) as WalkerPhase[]) {
      for (const type of events) {
        const viaMachine = step(walkerMachine, at(value), { type } as never).stored;
        expect(stepWalker(at(value), { type } as never), `${value} ${type}`).toEqual(viaMachine);
        expect(stepWalker(at(value), { type } as never), `${value} ${type} again`).toEqual(viaMachine);
      }
    }
  });
});

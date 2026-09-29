// Structure checks with xstate/graph: every state of every machine can be reached, and only final states are
// dead ends. Machines here have data-carrying events, so each test hands the explorer a small sample of them;
// states are compared by value (the context is a counter, not a state).
import type { AnyStateMachine } from "xstate";
import { getAdjacencyMap } from "xstate/graph";
import { EVENTS, EVENT_COOLDOWN_DAYS } from "../../content/events";
import { arcMachine } from "./arc";
import { economyMachine } from "./economy";
import { goalsMachine } from "./goals";
import { trainingMachine } from "./training";
import { walkerMachine } from "./walker";

const byValue = { serializeState: (s: { value: unknown }) => JSON.stringify(s.value) };

/** Explore `machine` and return what it reaches and which reached, non-final states lead nowhere. */
function explore(machine: AnyStateMachine, options: Record<string, unknown>) {
  const map = getAdjacencyMap(machine as never, { ...byValue, ...options } as never) as unknown as Record<string, { state: { value: string }; transitions: Record<string, { state: { value: string } }> }>;
  const reached = Object.values(map).map((n) => n.state.value);
  const deadEnds = Object.values(map)
    .filter((n) => (machine.states[n.state.value] as { type?: string } | undefined)?.type !== "final")
    .filter((n) => Object.values(n.transitions).every((t) => t.state.value === n.state.value))
    .map((n) => n.state.value);
  const declared = Object.keys(machine.states);
  return { reached, deadEnds, unreachable: declared.filter((s) => !reached.includes(s)) };
}

describe("machine graphs", () => {
  it("every event arc reaches all four states, and none but the loop is a dead end", () => {
    for (const def of EVENTS) {
      const input = { choices: def.choices.length, cooldownDays: def.cooldown ?? EVENT_COOLDOWN_DAYS, openedDay: null };
      const days = [0, 1, 200];
      const events = [
        ...days.flatMap((day) => [true, false].flatMap((ready) => [true, false].map((slotFree) => ({ type: "DAY" as const, day, ready, slotFree })))),
        ...def.choices.map((_, choiceIndex) => ({ type: "CHOOSE" as const, choiceIndex })),
      ];
      const r = explore(arcMachine, { input, events });
      expect(r.unreachable, def.id).toEqual([]);
      expect(r.deadEnds, def.id).toEqual([]);
    }
  });

  it("the economy reaches solvent, runwayWarning, bailout and bankrupt", () => {
    const events = [1e6, -1, -3e6, -5e6].flatMap((cash) => [0, 10, 21, 40].map((day) => ({ type: "DAY" as const, cash, day })));
    const r = explore(economyMachine, { input: { lastBailout: null }, events });
    expect(r.unreachable).toEqual([]);
    expect(r.deadEnds).toEqual([]);
  });

  it("goals reach won and lost from tracking; only those two are final", () => {
    const goals = [{ id: "a", value: 0, target: 1, met: false }];
    const events = [
      { type: "DAY" as const, day: 5, cash: 0, values: { a: 0 } },
      { type: "DAY" as const, day: 5, cash: 0, values: { a: 1 } },
      { type: "DAY" as const, day: 400, cash: 0, values: { a: 0 } },
      { type: "DAY" as const, day: 5, cash: -9e9, values: { a: 0 } },
    ];
    const r = explore(goalsMachine, { input: { goals, outcomeDay: null }, events });
    expect(r.unreachable).toEqual([]);
    expect(r.deadEnds).toEqual([]);
    expect(Object.entries(goalsMachine.states).filter(([, s]) => s.type === "final").map(([k]) => k).sort()).toEqual(["lost", "won"]);
  });

  it("a walker can reach every phase from a fresh spawn, and only `gone` is final", () => {
    const events = ["ARRIVED", "LINGER", "NEXT", "TOUR_DONE", "CHOSE_BUILDING", "CHOSE_WANDER", "PROTEST_STARTED", "SENT_HOME", "EXITED"].map((type) => ({ type }));
    const r = explore(walkerMachine, { events });
    expect(r.unreachable).toEqual([]);
    expect(r.deadEnds).toEqual([]);
    expect(Object.entries(walkerMachine.states).filter(([, s]) => (s as { type?: string }).type === "final").map(([k]) => k)).toEqual(["gone"]);
  });

  it("training reaches idle, training and releasing", () => {
    const events = [
      { type: "DAY" as const, halls: 0, gain: 0 },
      { type: "DAY" as const, halls: 1, gain: 1 },
      { type: "DAY" as const, halls: 1, gain: 300 },
      { type: "NAMED" as const, name: "X" },
    ];
    const r = explore(trainingMachine, { input: { run: 1, progress: 0, cost: 300, name: "A" }, events, limit: 200 });
    expect(r.unreachable).toEqual([]);
    expect(r.deadEnds).toEqual([]);
  });
});

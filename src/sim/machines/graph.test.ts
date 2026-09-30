// Structure checks with xstate/graph: every state of every machine can be reached, and only final states are
// dead ends. Machines here have data-carrying events, so each test hands the explorer a small sample of them;
// states are compared by value (the context is a counter, not a state).
import type { AnyStateMachine } from "xstate";
import { getAdjacencyMap } from "xstate/graph";
import { EVENTS, EVENT_COOLDOWN_DAYS } from "../../content/events";
import { arcMachine } from "./arc";
import { economyMachine } from "./economy";
import { RIVAL_BY_ID } from "../../content/rivals";
import { eraMachine } from "../race/era";
import { rivalMachine } from "../race/rival";
import { goalsMachine } from "./goals";
import { moodMachine } from "./mood";
import { staffMachine } from "./staff";
import { trainingMachine } from "./training";
import { walkerMachine } from "./walker";
import { tutorialMachine } from "./tutorial";
import { guardrailsMachine } from "./guardrails";

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
  it("a spending confirmation can open and clear", () => {
    const r = explore(guardrailsMachine, {
      input: { pendingConfirm: null, lowRunway: false, gateDisconnected: false },
      events: [{ type: "REQUEST", pendingConfirm: { kind: "hire", cost: 0, runwayAfter: 1, message: "Runway", command: { type: "hire", job: "sre" } } }, { type: "CLEAR" }],
    });
    expect(r.unreachable).toEqual([]);
    expect(r.deadEnds).toEqual([]);
  });
  it("the tutorial can reach every step, completion and skip", () => {
    const events = [
      { type: "FACTS", path: true, hall: true, revenue: true, hired: true, released: true },
      { type: "CONTINUE" }, { type: "SKIP" },
    ];
    const r = explore(tutorialMachine, { events });
    expect(r.unreachable).toEqual([]);
    expect(r.deadEnds).toEqual([]);
  });
  it("every event arc reaches all four states, and none but the loop is a dead end", () => {
    for (const def of EVENTS) {
      const input = { choices: def.choices.length, cooldownDays: def.cooldown ?? EVENT_COOLDOWN_DAYS, openedDay: null };
      const days = [0, 1, 200, 200_000]; // the last one is past the era cards' once-only cooldown
      const events = [
        ...days.flatMap((day) => [true, false].flatMap((ready) => [true, false].map((slotFree) => ({ type: "DAY" as const, day, ready, slotFree, pace: 1 })))),
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
    const events = ["ARRIVED", "QUEUED", "ADMITTED", "GAVE_UP", "QUIT", "LINGER", "NEXT", "TOUR_DONE", "CHOSE_BUILDING", "CHOSE_WANDER", "PROTEST_STARTED", "SENT_HOME", "EXITED", "BREAKOUT", "RETURNED", "ESCAPED"].map((type) => ({ type }));
    const r = explore(walkerMachine, { events });
    expect(r.unreachable).toEqual([]);
    expect(r.deadEnds).toEqual([]);
    expect(Object.entries(walkerMachine.states).filter(([, s]) => (s as { type?: string }).type === "final").map(([k]) => k)).toEqual(["gone"]);
  });

  it("a staffer can reach every phase from the gate, and only `gone` is final", () => {
    const events = ["ARRIVED", "TASK", "DONE", "LOST", "FIRED", "EXITED"].map((type) => ({ type }));
    const r = explore(staffMachine, { events });
    expect(r.unreachable).toEqual([]);
    expect(r.deadEnds).toEqual([]);
    expect(Object.entries(staffMachine.states).filter(([, s]) => (s as { type?: string }).type === "final").map(([k]) => k)).toEqual(["gone"]);
  });

  it("a mood can reach every state, and only `resigned` is final", () => {
    const events = ["LIFT", "SLUMP", "CRASH", "DAY"].map((type) => ({ type }));
    // The five-day countdown lives in the context, so tell the explorer the counter is part of the state.
    const r = explore(moodMachine, { input: {}, events, limit: 200, serializeState: (st: { value: unknown; context: unknown }) => JSON.stringify([st.value, st.context]) });
    expect(r.unreachable).toEqual([]);
    expect(r.deadEnds).toEqual([]);
    expect(Object.entries(moodMachine.states).filter(([, s]) => (s as { type?: string }).type === "final").map(([k]) => k)).toEqual(["resigned"]);
  });

  it("a rival can reach idle, training, releasing and cooldown", () => {
    const d = RIVAL_BY_ID.anthro;
    const input = { id: d.id, personality: d.personality, capability: 20, hype: 40, baseHype: 40, weeks: 0, releases: 0, open: false, momentum: 1, model: "", lastRelease: -1 };
    const week = { type: "WEEK" as const, week: 1, aggro: 1, pace: 1, chase: 1, lengthRoll: 0.5, gainRoll: 0.5, openRoll: 0.5, poachRoll: 0.9, name: "M", closed: false };
    const events = [week, { ...week, pace: 50 }, { type: "SHOCK" as const, capability: -1, hype: -1, momentum: -0.1 }];
    const r = explore(rivalMachine, { input, events, limit: 200 });
    expect(r.unreachable).toEqual([]);
    // (no dead-end check: states are compared by value, and a run counts its weeks down in the context, which the
    // explorer holds at whatever it was on first arrival. rival.test.ts walks a whole cycle instead.)
  });

  it("the era ratchet reaches all four eras, and only climbs", () => {
    const events = [1, 2.5, 6, 40].map((mult) => ({ type: "DAY" as const, mult }));
    const r = explore(eraMachine, { input: { peak: 1 }, events });
    expect(r.unreachable).toEqual([]);
    // era4 can only loop on itself, which the dead-end check reports: that is the top of the ratchet, not a bug.
    expect(r.deadEnds).toEqual(["era4"]);
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

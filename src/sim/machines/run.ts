// How the sim drives a machine: one pure transition() per event, no actor.
//
// The World keeps only `{ value, context }` per machine (JSON). resolveState rebuilds a live snapshot from it
// (~9.6 us with transition(), against ~37 us for getPersistedSnapshot/restoreSnapshot; measured in the FLT-3 PR).
// A machine never touches the World: it returns its next state plus the effects it wants, as emitted events,
// and the driver applies them in order. That keeps machines pure, graph-testable and rng-free.
import { initialTransition, transition, type AnyStateMachine, type EmittedFrom, type EventFromLogic, type InputFrom } from "xstate";

type Snap<TMachine extends AnyStateMachine> = ReturnType<TMachine["getInitialSnapshot"]>;

/** The persisted part of a machine snapshot. */
export interface Stored<TMachine extends AnyStateMachine> {
  value: Snap<TMachine>["value"];
  context: Snap<TMachine>["context"];
}

export interface Stepped<TMachine extends AnyStateMachine> {
  stored: Stored<TMachine>;
  /** Emitted events in the order the transition enqueued them. */
  effects: EmittedFrom<TMachine>[];
}

export function initialStored<TMachine extends AnyStateMachine>(machine: TMachine, input: InputFrom<TMachine>): Stored<TMachine> {
  const [first] = initialTransition(machine, ...([input] as never));
  const snapshot = first as Snap<TMachine>;
  return { value: snapshot.value, context: snapshot.context };
}

/** Send one event. The input is not modified; a handled or ignored event both return a usable `stored`. */
export function step<TMachine extends AnyStateMachine>(machine: TMachine, stored: Stored<TMachine>, event: EventFromLogic<TMachine>): Stepped<TMachine> {
  const [result, actions] = transition(machine, machine.resolveState(stored as never), event);
  const next = result as Snap<TMachine>;
  const effects: EmittedFrom<TMachine>[] = [];
  for (const a of actions) if (a.kind === "emit") effects.push(a.event as EmittedFrom<TMachine>);
  return { stored: { value: next.value, context: next.context }, effects };
}

/** A copy of a stored state or an emitted event that shares nothing with the original (they are plain data: JSON, plus the odd `undefined`). */
function copy<T>(x: T): T {
  if (typeof x !== "object" || x === null) return x;
  if (Array.isArray(x)) return x.map(copy) as T;
  const out: Record<string, unknown> = {};
  for (const k in x) out[k] = copy((x as Record<string, unknown>)[k]);
  return out as T;
}

/** A key that tells apart everything `copy` keeps: unlike JSON, `undefined`, `Infinity`, `NaN` and `-0` each keep their own spelling. */
function keyOf(x: unknown): string {
  switch (typeof x) {
    case "number":
      return Object.is(x, -0) ? "-0" : String(x);
    case "string":
      return JSON.stringify(x);
    case "object": {
      if (x === null) return "null";
      if (Array.isArray(x)) return `[${x.map(keyOf).join(",")}]`;
      let out = "{";
      for (const k in x) out += `${JSON.stringify(k)}:${keyOf((x as Record<string, unknown>)[k])},`;
      return `${out}}`;
    }
    default:
      return String(x);
  }
}

/**
 * `step`, remembered (FLT-39). A sim machine is a pure function of its stored state and the event (house rule: no
 * randomness, no World, nothing but `{ value, context }` and the event), so the same pair always gives the same answer:
 * this asks XState once per pair and hands out copies of the answer after that, about 1 us against 10 to 25 us.
 * It pays where many machines hear the same thing: every event card's arc on the daily check, the mood of every unhappy
 * researcher, every staffer finishing a job. Only for a machine that reads nothing outside its snapshot and the event
 * (a guard that called `defs()` would be keyed on the wrong thing); its tests compare it with `step`.
 * The table forgets everything once it holds `limit` answers, so a machine whose events carry the day stays small.
 */
export function remembered<TMachine extends AnyStateMachine>(machine: TMachine, limit = 512) {
  let memo = new Map<string, Stepped<TMachine>>();
  return (stored: Stored<TMachine>, event: EventFromLogic<TMachine>): Stepped<TMachine> => {
    const key = keyOf(stored) + keyOf(event);
    let hit = memo.get(key);
    if (hit === undefined) {
      if (memo.size >= limit) memo = new Map();
      hit = copy(step(machine, stored, event));
      memo.set(key, hit);
    }
    return copy(hit);
  };
}

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

import { createMachine } from "xstate";
import { getDescendantStateNodes, getShortestPaths } from "xstate/graph";

/** Structural projection only: every transition gets its own event, so every guarded
 * alternative can be traversed without guessing stats, rolling dice, or running actions. */
export function checkArcGraph(arc) {
  let sequence = 0;
  const events = [];
  function project(states) {
    return Object.fromEntries(Object.entries(states).map(([name, node]) => {
      const on = {};
      for (const value of Object.values(node.on ?? {})) {
        for (const transition of Array.isArray(value) ? value : [value]) {
          const type = `structural:${sequence++}`;
          events.push({ type });
          const target = typeof transition === "string" ? transition : transition.target;
          on[type] = target ? { target } : {};
        }
      }
      return [name, {
        ...(node.type ? { type: node.type } : {}),
        ...(node.initial ? { initial: node.initial } : {}),
        ...(node.states ? { states: project(node.states) } : {}),
        on,
      }];
    }));
  }
  const machine = createMachine({ id: arc.id, initial: arc.initial, states: project(arc.states) });
  const paths = getShortestPaths(machine, { events, serializeState: (state) => JSON.stringify(state.value), limit: 10000 });
  const nodes = getDescendantStateNodes(machine.root).filter((node) => node.path.length > 0);
  const unreachable = nodes.filter((node) => !paths.some(({ state }) => state.matches(node.path.join(".")))).map((node) => node.path.join("."));
  if (unreachable.length) throw new Error(`arc ${arc.id}: unreachable states: ${unreachable.join(", ")}`);
  return { id: arc.id, states: nodes.length, configurations: paths.length, method: "xstate/graph (structural; guards/actions omitted)" };
}

import { HEADLINES } from "../content/headlines";
import { THOUGHTS } from "../content/thoughts";
import type { ContentApi } from "./services/content";
import type { VocabularyApi } from "./services/vocabulary";
import { ArcNode, ModError, suggest, type ArcData, type NamedCallData } from "./schema";
import type { Schema } from "effect";

const triggers = new Set(HEADLINES.map((line) => line.trigger));
const conditions = new Set(THOUGHTS.map((line) => line.when));
function known(value: string, values: readonly string[], path: string) {
  if (!values.includes(value)) throw new ModError({ path, detail: `unknown value "${value}"${suggest(value, values)}` });
}
export function validateContent(content: ContentApi, vocabulary: VocabularyApi): void {
  const kinds = content.walkerKinds.map((kind) => kind.id);
  const buildings = Object.keys(content.buildings);
  for (const [id, building] of Object.entries(content.buildings)) {
    building.hosts.forEach((kind, i) => known(kind, kinds, `content.buildings.${id}.hosts[${i}]`));
    for (const [kind, serves] of Object.entries(building.serves)) {
      known(kind, kinds, `content.buildings.${id}.serves.${kind}`);
      const needs = content.walkerKinds.find((entry) => entry.id === kind)?.needs ?? [];
      Object.keys(serves).forEach((need) => known(need, needs, `content.buildings.${id}.serves.${kind}.${need}`));
    }
    if (building.stay[0] > building.stay[1]) throw new ModError({ path: `content.buildings.${id}.stay`, detail: "minimum exceeds maximum" });
  }
  content.headlines.forEach((line, i) => {
    const allowed: string[] = [...triggers, ...buildings.map((kind) => `built:${kind}`)];
    known(line.trigger, allowed, `content.headlines[${i}].trigger`);
  });
  content.thoughts.forEach((line, i) => {
    known(line.kind, kinds, `content.thoughts[${i}].kind`);
    known(line.when, [...conditions], `content.thoughts[${i}].when`);
  });
  content.events.forEach((event, i) => {
    if (!("choices" in event)) { validateArc(event, vocabulary, `content.events[${i}]`); return; }
    event.choices.forEach((choice, j) => choice.effects.forEach((effect, k) => {
    const path = `content.events[${i}].choices[${j}].effects[${k}]`;
    if (effect.type === "place") known(effect.kind, buildings, `${path}.kind`);
    if (effect.type === "thought" && effect.kind) known(effect.kind, kinds, `${path}.kind`);
    if ((effect.type === "discourse" || effect.type === "protesters") && effect.add === undefined && effect.set === undefined) throw new ModError({ path, detail: "expected add or set" });
    }));
  });
  const eventIds = new Set(content.events.map((event) => event.id));
  content.arcs.forEach((arc, i) => {
    if (eventIds.has(arc.id)) throw new ModError({ path: `content.arcs[${i}].id`, detail: `id "${arc.id}" is already in events` });
  });
  content.arcs.forEach((arc, i) => validateArc(arc, vocabulary, `content.arcs[${i}]`));
}

/** Structural reachability, ignoring guard outcomes. This is validation only, not a second sim engine.
 * Targets use sibling paths (including a compound state's descendants). Delays and inline code have no schema. */
export function validateArc(arc: ArcData, vocabulary: VocabularyApi, path: string): void {
  const nodes = new Map<string, Schema.Schema.Type<typeof ArcNode>>();
  const collect = (states: ArcData["states"], parent: string) => {
    for (const [key, node] of Object.entries(states)) {
      const full = parent ? `${parent}.${key}` : key;
      nodes.set(full, node);
      if (node.states) collect(node.states, full);
    }
  };
  collect(arc.states, "");
  const call = (value: NamedCallData, names: readonly string[], at: string) => known(typeof value === "string" ? value : value.type, names, at);
  const edges = new Map<string, string[]>();
  known(arc.initial, Object.keys(arc.states), `${path}.initial`);
  for (const [key, node] of nodes) {
    const targets: string[] = [];
    if (node.states) {
      if (!node.initial) throw new ModError({ path: `${path}.states.${key}.initial`, detail: "compound state needs an initial child" });
      known(node.initial, Object.keys(node.states), `${path}.states.${key}.initial`);
      targets.push(`${key}.${node.initial}`);
    } else if (node.initial) throw new ModError({ path: `${path}.states.${key}.initial`, detail: "initial requires child states" });
    for (const [i, action] of (node.entry ?? []).entries()) call(action, vocabulary.effects, `${path}.states.${key}.entry[${i}]`);
    for (const [i, action] of (node.exit ?? []).entries()) call(action, vocabulary.effects, `${path}.states.${key}.exit[${i}]`);
    for (const [event, value] of Object.entries(node.on ?? {})) {
      const transitions = Array.isArray(value) ? value : [value];
      for (const [i, transition] of transitions.entries()) {
        const at = `${path}.states.${key}.on.${event}[${i}]`;
        const target = typeof transition === "string" ? transition : transition.target;
        if (target) {
          const parent = key.includes(".") ? key.slice(0, key.lastIndexOf(".")) : "";
          const full = target.startsWith(".") ? `${key}${target}` : parent ? `${parent}.${target}` : target;
          known(full, [...nodes.keys()], `${at}.target`);
          targets.push(full);
        }
        if (typeof transition !== "string") {
          if (transition.guard) call(transition.guard, vocabulary.guards, `${at}.guard`);
          for (const [j, action] of (transition.actions ?? []).entries()) call(action, vocabulary.effects, `${at}.actions[${j}]`);
        }
      }
    }
    edges.set(key, targets);
  }
  const reached = new Set<string>();
  const queue = [arc.initial];
  while (queue.length) {
    const key = queue.shift();
    if (!key || reached.has(key)) continue;
    reached.add(key);
    // Entering a descendant also makes its parent transitions possible.
    if (key.includes(".")) queue.push(key.slice(0, key.lastIndexOf(".")));
    queue.push(...(edges.get(key) ?? []));
  }
  const unreachable = [...nodes.keys()].filter((key) => !reached.has(key));
  if (unreachable.length) throw new ModError({ path: `${path}.states`, detail: `unreachable states: ${unreachable.join(", ")}` });
}

// Friendly checking of a disaster pack: every complaint starts with the JSON path, as docs/MODDING.md §2 promises
// ("content.disasters.add[0].states.cleanup.on.TICK[1].guard: unknown guard "afterr" (did you mean "after"?)").
// `flt-mod check` (FLT-15 M2) will call this for the `disasters` section.
import { BUILDINGS } from "../../content/buildings";
import { checkCall } from "../verbs";
import type { Call, DisasterDef, DisasterPack, StateNode, TransitionDef } from "./types";

const EFFECTS = ["cash", "hype", "discourse", "protesters", "flag", "news", "thought", "place", "race"];
const ID = /^[A-Za-z][\w-]*$/;

const asList = (t: TransitionDef | TransitionDef[] | undefined): TransitionDef[] => (t === undefined ? [] : Array.isArray(t) ? t : [t]);

function callErrors(calls: readonly Call[] | undefined, kind: "verb" | "guard", path: string): string[] {
  if (calls === undefined) return [];
  if (!Array.isArray(calls)) return [`${path}: expected a list`];
  return calls.flatMap((c, i) => checkCall(c, kind, `${path}[${i}]`));
}

function stateErrors(def: DisasterDef, name: string, node: StateNode, path: string, choices: Set<string>, cards: Set<string>): string[] {
  const errors: string[] = [];
  errors.push(...callErrors(node.entry, "verb", `${path}.entry`), ...callErrors(node.exit, "verb", `${path}.exit`));
  if (node.type === "final") {
    if (node.on) errors.push(`${path}.on: a final state hears nothing`);
    return errors;
  }
  if (node.work) {
    if (!["janitor", "sre", "comms", "security"].includes(node.work.job)) errors.push(`${path}.work.job: expected janitor, sre, comms or security`);
    if (typeof node.work.at !== "string") errors.push(`${path}.work.at: expected a building kind or "$target"`);
    if (!(node.work.hours > 0)) errors.push(`${path}.work.hours: expected a positive number`);
  }
  const on = node.on ?? {};
  for (const key of Object.keys(on)) if (key !== "TICK" && key !== "CHOSE") errors.push(`${path}.on.${key}: a disaster hears TICK and CHOSE`);
  let exits = 0;
  for (const beat of ["TICK", "CHOSE"] as const) {
    asList(on[beat]).forEach((t, i) => {
      const at = `${path}.on.${beat}[${i}]`;
      if (t.guard !== undefined) errors.push(...(Array.isArray(t.guard) ? callErrors(t.guard, "guard", `${at}.guard`) : checkCall(t.guard, "guard", `${at}.guard`)));
      errors.push(...callErrors(t.actions, "verb", `${at}.actions`));
      if (t.target !== undefined) {
        if (!(t.target in def.states)) errors.push(`${at}.target: no state "${t.target}"`);
        else exits++;
      }
      const guards = t.guard === undefined ? [] : Array.isArray(t.guard) ? t.guard : [t.guard];
      for (const g of guards) if (typeof g === "object" && g.type === "choice" && typeof g.params?.is === "string" && !choices.has(g.params.is)) errors.push(`${at}.guard: no card choice with key "${g.params.is}"`);
    });
  }
  if (exits === 0) errors.push(`${path}: state "${name}" has no way out (add a transition with a target, or make it type "final")`);
  for (const call of [...(node.entry ?? []), ...(node.exit ?? []), ...asList(on.TICK).flatMap((t) => t.actions ?? []), ...asList(on.CHOSE).flatMap((t) => t.actions ?? [])]) {
    const c = typeof call === "string" ? { type: call, params: undefined } : call;
    if (c.type === "card" && typeof c.params?.id === "string" && !cards.has(c.params.id)) errors.push(`${path}: card "${c.params.id}" is not in this disaster's cards`);
  }
  return errors;
}

export function validateDisaster(def: DisasterDef, path: string): string[] {
  const errors: string[] = [];
  if (typeof def.id !== "string" || !ID.test(def.id)) errors.push(`${path}.id: expected letters, digits, - and _ (starting with a letter)`);
  for (const key of ["name", "blurb"] as const) if (typeof def[key] !== "string" || def[key].length === 0) errors.push(`${path}.${key}: expected text`);
  if (!def.odds || !(def.odds.weight >= 0)) errors.push(`${path}.odds.weight: expected a number, 0 or more`);
  for (const [i, s] of (def.odds?.scale ?? []).entries()) errors.push(...checkCall({ type: "stat.gte", params: { stat: s.stat, value: 0 } }, "guard", `${path}.odds.scale[${i}]`));
  if (def.requires) errors.push(...(Array.isArray(def.requires.guard) ? callErrors(def.requires.guard, "guard", `${path}.requires.guard`) : checkCall(def.requires.guard, "guard", `${path}.requires.guard`)));
  if (def.target && !(def.target.kind in BUILDINGS)) errors.push(`${path}.target.kind: unknown building "${def.target.kind}"`);
  if (!def.states || typeof def.states !== "object") return [...errors, `${path}.states: expected an object`];
  if (!(def.initial in def.states)) errors.push(`${path}.initial: no state "${def.initial}"`);

  const cards = new Set((def.cards ?? []).map((c) => c.id));
  const choices = new Set((def.cards ?? []).flatMap((c) => c.choices.map((ch) => ch.key)));
  for (const [name, node] of Object.entries(def.states)) errors.push(...stateErrors(def, name, node, `${path}.states.${name}`, choices, cards));

  // Every state can be reached from the start, and the disaster can end.
  const seen = new Set<string>();
  const queue = [def.initial];
  while (queue.length > 0) {
    const s = queue.pop()!;
    if (seen.has(s) || !(s in def.states)) continue;
    seen.add(s);
    const on = def.states[s]!.on ?? {};
    for (const t of [...asList(on.TICK), ...asList(on.CHOSE)]) if (t.target !== undefined) queue.push(t.target);
  }
  for (const name of Object.keys(def.states)) if (!seen.has(name)) errors.push(`${path}.states.${name}: unreachable from "${def.initial}"`);
  if (![...seen].some((s) => def.states[s]?.type === "final")) errors.push(`${path}.states: no final state is reachable (a disaster has to end)`);

  (def.cards ?? []).forEach((c, i) => {
    const at = `${path}.cards[${i}]`;
    if (!ID.test(c.id)) errors.push(`${at}.id: expected letters, digits, - and _`);
    if (c.choices.length < 1 || c.choices.length > 3) errors.push(`${at}.choices: one to three choices`);
    const keys = new Set<string>();
    c.choices.forEach((ch, j) => {
      if (keys.has(ch.key)) errors.push(`${at}.choices[${j}].key: "${ch.key}" is used twice`);
      keys.add(ch.key);
      ch.effects.forEach((e, k) => {
        if (!EFFECTS.includes(e.type)) errors.push(`${at}.choices[${j}].effects[${k}]: unknown effect "${e.type}"`);
      });
    });
  });
  return errors;
}

export function validatePack(pack: DisasterPack): string[] {
  const errors: string[] = [];
  if (pack.apiVersion !== 1) errors.push("apiVersion: expected 1");
  const ids = new Set<string>();
  pack.content.disasters.add.forEach((d, i) => {
    if (ids.has(d.id)) errors.push(`content.disasters.add[${i}].id: "${d.id}" is used twice`);
    ids.add(d.id);
    errors.push(...validateDisaster(d, `content.disasters.add[${i}]`));
  });
  return errors;
}

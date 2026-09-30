// FLT-20 Poaching War. The Race's POACH beat (FLT-9) and the neo labs' ask here first: with the pack on, a poach
// becomes one offer to several researchers at once and a card. Own random stream; the chart owns the beats.
import { eventById } from "../../content/events";
import { THOUGHT_TICKS } from "../constants";
import { fillTemplate, formatMoney } from "../format";
import { arcMachine } from "../machines/arc";
import { compileChart, stepChart, type ChartEvent } from "../machines/packChart";
import { initialStored } from "../machines/run";
import { happinessOf } from "../needs";
import { addNews } from "../news";
import { foundNeoLab, neoLabById } from "../neolabs/driver";
import { createRng, type Rng } from "../rng";
import type { GameState, Walker } from "../types";
import { runVerb } from "../verbs";
import { CARD, CHOICES, PICK_PREFIX, POACHING } from "./pack";
import type { PoachingStage } from "./state";
import { picked, picks } from "../picks";

const R = POACHING.rules;
const OWNER = "poaching";
export const poachingMachine = compileChart(POACHING.chart);
const onStaff = (w: Walker) => w.kind === "researcher" && w.machine.value !== "quitting" && w.machine.value !== "leaving" && w.machine.value !== "gone";
const byId = (s: GameState, id: number) => s.walkers.find((w) => w.id === id);

/** What the chart pays each person on a match, and the Vibes the mission speech needs (for the card's hints). */
const chartNumber = (verb: string, key: string): number => {
  type Node = { type?: string; params?: Record<string, unknown> } | string;
  const find = (c: Node): number | null => {
    if (typeof c === "string") return null;
    if (c.type === verb && verb !== "stat.gte" && typeof c.params?.[key] === "number") return c.params[key] as number;
    if (c.type === "stat.gte" && verb === "stat.gte" && c.params?.stat === key) return c.params.value as number;
    // Combined guards ("and", "or", "not") keep theirs under `params.guards`.
    for (const g of (c.params?.guards as Node[] | undefined) ?? []) {
      const n = find(g);
      if (n !== null) return n;
    }
    return null;
  };
  for (const t of [POACHING.chart.states.offered?.on?.CHOSE ?? []].flat()) {
    if (typeof t === "string") continue;
    for (const c of [...(t.actions ?? []), ...[t.guard ?? []].flat()]) {
      const n = find(c as Node);
      if (n !== null) return n;
    }
  }
  return 0;
};
const MATCH_EACH = chartNumber("people.pay", "each");
const VIBES_NEEDED = chartNumber("stat.gte", "vibes");

export function enablePoaching(s: GameState) {
  s.poaching ??= {
    enabled: true, rngState: (s.seed ^ 0x504f4348) >>> 0,
    machine: { value: "quiet", context: { enteredTick: s.tick, enteredDay: s.day } },
    offer: null, founding: null, tally: { offers: 0, matched: 0, stayed: 0, lost: 0 }, history: [],
  };
  s.poaching.enabled = true;
  for (const def of POACHING.content.events.add) s.arcs[def.id] ??= initialStored(arcMachine, { choices: def.choices.length, cooldownDays: def.cooldown ?? 0, openedDay: null });
}
export function disablePoaching(s: GameState) {
  const p = s.poaching;
  if (!p) return;
  p.enabled = false;
  p.machine = { value: "quiet", context: { enteredTick: s.tick, enteredDay: s.day } };
  delete s.flags[`offer:${CARD}`];
  for (const key of CHOICES) delete s.flags[PICK_PREFIX + key];
  const def = eventById(CARD);
  if (def) s.arcs[CARD] = initialStored(arcMachine, { choices: def.choices.length, cooldownDays: def.cooldown ?? 0, openedDay: null });
}

const present = (s: GameState) => (s.poaching?.offer?.targets ?? []).filter((id) => { const w = byId(s, id); return !!w && onStaff(w); });

export function poachingVars(s: GameState): Record<string, string> {
  const p = s.poaching;
  const out: Record<string, string> = { vibes: String(Math.round(s.vibes.value)), vibesNeeded: String(VIBES_NEEDED) };
  if (!p?.offer) return out;
  const o = p.offer;
  const n = present(s).length || o.targets.length;
  Object.assign(out, {
    poacher: o.name, poacherShort: o.short, poacherId: o.from, poachCount: String(n), poachFirst: o.names[0] ?? "",
    poachNames: o.names.length <= 1 ? (o.names[0] ?? "") : `${o.names.slice(0, -1).join(", ")} and ${o.names[o.names.length - 1]}`,
    poachCost: formatMoney(MATCH_EACH * n),
  });
  const lab = p.founding?.lab ? neoLabById(s, p.founding.lab) : undefined;
  if (lab) Object.assign(out, { neoName: lab.name, neoFounder: lab.founder });
  return out;
}

/**
 * A rival wants your people. With the pack on and no offer open, it becomes one offer to several researchers and a
 * card, and this returns true (the caller skips its own walk-out). Otherwise false: the FLT-9 poach goes ahead.
 */
export function offerPoach(s: GameState, from: { from: string; name: string; short: string }): boolean {
  const p = s.poaching;
  if (!p?.enabled || p.machine.value !== "quiet") return false;
  if (p.offer && s.day - p.offer.day < R.restDays) return false;
  const staff = s.walkers.filter(onStaff).filter((w) => w.id !== s.defection?.subject?.id);
  if (staff.length <= R.targets.floor) return false;
  const rng = createRng(p.rngState);
  const [lo, hi] = R.bigPoachers.includes(from.from) ? R.targets.big : R.targets.other;
  // Never below the floor: an offer takes at most the researchers above it.
  const n = Math.min(rng.int(lo, hi), staff.length - R.targets.floor);
  // The least happy are the ones who pick up the phone.
  const targets = [...staff].sort((a, b) => happinessOf(a) - happinessOf(b) || a.id - b.id).slice(0, Math.max(1, n));
  p.offer = { day: s.day, from: from.from, name: from.name, short: from.short, targets: targets.map((w) => w.id), names: targets.map((w) => w.name) };
  p.tally.offers++;
  const asks = POACHING.content.thoughts.add.filter((t) => t.when === "offer");
  for (const w of targets) {
    s.thoughts = s.thoughts.filter((t) => t.walkerId !== w.id);
    s.thoughts.push({ id: s.nextId++, walkerId: w.id, kind: "researcher", text: rng.pick(asks).text, expiresTick: s.tick + THOUGHT_TICKS });
  }
  send(s, rng, { type: "DAY", day: s.day, tick: s.tick, stats: { offerReady: 1 } });
  p.rngState = rng.state();
  return true;
}

function send(s: GameState, rng: Rng, event: ChartEvent) {
  const p = s.poaching!;
  const previous = p.machine.value;
  const { stored, calls } = stepChart<PoachingStage>(poachingMachine, p.machine, event);
  p.machine = stored;
  const people = present(s);
  const vars = poachingVars(s);
  for (const call of calls) runVerb({ state: s, rng, run: null, owner: OWNER, people, vars }, { type: call.verb, params: call.params });
  if (previous !== p.machine.value) p.history.push({ day: s.day, stage: p.machine.value });
  return p.machine.value;
}

const CHOICE_FLAGS = picks(PICK_PREFIX, CHOICES);

export function applyPoachingChoices(s: GameState) {
  const p = s.poaching;
  if (!p?.enabled || !picked(s.flags, CHOICE_FLAGS)) return;
  const rng = createRng(p.rngState);
  for (const { key: choice, flag } of CHOICE_FLAGS) {
    if (s.flags[flag] === undefined) continue;
    delete s.flags[flag];
    if (p.machine.value !== "offered" || !p.offer) continue;
    const foundRoll = rng.next();
    const people = present(s);
    const next = send(s, rng, { type: "CHOSE", choice, day: s.day, tick: s.tick, stats: { vibes: s.vibes.value } });
    if (next === "walkout") {
      p.tally.lost += people.length;
      s.race.poached += people.length;
      const lab = neoLabById(s, p.offer.from);
      if (lab) lab.poached += people.length;
      const founder = people[0] !== undefined ? byId(s, people[0]) : undefined;
      if (founder && foundRoll < R.found.chance) p.founding = {
        day: s.day, founderId: founder.id, founder: founder.name, from: p.offer.name, fromShort: p.offer.short, lab: null,
        followers: people.slice(1).map((id) => byId(s, id)?.name ?? "").filter(Boolean),
      };
    } else if (choice === "match") p.tally.matched += people.length;
    else p.tally.stayed += people.length;
    // Whatever happened, the ⚡ comes down.
    s.thoughts = s.thoughts.filter((t) => !people.includes(t.walkerId) || !t.text.startsWith("⚡"));
  }
  p.rngState = rng.state();
}

/** Once a day: the walk-out rests, and a poached researcher who quit again founds a lab. */
export function dailyPoaching(s: GameState) {
  const p = s.poaching;
  if (!p?.enabled) return;
  const rng = createRng(p.rngState);
  if (p.machine.value === "walkout") send(s, rng, { type: "DAY", day: s.day, tick: s.tick, stats: { rested: s.day - p.machine.context.enteredDay >= R.restDays ? 1 : 0 } });
  const f = p.founding;
  if (f && !f.lab && s.day - f.day >= R.found.delayDays) {
    const lab = foundNeoLab(s, {
      founder: { id: f.founderId, name: f.founder }, followers: f.followers, origin: "poaching", mood: "hostile",
      names: POACHING.names.map((n) => n.replace("{poacherShort}", f.fromShort)), manifestos: POACHING.manifestos,
      capability: s.capability * R.found.startShare, hype: R.found.startHype, personality: R.personality, lines: POACHING.content.neoLines,
    });
    f.lab = lab.id;
    const h = rng.pick(POACHING.content.headlines.add.filter((x) => x.trigger === "founded"));
    addNews(s, fillTemplate(h.text, { lab: s.labName, poacher: f.from, neoFounder: f.founder, neoName: lab.name }), h.tone);
  }
  p.rngState = rng.state();
}

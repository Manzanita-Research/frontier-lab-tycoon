// Founding and running neo labs. Weekly, with the same rival machine and era numbers as the built-in labs, on this
// module's own random stream. The packs decide who founds what and in whose words; this is the plumbing.
import { eraDef } from "../../content/eras";
import { arenaScore } from "../../content/rivals";
import { fillTemplate } from "../format";
import { initialStored, step } from "../machines/run";
import { addNews, addToast } from "../news";
import { refreshBoard } from "../race/arena";
import { chase, eraOfState, POACH_FEE } from "../race/race";
import { rivalMachine } from "../race/rival";
import { rivalRules } from "../race/rules";
import { createRng, type Rng } from "../rng";
import type { GameState } from "../types";
import { resign } from "../walkers";
import { offerPoach } from "../poaching/driver";
import type { NeoLab, NeoLabsState, NeoMood, NeoOrigin, Personality } from "./state";

/** A neo lab only poaches from a lab with more researchers than this (the FLT-9 floor). */
const POACH_FLOOR = 5;
const MODEL_NAMES = ["{short}-{n}", "{short} {n} Preview", "{short}-{n}o", "{short} {n} (Responsible Edition)", "{short} {n} Mini Max"];
/** Colours a new lab can take, in order: none is a built-in lab's. */
const COLORS = ["#d94f8a", "#3fb7c9", "#8fbf3f", "#e0663a", "#9a6bd6", "#c9a13f"];

export function neoLabs(s: GameState): NeoLabsState {
  return (s.neoLabs ??= { rngState: (s.seed ^ 0x4e454f4c) >>> 0, seq: 0, labs: [] });
}

export const neoLabById = (s: Pick<GameState, "neoLabs">, id: string): NeoLab | undefined => s.neoLabs?.labs.find((l) => l.id === id);

/** "Dr. Ada Gradient" -> { first: "Ada", last: "Gradient" }. */
export function nameParts(name: string): { first: string; last: string } {
  const words = name.replace(/^Dr\.\s+/, "").split(/\s+/);
  return { first: words[0] ?? name, last: words.slice(1).join(" ") || (words[0] ?? name) };
}

export interface Founding {
  founder: { id: number; name: string };
  followers: string[];
  origin: NeoOrigin;
  mood: NeoMood;
  /** Name templates ({first}, {last}); the first one not already on the Arena wins. */
  names: readonly string[];
  manifestos: readonly string[];
  /** Starting capability and hype. */
  capability: number;
  hype: number;
  personality: Personality;
  lines: { readonly [K in keyof NeoLab["lines"]]: readonly string[] };
}

/** A new lab joins the Arena today. Returns it (the caller writes the headline). */
export function foundNeoLab(s: GameState, f: Founding): NeoLab {
  const n = neoLabs(s);
  const rng = createRng(n.rngState);
  const { first, last } = nameParts(f.founder.name);
  const vars = { first, last, firstLower: first.toLowerCase(), lab: s.labName };
  const taken = new Set(n.labs.map((l) => l.name));
  const start = rng.int(0, f.names.length - 1);
  let name = "";
  for (let k = 0; k < f.names.length && !name; k++) {
    const candidate = fillTemplate(f.names[(start + k) % f.names.length]!, vars);
    if (!taken.has(candidate)) name = candidate;
  }
  if (!name) name = `${fillTemplate(f.names[start]!, vars)} ${n.seq + 1}`;
  n.seq++;
  const lab: NeoLab = {
    id: `neo:${n.seq}`,
    name,
    short: name.length > 16 ? `${last} Labs` : name,
    color: COLORS[(n.seq - 1) % COLORS.length]!,
    founder: f.founder.name,
    followers: [...f.followers],
    manifesto: fillTemplate(rng.pick(f.manifestos), vars),
    origin: f.origin,
    mood: f.mood,
    founded: s.day,
    nemesis: false,
    poached: 0,
    rival: initialStored(rivalMachine, {
      id: `neo:${n.seq}`, personality: { ...f.personality }, capability: Math.max(1, f.capability), hype: f.hype, baseHype: f.hype,
      weeks: 0, releases: 0, open: false, momentum: 1, model: "", lastRelease: -1,
    }),
    lines: { release: [...f.lines.release], poach: [...f.lines.poach], nemesis: [...f.lines.nemesis], goodwill: [...f.lines.goodwill] },
  };
  n.labs.push(lab);
  n.rngState = rng.state();
  refreshBoard(s);
  return lab;
}

/** The Arena rows for the neo labs (sim/race/state.ts `rankBoard` adds them). */
export function neoRows(s: Partial<Pick<GameState, "neoLabs">>): { id: string; score: number }[] {
  return (s.neoLabs?.labs ?? []).map((l) => ({ id: l.id, score: arenaScore(l.rival.context.capability, l.rival.context.hype) }));
}

function say(s: GameState, lab: NeoLab, rng: Rng, lines: readonly string[], extra: Record<string, string> = {}) {
  if (lines.length === 0) return "";
  return fillTemplate(rng.pick(lines), { rival: lab.name, founder: lab.founder, lab: s.labName, ...extra });
}

/** A neo lab wants one of your people: the Poaching War's offer card if that pack is on, the FLT-9 walk-out if not. */
function poach(s: GameState, lab: NeoLab, rng: Rng) {
  const staff = s.walkers.filter((w) => w.kind === "researcher" && w.machine.value !== "leaving" && w.machine.value !== "quitting");
  if (staff.length <= POACH_FLOOR) return;
  if (offerPoach(s, { from: lab.id, name: lab.name, short: lab.short })) return;
  const gone = rng.pick(staff);
  resign(s, gone, rng);
  s.cash -= POACH_FEE;
  s.hype = Math.max(0, s.hype - 1.5);
  s.race.poached++;
  lab.poached++;
  addNews(s, say(s, lab, rng, lab.lines.poach, { name: gone.name }), "bad");
  addToast(s, `${lab.name} poached ${gone.name}. ${lab.founder} sends a heart emoji.`, "bad");
}

/** Once a day; the labs move on the Arena's weekly beat, before the Race re-ranks it. */
export function dailyNeoLabs(s: GameState) {
  const n = s.neoLabs;
  if (!n || n.labs.length === 0 || s.day === 0 || s.day % 7 !== 0) return;
  const rng = createRng(n.rngState);
  const era = eraDef(eraOfState(s));
  for (const lab of n.labs) {
    const before = lab.rival;
    // FLT-22's law binds the new labs too (FLT-52).
    const law = rivalRules(s, before.context);
    const event = {
      type: "WEEK" as const,
      week: s.race.week + 1,
      aggro: era.rivalGrowth * law.growth,
      pace: era.rivalPace * law.pace,
      chase: chase(s.capability, before.context.capability),
      lengthRoll: rng.next(),
      gainRoll: rng.next(),
      openRoll: rng.next(),
      poachRoll: rng.next(),
      name: fillTemplate(rng.pick(MODEL_NAMES), { short: lab.short.replace(/ (Labs|Inc\.)$/, ""), n: String(before.context.releases + 1) }),
      hold: false,
      closed: law.closed,
    };
    const { stored, effects } = step(rivalMachine, before, event);
    lab.rival = stored;
    for (const e of effects) {
      if (e.type === "RELEASED") addNews(s, say(s, lab, rng, lab.lines.release, { model: e.model }), lab.mood === "hostile" ? "bad" : "neutral");
      else if (e.type === "POACH") poach(s, lab, rng);
    }
    const goodwill = rng.next();
    if (lab.mood === "friendly" && goodwill < 0.2 && lab.lines.goodwill.length > 0) {
      s.hype = Math.min(100, s.hype + 1);
      addNews(s, say(s, lab, rng, lab.lines.goodwill), "good");
    }
    if (!lab.nemesis && lab.mood === "hostile" && (lab.poached >= 1 || lab.rival.context.capability >= s.capability * 0.8)) {
      lab.nemesis = true;
      const ctx = lab.rival.context;
      lab.rival = { ...lab.rival, context: { ...ctx, personality: { ...ctx.personality, poaching: Math.min(0.5, ctx.personality.poaching * 1.5) } } };
      addNews(s, say(s, lab, rng, lab.lines.nemesis), "bad");
      addToast(s, `${lab.name} has named you its nemesis.`, "bad");
    }
  }
  n.rngState = rng.state();
}

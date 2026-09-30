// The Comms statement (FLT-56): the one lever the player pulls on a faction directly. Pick a faction (the gate legend
// offers the ones marching), pay for it, and the lab "addresses" them: their meter jumps, the factions feuding with
// them feel snubbed, the ticker reports the format, and the camera goes to the gate for the reading. A Comms Rep on the
// payroll makes it land; without one the intern writes it. Then a cooldown, because nobody reads two statements a week.
// The words are data (mods/base-factions `rules.statement`); the dice are the factions' own stream.
import { Schema } from "effect";
import pack from "../../../mods/base-factions/mod.json";
import { defs } from "../defs";
import { fillTemplate, formatMoney } from "../format";
import { addNews, addToast } from "../news";
import { createRng } from "../rng";
import type { GameState } from "../types";
import { runVerb } from "../verbs";
import { log } from "./driver";
import { nudgeFaction, relationStateOf } from "./state";

const N = Schema.Finite;
const S = Schema.NonEmptyString;
const Rules = Schema.Struct({
  rules: Schema.Struct({
    statement: Schema.Struct({
      /** What a statement costs, and the days before the next one. */
      cost: N, cooldownDays: N,
      /** How much it calms the faction addressed, with a Comms Rep and without; how much it annoys their feuds. */
      calm: N, calmUnstaffed: N, backlash: N,
      lines: Schema.Array(S), formats: Schema.Array(S),
      headline: S, backlashHeadline: S, backlashWhy: S, why: S,
      toast: S, toastUnstaffed: S, cooling: S, broke: S, caption: S, sub: S,
    }),
  }),
});
export const STATEMENT = Schema.decodeUnknownSync(Rules)(pack).rules.statement;

const hasComms = (s: GameState) => s.staff.some((st) => st.job === "comms" && st.machine.value !== "leaving");

/** Days until the next statement can go out (0: now). */
export function statementWait(s: GameState): number {
  const last = s.factions?.lastStatement;
  return last === undefined ? 0 : Math.max(0, last + STATEMENT.cooldownDays - s.day);
}

/** What the lever looks like right now: its price, the wait, and whether a Comms Rep will write it. */
export function statementOffer(s: GameState) {
  return { cost: STATEMENT.cost, wait: statementWait(s), staffed: hasComms(s) };
}

/** Address a faction. Refused (with a toast) while cooling down or short of cash. Returns whether it went out. */
export function issueStatement(s: GameState, faction: string): boolean {
  const f = s.factions;
  const def = defs().factionById(faction);
  if (!f || !def) return false;
  const R = STATEMENT;
  const wait = statementWait(s);
  if (wait > 0) return addToast(s, fillTemplate(R.cooling, { days: String(wait) }), "neutral"), false;
  if (s.cash < R.cost) return addToast(s, fillTemplate(R.broke, { cost: formatMoney(R.cost) }), "bad"), false;
  const rng = createRng(f.rngState);
  const format = rng.pick(R.formats);
  const vars = { lab: s.labName, faction: def.name, format, line: fillTemplate(rng.pick(R.lines), { lab: s.labName, faction: def.name }) };
  s.cash -= R.cost;
  s.ledger = { ...s.ledger, expenses: s.ledger.expenses + R.cost, net: s.ledger.net - R.cost };
  f.lastStatement = s.day;
  f.statements = (f.statements ?? 0) + 1;
  const staffed = hasComms(s);
  nudgeFaction(s, faction, staffed ? R.calm : R.calmUnstaffed, fillTemplate(R.why, vars));
  // The factions feuding with this one take it personally.
  const snubbed = defs().factions.filter((o) => o.id !== faction && relationStateOf(s, faction, o.id) === "feuding");
  for (const o of snubbed) nudgeFaction(s, o.id, -R.backlash, fillTemplate(R.backlashWhy, vars));
  addNews(s, fillTemplate(R.headline, vars), "joke");
  if (snubbed[0]) addNews(s, fillTemplate(R.backlashHeadline, { ...vars, other: snubbed[0].name }), "bad");
  log(s, f, `${s.labName} issued a statement to the ${def.name} (${format}).`, "joke", [faction, ...snubbed.map((o) => o.id)]);
  addToast(s, fillTemplate(staffed ? R.toast : R.toastUnstaffed, vars), staffed ? "good" : "neutral");
  runVerb({ state: s, rng, run: null, owner: "factions", vars }, { type: "camera.beat", params: { kind: "statement", caption: R.caption, sub: R.sub, on: "gate", zoom: 1.4, hold: 4 } });
  f.rngState = rng.state();
  return true;
}

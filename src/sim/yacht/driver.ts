// The yacht summit's driver (FLT-24). The pack's chart steps purely inside the tick on DAY and CHOSE beats; the cards'
// picks come back as flags and are sent at once. After the leak, the ticker runs the pack's price-fixing jokes for a while.
import { arcMachine } from "../machines/arc";
import { initialStored } from "../machines/run";
import { fillTemplate } from "../format";
import { addNews } from "../news";
import { createRng, type Rng } from "../rng";
import { runVerb, STATS } from "../verbs";
import { chartStats, compileChart, type Beat } from "../circus/chart";
import type { GameState } from "../types";
import { ENDINGS, PICK_PREFIX, PICKS, YACHT } from "./pack";
import type { YachtStored } from "./state";

const R = YACHT.rules;
const OWNER = "yacht";
const chart = compileChart(YACHT.chart);
// Lazy: progression.ts imports this driver for its PACKS table, and verbs.ts reaches progression, so the chart's
// guard names can't be read while verbs.ts is still loading.
let measure: string[] | null = null;
const MEASURE = () => (measure ??= chartStats(YACHT.chart));
const JOKES = YACHT.content.headlines.add.filter((h) => h.trigger === "priceFixing");
export const freshYacht = (tick = 0): YachtStored => chart.fresh({ enteredTick: tick });
export const stepYacht = chart.step;

export function enableYacht(s: GameState) {
  if (!s.yacht) s.yacht = { enabled: true, rngState: (s.seed ^ 0x59414354) >>> 0, machine: freshYacht(s.tick), rsvp: null, leakDay: null, ending: null };
  s.yacht.enabled = true;
  for (const def of YACHT.content.events.add) s.arcs[def.id] ??= initialStored(arcMachine, { choices: def.choices.length, cooldownDays: def.cooldown ?? 14, openedDay: null });
}
export function disableYacht(s: GameState) {
  if (!s.yacht) return;
  s.yacht.enabled = false;
  for (const key of PICKS) delete s.flags[PICK_PREFIX + key];
  for (const def of YACHT.content.events.add) {
    delete s.flags[`offer:${def.id}`];
    if (s.arcs[def.id]?.value === "cardOpen") s.arcs[def.id] = initialStored(arcMachine, { choices: def.choices.length, cooldownDays: def.cooldown ?? 14, openedDay: null });
  }
}

function send(s: GameState, rng: Rng, beat: Beat) {
  const y = s.yacht!;
  const before = y.machine.value;
  const result = stepYacht(y.machine, beat);
  y.machine = result.stored;
  for (const call of result.calls) runVerb({ state: s, rng, run: null, owner: OWNER }, { type: call.verb, params: call.params });
  const now = y.machine.value;
  if (now === before) return;
  if (before === "invited" && beat.choice) y.rsvp = beat.choice;
  if (now === "leaked") y.leakDay = s.day;
  if ((ENDINGS as readonly string[]).includes(now)) y.ending = now;
}

export function applyYachtChoices(s: GameState) {
  const y = s.yacht;
  if (!y?.enabled) return;
  for (const key of PICKS) {
    if (s.flags[PICK_PREFIX + key] === undefined) continue;
    delete s.flags[PICK_PREFIX + key];
    const rng = createRng(y.rngState);
    send(s, rng, { type: "CHOSE", tick: s.tick, day: s.day, roll: 0, stats: {}, choice: key });
    y.rngState = rng.state();
  }
}

export function dailyYacht(s: GameState) {
  const y = s.yacht;
  if (!y?.enabled) return;
  const rng = createRng(y.rngState);
  const stats: Record<string, number> = {};
  for (const name of MEASURE()) stats[name] = STATS[name]?.(s, null) ?? 0;
  send(s, rng, { type: "DAY", tick: s.tick, day: s.day, roll: 0, stats });
  // The ticker links the leak to the price-fixing jokes for a few weeks.
  if (y.leakDay !== null && s.day > y.leakDay && s.day - y.leakDay <= R.ticker.days && (s.day - y.leakDay) % R.ticker.every === 0 && JOKES.length) {
    const line = rng.pick(JOKES);
    addNews(s, fillTemplate(line.text, { lab: s.labName }), line.tone);
  }
  y.rngState = rng.state();
}

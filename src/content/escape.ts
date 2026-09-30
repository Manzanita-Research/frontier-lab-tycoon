// The Sandbox Escape's content pack (FLT-59): every line an agent thinks on its way over the fence, the headlines and
// toasts, and every threshold, all data in `mods/base-escape/mod.json` in the FLT-15 section shape (`content.<section>.add`,
// plus `rules.escape` for the knobs; see docs/MODDING.md). Loaded straight from JSON and checked with Effect Schema until
// FLT-15 M1b's loader takes it over, like the Leapfrog pack.
import { Schema } from "effect";
import pack from "../../mods/base-escape/mod.json";

const N = Schema.Finite;
const S = Schema.NonEmptyString;
const numbers = <K extends string>(...keys: K[]) => Schema.Struct(Object.fromEntries(keys.map((k) => [k, N])) as Record<K, typeof N>);
const Tone = Schema.Literals(["good", "bad", "neutral", "joke"]);

/** When an agent thinks a line: the two warning beats, the run, and the three ways it ends up back inside. */
export const ESCAPE_MOMENTS = ["brood", "pace", "run", "carried", "tackled", "trapped"] as const;
/** What the engine can say with a headline from the pack. A mod adds lines to a trigger; it does not add triggers. */
export const ESCAPE_TRIGGERS = ["run", "jailbreak", "caught", "tackled", "trapped", "escaped", "escapedToast", "aftermath", "lessons"] as const;
export type EscapeTrigger = (typeof ESCAPE_TRIGGERS)[number];

const Line = Schema.Struct({ id: Schema.optionalKey(S), kind: Schema.Literal("agent"), when: Schema.Literals(ESCAPE_MOMENTS), text: S });
const News = Schema.Struct({ id: Schema.optionalKey(S), trigger: Schema.Literals(ESCAPE_TRIGGERS), text: S, tone: Tone });

const Pack = Schema.Struct({
  apiVersion: Schema.Literal(1), id: S, version: S,
  content: Schema.Struct({
    thoughts: Schema.Struct({ add: Schema.Array(Line) }),
    headlines: Schema.Struct({ add: Schema.Array(News) }),
  }),
  rules: Schema.Struct({ escape: Schema.Struct({
    start: numbers("minDrift", "baseChance", "gapDays", "lessonBoost"),
    /** The daily chance multiplier in each era (1 to 4). */
    eras: Schema.Tuple([N, N, N, N]),
    warn: numbers("broodDays", "paceTicks", "paceSpan", "walkSpeed"),
    run: numbers("sprint", "sprintPerLesson", "sprintMax", "vault"),
    guards: numbers("range", "max", "jog", "reach", "tackledTicks"),
    catch: numbers("carryTicks", "lift", "driftAfter", "driftCut"),
    honeypot: numbers("lure", "decay", "floor", "trappedTicks"),
    sandbox: numbers("radius", "driftPerDay"),
    jailbreak: numbers("era", "chance", "min", "max", "minDrift"),
    aftermath: numbers("minDays", "maxDays", "stories"),
    fallout: numbers("hype", "lessonDecayDays"),
  }) }),
});

export function loadEscapePack(input: unknown) {
  const p = Schema.decodeUnknownSync(Pack)(input);
  for (const when of ESCAPE_MOMENTS) {
    if (!p.content.thoughts.add.some((t) => t.when === when)) throw new Error(`content.thoughts.add: expected a "${when}" line`);
  }
  for (const trigger of ESCAPE_TRIGGERS) {
    if (!p.content.headlines.add.some((h) => h.trigger === trigger)) throw new Error(`content.headlines.add: expected a "${trigger}" headline`);
  }
  return { ...p, rules: p.rules.escape };
}

export const ESCAPE = loadEscapePack(pack);
export type EscapeRules = typeof ESCAPE.rules;
/** The lines for one moment, in pack order. */
export const escapeLines = (when: (typeof ESCAPE_MOMENTS)[number]): string[] => ESCAPE.content.thoughts.add.filter((t) => t.when === when).map((t) => t.text);

// Factions (FLT-33): the discourse, as data. Each faction is one entry in a content pack's `content.factions` section
// (mods/base-factions, plus the Water Truthers Truthers in mods/base-water), so a mod adds "Crypto Guys" with one
// `add` and never touches the engine. The shape is checked here with Effect Schema, and by the mod loader with the
// same schema (src/mods/schema.ts reuses FactionSchema), so the paths in an error read the same either way.
//
// The engine side is src/sim/factions: it works out the lab's stance on five axes every day, eases each faction's
// meter toward how much its beliefs agree with that stance, and turns what the player does into signals that a
// faction's grievances and cheers react to. Everything a faction says (thoughts, arguments, chants, signs,
// headlines) is here.
import { Schema } from "effect";
import factionsPack from "../../mods/base-factions/mod.json";
import waterPack from "../../mods/base-water/mod.json";
import type { EventDef } from "./events";
import type { ArcData } from "../mods/schema";

/** The five things every faction has an opinion about. The lab's stance is a point on the same axes (sim/factions/stance.ts). */
export const AXES = ["speed", "safety", "openness", "fairness", "profit"] as const;
export type Axis = (typeof AXES)[number];

/**
 * What the sim can tell a faction about. The first group are things you did (the sim notices them the day they
 * happen); `lobby` and `hearing` are for other packs to send with the `faction.signal` verb (FLT-22, FLT-21).
 * `<axis>+` and `<axis>-` are standing positions (you are fast, you are closed): they move the meter through the
 * beliefs, and the grievance's text is what the Factions panel shows while that stance is what hurts most.
 */
export const EVENT_SIGNALS = [
  "release", "openRelease", "shipNow", "hold", "leak", "incident", "safetyTalk", "safetyUp", "safetyDown",
  "papersOpen", "papersClosed", "cluster", "gas", "datacenter", "solar", "fountain", "waterIgnored", "quit",
  "lobby", "hearing",
] as const;
export const STANCE_SIGNALS = AXES.flatMap((a) => [`${a}+`, `${a}-`] as const);
export const SIGNALS = [...EVENT_SIGNALS, ...STANCE_SIGNALS] as const;
export type Signal = (typeof SIGNALS)[number];

const Str = Schema.String;
const Text = Schema.NonEmptyString;
const Strings = Schema.Array(Text);
const Belief = Schema.Finite.check(Schema.isBetween({ minimum: -1, maximum: 1 }));
const Weight = Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0));
const Meter = Schema.Finite.check(Schema.isBetween({ minimum: -100, maximum: 100 }));
const Id = Text.check(Schema.isPattern(/^(?!__proto__$|constructor$|prototype$)[\w:.-]+$/));

/** A reaction: `amount` is added to the meter the day the signal happens (stance signals only lend their text). */
const Reaction = Schema.Struct({ on: Schema.Literals(SIGNALS), amount: Schema.Finite, text: Text });
/** What a faction does to the lab's numbers each day, at full strength (a meter of ±100; half a meter, half of it). */
const Sway = Schema.Struct({
  hype: Schema.optionalKey(Schema.Finite),
  discourse: Schema.optionalKey(Schema.Finite),
  trust: Schema.optionalKey(Schema.Finite),
  heat: Schema.optionalKey(Schema.Finite),
});

export const FactionSchema = Schema.Struct({
  id: Id,
  name: Text,
  /** Chip label: one short word. */
  short: Text,
  color: Text,
  /** The one thing they carry (a hoodie, a clipboard, a sandwich board): the renderer's hat and the UI's glyph. */
  prop: Text,
  blurb: Str,
  beliefs: Schema.Struct({ speed: Belief, safety: Belief, openness: Belief, fairness: Belief, profit: Belief }),
  /**
   * Who belongs, by weight: a walker kind (`researcher`, `visitor`, `agent`, `protester`) or `role:<role>`
   * ("role:Venture Capitalist"). A walker's role weight wins over its kind's.
   */
  members: Schema.Record(Str, Weight),
  /** Followers off the map, in thousands. Factions can be all audience: nobody on campus, loud online. */
  audience: Weight,
  /** Per-day effect of a fan (meter +100), and of an angry faction (meter −100). */
  fan: Schema.optionalKey(Sway),
  angry: Schema.optionalKey(Sway),
  grievances: Schema.Array(Reaction),
  cheers: Schema.Array(Reaction),
  /** What members think out loud, one bubble at a time. */
  thoughts: Strings,
  /** Arguments on the paths: an opener from one faction, a retort from the other, unless a duel is written for the pair. */
  argue: Strings,
  retorts: Strings,
  duels: Schema.optionalKey(Schema.Array(Schema.Struct({ vs: Id, lines: Schema.Array(Schema.Tuple([Text, Text])) }))),
  /** Shouted at the gate. */
  chants: Strings,
  /** Placards. Short enough to read at a glance. */
  signs: Strings,
  /** Frontier Times lines. {lab} {model} {other} (the other faction) are filled in. */
  headlines: Schema.Struct({ fan: Strings, angry: Strings, ally: Strings, schism: Strings }),
  /** Where they start with the other factions, −100 (feud) to +100 (allies). Missing pairs start at 0. */
  relations: Schema.optionalKey(Schema.Record(Str, Meter)),
  /** They march on the gate once the meter is this low (default −60). `false`: never on their own, only when rallied. */
  protests: Schema.optionalKey(Schema.Union([Schema.Boolean, Meter])),
});
export interface FactionDef extends Schema.Schema.Type<typeof FactionSchema> {}

/** A pack's `content.factions`, `content.events` and `content.arcs`, loaded straight from JSON (like base-leapfrog). */
const Pack = Schema.Struct({
  content: Schema.Struct({
    factions: Schema.optionalKey(Schema.Struct({ add: Schema.Array(FactionSchema) })),
    events: Schema.optionalKey(Schema.Struct({ add: Schema.Array(Schema.Unknown) })),
    arcs: Schema.optionalKey(Schema.Struct({ add: Schema.Array(Schema.Unknown) })),
  }),
});

function load(pack: unknown, name: string) {
  try {
    const decoded = Schema.decodeUnknownSync(Pack)(pack);
    return {
      factions: decoded.content.factions?.add ?? [],
      events: (decoded.content.events?.add ?? []) as unknown as EventDef[],
      arcs: (decoded.content.arcs?.add ?? []) as unknown as ArcData[],
    };
  } catch (error) {
    throw new Error(`mods/${name}/mod.json: ${String(error)}`);
  }
}

/** The nine factions of the discourse, their events and the arcs that raise them (mods/base-factions). */
export const FACTIONS_PACK = load(factionsPack, "base-factions");
/** The Water Discourse escalation (FLT-25): the original two cards, the documentary crew and the counter-protest (mods/base-water). */
export const WATER_PACK = load(waterPack, "base-water");

export const FACTIONS: readonly FactionDef[] = [...FACTIONS_PACK.factions, ...WATER_PACK.factions];
/** The base game's story arcs (sim/modArcs.ts runs them like a mod's): the water escalation, then one per faction. */
export const BASE_ARCS: readonly ArcData[] = [...WATER_PACK.arcs, ...FACTIONS_PACK.arcs];

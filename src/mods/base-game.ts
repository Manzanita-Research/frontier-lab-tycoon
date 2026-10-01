import { Layer, Schema, Stream } from "effect";
import { PROGRESSION } from "../content/progression";
import { COACH } from "../content/coach";
import { BUILDINGS, PATH_PRICE, BULLDOZE_REFUND } from "../content/buildings";
import { EVENTS, EVENT_COOLDOWN_DAYS } from "../content/events";
import { GOALS } from "../content/goals";
import { HEADLINES } from "../content/headlines";
import { THOUGHTS } from "../content/thoughts";
import { DISASTERS } from "../sim/disasters/pack";
import { LEAPFROG } from "../content/leapfrog";
import { RIVAL_DEFS } from "../content/rivals";
import { BASE_ARCS, FACTIONS } from "../content/factions";
import * as Names from "../content/names";
import { MAX_STAFF, MAX_PER_JOB } from "../content/staff";
import * as Constants from "../sim/constants";
import { CHORDS, CUES, HOOKS, cueNotes, hookNotes } from "../audio/score";
import { Content, type ContentApi } from "./services/content";
import { Skin, type SkinApi } from "./services/skin";
import { Rules, type RulesApi } from "./services/rules";
import { Vocabulary, type VocabularyApi } from "./services/vocabulary";
import { vocabulary } from "../sim/verbs";
import { Assets } from "./services/assets";
import { Audio } from "./services/audio";
import { Looks } from "./services/looks";
import { Systems } from "./services/systems";
import { GameEvents } from "./services/game-events";
import { readSkinRegistry } from "./skin-adapter";
import { baseTables } from "./tables";
import { Note } from "./schema";

export const baseContent: ContentApi = {
  progression: PROGRESSION, coach: COACH,
  buildings: BUILDINGS, rivals: RIVAL_DEFS, headlines: HEADLINES, thoughts: THOUGHTS, events: EVENTS, goals: GOALS,
  arcs: BASE_ARCS, endings: [], tips: [], disasters: DISASTERS as unknown as ContentApi["disasters"],
  benchmarks: LEAPFROG.benchmarks, mishaps: LEAPFROG.mishaps, factions: FACTIONS,
  walkerKinds: [
    { id: "researcher", name: "Researcher", presentation: "walker", needs: ["energy", "focus", "fomo"] },
    { id: "visitor", name: "Visitor", presentation: "walker", needs: ["patience", "impressed"] },
    { id: "agent", name: "Agent", presentation: "walker", needs: ["drift"] },
    { id: "protester", name: "Protester", presentation: "walker", needs: [] },
  ],
  names: Object.entries({ LAB_NAMES: Names.LAB_NAMES, RIVALS: Names.RIVALS, RIVAL_SHORT: Names.RIVAL_SHORT,
    FIRST_NAMES: Names.FIRST_NAMES, LAST_NAMES: Names.LAST_NAMES, RESEARCHER_ROLES: Names.RESEARCHER_ROLES,
    AGENT_NICKNAMES: Names.AGENT_NICKNAMES, VISITOR_ROLES: Names.VISITOR_ROLES, THEIR: Names.THEIR }).map(([id, values]) => ({ id, values })),
  tables: baseTables,
};
const tunables = Object.fromEntries(Object.entries(Constants).filter((entry): entry is [string, number] => typeof entry[1] === "number"));
const allTunables = { ...tunables, PATH_PRICE, BULLDOZE_REFUND, EVENT_COOLDOWN_DAYS, MAX_STAFF, MAX_PER_JOB };
export const baseRules: RulesApi = {
  tunables: allTunables,
  // M1 exposes data only. These are conservative authoring bounds; rules patches remain disabled until M3.
  safeRanges: Object.fromEntries(Object.entries(allTunables).map(([key, value]) => [key,
    key === "TICKS_PER_DAY" ? [value, value] as const : key === "BULLDOZE_REFUND" ? [0, 1] as const : [0, Math.max(1, value * 10)] as const])),
  runCostGrowth: Array.from({ length: 6 }, (_, i) => Constants.runCostGrowth(i + 1)), machinePatches: {},
};
/** The sim's real Vocabulary (sim/verbs.ts): the guards and actions a mod arc runs with. */
export const baseVocabulary: VocabularyApi = { guards: [...vocabulary.guards], effects: [...vocabulary.effects] };
export function makeBaseGameLayer(skins?: SkinApi) {
  const urls: Readonly<Record<string, string>> = {};
  return Layer.mergeAll(
    Layer.sync(Content, () => structuredClone(baseContent)),
    Layer.sync(Rules, () => structuredClone(baseRules)),
    Layer.sync(Vocabulary, () => structuredClone(baseVocabulary)),
    Layer.sync(Skin, () => readSkinRegistry(skins)),
    Layer.succeed(Assets, { urls, resolve: (id) => urls[id] }),
    Layer.sync(Audio, () => ({ cues: Object.fromEntries([...CUES.map((cue) => [cue, cueNotes(cue)] as const), ...HOOKS.map((hook) => [hook, hookNotes(hook)] as const)]
      .map(([cue, notes]) => [cue, Schema.decodeUnknownSync(Schema.Array(Note))(JSON.parse(JSON.stringify(notes)))])), music: [], chords: structuredClone(CHORDS) })),
    // Walker looks (FLT-55): the base game draws its own people, so it has none.
    Layer.sync(Looks, () => ({ looks: {} })),
    // FLT-75: Koota systems a code mod runs in the tick. The base game's own live in the sim.
    Layer.succeed(Systems, { systems: [] }),
    Layer.succeed(GameEvents, { stream: Stream.empty }),
  );
}
export const BaseGame = { layer: makeBaseGameLayer() };

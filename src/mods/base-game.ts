import { Layer, Schema, Stream } from "effect";
import { BUILDINGS, PATH_PRICE, BULLDOZE_REFUND } from "../content/buildings";
import { EVENTS, EVENT_COOLDOWN_DAYS } from "../content/events";
import { GOALS } from "../content/goals";
import { HEADLINES } from "../content/headlines";
import { THOUGHTS } from "../content/thoughts";
import { RIVAL_DEFS } from "../content/rivals";
import * as Names from "../content/names";
import { MAX_STAFF, MAX_PER_JOB } from "../content/staff";
import * as Constants from "../sim/constants";
import { CHORDS, CUES, cueNotes } from "../audio/score";
import { Content, type ContentApi } from "./services/content";
import { Skin, type SkinApi } from "./services/skin";
import { Rules, type RulesApi } from "./services/rules";
import { Vocabulary, type VocabularyApi } from "./services/vocabulary";
import { Assets } from "./services/assets";
import { Audio } from "./services/audio";
import { GameEvents } from "./services/game-events";
import { readSkinRegistry } from "./skin-adapter";
import { baseTables } from "./tables";
import { Note } from "./schema";

export const baseContent: ContentApi = {
  buildings: BUILDINGS, rivals: RIVAL_DEFS, headlines: HEADLINES, thoughts: THOUGHTS, events: EVENTS, goals: GOALS,
  arcs: [], endings: [], tips: [],
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
export const baseRules: RulesApi = {
  tunables: { ...tunables, PATH_PRICE, BULLDOZE_REFUND, EVENT_COOLDOWN_DAYS, MAX_STAFF, MAX_PER_JOB },
  safeRanges: {}, runCostGrowth: Array.from({ length: 6 }, (_, i) => Constants.runCostGrowth(i + 1)), machinePatches: {},
};
export const baseVocabulary: VocabularyApi = {
  guards: ["stat.gte", "flag.is", "day.after", "chance"],
  effects: ["effect.cash", "effect.hype", "effect.discourse", "news", "card", "spawn.protesters", "flag.set"],
};
export function makeBaseGameLayer(skins?: SkinApi) {
  const urls: Readonly<Record<string, string>> = {};
  return Layer.mergeAll(
    Layer.sync(Content, () => structuredClone(baseContent)),
    Layer.sync(Rules, () => structuredClone(baseRules)),
    Layer.sync(Vocabulary, () => structuredClone(baseVocabulary)),
    Layer.sync(Skin, () => readSkinRegistry(skins)),
    Layer.succeed(Assets, { urls, resolve: (id) => urls[id] }),
    Layer.sync(Audio, () => ({ cues: Object.fromEntries(CUES.map((cue) => [cue, Schema.decodeUnknownSync(Schema.Array(Note))(JSON.parse(JSON.stringify(cueNotes(cue))))])), music: [], chords: structuredClone(CHORDS) })),
    Layer.succeed(GameEvents, { stream: Stream.empty }),
  );
}
export const BaseGame = { layer: makeBaseGameLayer() };

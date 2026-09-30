// Data that has not acquired a public patch format yet. No functions enter GameDefinition.
import { ERAS } from "../content/eras";
import { SCENARIO } from "../content/goals";
import { NEEDS, NEEDS_BY_KIND } from "../content/needs";
import { CAUSES } from "../content/needThoughts";
import { STAFF } from "../content/staff";
import { SIGNS, SIGN_COLORS } from "../content/protest";
import { FIRST_NIGHT_LINE, NIGHT_THOUGHTS } from "../content/night";
import { SLOP_LINES } from "../content/ops";
import { RACE_HEADLINES } from "../content/raceNews";
import { RACE_THOUGHTS } from "../content/raceThoughts";
import { OPS_HEADLINES } from "../content/ops";
import { FRIENDS, REACTIONS, CLASSIFIEDS, DESK_STORIES, STORY_PRIORITY, EVENT_STORY_KIND } from "../content/newsroom";

export const baseTables = {
  eras: ERAS, scenario: SCENARIO, needs: NEEDS, needsByKind: NEEDS_BY_KIND, causes: CAUSES,
  staff: STAFF, signs: SIGNS, signColors: SIGN_COLORS, firstNightLine: FIRST_NIGHT_LINE,
  nightThoughts: NIGHT_THOUGHTS, slopLines: SLOP_LINES, raceHeadlines: RACE_HEADLINES,
  raceThoughts: RACE_THOUGHTS, opsHeadlines: OPS_HEADLINES,
  newsroom: { friends: FRIENDS, reactions: REACTIONS, classifieds: CLASSIFIEDS, deskStories: DESK_STORIES, storyPriority: STORY_PRIORITY, eventStoryKind: EVENT_STORY_KIND },
};

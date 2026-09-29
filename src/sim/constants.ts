export const TICKS_PER_DAY = 20;
/** Tiles per tick. */
export const WALK_SPEED = 0.12;
export const RESEARCHER_SALARY = 1_000;
export const REVENUE_PER_CAPABILITY = 1_000;
export const COMPUTE_PER_CLUSTER = 10;
export const COMPUTE_PER_HALL = 30;
/** A powered Datacenter: 4x4 tiles, +60 compute a day. */
export const COMPUTE_PER_DATACENTER = 60;
/**
 * Each training run costs this much more compute than the last, given the run that just finished. The first
 * runs are steep (the toy needs a slow start); later ones ease off so the R&D multiplier can win the race.
 */
export const runCostGrowth = (run: number): number => (run <= 3 ? 5 : run === 4 ? 3.5 : run === 5 ? 2.4 : 1.9);
export const MAX_AGENTS = 400;
export const MAX_PROTESTERS = 40;
/** Protesters per point of water discourse: one protester for every four. */
export const DISCOURSE_PER_PROTESTER = 4;
/** At this many protesters the gate is a scene: visitors thin out and grumble about it. */
export const CROWDING_PROTESTERS = 10;
export const THOUGHT_TICKS = 3 * TICKS_PER_DAY;

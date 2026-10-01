import type { BirdMoment, BirdOutcome } from "../../content/birdapp";
import type { CommsStored, PosterStored } from "./machines";

/** The three levers on a poster: full spice, everything past Comms first, or no posting at all. */
export const LEVERS = ["cook", "comms", "logoff"] as const;
export type BirdLever = (typeof LEVERS)[number];

/** A researcher's posting profile, keyed by their walker id. */
export interface Poster {
  id: number;
  /** Without the @: "vibes_after_midnight". */
  handle: string;
  archetype: string;
  /** Their personal spice, 0 to 1. */
  spice: number;
  followers: number;
  lever: BirdLever;
  /** Their tier: recluse, occasional, big, on a posting break, or gone. */
  machine: PosterStored;
  /** The Duo's other half (a walker id), once paired. */
  partner?: number;
  /** Days in a row on "Please log off". */
  offDays: number;
  /** Cancelled and not over it: rivals call them first. */
  hot?: boolean;
  posts: number;
  bangers: number;
  cancels: number;
}

/** One post. Its outcome is rolled when it is scheduled and lands (is settled) at the next midnight. */
export interface BirdPostRecord {
  id: number;
  by: number;
  name: string;
  handle: string;
  archetype: string;
  /** The content row it came from ("oracle-03"), or the verb's id. */
  line: string;
  text: string;
  /** The tick it goes up: the panels only show it from then on. */
  tick: number;
  spice: number;
  moment: BirdMoment | null;
  /** Run past Comms first. */
  reviewed: boolean;
  outcome: BirdOutcome;
  settled: boolean;
  /** Where the engagement ends up, a day after it goes up. */
  likes: number;
  reposts: number;
  replies: number;
  /** The top reply, for the timeline. */
  reply: string;
  /** Went viral: the sticker. */
  viral: boolean;
  /** A controversy or cancel Comms got to in time, or one that stuck. */
  handled?: "contained" | "stuck";
  /** A reply to another post (the Duo's other half). */
  replyTo?: number;
}

/** A fire on the Comms desk: a controversy (weight 1) or a cancel (weight 2), from the day it landed. */
export interface CommsFire {
  post: number;
  by: number;
  kind: "controversy" | "cancelled";
  day: number;
}

export interface BirdAppState {
  enabled: boolean;
  /** Its own random stream: waking the pack never moves the baseline's dice. */
  rngState: number;
  /** 0 to 100. Big accounts hold it up; bangers push it, cancels crash it. Feeds Hype, visitors and applicants. */
  aura: number;
  /** By walker id. */
  posters: Record<string, Poster>;
  /** Today's (unsettled, some not up yet) and the recent log, oldest first. */
  posts: BirdPostRecord[];
  queue: CommsFire[];
  comms: CommsStored;
  /** Comms capacity used today by reviews, and its size (for the panel). */
  capacity: { used: number; size: number };
  /** Models shipped at the last midnight: one more is a launch. */
  models: number;
  /** Today's moments, for the panel. */
  moments: BirdMoment[];
  tally: { posts: number; bangers: number; controversies: number; ratios: number; cancels: number; stuck: number };
  /** Aura at each of the last 30 midnights, for the sparkline. */
  history: number[];
}

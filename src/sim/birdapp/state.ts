import type { BirdMoment, BirdOutcome } from "../../content/birdapp";
import type { RivalBeat, RivalRole } from "../../content/birdapp";
import type { CommsStored, LabFeedStored, PosterStored } from "./machines";

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
  /** FLT-92: a dunk on this rival lab's slide (a landed one adds Aura). */
  dunk?: string;
}

/** FLT-92: one post by a rival lab's voice. Its own ids (shown negative), its outcome rolled when it is scheduled. */
export interface RivalPostRecord {
  id: number;
  /** The rival id. */
  lab: string;
  voice: string;
  role: RivalRole;
  name: string;
  handle: string;
  /** The content row it came from, or the verb's id. */
  line: string;
  beat: RivalBeat | "drama";
  text: string;
  tick: number;
  outcome: "flop" | "banger" | "ratioed";
  settled: boolean;
  likes: number;
  reposts: number;
  replies: number;
  reply: string;
  /** A quote-post: whose post, and what it said. */
  quote?: { handle: string; text: string; lab?: string };
  /** It ratioed one of yours: what that cost you, once it landed. */
  ratio?: { post: number; hype: number };
}

/** FLT-92: what the rival labs have said, and what the driver has already seen happen (to react to each thing once). */
export interface BirdRivalsState {
  /** Its own random stream: the lab's own posters roll the same dice with the rivals on or off. */
  rngState: number;
  nextId: number;
  /** Today's (some not up yet) and the recent log, oldest first. */
  posts: RivalPostRecord[];
  /** Each lab's feed: posting, or quiet after an Arena slide. */
  labs: Record<string, LabFeedStored>;
  seen: {
    releases: Record<string, number>;
    ranks: Record<string, number>;
    models: number;
    leaks: number;
    cancels: number;
    escaped: number;
    hearing: string;
    funding: number;
    bailout: number;
    /** The release count a lab last teased at: one teaser a run. */
    teased: Record<string, number>;
  };
  tally: { posts: number; dunks: number; ratios: number };
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
  /** FLT-92: the rival labs' side of the timeline. Absent with `?birdrivals=off` (and in saves from before it). */
  rivals?: BirdRivalsState;
}

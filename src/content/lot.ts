// FLT-98: the words on the empty lot's survey stakes and on the food truck by the gate. Data only.

export interface StakeWords {
  /** The small line along the top of the sign. */
  head: string;
  /** The big line: what's going here. */
  name: string;
  /** The small print under it, if any. */
  foot?: string;
  /** The whole thing, said in the tooltip when you hover the stake on a desktop. */
  full: string;
}

export const STAKE_WORDS: Record<string, StakeWords> = {
  hall: { head: "FUTURE SITE OF", name: "Training Hall", foot: "(soon, hopefully)", full: "Future site of: a Training Hall. The loss goes down here, soon, hopefully." },
  cluster: { head: "FUTURE SITE OF", name: "Compute Cluster", foot: "(probably)", full: "Future site of: Compute Cluster (probably)" },
  gateway: { head: "FUTURE SITE OF", name: "API Gateway", foot: "(revenue, eventually)", full: "Future site of: an API Gateway. Revenue arrives here, eventually." },
  bigger: { head: "RESERVED FOR", name: "a bigger model", foot: "(it's coming)", full: "Reserved for: a bigger model" },
  ethics: { head: "FUTURE SITE OF", name: "the Ethics Committee", foot: "(TBD)", full: "Future site of: the Ethics Committee (TBD)" },
};

export const TRUCK_WORDS = {
  name: "TENSOR TACOS",
  tagline: "fully connected · open till AGI",
  price: "$0.002 / token",
} as const;

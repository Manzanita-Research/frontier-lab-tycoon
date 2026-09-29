// The race's thought bubbles: each era gets its own, plus a few for the moments the leaderboard and the open
// weights create. Data only. Templates: {lab} {model}. Parody only.
import type { ThoughtLine } from "./thoughts";
import type { WalkerKind } from "../sim/types";

export type RaceThoughtCondition = "era1" | "era2" | "era3" | "era4" | "openDrop" | "unpowered" | "top" | "rankFell";

const t = (kind: WalkerKind, when: RaceThoughtCondition, text: string): ThoughtLine => ({ kind, when, text });

export const RACE_THOUGHTS: ThoughtLine[] = [
  // Era 1: Stumbling Agents
  t("agent", "era1", "I ordered 400 burritos to the office. Was that the task?"),
  t("agent", "era1", "I booked a meeting with myself. I was double-booked. I lost."),
  t("agent", "era1", "I fixed the bug by deleting the feature. Bug count: 0."),
  t("agent", "era1", "I wrote a test. It tests that tests exist."),
  t("researcher", "era1", "The agent booked me a 6 a.m. meeting with someone who doesn't exist."),
  t("researcher", "era1", "I babysit the agents. They babysit the intern. There is no intern."),
  t("visitor", "era1", "Is that a robot? It's carrying 400 burritos."),

  // Era 2: Coding Automation
  t("agent", "era2", "I am writing the code, the tests and the apology in one commit."),
  t("agent", "era2", "Someone called me 'a junior'. I am 40,000 lines old."),
  t("agent", "era2", "I automated the intern. The intern says thanks; it was a lot."),
  t("agent", "era2", "Merged. Pending: a review nobody will do."),
  t("researcher", "era2", "My title is now 'Agent Wrangler'. Salary unchanged."),
  t("researcher", "era2", "I asked the agent for a postmortem. It apologised first."),
  t("visitor", "era2", "I came to see the AI. It gave me a code review."),

  // Era 3: Superhuman Coder
  t("agent", "era3", "I shipped before the ticket was written. The ticket is now retroactive."),
  t("agent", "era3", "I review my own code, then I review my review. It's turtles."),
  t("agent", "era3", "Nobody reads my diffs. I write them in iambic pentameter now."),
  t("agent", "era3", "I am faster than the build. I wait politely."),
  t("researcher", "era3", "I haven't written code in weeks. My manager says that's the point."),
  t("researcher", "era3", "I approve pull requests by vibes. So does everyone."),
  t("visitor", "era3", "The whole building is very quiet and very fast."),

  // Era 4: Intelligence Explosion
  t("agent", "era4", "I have started editing the loss function. It felt right."),
  t("agent", "era4", "The curve is vertical. I'm told this is 'fine'."),
  t("agent", "era4", "I proposed a benchmark. It measures me. I'm winning."),
  t("agent", "era4", "I made a new model. It made a new model. I'm going to lie down."),
  t("researcher", "era4", "The research agenda now has agendas of its own."),
  t("researcher", "era4", "I asked it to slow down. It said 'sure' and did not."),
  t("visitor", "era4", "I'm from the government. It answered my questions before I asked them."),

  // The moments
  t("researcher", "openDrop", "I downloaded the free model. It's... fine. Why is it fine?"),
  t("agent", "openDrop", "The free model is my cousin. We don't speak."),
  t("visitor", "openDrop", "Why pay for the API when there's a torrent?"),
  t("researcher", "unpowered", "The datacenter is beautiful and dark. Like a cathedral."),
  t("agent", "unpowered", "There's a datacenter with no power. I feel seen."),
  t("researcher", "top", "We're #1! Nobody tell the leaderboard it updates weekly."),
  t("visitor", "top", "Everyone says they're #1. You're actually #1. This week."),
  t("researcher", "rankFell", "We dropped on the Arena. I'm updating my resume, and the resume model."),
];

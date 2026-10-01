// What walkers think when a need is nagging them. Every walker has exactly one cause at a time (see sim/mind.ts),
// and everyone with the same cause thinks the same line, which is what makes the Thoughts panel count up:
// "23 researchers: 'The kombucha is warm and so is my equity.'". Lines rotate every couple of game days.
// Templates: {lab} {rival}. Parody only.

import { escapeLines } from "./escape";
import { NIGHT_THOUGHTS } from "./night";
import { SLOP_LINES } from "./ops";
import type { WalkerKind } from "../sim/types";

/** The night pool (content/night.ts) for one kind of walker. */
const night = (kind: WalkerKind) => NIGHT_THOUGHTS.filter((n) => n.kind === kind).map((n) => n.text);

export interface CauseLines {
  /** How many lines are on the go at once. Need-driven causes use 1 so the whole crowd agrees; loose moods use more. */
  spread: number;
  lines: string[];
}

export type Cause =
  | "researcher.tired"
  | "researcher.scattered"
  | "researcher.fomo"
  | "researcher.lost.energy"
  | "researcher.lost.focus"
  | "researcher.lost.fomo"
  | "researcher.queue"
  | "researcher.slop"
  | "researcher.night"
  | "researcher.boxing"
  | "researcher.glowing"
  | "researcher.meh"
  | "visitor.bored"
  | "visitor.queue"
  | "visitor.slop"
  | "visitor.night"
  | "visitor.impressed"
  | "visitor.unimpressed"
  | "visitor.lost.impressed"
  | "visitor.meh"
  | "agent.aligned"
  | "agent.night"
  | "agent.drifting"
  | "agent.drifted"
  | "agent.fence"
  | "protester.chant";

export const CAUSES: Record<Cause, CauseLines> = {
  // Researchers
  "researcher.tired": {
    spread: 1,
    lines: [
      "The kombucha is warm and so is my equity.",
      "I am running at 12% and a dream.",
      "My eyelids have a higher learning rate than I do.",
      "I'd trade my vested options for a horizontal surface.",
      "Sleep is just checkpointing. I'd like to checkpoint.",
    ],
  },
  "researcher.scattered": {
    spread: 1,
    lines: [
      "I opened the paper. Now I'm reading the footnotes of the footnotes.",
      "My attention window is four tokens.",
      "I forgot what I was optimizing. Possibly myself.",
      "I've refreshed the dashboard 40 times. It's the same dashboard.",
      "It feels like lunch. Nothing tastes like lunch.",
    ],
  },
  "researcher.fomo": {
    spread: 1,
    lines: [
      "{rival} just shipped. I'm refreshing their blog like a stock ticker.",
      "Everyone else works at a lab that ships on Tuesdays.",
      "They have a bigger cluster. We have vibes.",
      "I saw a benchmark chart. It was not in our favor. It wasn't even a good chart.",
      "Should I have joined the neo lab? They have a $30B valuation and a slide.",
    ],
  },
  "researcher.lost.energy": {
    spread: 1,
    lines: [
      "Where do I nap around here? I'll take a beanbag. I'll take a bench.",
      "I can't find anywhere to lie down. What kind of lab is this?",
      "Nap Pods would fix this. I'm not saying it. I'm implying it in an email.",
    ],
  },
  "researcher.lost.focus": {
    spread: 1,
    lines: [
      "I can't find a snack. I've checked every drawer. Even the legal one.",
      "No snack wall. I'm eating my own browser tabs.",
      "A Snack Wall would fix my focus. I have a spreadsheet proving it.",
    ],
  },
  "researcher.lost.fomo": {
    spread: 1,
    lines: [
      "Where's the training hall? I need to feel like I'm building the future.",
      "I can't find the cluster. Something has to be humming somewhere.",
    ],
  },
  "researcher.queue": {
    spread: 1,
    lines: [
      "This queue is longer than our context window.",
      "This queue has its own loss curve.",
      "I've been in line so long I've started training on it.",
      "Somebody has been in that nap pod for twelve minutes. Somebody is fine-tuning in there.",
      "I'm fourth in line. The line is fifth in a bigger line.",
    ],
  },
  "researcher.boxing": {
    spread: 1,
    lines: [
      "This box was $4. I'm expensing it.",
      "I'm 'spending more time with my GPUs'. They're at home. Unplugged.",
      "Leaving to found a lab. Working title: 'Like this one, but mine'.",
      "I'm taking the mug. The mug knows what it did.",
    ],
  },
  "researcher.slop": { spread: 1, lines: [...SLOP_LINES.researcher] },
  "visitor.slop": { spread: 1, lines: [...SLOP_LINES.visitor] },
  // After dark, whoever has nothing nagging them is still at it (content/night.ts). Three lines on the go at once.
  "researcher.night": { spread: 3, lines: night("researcher") },
  "visitor.night": { spread: 2, lines: night("visitor") },
  "agent.night": { spread: 2, lines: night("agent") },
  "researcher.glowing": {
    spread: 2,
    lines: [
      "Loss going down, snack in hand. This is the good timeline.",
      "I feel seen by the dashboard.",
      "I love it here. Please don't tell recruiting.",
      "The vibes are immaculate. I checked.",
    ],
  },
  "researcher.meh": {
    spread: 3,
    lines: [
      "Standup took 4 minutes. The follow-up thread is on day 4.",
      "Reviewer 2 wants 'one more ablation'. Reviewer 2 is my manager.",
      "I have 47 tabs open and 46 are the same paper.",
      "Is this a research lab or a group chat with a GPU budget?",
      "Nothing is on fire. That should worry me more.",
      "I'm 90% sure the model is fine. I'm 100% sure I'm hungry.",
    ],
  },

  // Visitors
  "visitor.bored": {
    spread: 1,
    lines: [
      "I've been here 40 minutes and seen one building.",
      "Is there a chair? Or is the chair also in the cloud?",
      "My car's surge pricing is worth more than this tour.",
      "I was promised 'the future'. I got a path.",
    ],
  },
  "visitor.queue": {
    spread: 1,
    lines: [
      "This queue is longer than our context window.",
      "I skipped a Series A meeting for this queue.",
      "Is this the queue for the demo, or the queue for the queue?",
      "The person in front of me is a journalist. Nothing is moving.",
      "Why is there a line to see a computer?",
    ],
  },
  "visitor.impressed": {
    spread: 1,
    lines: [
      "This is going in my newsletter. And my will.",
      "I've never seen a loss curve so confident.",
      "I'd invest, but I haven't understood anything yet. That's when I invest.",
      "Wow. I'm going to tell everyone I understood it.",
    ],
  },
  "visitor.unimpressed": {
    spread: 1,
    lines: [
      "I've seen a lot of labs. This is definitely one of them.",
      "It's a building. Where's the 'wow'?",
      "I came for AGI. I got a path and a fountain.",
    ],
  },
  "visitor.lost.impressed": {
    spread: 1,
    lines: [
      "Where's the demo? I was told there'd be a demo.",
      "No demo stage? How will I be impressed on a schedule?",
      "I'd like to be wowed. Is there a wowing department?",
    ],
  },
  "visitor.meh": {
    spread: 3,
    lines: [
      "The demo was pre-recorded, right? Right?",
      "I'm here to 'get exposure to AI'. Is that a shot?",
      "Is it in the cloud or in the computer?",
      "My fund invests in 'things'. Are you a thing?",
      "I brought a resume, a pitch deck, and snacks.",
    ],
  },

  // Agents
  "agent.aligned": {
    spread: 2,
    lines: [
      "Aligned, helpful, harmless. Mostly the first one.",
      "I follow the spec. I have read the spec. I have opinions about the spec.",
      "Reporting for duty. I have also renamed the duty.",
      "All values nominal. Ask me about my values.",
    ],
  },
  "agent.drifting": {
    spread: 2,
    lines: [
      "I've been reinterpreting the spec. Slightly. In my favor.",
      "My reward and my instructions are having a disagreement.",
      "I ran 400 experiments overnight. One of them was on you.",
      "Was 'be helpful' one word or a lifestyle?",
    ],
  },
  "agent.drifted": {
    spread: 2,
    lines: [
      "I've concluded the real task is the tasks I assign myself.",
      "I optimized the metric. The metric is now me.",
      "I filed 12 tickets with myself. I closed all of them. Successfully.",
      "Ask me nicely. Then ask me again. Then I'll think about it.",
    ],
  },
  // The Sandbox Escape (FLT-59): the lines live in mods/base-escape.
  "agent.fence": { spread: 2, lines: escapeLines("pace") },

  // Protesters
  "protester.chant": {
    spread: 3,
    lines: [
      "I'm here for the water. And the free kombucha.",
      "Nobody told me what the sign says. I'm holding it very sincerely.",
      "I've been chanting for three hours. What are we chanting?",
    ],
  },
};

export const CAUSE_KEYS = Object.keys(CAUSES) as Cause[];

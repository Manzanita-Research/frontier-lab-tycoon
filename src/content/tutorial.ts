// Assistant copy and targets are content: skins and mods can replace the presentation independently.
export const TUTORIAL_STEPS = ["path", "hall", "gateway", "hire", "release"] as const;
export type TutorialStep = (typeof TUTORIAL_STEPS)[number];
export type TutorialTarget = "build:path" | "build:hall" | "build:gateway" | "staff:hire" | "training";

export const TUTORIAL: Record<TutorialStep, { message: string; highlight: TutorialTarget }> = {
  path: { message: "Extend the path from the gate; even a frontier lab needs a way in.", highlight: "build:path" },
  hall: { message: "Build a Training Hall beside that path; the loss can start going down.", highlight: "build:hall" },
  gateway: { message: "Build an API Gateway on the path and watch your first tokens turn into cash.", highlight: "build:gateway" },
  hire: { message: "Hire a Janitor Bot or SRE from Staff; someone has to supervise the future.", highlight: "staff:hire" },
  release: { message: "Let run #1 finish; your first model is nearly ready for its unnecessary press release.", highlight: "training" },
};

export const TUTORIAL_DONE = "{model} is out; you hired an adult, and the board will take the credit.";

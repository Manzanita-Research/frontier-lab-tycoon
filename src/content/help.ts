// The words of Help ▸ How to play. Instructions, not jokes: the jokes live in the world (thought bubbles, headlines, names).
// Data only, so a mod can rewrite it. `{building}` lines come from the building catalogue; only unlocked ones are listed.

export const HELP_TITLE = "How to play";

/** The loop, in five lines. */
export const HELP_LOOP: readonly string[] = [
  "Draw a path from the gate. Everyone in your lab walks on paths.",
  "Build a Training Hall next to the path. It turns compute into a model, and your researchers work there.",
  "Ship your models. Each one earns hype, and hitting your goal unlocks new things to build.",
  "Open an API Gateway to sell what you build. Cash comes in every day.",
  "Watch your Runway and keep growing. Speed the clock up with the buttons at the bottom when you are ready.",
];

/** What the numbers mean. */
export const HELP_NUMBERS: readonly { name: string; line: string }[] = [
  { name: "Cash", line: "The money you have right now." },
  { name: "Runway", line: "How many months your cash lasts at today's spending. Keep it above a few months." },
  { name: "Vibes", line: "How good the lab feels to be in. Happy people bring visitors, applicants and investors." },
  { name: "Hype", line: "How much the world is talking about you. It brings visitors and helps when you ship." },
];

/**
 * One plain line per building (or path). The buildings' own blurbs are jokes, which is right for the world and wrong for a manual;
 * a building added by a mod with no line here falls back to its blurb.
 */
export const HELP_BUILDINGS: Record<string, string> = {
  path: "Path: how people get around. Everything you build has to touch one, and that path has to reach the gate. Buildings don't count as path: a red No path! flag means a door can't reach the gate. Click the flag to see the gap.",
  cluster: "Compute Cluster: makes the compute your Training Halls turn into models.",
  hall: "Training Hall: trains your models. Your researchers work here.",
  gateway: "API Gateway: sells your models to customers. It is where your income comes from.",
  kombucha: "Kombucha Bar: somewhere to unwind. Keeps researchers and visitors happy.",
  nap: "Nap Pods: rest for tired researchers.",
  snack: "Snack Wall: a quick bite for hungry researchers.",
  demo: "Demo Stage: shows your latest model to visitors and brings hype.",
  datacenter: "Datacenter: a lot of extra compute. It needs a power plant.",
  gas: "Gas Turbine: power for a Datacenter.",
  solar: "Solar Farm: cleaner power for a Datacenter.",
};

/** FLT-85: the rule, said once, the first time a building has No path!. */
export const NO_PATH_RULE = "Buildings don't count as path. Connect the door to the gate.";
/** The flag's second line: how far the building is from the gate's paths. */
export const noPathShort = (tiles: number) => (tiles === 0 ? "Boxed in" : `${tiles} tile${tiles === 1 ? "" : "s"} short`);

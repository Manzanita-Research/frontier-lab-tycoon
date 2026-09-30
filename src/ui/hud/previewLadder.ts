// A stand-in for the ladder the logic (FLT-49) sends: the five rungs of the plan (FLT-47) as snapshot additions. For fixtures, the
// skin tests, and screenshot links (`?debug=1&ladder=1&coach=0`) that show a rung without playing up to it. Not game logic: the real
// unlocks, goals and coach lines live in the sim's content.
/** The ladder as the plan draws it (FLT-47), for fixtures and screenshots: what is unlocked, the goal, the teasers, what is shown. */
const LADDER = [
  { name: "Garage", buildings: ["path", "cluster", "hall"], staff: [], goal: ["Ship your first model", 0, 1], show: [] },
  { name: "Open for business", buildings: ["path", "cluster", "hall", "gateway", "kombucha"], staff: [], goal: ["Earn $20K a day", 4_000, 20_000], show: ["revenue", "vibes"] },
  { name: "Growing team", buildings: ["path", "cluster", "hall", "gateway", "kombucha", "nap", "snack"], staff: ["sre", "janitor"], goal: ["Reach 8 researchers and 500 Vibes", 4, 8], show: ["revenue", "vibes", "thoughts", "staff"] },
  { name: "The Race", buildings: ["path", "cluster", "hall", "gateway", "kombucha", "nap", "snack"], staff: ["sre", "janitor"], goal: ["Reach the Top 5 on the Arena", 7, 5], show: ["revenue", "vibes", "thoughts", "staff", "arena", "rnd", "news", "factions"] },
  { name: "Scrutiny", buildings: ["path", "cluster", "hall", "gateway", "kombucha", "nap", "snack", "demo", "security"], staff: ["sre", "janitor", "security", "comms"], goal: ["Ship model #3", 1, 3], show: ["revenue", "vibes", "thoughts", "staff", "arena", "rnd", "news", "events", "papers", "disasters", "factions"] },
] as const;

// One row per milestone, as the sim groups them: how many things it unlocks, and the goal that earns them.
const TEASERS = [
  [{ label: "2 more", hint: "Ship your first model" }, { label: "4 more", hint: "Earn $20K a day" }, { label: "3 more", hint: "Reach the Top 5 on the Arena" }],
  [{ label: "4 more", hint: "Earn $20K a day" }, { label: "3 more", hint: "Reach the Top 5 on the Arena" }],
  [{ label: "3 more", hint: "Reach the Top 5 on the Arena" }],
  [{ label: "3 more", hint: "Reach the Top 5 on the Arena" }],
  [],
] as const;

export const COACH_LINES = [
  { id: "start", target: "start", text: "Welcome to your lab. Everything you build starts here. Click Start." },
  { id: "path", target: "build:path", text: "Start with a path. Draw it from the gate. Everyone in your lab walks on paths." },
  { id: "hall", target: "build:hall", text: "Now a Training Hall. Put it next to your path. It turns compute into a model." },
  { id: "training", target: "training", text: "Your first model is training. Your researchers walk between the Cluster and the Hall." },
  { id: "gateway", target: "build:gateway", text: "You shipped a model! Build an API Gateway to sell it." },
  { id: "runway", target: "stat:runway", text: "That's money coming in. Keep an eye on Runway: it's how long your cash lasts." },
  { id: "goals", target: "goals", text: "Next goal: earn $20K a day. New buildings unlock as you grow." },
] as const;

/** The Playable v1 additions to a snapshot, as the logic (FLT-49) sends them. */
export function playableFixture(level: 1 | 2 | 3 | 4 | 5, coach: number | null = null, unlock = false) {
  const l = LADDER[level - 1]!;
  const panels = ["revenue", "vibes", "arena", "rnd", "thoughts", "news", "staff", "events", "papers", "disasters", "factions"] as const;
  const c = coach === null ? null : COACH_LINES[coach]!;
  return {
    progress: {
      level,
      levelName: l.name,
      unlocked: { buildings: [...l.buildings], staff: [...l.staff], systems: [] as string[] },
      goal: { text: l.goal[0], current: l.goal[1], target: l.goal[2] },
      teasers: TEASERS[level - 1]!.map((t) => ({ ...t })),
    },
    coach: c && { id: c.id, step: (coach ?? 0) + 1, of: COACH_LINES.length, text: c.text, target: c.target, waitFor: "action" as const, canSkip: true as const },
    unlockCard: unlock ? { id: `level-${level}`, title: "New items available!", body: "Your lab is growing. You can build:", items: ["API Gateway", "Kombucha Bar"] } : null,
    hud: { visible: Object.fromEntries(panels.map((p) => [p, (l.show as readonly string[]).includes(p)])) as Record<(typeof panels)[number], boolean> },
  };
}


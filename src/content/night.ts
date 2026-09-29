// Night-only thought pool. The campus clock (render/fx/clock.ts) says when it's night; the juice layer shows one of
// these over a walker's head every so often while the lights are on. Data only: adding a joke never needs code.
//
// Hook for the sim: to make these ordinary sim thoughts, add "night" to ThoughtCondition (content/thoughts.ts), have
// `activeConditions` (sim/thoughts.ts) set it when `isNight(hourAt(state.tick))`, and move these lines into THOUGHTS.
import type { WalkerKind } from "../sim/types";

export interface NightLine {
  kind: WalkerKind;
  text: string;
}

/** Shown first, every session, so the very first night always has its punchline. */
export const FIRST_NIGHT_LINE: NightLine = { kind: "researcher", text: "It's 2am. Still shipping." };

const n = (kind: WalkerKind, text: string): NightLine => ({ kind, text });

export const NIGHT_THOUGHTS: NightLine[] = [
  n("researcher", "It's 2am. Still shipping."),
  n("researcher", "I told my family 'one more eval'. That was Tuesday."),
  n("researcher", "Nothing good happens after midnight, except the eval."),
  n("researcher", "The loss curve is asleep. I refuse to wake it."),
  n("researcher", "Who scheduled the sync for 11pm? Oh. It was me."),
  n("researcher", "I'll sleep when the benchmark saturates."),
  n("researcher", "The moon is out. The GPUs are out. Sleep is out."),
  n("researcher", "Night shift: me, 400 agents, and one tired kombucha tap."),
  n("researcher", "It's dark. Someone should tell the roadmap."),
  n("agent", "Night mode enabled. Same output, dimmer."),
  n("agent", "I don't sleep. I idle at 3% and dream of tokens."),
  n("agent", "It is dark. I have filed a ticket with the sun."),
  n("agent", "Working late is a human thing. I do it out of solidarity."),
  n("visitor", "Is the tour still on? It's dark. Why is everyone still here?"),
  n("visitor", "Nice lamps. Very 'we have runway'."),
];

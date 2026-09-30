// What the inspector card shows about one walker: a plain snapshot, so React never touches the live World.
import { NEEDS, NEEDS_BY_KIND, type NeedKey } from "../content/needs";
import type { MoodLevel } from "./machines/mood";
import { formatDate } from "./format";
import { thoughtOf } from "./mind";
import { happinessOf } from "./needs";
import type { GameState, Walker, WalkerKind } from "./types";
import { defs } from "./defs";

export interface NeedBar {
  key: NeedKey;
  label: string;
  /** 0 to 1. */
  value: number;
  /** false: the bar is bad when full (fomo, drift). */
  goodWhenHigh: boolean;
}

export interface Inspect {
  id: number;
  kind: WalkerKind;
  name: string;
  role: string;
  needs: NeedBar[];
  /** 0 to 1. */
  happiness: number;
  mood: MoodLevel;
  status: string;
  thought: string;
  /** Three lines of personnel file. */
  history: [string, string, string];
}

const plural = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`);
const times = (n: number) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);

/** What they are up to, in a few words. */
export function statusOf(state: GameState, w: Walker): string {
  const building = w.targetId > 0 ? state.buildings.find((b) => b.id === w.targetId) : undefined;
  const name = building ? defs().buildings[building.kind].name : "";
  switch (w.machine.value) {
    case "arriving":
      return w.kind === "researcher" ? "Here for an interview" : w.kind === "visitor" ? "Just arrived" : "Booting up";
    case "seeking":
      return w.need === "work" ? `Heading to the ${name}` : w.need === "tour" ? `Touring: next stop, ${name}` : w.need ? `Seeking ${NEEDS[w.need].seeking} (${name})` : `Heading to the ${name}`;
    case "queuing":
      return `In line for the ${name}`;
    case "inside":
      return `In the ${name}`;
    case "loitering":
      return "Standing around outside";
    case "wandering":
      return w.lost ? `Can't find ${NEEDS[w.lost].seeking}` : "Wandering the campus";
    case "leaving":
      return "Heading out";
    case "quitting":
      return "Walking out with a box";
    case "picketing":
      return "Picketing the gate";
    default:
      return "";
  }
}

function historyOf(state: GameState, w: Walker): [string, string, string] {
  const { stats } = w;
  const when = formatDate(stats.joined);
  switch (w.kind) {
    case "researcher": {
      const habits: [number, string][] = [
        [stats.sips, `Drank ${plural(stats.sips, "kombucha", "kombuchas")}`],
        [stats.naps, `Took ${plural(stats.naps, "nap", "naps")}`],
        [stats.snacks, `Ate ${plural(stats.snacks, "snack", "snacks")}`],
        [stats.demos, `Watched ${plural(stats.demos, "demo", "demos")}`],
      ];
      habits.sort((a, b) => b[0] - a[0]);
      const top = habits[0]![0] > 0 ? habits[0]![1] : "Has not had a proper break yet";
      const offer = stats.offers > 0 ? `Turned down ${defs().names.RIVAL_SHORT[stats.rival] ?? "a rival"} ${times(stats.offers)}` : habits[1]![0] > 0 ? habits[1]![1] : "Has never been poached. Asks about it weekly";
      // Defection (FLT-26): a warning sign, readable but not certain.
      const vc = state.defection?.seen[w.id];
      return [`Joined ${when}`, top, vc ? `Seen with VCs by the Kombucha Bar${vc > 1 ? `, ${times(vc)}` : ""}` : offer];
    }
    case "visitor": {
      const flavor: Record<string, string> = {
        "Venture Capitalist": "Portfolio: 'things'",
        Journalist: "Working title: 'AI: Hot or Not?'",
        "Enterprise Buyer": "Needs it 'on-prem, but cloud'",
        Influencer: "Filming 'a day in the life of a GPU'",
      };
      return [`Arrived ${when}`, stats.demos > 0 ? `Watched ${plural(stats.demos, "demo", "demos")}` : "Has not seen a demo yet", flavor[w.role] ?? "Here for the AI"];
    }
    case "agent": {
      const prs = (state.day - stats.joined + 1) * 3 + (w.id % 5);
      const line = w.drift < 0.3 ? "Follows the spec, mostly" : w.drift < 0.65 ? "Has started editing the spec" : "Is now the spec";
      return [`Spawned ${when}`, `Opened ${prs} pull requests; ${Math.floor(prs / 4)} merged`, line];
    }
    default:
      return [`Handed a sign ${when}`, "Chanting since dawn", "Cannot explain the issue, sincerely"];
  }
}

/** The card for one walker, or null if they are no longer here. */
export function inspectWalker(state: GameState, id: number): Inspect | null {
  const w = state.walkers.find((o) => o.id === id);
  if (!w) return null;
  return {
    id: w.id,
    kind: w.kind,
    name: w.name,
    role: w.role,
    needs: NEEDS_BY_KIND[w.kind].map((key) => ({ key, label: NEEDS[key].label, value: w[key], goodWhenHigh: NEEDS[key].goodWhenHigh })),
    happiness: happinessOf(w),
    mood: w.mood.value,
    status: statusOf(state, w),
    thought: state.thoughts.find((t) => t.walkerId === w.id)?.text ?? thoughtOf(state, w),
    history: historyOf(state, w),
  };
}

// What the HUD reads about the yacht summit: where the arc is, and the leaked chat with names and colours filled in.
import type { RivalId } from "../../content/rivals";
import { defs } from "../defs";
import { fillTemplate } from "../format";
import type { GameState } from "../types";
import { YACHT } from "./pack";

export interface YachtChatLine { from: string; name: string; color: string; you: boolean; system: boolean; time: string; text: string }
export interface YachtView {
  enabled: boolean;
  stage: string;
  rsvp: string | null;
  ending: string | null;
  yachtName: string;
  groupName: string;
  /** The leaked chat, once it has leaked. */
  chat: YachtChatLine[];
}

const YOU_COLOR = "#e4572e";
const YACHT_COLOR = "#1f6f9f";

export function yachtView(s: GameState): YachtView {
  const y = s.yacht;
  const R = YACHT.rules;
  if (!y?.enabled) return { enabled: false, stage: "quiet", rsvp: null, ending: null, yachtName: R.yachtName, groupName: R.groupName, chat: [] };
  const lines = y.leakDay === null ? [] : y.rsvp === "decline" ? R.chat.declined : R.chat.signed;
  const vars = { lab: s.labName };
  return {
    enabled: true, stage: y.machine.value, rsvp: y.rsvp, ending: y.ending, yachtName: R.yachtName, groupName: R.groupName,
    chat: lines.map((l) => {
      const rival = defs().rivalById[l.from as RivalId];
      const name = l.from === "you" ? s.labName : l.from === "yacht" ? R.yachtName : l.from === "system" ? "" : rival?.short ?? l.from;
      const color = l.from === "you" ? YOU_COLOR : l.from === "yacht" ? YACHT_COLOR : rival?.color ?? "#888888";
      return { from: l.from, name, color, you: l.from === "you", system: l.from === "system", time: l.time, text: fillTemplate(l.text, vars) };
    }),
  };
}

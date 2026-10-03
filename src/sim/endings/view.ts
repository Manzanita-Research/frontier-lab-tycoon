// Endings (FLT-11): what the HUD, the share card and the renderer read. Plain JSON, rebuilt with each snapshot. The
// front page's words are the pack's, filled with this lab's names; the run summary is the text people paste to friends.
import { formatDate, fillTemplate } from "../format";
import { dailyLabel } from "../daily";
import { protesterCount } from "../protest";
import { eraOfState } from "../race/race";
import type { GameState } from "../types";
import { managerName } from "./driver";
import { endingById } from "./pack";
import type { Look } from "./state";
import { labNumberOf, refoundView, type RefoundView } from "./lineage";
import { memoView, type MemoView } from "./memo";
import { groupThousands } from "../format";

export interface FrontPage {
  kicker: string;
  headline: string;
  deck: string;
  caption: string;
  subs: string[];
  classified: string;
  signoff: string;
  /** "Y3 · Mar 4", the paper's dateline. */
  date: string;
  /** "Vol. 3 · No. 64". */
  issue: string;
}

export interface RunStats {
  days: number;
  peakVibes: number;
  models: number;
  peakProtesters: number;
  agentsEscaped: number;
}

export interface EndingView {
  id: string;
  title: string;
  tone: "good" | "bad" | "neutral";
  /** Can the player keep watching (The Takeover, Regulated, Captured), or has time stopped (Acqui-hired, The Pivot)? */
  keepPlaying: boolean;
  /** What the end screen offers first (FLT-57): "Found a new lab", or keep going. */
  next: { action: "refound" | "keepPlaying"; label: string; prompt: string };
  paper: FrontPage;
}

export interface EndingsView {
  /** The front page, once it's out; null while the ending's sequence is still playing (and in an ordinary game). */
  ending: EndingView | null;
  /** The ending under way (its id), even before the front page. */
  running: string | null;
  look: Look;
  /** "Frontier-9" while The Takeover's autopilot is in charge: the title bar and the cursor's badge read it. */
  managedBy: string | null;
  /** The Takeover's last card: "Thanks for playing. We'll take it from here." */
  thanks: string | null;
  /** Buildings the autopilot has placed. */
  placed: number;
  stats: RunStats;
  /** Today's lab: "Sep 30, 2026", or null for an ordinary seed. */
  daily: string | null;
  /** Today's lab's date key ("2026-09-30"): what a friend link pins. */
  dailyKey: string | null;
  seed: number;
  /** One square per stretch of the run, coloured by era, like the thing everyone pastes into the group chat. */
  strip: string;
  /** The whole run summary, ready for the clipboard. */
  summary: string;
  /** Lab #1, #2, ...: how many labs this founder has run (FLT-57). */
  labNumber: number;
  /** The perks "Found a new lab" offers, once an ending that leads there has its front page out. */
  refound: RefoundView | null;
  /** The Memo's countdown, then its aftermath (FLT-57). */
  memo: MemoView | null;
}

/** The squares for eras 1 to 4, and the stamp the strip ends on for each ending. */
const ERA_SQUARES = ["🟦", "🟩", "🟨", "🟥"];
const ENDING_EMOJI: Record<string, string> = { takeover: "🤖", regulated: "📋", acquihired: "🧾", captured: "🏛️", pivot: "🔁", escaped: "🏃" };
const STRIP_LEN = 12;

/** The era each of `STRIP_LEN` equal stretches of the run was in. */
export function eraStrip(eraDays: readonly number[], days: number): string {
  let out = "";
  for (let i = 0; i < STRIP_LEN; i++) {
    const day = ((i + 0.5) / STRIP_LEN) * Math.max(1, days);
    let era = 0;
    for (let e = 0; e < eraDays.length; e++) if (eraDays[e]! <= day) era = e;
    out += ERA_SQUARES[Math.min(era, ERA_SQUARES.length - 1)];
  }
  return out;
}

const n = (x: number) => groupThousands(x);

export function endingsView(s: GameState): EndingsView | null {
  const e = s.endings;
  if (!e) return null;
  const days = e.endedDay ?? s.day;
  const stats: RunStats = {
    days,
    peakVibes: Math.max(e.peakVibes, Math.round(s.vibes.value)),
    models: s.models.length,
    peakProtesters: Math.max(e.peakProtesters, protesterCount(s)),
    agentsEscaped: e.agentsEscaped,
  };
  const eraDays = e.eraDays.slice();
  while (eraDays.length < eraOfState(s)) eraDays.push(s.day);
  const def = e.id ? endingById(e.id) : undefined;
  const vars: Record<string, string> = {
    lab: s.labName,
    model: s.models.at(-1) ?? s.training.context.name,
    models: String(s.models.length),
    day: String(days),
    manager: managerName(s),
    ...(e.run?.vars ?? {}),
    placed: String(e.autopilot.placed),
  };
  const fill = (t: string) => fillTemplate(t, vars);
  const ending: EndingView | null =
    def && e.endedDay !== null
      ? {
          id: def.id,
          title: def.title,
          tone: def.tone,
          keepPlaying: def.keepPlaying,
          next: { action: def.next.action, label: fill(def.next.label), prompt: fill(def.next.prompt) },
          paper: {
            kicker: fill(def.paper.kicker),
            headline: fill(def.paper.headline),
            deck: fill(def.paper.deck),
            caption: fill(def.paper.caption),
            subs: def.paper.subs.map(fill),
            classified: fill(def.paper.classified),
            signoff: fill(def.paper.signoff),
            date: formatDate(e.endedDay),
            issue: `Vol. ${Math.floor(e.endedDay / 360) + 1} · No. ${(e.endedDay % 360) + 1}`,
          },
        }
      : null;
  const daily = e.daily ? dailyLabel(e.daily) : null;
  const strip = eraStrip(eraDays, days) + (def ? (ENDING_EMOJI[def.id] ?? "📰") : "");
  const labNumber = labNumberOf(s);
  const summary = [
    `Frontier Lab Tycoon · ${daily ? `Today's lab, ${daily}` : `seed ${s.seed}`}${labNumber > 1 ? ` · Lab #${labNumber}` : ""}`,
    `${s.labName}${def ? ` → ${def.title}` : ""}`,
    strip,
    `📅 ${n(stats.days)} days · ✨ ${n(stats.peakVibes)} peak Vibes · 🚀 ${n(stats.models)} models`,
    `📣 ${n(stats.peakProtesters)} peak protesters · 🏃 ${n(stats.agentsEscaped)} agents escaped`,
    ...(ending ? [`“${ending.paper.headline}”`] : []),
  ].join("\n");
  const managedBy = typeof e.look.managedBy === "string" ? e.look.managedBy : null;
  return {
    ending,
    running: e.id,
    look: { ...e.look },
    managedBy,
    thanks: typeof e.look.thanks === "string" ? e.look.thanks : null,
    placed: e.autopilot.placed,
    stats,
    daily,
    dailyKey: e.daily,
    seed: s.seed,
    strip,
    summary,
    labNumber,
    refound: ending?.next.action === "refound" ? refoundView(s) : null,
    memo: memoView(s),
  };
}

/** Kept for the renderer: how far the ghost cursor is along its glide to the next build (0 to 1), or null. */
export function cursorOf(s: GameState, tick = s.tick): { x: number; z: number; kind: string; t: number } | null {
  const target = s.endings?.autopilot.on ? s.endings.autopilot.target : null;
  if (!target) return null;
  const span = Math.max(1, target.placeTick - target.aimedTick);
  return { x: target.x, z: target.z, kind: target.kind, t: Math.max(0, Math.min(1, (tick - target.aimedTick) / span)) };
}

// Pure presentation transforms. No sim mutation, random draws, clocks or browser APIs.
import type { NewsTrigger } from "../content/headlines";
import { LEAPFROG, type PackTrigger } from "../content/leapfrog";
import { CLASSIFIEDS, DESK_STORIES, EVENT_STORY_KIND, REACTIONS, STORY_PRIORITY, type Friend, type StoryKind } from "../content/newsroom";
import type { NewsItem } from "../sim/types";
import { defs } from "../sim/defs";

export interface Story { id: number; day: number; text: string; kind: StoryKind }
export interface FrontPage {
  type: "paper"; id: string; day: number; from: number; lab: string;
  lead: Story; sub: Story[]; caption: string; classified: string;
  stocks: { name: string; price: string; change: number }[];
  photo?: string;
}
export interface ChatMessage { friend: Friend; text: string }
export interface Recap { type: "chat"; id: string; day: number; from: number; lab: string; topic: string; messages: ChatMessage[] }
export type Edition = FrontPage | Recap;

const triggerKind = (trigger: NewsTrigger): StoryKind => {
  if (trigger.startsWith("built:")) return "build";
  switch (trigger) {
    case "runDone": return "release";
    case "runStarted": return "training";
    case "lowCash": case "bailout": return "money";
    case "rival": return "rival";
    case "protest": return "protest";
    case "won": case "lost": return "ending";
    default: return "filler";
  }
};
/** Release Leapfrog's headlines: the news cycle's owner makes the front page; solved benchmarks are era-sized news. */
const packKind = (trigger: PackTrigger): StoryKind => {
  switch (trigger) {
    case "cycleOwned": return "cycle";
    case "saturated": return "era";
    case "counterStrong": case "counterSoft": case "shipped": case "bug": return "release";
    case "stunt": case "cycleLost": case "windowClosed": case "crowded": case "flawless": return "filler";
    default: return "rival";
  }
};
// Recover the content trigger without changing NewsItem (or any shared sim type).
const pattern = (text: string, kind: StoryKind) => ({
  kind,
  re: new RegExp(`^${text.split(/\{\w+\}/).map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".+?")}$`),
});
// Built from the session's content (mods can add headlines and events), once per definition.
let built: { from: ReturnType<typeof defs>; patterns: ReturnType<typeof pattern>[] } | null = null;
const patternsOf = (d = defs()) => (built?.from === d ? built.patterns : (built = { from: d, patterns: [
  ...d.headlines.map((h) => pattern(h.text, triggerKind(h.trigger))),
  ...LEAPFROG.headlines.map((h) => pattern(h.text, packKind(h.trigger))),
  ...LEAPFROG.mishaps.map((m) => pattern(m.headline, "cycle" as StoryKind)),
  ...d.events.flatMap((e) => e.choices.flatMap((c) => c.effects.flatMap((f) => f.type === "news" ? [pattern(f.text, EVENT_STORY_KIND[e.id] ?? "filler")] : []))),
] }).patterns);
export function storyFromNews(n: NewsItem): Story {
  const match = patternsOf().find((p) => p.re.test(n.text));
  const kind = match?.kind ?? (/breakdown|broke|offline|alarm/i.test(n.text) ? "breakdown" : /era|takeoff|explosion/i.test(n.text) ? "era" : /protest|water discourse/i.test(n.text) ? "protest" : "filler");
  return { id: n.id, day: n.day, text: n.text, kind };
}
/** Biggest story first; newer wins ties, then id. Deduplicate before taking four. Never sorts the input. */
export function rankStories(stories: readonly Story[], from: number, to: number): Story[] {
  const seen = new Set<string>();
  return stories.filter((s) => s.day >= from && s.day < to)
    .slice().sort((a, b) => STORY_PRIORITY[b.kind] - STORY_PRIORITY[a.kind] || b.day - a.day || b.id - a.id)
    .filter((s) => { if (seen.has(s.text)) return false; seen.add(s.text); return true; });
}

export function frontPage(stories: readonly Story[], day: number, lab: string): FrontPage {
  const from = Math.max(0, day - 7);
  const ranked = rankStories(stories, from, day);
  const fillers = DESK_STORIES.map((text, i): Story => ({ id: -i - 1, day: day - 1, kind: "filler", text }));
  const [lead, ...sub] = [...ranked, ...fillers];
  return {
    type: "paper", id: `paper-${day}`, from, day, lab,
    lead: lead!, sub: sub.slice(0, 3),
    caption: `${lab}, photographed at press time. The lawn remains cautiously optimistic.`,
    classified: CLASSIFIEDS[Math.floor(day / 7) % CLASSIFIEDS.length]!,
    // Fictional sentiment index, not simulated trading. Stable across reopening an edition.
    stocks: defs().names.RIVALS.slice(0, 4).map((name, i) => ({ name, price: (80 + ((day * 13 + i * 41) % 240) / 10).toFixed(2), change: ((day + i * 7) % 23) - 11 })),
  };
}

export function recap(stories: readonly Story[], day: number, lab: string): Recap {
  const from = Math.max(0, day - 30);
  const ranked = rankStories(stories, from, day);
  const topic = ranked[0]?.text ?? `${lab} survived another month on the internet`;
  const kinds = [...new Set(ranked.map((s) => s.kind))];
  if (kinds.length === 0) kinds.push("filler");
  const count = stories.filter((s) => s.kind === "release" && s.day >= from && s.day < day).length;
  const friends: Friend[] = ["skeptic", "doomer", "accel", "mom"];
  // Everyone reacts to the lead, then the three friends pick up other actual events.
  const messages: ChatMessage[] = friends.map((friend) => ({ friend, text: REACTIONS[kinds[0]!][friend].replace("{count}", String(count)).replace("{launches}", count === 1 ? "launch" : "launches") }));
  kinds.slice(1, 4).forEach((kind, i) => {
    const friend = friends[i % 3]!;
    messages.push({ friend, text: REACTIONS[kind][friend].replace("{count}", String(count)).replace("{launches}", count === 1 ? "launch" : "launches") });
  });
  return { type: "chat", id: `chat-${day}`, day, from, lab, topic, messages };
}

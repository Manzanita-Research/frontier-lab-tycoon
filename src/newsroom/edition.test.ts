import { describe, expect, it } from "vitest";
import { HEADLINES } from "../content/headlines";
import { fillTemplate } from "../sim/format";
import { frontPage, rankStories, recap, storyFromNews, type Story } from "./edition";
import { NewsDesk } from "./desk";
import { createInitialState } from "../sim/state";
import { defs } from "../sim/defs";
const s = (kind: Story["kind"], day: number, id = day): Story => ({ kind, day, id, text: `${kind} happened ${id}` });

describe("Frontier Times", () => {
  it("ranks significance ahead of recency, breaks ties deterministically and doesn't mutate", () => {
    const stories = [s("filler", 6), s("release", 2), s("protest", 5), s("release", 4), s("breakdown", 1)];
    const copy = stories.slice();
    expect(rankStories(stories, 0, 7).map((s) => s.kind)).toEqual(["breakdown", "release", "release", "protest", "filler"]);
    expect(rankStories(stories, 0, 7)[1]?.day).toBe(4);
    expect(stories).toEqual(copy);
  });
  it("excludes events outside the completed week, deduplicates, and always has three sub-stories", () => {
    const stories = [s("ending", 7), s("era", -1), s("release", 3), s("release", 3), s("protest", 6)];
    const page = frontPage(stories, 7, "Tiny Lab");
    expect(page.lead.kind).toBe("release");
    expect(page.sub).toHaveLength(3);
    expect(new Set([page.lead, ...page.sub].map((s) => s.text)).size).toBe(4);
    expect(frontPage([], 7, "Tiny Lab").sub).toHaveLength(3);
  });
  it("files the Bird App's bangers and cancels as the news cycle, and a spat as filler (FLT-69)", () => {
    const d = defs();
    const vars = { lab: "Lab (v2.1)", name: "Ada Gradient", handle: "@ada", post: "scaling is a vibe", rival: "Macrohard", model: "Frontier-2", queue: "3" };
    const kinds = (beat: "banger" | "cancelled" | "controversy") =>
      new Set(d.bird.events(beat, "headline").map((e, i) => storyFromNews({ id: i, day: 1, text: fillTemplate(e.text, vars), tone: "neutral" }).kind));
    expect(kinds("banger")).toEqual(new Set(["cycle"]));
    expect(kinds("cancelled")).toEqual(new Set(["cycle"]));
    expect(kinds("controversy")).toEqual(new Set(["filler"]));
  });
  it("recovers every current headline trigger even with punctuation in model/lab names", () => {
    for (const [id, h] of HEADLINES.entries()) {
      const n = storyFromNews({ id, day: 1, tone: h.tone, text: fillTemplate(h.text, { lab: "Descent & Sons (v2)", model: "Frontier-4.5-Pro", rival: "Open-ish AI", cash: "$4.2M" }) });
      if (h.trigger === "runDone") expect(n.kind).toBe("release");
      if (h.trigger.startsWith("built:")) expect(n.kind).toBe("build");
      if (h.trigger === "protest") expect(n.kind).toBe("protest");
      if (h.trigger === "lowCash" || h.trigger === "bailout") expect(n.kind).toBe("money");
      if (h.trigger === "rival") expect(n.kind).toBe("rival");
    }
  });
});

describe("monthly group chat", () => {
  it("keeps all four voices and Mom's screenshot line, uses only this month's actual events", () => {
    const result = recap([s("ending", -1), s("era", 30), s("release", 4), s("protest", 8), s("money", 12)], 30, "Tiny Lab");
    expect(result.topic).toContain("release");
    expect(result.messages.slice(0, 4).map((m) => m.friend)).toEqual(["skeptic", "doomer", "accel", "mom"]);
    expect(result.messages[0]?.text).toContain("1 launch");
    expect(result.messages[3]?.text).toBe("is this you on the news? call me");
    expect(result.messages.some((m) => m.text.includes("water"))).toBe(true);
    expect(result.messages.some((m) => m.text.includes("money"))).toBe(true);
    expect(recap([], 30, "Tiny Lab").messages).toHaveLength(4);
    expect(result).toEqual(recap([s("ending", -1), s("era", 30), s("release", 4), s("protest", 8), s("money", 12)], 30, "Tiny Lab"));
  });
  it("generates every event type with no unresolved template variables", () => {
    for (const kind of ["release", "protest", "money", "rival", "build", "training", "era", "breakdown", "ending", "filler"] as const) {
      const result = recap([s(kind, 1)], 30, "Tiny Lab");
      expect(result.messages.every((m) => m.text.length > 10 && !m.text.includes("{"))).toBe(true);
    }
  });
});

it("publishes once per boundary, retains the month beyond the ticker's fifty items, resets cleanly", () => {
  const desk = new NewsDesk();
  const w = createInitialState(1);
  expect(desk.poll(w).editions).toHaveLength(0);
  w.news = [{ id: 900, day: 2, tone: "good", text: "Tiny Lab releases Frontier-2; benchmarks up, expectations up, sleep down" }];
  w.day = 6; desk.poll(w);
  w.day = 7;
  expect(desk.poll(w).editions.map((e) => e.id)).toEqual(["paper-7"]);
  expect(desk.poll(w).editions).toHaveLength(0);
  w.news = []; w.day = 30;
  const editions = desk.poll(w).editions;
  expect(editions.at(-1)?.type).toBe("chat");
  const chat = editions.at(-1);
  expect(chat?.type === "chat" && chat.messages[3]?.text).toContain("is this you on the news?");
  const newWorld = createInitialState(2);
  newWorld.day = 100;
  expect(desk.poll(newWorld)).toEqual({ reset: true, editions: [] });
});

it("records event-card openings and recognizes their choice headlines as the same event kind", () => {
  const desk = new NewsDesk();
  const world = createInitialState(2);
  desk.poll(world);
  const arc = world.arcs.waterDiscourse;
  if (!arc) throw new Error("Missing water arc");
  arc.value = "cardOpen"; arc.context = { ...arc.context, openedDay: 6 }; world.day = 6;
  desk.poll(world);
  desk.poll(world);
  world.day = 7;
  const paper = desk.poll(world).editions[0];
  expect(paper?.type === "paper" && paper.lead.kind).toBe("protest");
  expect(storyFromNews({ id: 99, day: 6, tone: "good", text: "Tiny Lab unveils Transparency Fountain: water you can see through, unlike the report" }).kind).toBe("protest");
});

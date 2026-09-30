import { describe, expect, it } from "vitest";
import { BUILDINGS } from "../../content/buildings";
import { formatMoney } from "../../sim/format";
import { fixtureInput, fixtureWorld, FIXTURE_CHAT, FIXTURE_PAPER } from "./fixtures";
import { CALM_START_DAY } from "../../sim/disasters/driver";
import { SKIN_API_VERSION } from "./types";
import { hudViewModel, SHIPPED_DAYS, TICKER_ITEMS } from "./vm";

/** Every value in a view-model must survive JSON: that is what makes it a contract a skin can rely on. */
function assertPlain(v: unknown, path = "vm") {
  if (v === undefined) throw new Error(`${path} is undefined`);
  if (typeof v === "function" || typeof v === "symbol") throw new Error(`${path} is a ${typeof v}`);
  if (typeof v === "number" && !Number.isFinite(v)) throw new Error(`${path} is ${v}`);
  if (Array.isArray(v)) v.forEach((x, i) => assertPlain(x, `${path}[${i}]`));
  else if (v && typeof v === "object") {
    const proto = Object.getPrototypeOf(v);
    if (proto !== Object.prototype && proto !== null) throw new Error(`${path} is a ${proto.constructor?.name}, not a plain object`);
    for (const [k, x] of Object.entries(v)) assertPlain(x, `${path}.${k}`);
  }
}

describe("hudViewModel", () => {
  const input = fixtureInput({ tool: "cluster" });
  const vm = hudViewModel(input);

  it("is plain JSON and survives a round trip", () => {
    assertPlain(vm);
    expect(JSON.parse(JSON.stringify(vm))).toEqual(vm);
  });

  it("is a pure function of its input", () => {
    expect(hudViewModel(input)).toEqual(vm);
    expect(hudViewModel(fixtureInput({ tool: "cluster" }))).toEqual(vm);
    expect(vm.apiVersion).toBe(SKIN_API_VERSION);
  });

  it("carries the stats, formatted", () => {
    const s = input.snap;
    expect(vm.stats.labName).toBe(s.labName);
    expect(vm.stats.cash.text).toBe(formatMoney(s.cash));
    expect(vm.stats.vibes.value).toBe(Math.round(s.vibes.value));
    expect(vm.stats.time).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/);
    expect(vm.stats.date).toMatch(/^Y\d · [A-Z][a-z]{2} \d+$/);
    expect(vm.stats.dateShort).not.toContain("·");
    expect(vm.stats.vibes.rows).toHaveLength(7);
    expect(vm.stats.runway.text).toBe(s.runway === null ? "∞" : `${s.runway.toFixed(1)} mo`);
  });

  it("lists the build palette with prices, hotkeys, affordability and the selected tool", () => {
    const kinds = vm.buildItems.map((b) => b.kind);
    expect(kinds).toEqual(["path", "cluster", "hall", "gateway", "kombucha", "nap", "snack", "demo", "security", "bulldoze", "staff"]);
    const cluster = vm.buildItems.find((b) => b.kind === "cluster")!;
    expect(cluster).toMatchObject({ name: BUILDINGS.cluster.name, hotkey: 2, selected: true, price: BUILDINGS.cluster.price, priceText: formatMoney(BUILDINGS.cluster.price) });
    expect(vm.buildItems.filter((b) => b.selected)).toHaveLength(1);
    expect(vm.buildItems.find((b) => b.kind === "bulldoze")!.hotkey).toBe(9);
    expect(vm.buildTip?.name).toBe(BUILDINGS.cluster.name);
    const poor = hudViewModel({ ...input, snap: { ...input.snap, cash: 15_000 } });
    expect(poor.buildItems.find((b) => b.kind === "hall")!.affordable).toBe(false);
    expect(poor.buildItems.find((b) => b.kind === "path")!.affordable).toBe(true);
    expect(hudViewModel({ ...input, tool: null }).buildTip).toBeNull();
  });

  it("offers the four speeds and marks the active one", () => {
    expect(vm.speed.options.map((o) => o.value)).toEqual([0, 1, 3, 10]);
    expect(vm.speed.options.map((o) => o.key)).toEqual(["speed.pause", "speed.1", "speed.3", "speed.10"]);
    expect(vm.speed.options.filter((o) => o.active).map((o) => o.value)).toEqual([1]);
    expect(hudViewModel({ ...input, speed: 0 }).speed.paused).toBe(true);
  });

  it("turns thoughts into bubbles with speakers", () => {
    expect(vm.bubbles.length).toBeGreaterThan(0);
    expect(vm.bubbles.every((b) => b.speaker.length > 0 && b.text.length > 0)).toBe(true);
  });

  it("carries the training run, the ETA and the SHIPPED! window", () => {
    expect(vm.training.hasHall).toBe(true);
    expect(vm.training.pctText).toMatch(/^\d+%$/);
    expect(vm.training.etaDays === null || vm.training.etaDays >= 0).toBe(true);
    expect(vm.training.justShipped).toBe(false);
    const shipped = hudViewModel({ ...input, snap: { ...input.snap, models: 1, lastRelease: input.snap.day - 1 } });
    expect(shipped.training.justShipped).toBe(true);
    const later = hudViewModel({ ...input, snap: { ...input.snap, models: 1, lastRelease: input.snap.day - SHIPPED_DAYS - 1 } });
    expect(later.training.justShipped).toBe(false);
  });

  it("describes the objectives", () => {
    expect(vm.objectives.total).toBe(3);
    expect(vm.objectives.items.every((g) => g.ratio >= 0 && g.ratio <= 1)).toBe(true);
    // The release goal names the run in flight and carries its own count, so it has no separate progress line.
    const release = vm.objectives.items.find((g) => g.id === "release")!;
    expect(release.label).toBe(input.snap.releaseGoal);
    expect(release.label).toMatch(/^Ship 3 models \(\d\/3\), next: /);
    expect(release.progress).toBe("");
    expect(vm.objectives.items.filter((g) => g.id !== "release").every((g) => g.progress.length > 0)).toBe(true);
    expect(vm.objectives.daysLeft).toBeGreaterThan(0);
  });

  it("opens the inspector for the selected walker and closes it for nobody", () => {
    expect(vm.inspector).not.toBeNull();
    expect(vm.inspector!.badge).toMatch(/^\d{4}$/);
    expect(vm.inspector!.history).toHaveLength(3);
    expect(vm.inspector!.needs.every((n) => n.pct >= 0 && n.pct <= 100)).toBe(true);
    expect(vm.inspector!.portrait.body).toMatch(/^#/);
    expect(hudViewModel(fixtureInput({ selected: null })).inspector).toBeNull();
  });

  it("shows one hint at a time, and none while a toast is talking", () => {
    const quiet = { ...input, toasts: [] };
    expect(hudViewModel(quiet).hints).toEqual(["gateway"]);
    expect(hudViewModel({ ...quiet, toldGateway: true }).hints).toEqual(["tap"]);
    expect(hudViewModel({ ...quiet, toldGateway: true, tapHint: false }).hints).toEqual([]);
    expect(vm.toasts.length).toBeGreaterThan(0);
    expect(vm.hints).toEqual([]);
  });

  it("describes the payroll and offers it as a tile in the palette", () => {
    const staffTile = vm.buildItems.at(-1)!;
    expect(staffTile).toMatchObject({ kind: "staff", name: "Staff", hotkey: null, selected: false, affordable: true });
    expect(hudViewModel(fixtureInput({ staff: true })).buildItems.at(-1)!.selected).toBe(true);
    expect(vm.staff.open).toBe(false);
    expect(vm.staff.jobs.map((j) => j.job)).toEqual(["janitor", "sre", "comms", "security"]);
    expect(vm.staff.jobs.every((j) => j.salaryText.endsWith("/day") && /^#|rgb|hsl/.test(j.color))).toBe(true);
    expect(vm.staff.payrollText).toBe("nobody on the payroll");
  });

  it("caps the ticker to the newest headlines", () => {
    const many = Array.from({ length: 60 }, (_, i) => ({ id: i + 1, day: i, text: `n${i}`, tone: "neutral" as const }));
    const t = hudViewModel({ ...input, news: many }).ticker;
    expect(t).toHaveLength(TICKER_ITEMS);
    expect(t.at(-1)!.id).toBe(60);
  });

  it("presents an open event card with filled-in text, and the era card separately", () => {
    const water = hudViewModel(fixtureInput({ event: "waterDiscourse" }));
    expect(water.event).toMatchObject({ id: "waterDiscourse", tone: "bad", stripe: "Breaking", kind: "plain" });
    expect(water.event!.choices.map((c) => c.key)).toEqual([1, 2, 3]);
    expect(water.eraCard).toBeNull();
    const auction = hudViewModel(fixtureInput({ event: "computeAuction" }));
    expect(auction.event!.kind).toBe("auction");
    expect(auction.event!.paddles).toHaveLength(3);
    expect(auction.event!.body).not.toMatch(/\{\w+\}/);
    const era = hudViewModel(fixtureInput({ event: "era2" }));
    expect(era.event).toBeNull();
    expect(era.eraCard).toMatchObject({ n: 2, total: 4 });
    expect(era.eraCard!.continueLabel.length).toBeGreaterThan(0);
  });

  it("presents the outcome card only while it is undismissed", () => {
    expect(vm.outcome).toBeNull();
    const won = hudViewModel(fixtureInput({ outcome: "won" }));
    expect(won.outcome).toMatchObject({ won: true, stripe: "Scenario complete" });
    expect(won.outcome!.stats.map((s) => s.label)).toContain("Cash");
    expect(hudViewModel({ ...fixtureInput({ outcome: "lost" }), outcomeDismissed: true }).outcome).toBeNull();
  });

  it("puts the news room in order: newest edition first, the open one in full, nothing under a card", () => {
    expect(vm.newsroom.archive.map((e) => e.id)).toEqual([FIXTURE_CHAT.id, FIXTURE_PAPER.id]);
    expect(vm.newsroom.unread).toBe(1);
    expect(vm.newsroom.arrival).toMatchObject({ id: FIXTURE_PAPER.id, type: "paper" });
    expect(vm.newsroom.view).toBeNull();
    const paper = hudViewModel(fixtureInput({ view: FIXTURE_PAPER }));
    expect(paper.newsroom.view).toBe("paper");
    expect(paper.newsroom.paper!.substories).toHaveLength(3);
    expect(paper.newsroom.arrival).toBeNull();
    const chat = hudViewModel(fixtureInput({ view: FIXTURE_CHAT, chatCount: 2 }));
    expect(chat.newsroom.chat!.messages).toHaveLength(2);
    expect(chat.newsroom.chat!.typing).not.toBeNull();
    expect(hudViewModel(fixtureInput({ view: FIXTURE_CHAT, chatCount: 99 })).newsroom.chat!.done).toBe(true);
    // A card that needs answering hides the reader.
    expect(hudViewModel(fixtureInput({ view: FIXTURE_PAPER, event: "waterDiscourse" })).newsroom.view).toBeNull();
  });

  it("derives layout flags from the viewport", () => {
    expect(vm.layout).toMatchObject({ phone: false, compact: false, tall: true });
    expect(hudViewModel(fixtureInput({ width: 390, height: 844 })).layout).toMatchObject({ phone: true, compact: true, tall: true });
    expect(hudViewModel(fixtureInput({ width: 600, height: 700 })).layout).toMatchObject({ phone: false, compact: true, tall: false });
  });

  it("builds a view-model well inside the 5 Hz budget", () => {
    const big = fixtureInput({ world: fixtureWorld(60), tool: "hall" });
    hudViewModel(big);
    const t0 = performance.now();
    for (let i = 0; i < 500; i++) hudViewModel(big);
    const perCall = (performance.now() - t0) / 500;
    // The HUD builds one every 200 ms at most; a millisecond would already be a lot.
    expect(perCall).toBeLessThan(1);
  });
});

describe("the spend check, the standing warnings and the release goal, as a skin sees them", () => {
  it("shows a spend waiting for a yes or a no as plain data, and nothing when nothing waits", () => {
    expect(hudViewModel(fixtureInput()).confirm).toBeNull();
    const vm = hudViewModel(fixtureInput({ confirm: true }));
    expect(vm.confirm).toEqual({ kind: "hire", cost: 4000, costText: "$4K", runwayAfter: 1.8, runwayText: "1.8 mo", message: "This leaves 1.8 months of runway. The board will have questions." });
    assertPlain(vm.confirm);
  });

  it("carries standing warnings, and shows a toast that repeats one only once", () => {
    const warning = "Your entrance isn't connected to any paths. Visitors are forming a very orderly queue to nowhere.";
    const quiet = hudViewModel(fixtureInput());
    expect(quiet.warnings).toEqual([]);
    const input = fixtureInput({ warnings: [warning] });
    expect(hudViewModel(input).warnings).toEqual([warning]);
    const echoed = hudViewModel({ ...input, toasts: [{ id: 5, text: warning, tone: "bad" }] });
    expect(echoed.toasts).toEqual([]);
    // Other toasts are untouched.
    expect(hudViewModel({ ...input, toasts: [{ id: 6, text: "Something else", tone: "joke" }] }).toasts.map((t) => t.text)).toEqual(["Something else"]);
  });
});

describe("Playable v1: what the lab has earned, the coach, and Help", () => {
  const level = (n: 1 | 2 | 3 | 4 | 5, more: Parameters<typeof fixtureInput>[0] = {}) => hudViewModel(fixtureInput({ level: n, ...more }));

  it("carries no ladder as 'everything is earned': the game plays as it always did", () => {
    // A snapshot from before the ladder (an older save, a link): none of the playable fields.
    const input = fixtureInput();
    const { progress: _p, coach: _c, unlockCard: _u, hud: _h, ...old } = input.snap;
    const vm = hudViewModel({ ...input, snap: old as typeof input.snap });
    expect(Object.values(vm.visible).every(Boolean)).toBe(true);
    expect(vm.buildItems.map((b) => b.kind)).toContain("demo");
    expect(vm.coach).toBeNull();
    expect(vm.unlock).toBeNull();
    expect(vm.progress.teasers).toEqual([]);
    expect(vm.progress.goal.line).toBe("");
  });

  it("shows only the unlocked tools in the build panel (the bulldozer always), and teases the rest", () => {
    const one = level(1);
    expect(one.buildItems.map((b) => b.kind)).toEqual(["path", "cluster", "hall", "bulldoze"]);
    expect(one.progress.teasers).toContainEqual({ label: "2 more", hint: "Ship your first model" });
    expect(level(2).buildItems.map((b) => b.kind)).toEqual(["path", "cluster", "hall", "gateway", "kombucha", "bulldoze"]);
    expect(level(3).buildItems.map((b) => b.kind)).toContain("staff");
    expect(one.buildItems.map((b) => b.kind)).not.toContain("staff");
    expect(level(5).progress.teasers).toEqual([]);
  });

  it("hires only the kinds of staff the lab has unlocked", () => {
    expect(level(3, { staff: true }).staff.jobs.map((j) => j.job).sort()).toEqual(["janitor", "sre"]);
    expect(level(5, { staff: true }).staff.jobs.map((j) => j.job).sort()).toEqual(["comms", "janitor", "security", "sre"]);
  });

  it("says which HUD panels exist yet, rung by rung", () => {
    expect(Object.values(level(1).visible).some(Boolean)).toBe(false);
    expect(level(2).visible).toMatchObject({ revenue: true, vibes: true, thoughts: false, arena: false });
    expect(level(3).visible).toMatchObject({ thoughts: true, staff: true, arena: false, news: false });
    expect(level(4).visible).toMatchObject({ arena: true, rnd: true, news: true, events: false });
    expect(Object.values(level(5).visible).every(Boolean)).toBe(true);
  });

  it("puts the one goal on one line, with a ratio", () => {
    const g = level(1).progress.goal;
    expect(g).toMatchObject({ text: "Ship your first model", current: 0, target: 1, line: "Ship your first model · 0/1", ratio: 0 });
    expect(level(2).progress.goal.line).toBe("Earn $20K a day · 4000/20000");
    expect(level(2).progress.goal.ratio).toBeCloseTo(0.2);
  });

  it("passes the coach mark and the New! card through as plain data", () => {
    const vm = level(1, { coach: 0, unlock: true });
    expect(vm.coach).toEqual({ id: "start", step: 1, of: 7, text: "Welcome to your lab. Everything you build starts here. Click Start.", target: "start", waitFor: "action", canSkip: true });
    expect(vm.unlock).toMatchObject({ title: "New items available!", items: ["API Gateway", "Kombucha Bar"] });
    assertPlain(vm.coach);
    assertPlain(vm.unlock);
    expect(level(1).coach).toBeNull();
  });

  it("holds the standing hints back while the coach speaks, and the Gateway hint while the Gateway is locked", () => {
    const quiet = { toasts: [] };
    expect(hudViewModel({ ...fixtureInput({ level: 1 }), ...quiet }).hints).toEqual(["tap"]);
    expect(hudViewModel({ ...fixtureInput({ level: 1, coach: 1 }), ...quiet }).hints).toEqual([]);
    expect(hudViewModel({ ...fixtureInput({ level: 2 }), ...quiet, snap: { ...fixtureInput({ level: 2 }).snap, hasGateway: false } }).hints).toEqual(["gateway"]);
  });

  it("writes Help from what is unlocked: the loop, one plain line per building, what the numbers mean", () => {
    expect(level(1).help).toBeNull();
    const help = level(2, { help: true }).help!;
    expect(help.loop).toHaveLength(5);
    expect(help.buildings.map((b) => b.kind)).toEqual(["path", "cluster", "hall", "gateway", "kombucha"]);
    expect(help.buildings.find((b) => b.kind === "gateway")!.line).toMatch(/^API Gateway: sells your models/);
    expect(help.buildings.map((b) => b.kind)).not.toContain("nap");
    expect(help.numbers.map((n) => n.name)).toEqual(["Cash", "Runway", "Vibes", "Hype"]);
    // Instructions, not jokes: the world keeps those.
    for (const line of [...help.loop, ...help.buildings.map((b) => b.line)]) expect(line).not.toMatch(/venture capital into heat|loss goes down/i);
  });
});

describe("the Disasters view (FLT-32)", () => {
  const mid = hudViewModel(fixtureInput({ disaster: true, disastersOpen: true }));

  it("is earned at Scrutiny: hidden before it, and the menu cannot open while it is", () => {
    const four = hudViewModel(fixtureInput({ level: 4, disastersOpen: true }));
    expect(four.disasters.enabled).toBe(false);
    expect(four.disasters.open).toBe(false);
    expect(four.buildItems.map((b) => b.kind)).not.toContain("security");
    const five = hudViewModel(fixtureInput({ level: 5, disastersOpen: true }));
    expect(five.disasters.enabled).toBe(true);
    expect(five.disasters.open).toBe(true);
    expect(five.buildItems.map((b) => b.kind)).toContain("security");
  });

  it("offers the four settings with one checked, and every disaster, greyed with a reason while it is under way", () => {
    expect(mid.disasters.risks.map((r) => r.label)).toEqual(["Off", "Rare", "Normal", "Chaos"]);
    expect(mid.disasters.risks.filter((r) => r.active).map((r) => r.key)).toEqual([mid.disasters.risk]);
    const swarm = mid.disasters.menu.find((m) => m.id === "rogueSwarm")!;
    expect(swarm).toMatchObject({ active: true, available: false });
    expect(swarm.reason).toMatch(/under way/);
    expect(mid.disasters.menu.find((m) => m.id === "gpuFire")).toMatchObject({ active: false, available: true });
    for (const m of mid.disasters.menu) for (const t of m.tags) expect(t.label).not.toBe("");
  });

  it("says what is going wrong, in the game's voice, with the cleanup's progress", () => {
    const swarm = mid.disasters.running.find((r) => r.id === "rogueSwarm")!;
    expect(swarm.stage).toBe("response");
    expect(swarm.phaseLabel).toBe("Cleaning up");
    expect(swarm.line).toMatch(/revoking keys/);
    expect(swarm.progress).toBeGreaterThan(0);
    expect(swarm.progressText).toMatch(/^Security \d+%$/);
    expect(mid.disasters.running.find((r) => r.id === "weightsLeak")?.phaseLabel).toBe("Lawyering");
  });

  it("names who was pulled off their post, and shouts when nobody is left", () => {
    const sec = mid.disasters.understaffed.find((u) => u.job === "security")!;
    expect(sec).toMatchObject({ all: true, diverted: sec.total });
    expect(sec.text).toBe("All Security on the Rogue Agent Swarm. GATE UNGUARDED.");
    // The map's half: who goes red, and where the swarm's cleanup is (the Security Office).
    const snap = fixtureInput({ disaster: true }).snap;
    expect(snap.disasters.divertedIds).toHaveLength(snap.disasters.diverted.reduce((n, d) => n + d.diverted, 0));
    const site = snap.disasters.sites.find((x) => x.owner === "rogueSwarm" && x.job === "security")!;
    expect(snap.buildings.find((b) => b.id === site.to)?.kind).toBe("security");
  });

  it("marks the rival running on your leaked weights in the Arena", () => {
    const leaked = mid.arena.rows.filter((r) => r.leak);
    expect(leaked.map((r) => r.id)).toEqual(["sirocco"]);
    expect(leaked[0]!.title).toMatch(/leaked weights/);
    expect(hudViewModel(fixtureInput()).arena.rows.some((r) => r.leak)).toBe(false);
  });

  it("puts a word on trust and heat", () => {
    expect(mid.disasters.trust.text).toBe(`${mid.disasters.trust.value} · ${mid.disasters.trust.word}`);
    expect(mid.disasters.heat.word).not.toBe("");
  });

  it("promises a calm start while the lab has shipped nothing, and says nothing about it when risk is off", () => {
    const w = fixtureWorld();
    w.disasters.risk = "rare";
    w.models = [];
    expect(hudViewModel(fixtureInput({ world: w })).disasters.calm).not.toBeNull();
    w.disasters.risk = "off";
    expect(hudViewModel(fixtureInput({ world: w })).disasters.calm).toBeNull();
    expect(CALM_START_DAY).toBeGreaterThan(0);
  });
});

describe("the discourse (FLT-33)", () => {
  const fx = hudViewModel(fixtureInput({ factions: true, factionsOpen: true }));

  it("is plain JSON, like the rest of the view-model", () => {
    assertPlain(fx);
    assertPlain(hudViewModel(fixtureInput({ factions: true })));
  });

  it("is off (and draws nothing) until the factions are on", () => {
    const vm = hudViewModel(fixtureInput());
    expect(vm.factions.enabled).toBe(false);
    expect(vm.inspector?.faction ?? null).toBeNull();
  });

  it("gives every faction a meter, a mood in words and a reason, and says who is at the gate", () => {
    const f = fx.factions;
    expect(f.enabled && f.open).toBe(true);
    expect(f.rows.length).toBeGreaterThanOrEqual(10);
    for (const r of f.rows) {
      expect(r.meter).toBeGreaterThanOrEqual(-100);
      expect(r.meter).toBeLessThanOrEqual(100);
      expect(r.meterText).toMatch(/^([+−]\d+|0)$/);
      expect(["Fans", "Upset", "Marching", "Furious online", "Calm"]).toContain(r.moodLabel);
    }
    expect(f.fans + f.angry).toBeGreaterThan(0);
    expect(f.headline).not.toBe("");
    expect(f.stance.map((s) => s.axis)).toEqual(["speed", "safety", "openness", "fairness", "profit"]);
    expect(f.safety.options.filter((o) => o.active)).toHaveLength(1);
    if (f.gate.length) expect(f.gateText).toMatch(/^At the gate: \d+ /);
  });

  it("puts a schism first among the relations", () => {
    const rel = fx.factions.relations;
    const i = rel.findIndex((r) => r.schism);
    if (i >= 0) expect(rel.slice(0, i).every((r) => r.schism)).toBe(true);
    expect(rel.every((r) => r.state === "allied" || r.state === "feuding")).toBe(true);
  });

  it("chips the selected walker and every bubble said as a faction", () => {
    expect(fx.inspector?.faction).toMatchObject({ id: expect.any(String), color: expect.stringMatching(/^#/) });
    for (const b of fx.bubbles) if (b.faction) expect(fx.factions.rows.map((r) => r.id)).toContain(b.faction.id);
  });
});

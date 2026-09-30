import { describe, expect, it } from "vitest";
import { BUILDINGS } from "../../content/buildings";
import { formatMoney } from "../../sim/format";
import { fixtureInput, fixtureWorld, FIXTURE_CHAT, FIXTURE_PAPER } from "./fixtures";
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
    expect(kinds).toEqual(["path", "cluster", "hall", "gateway", "kombucha", "nap", "snack", "demo", "bulldoze", "staff"]);
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
    expect(vm.objectives.items.every((g) => g.progress.length > 0 && g.ratio >= 0 && g.ratio <= 1)).toBe(true);
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

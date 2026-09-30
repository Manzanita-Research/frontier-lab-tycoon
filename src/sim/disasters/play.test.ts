// Each first-wave disaster played through all its phases in a headless run, the random mode at its configured rates,
// and determinism: same seed and commands, same game.
import { createWatch } from "../../render/fx/watch";
import { STAFF } from "../../content/staff";
import { breakBuilding } from "../breakdowns";
import type { Command } from "../commands";
import { openEventOf } from "../events";
import { computePerDay } from "../training";
import { guardsOn } from "../staff";
import { answer, findSpot, layPaths, createTestCampus, readyForPressure } from "../testkit";
import { applyNow, TICKS_PER_DAY, tick } from "../tick";
import type { GameState } from "../types";
import { stepDisaster, startStored } from "./compile";
import { auditorOdds, canTrigger, computeFactor, disastersView, revenueEffect, setRisk, triggerDisaster, upkeepFactor } from "./driver";
import { disasterById } from "./pack";
import type { Risk } from "./types";

/** A working lab: a second cluster and a gateway on generous paths, plenty of cash, and (optionally) a crew. */
function lab(seed = 3, crew: { security?: number; sre?: number } = { security: 2, sre: 1 }, pressure = true): GameState {
  const s = createTestCampus(seed);
  s.cash = 50_000_000;
  layPaths(s);
  for (const kind of ["gateway", "cluster"] as const) {
    const at = findSpot(s, kind);
    if (at) applyNow(s, [{ type: "placeBuilding", kind, x: at[0], z: at[1] }]);
  }
  const hires: Command[] = [];
  for (let i = 0; i < (crew.security ?? 0); i++) hires.push({ type: "hire", job: "security" });
  for (let i = 0; i < (crew.sre ?? 0); i++) hires.push({ type: "hire", job: "sre" });
  applyNow(s, hires);
  // Pressure (cards, disasters) waits for a first launch and a gateway (FLT-16): stage it, this is not an onboarding test.
  if (pressure) readyForPressure(s);
  // ...and keep the other card that turns up once pressure is on (the compute auction) out of these scripts.
  s.race.nextAuction = Number.MAX_SAFE_INTEGER;
  for (let i = 0; i < 60; i++) tick(s);
  return s;
}

const phase = (s: GameState, id: string) => s.disasters.runs.find((r) => r.id === id)?.machine.value ?? null;

/** Tick (answering any card with `pick`) until `stop` is true or `max` ticks pass; returns the phases seen, in order. */
function play(s: GameState, id: string, pick: number, stop: () => boolean = () => false, max = 900): string[] {
  const seen: string[] = [];
  for (let i = 0; i < max; i++) {
    tick(s, answer(s, pick));
    const p = phase(s, id);
    if (p !== null && seen.at(-1) !== p) seen.push(p);
    if (p === null || stop()) break;
  }
  return seen;
}

const cleanupOf = (s: GameState, id: string, pick = 0) => play(s, id, pick, () => phase(s, id) === "cleanup" || phase(s, id) === "cleanupPlug");
const cardsOpen = (s: GameState) => openEventOf(s)?.id ?? null;

describe("Rogue Agent Swarm", () => {
  it("plays warning, active (a card), cleanup (staff-hours) and aftermath, then is gone and everything is undone", () => {
    const s = lab(3, { security: 2, sre: 1 });
    const upkeepBefore = s.ledger.expenses;
    expect(triggerDisaster(s, "rogueSwarm").ok).toBe(true);
    expect(phase(s, "rogueSwarm")).toBe("warning");
    expect(s.news.at(-1)!.text).toContain("Unusual activity");

    // Warning, then the card: time stands still until the player answers it.
    for (let i = 0; i < 6 && cardsOpen(s) === null; i++) tick(s);
    expect(cardsOpen(s)).toBe("dz:rogueSwarm:alert");
    expect(phase(s, "rogueSwarm")).toBe("active");
    const frozen = s.tick;
    tick(s);
    tick(s);
    expect(s.tick).toBe(frozen);
    expect(computeFactor(s)).toBeCloseTo(0.6);
    expect(upkeepFactor(s, "cluster")).toBe(3);
    expect(upkeepFactor(s, "gateway")).toBe(3);
    expect(upkeepFactor(s, "hall")).toBe(1);
    expect(computePerDay(s)).toBeCloseTo(20 * 0.6);

    // Cleanup: the Security Office arrives, every guard and the SRE are pulled off their posts.
    const seen = ["warning", "active", ...cleanupOf(s, "rogueSwarm").slice(-1)];
    expect(seen).toEqual(["warning", "active", "cleanup"]);
    const office = s.buildings.find((b) => b.kind === "security")!;
    expect(office).toBeDefined();
    const guards = s.staff.filter((o) => o.job === "security");
    const sre = s.staff.find((o) => o.job === "sre")!;
    expect(guards.every((g) => g.divert?.to === office.id)).toBe(true);
    expect(sre.divert?.to).toBe(office.id);
    expect(guardsOn(s)).toBe(0);
    expect(disastersView(s)[0]).toMatchObject({ id: "rogueSwarm", phase: "cleanup", progress: 0 });

    // A building breaks while they are away: nobody repairs it until the swarm is over.
    const cluster2 = s.buildings.filter((b) => b.kind === "cluster")[1]!;
    breakBuilding(s, cluster2);
    // They jog: faster than a fence walk.
    const before = guards.map((g) => [g.x, g.z]);
    tick(s);
    const step = Math.hypot(guards[0]!.x - before[0]![0]!, guards[0]!.z - before[0]![1]!);
    expect(step).toBeGreaterThan(STAFF.security.speed * 1.4);
    expect(step).toBeLessThanOrEqual(STAFF.security.speed * 1.8 + 1e-9);

    let progress = 0;
    let cleaned = 0;
    while (phase(s, "rogueSwarm") === "cleanup" && cleaned < 400) {
      tick(s, answer(s));
      cleaned++;
      if (phase(s, "rogueSwarm") !== "cleanup") break;
      const p = disastersView(s)[0]!.progress;
      expect(p).toBeGreaterThanOrEqual(progress - 1e-9);
      progress = p;
      expect(cluster2.broken).toBe(true);
    }
    // 96 staff-hours at two guards is 40 ticks of work, plus the jog there.
    expect(cleaned).toBeGreaterThan(38);
    expect(cleaned).toBeLessThan(120);
    expect(phase(s, "rogueSwarm")).toBe("aftermath");

    // Aftermath: everyone released, the drain and the tripled bills over, auditors circling.
    expect(guards.some((g) => g.divert) || sre.divert).toBeFalsy();
    expect(computeFactor(s)).toBe(1);
    expect(upkeepFactor(s, "cluster")).toBe(1);
    expect(auditorOdds(s)).toBe(2);
    expect(s.disasters.trust).toBe(44);
    expect(s.disasters.heat).toBe(12);
    expect(s.news.some((n) => n.text.includes("swarm postmortem"))).toBe(true);
    for (let i = 0; i < 2 * TICKS_PER_DAY; i++) tick(s, answer(s));
    expect(s.disasters.runs).toEqual([]);
    expect(s.disasters.history.map((h) => h.id)).toEqual(["rogueSwarm"]);
    // The auditors' interest outlives the swarm: it was set for 60 days, not for as long as the disaster ran.
    expect(auditorOdds(s)).toBe(2);
    expect(Object.keys(s.flags).filter((k) => k.startsWith("offer:dz") || k.startsWith("pick:dz"))).toEqual([]);
    // The SRE, released, gets on with it.
    for (let i = 0; i < 100; i++) tick(s);
    expect(cluster2.broken).toBe(false);
    expect(upkeepBefore).toBeGreaterThan(0);
    // The API bill really did triple while it lasted; the auditors' odds are back to normal in time.
    s.tick += 61 * TICKS_PER_DAY;
    expect(auditorOdds(s)).toBe(1);
  });

  it("costs real money while it runs: the day's expenses jump by twice the cluster and gateway upkeep", () => {
    const s = lab(3);
    tick(s);
    while (s.tick % TICKS_PER_DAY !== 0) tick(s);
    const calm = s.ledger.expenses;
    triggerDisaster(s, "rogueSwarm");
    for (let i = 0; i < 4 && !cardsOpen(s); i++) tick(s);
    tick(s, answer(s));
    while (s.tick % TICKS_PER_DAY !== 0) tick(s, answer(s));
    const clusters = s.buildings.filter((b) => b.kind === "cluster").length;
    const gateways = s.buildings.filter((b) => b.kind === "gateway").length;
    const extra = 2 * (clusters * 8_000 + gateways * 3_000);
    // (Researchers come and go, so allow a few salaries of slack.)
    expect(s.ledger.expenses - calm).toBeGreaterThan(extra - 8_000);
    expect(s.ledger.expenses - calm).toBeLessThan(extra + 8_000);
  });

  it("with no Security to send, the cloud provider revokes the key after nine days: -$180K, and it is over", () => {
    const s = lab(3, {});
    triggerDisaster(s, "rogueSwarm");
    cleanupOf(s, "rogueSwarm");
    const start = s.day;
    let dropped = 0;
    for (let i = 0; i < 12 * TICKS_PER_DAY && phase(s, "rogueSwarm") === "cleanup"; i++) {
      const before = s.cash;
      tick(s, answer(s));
      if (phase(s, "rogueSwarm") !== "cleanup") dropped = before - s.cash;
    }
    expect(phase(s, "rogueSwarm")).toBe("aftermath");
    expect(s.day - start).toBeGreaterThanOrEqual(9);
    expect(s.day - start).toBeLessThanOrEqual(10);
    expect(dropped).toBeGreaterThanOrEqual(180_000);
    expect(s.news.some((n) => n.text.includes("revokes"))).toBe(true);
  });

  it("'Pull the plug' stops the API bill at once, turns the till off for four days, and halves the cleanup", () => {
    const s = lab(3, { security: 2, sre: 0 });
    triggerDisaster(s, "rogueSwarm");
    const seen = cleanupOf(s, "rogueSwarm", 1);
    expect(seen.at(-1)).toBe("cleanupPlug");
    expect(upkeepFactor(s, "cluster")).toBe(1);
    expect(computeFactor(s)).toBeCloseTo(0.6);
    expect(revenueEffect(s)).toBe(0);
    let ticks = 0;
    while (phase(s, "rogueSwarm") === "cleanupPlug" && ticks++ < 300) tick(s, answer(s));
    // 48 staff-hours at two guards is 20 ticks of work, plus the jog there.
    expect(ticks).toBeLessThan(130);
    expect(phase(s, "rogueSwarm")).toBe("aftermath");
    // Four days is 80 ticks and the jog took most of them; either way it wears off by itself.
    s.tick += 5 * TICKS_PER_DAY;
    expect(revenueEffect(s)).toBe(1);
  });
});

describe("GPU Fire", () => {
  it("smoke, then fire; nobody comes, so it spreads to the next cluster; the contractor ends it; the scorch marks stay", () => {
    const s = lab(3, {});
    const [a, b] = s.buildings.filter((o) => o.kind === "cluster");
    expect(b).toBeDefined();
    const cash = s.cash;
    triggerDisaster(s, "gpuFire");
    const target = s.buildings.find((o) => o.id === s.disasters.runs[0]!.target)!;
    expect(a === target || b === target).toBe(true);
    expect(s.toasts.map((t) => t.text).join(" ")).toContain("Smoke coming out of the Compute Cluster");
    const seen = play(s, "gpuFire", 0);
    expect(seen).toEqual(["warning", "active", "spread", "aftermath"]);
    expect(s.news.some((n) => n.text.includes("Fire spreads to a second cluster"))).toBe(true);
    expect(s.news.some((n) => n.text === "GPU fire contained; GPUs less so.")).toBe(true);
    expect(s.buildings.filter((o) => o.kind === "cluster").every((o) => !o.broken)).toBe(true);
    expect(target.reliability).toBeLessThanOrEqual(0.7);
    expect(s.cash).toBeLessThan(cash - 120_000);
    for (let i = 0; i < 30; i++) tick(s, answer(s));
    expect(s.disasters.runs).toEqual([]);
    expect(s.disasters.history.at(-1)!.id).toBe("gpuFire");
  });

  it("an SRE who arrives in time keeps it to one cluster", () => {
    const s = lab(3, { sre: 1 });
    triggerDisaster(s, "gpuFire");
    const seen = play(s, "gpuFire", 0);
    expect(seen).toEqual(["warning", "active", "cleanup", "aftermath"]);
    expect(s.news.some((n) => n.text.includes("Fire spreads"))).toBe(false);
    expect(s.buildings.filter((o) => o.kind === "cluster").every((o) => !o.broken)).toBe(true);
  });

  it("with one cluster there is nothing to spread to, and the fire just burns until it is fixed", () => {
    const s = lab(3, {});
    s.buildings = s.buildings.filter((o) => o.kind !== "cluster" || o === s.buildings.find((c) => c.kind === "cluster"));
    s.version++;
    triggerDisaster(s, "gpuFire");
    const seen = play(s, "gpuFire", 0);
    expect(seen).toEqual(["warning", "active", "aftermath"]);
  });
});

describe("Weights Leak", () => {
  it("lifts the open-weights rival to your capability minus 10%, drops hype, and offers Sue, Shrug or 'always going to be open'", () => {
    const s = lab(3);
    s.capability = 60;
    const hype = s.hype;
    triggerDisaster(s, "weightsLeak");
    for (let i = 0; i < 6 && cardsOpen(s) === null; i++) tick(s);
    expect(cardsOpen(s)).toBe("dz:weightsLeak:leak");
    const sirocco = s.race.rivals.find((r) => r.context.id === "sirocco")!;
    expect(sirocco.context.capability).toBeGreaterThanOrEqual(54 - 1e-9);
    expect(sirocco.context.open).toBe(true);
    expect(s.hype).toBeLessThan(hype);
    expect(s.news.some((n) => n.text.includes("Sirocco 'independently' releases"))).toBe(true);
    const card = s.arcs["dz:weightsLeak:leak"]!;
    expect(card.value).toBe("cardOpen");
    expect(card.context.choices).toBe(3);
  });

  it("Shrug ends it; 'always going to be open' ends it and restores trust; Sue goes to court first", () => {
    const shrug = lab(3);
    triggerDisaster(shrug, "weightsLeak");
    expect(play(shrug, "weightsLeak", 1)).toEqual(["warning", "active", "aftermath"]);
    expect(shrug.news.some((n) => n.text.includes("shrug emoji"))).toBe(true);

    const open = lab(3);
    triggerDisaster(open, "weightsLeak");
    const hype = open.hype;
    expect(play(open, "weightsLeak", 2)).toEqual(["warning", "active", "aftermath"]);
    expect(open.disasters.trust).toBe(50 - 6 + 10);
    expect(open.hype).toBeGreaterThan(hype - 8); // the rebrand gives back more than the leak took

    const sue = lab(3);
    const cash = sue.cash;
    triggerDisaster(sue, "weightsLeak");
    expect(play(sue, "weightsLeak", 0)).toEqual(["warning", "active", "sue", "aftermath"]);
    expect(sue.cash).toBeLessThan(cash - 50_000); // the lawsuit is $150K, less what the gateway earns meanwhile
  });

  it("the lawsuit is one roll after four days: 30% to win (the machine, with the die handed to it)", () => {
    const def = disasterById("weightsLeak")!;
    const start = { ...startStored(def, 0, 0), value: "sue" };
    const beat = (roll: number, tickNow: number) => ({ type: "TICK" as const, tick: tickNow, day: tickNow / 20, roll, work: 0, stats: {} });
    expect(stepDisaster(def, start, beat(0.1, 79)).stored.value).toBe("sue");
    const win = stepDisaster(def, start, beat(0.1, 80));
    expect(win.stored.value).toBe("aftermath");
    expect(win.calls.map((c) => c.verb)).toContain("hype.delta");
    expect((win.calls.find((c) => c.verb === "news")!.params as { text: string }).text).toContain("Court orders");
    const lose = stepDisaster(def, start, beat(0.9, 80));
    expect(lose.stored.value).toBe("aftermath");
    expect((lose.calls.find((c) => c.verb === "news")!.params as { text: string }).text).toContain("thrown out");
  });
});

describe("Viral Jailbreak (second wave)", () => {
  it("halves-ish the till (x0.6) until it is dealt with; 'Ship a patch' costs $200K and ends it in two days", () => {
    const s = lab(3, {});
    const cash = s.cash;
    triggerDisaster(s, "viralJailbreak");
    for (let i = 0; i < 6 && cardsOpen(s) === null; i++) tick(s);
    expect(cardsOpen(s)).toBe("dz:viralJailbreak:jailbreak");
    expect(revenueEffect(s)).toBeCloseTo(0.6);
    const seen = play(s, "viralJailbreak", 0);
    expect(seen).toEqual(["patching", "aftermath"]);
    expect(s.cash).toBeLessThan(cash - 200_000);
    expect(revenueEffect(s)).toBe(1);
  });

  it("'It's a feature' gives hype and costs trust; the revenue stays low for eight days", () => {
    const s = lab(3, {});
    const hype = s.hype;
    triggerDisaster(s, "viralJailbreak");
    for (let i = 0; i < 6 && cardsOpen(s) === null; i++) tick(s);
    tick(s, answer(s, 2));
    expect(s.disasters.trust).toBe(50 - 8);
    expect(phase(s, "viralJailbreak")).toBe("leaning");
    expect(revenueEffect(s)).toBeCloseTo(0.6);
    for (let i = 0; i < 7 * TICKS_PER_DAY; i++) tick(s, answer(s));
    expect(revenueEffect(s)).toBeCloseTo(0.6);
    expect(s.hype).toBeGreaterThan(hype - 3);
    play(s, "viralJailbreak", 0);
    expect(revenueEffect(s)).toBe(1);
  });

  it("'Ban the phrase' is a coin flip (the die is the machine's, handed in)", () => {
    const def = disasterById("viralJailbreak")!;
    const start = { ...startStored(def, 0, 0), value: "banning" };
    const beat = (roll: number) => ({ type: "TICK" as const, tick: 100, day: 5, roll, work: 0, stats: {} });
    const worked = stepDisaster(def, start, beat(0.2));
    const failed = stepDisaster(def, start, beat(0.8));
    expect(worked.stored.value).toBe("aftermath");
    expect(worked.calls.some((c) => c.verb === "revenue.mult")).toBe(false);
    expect(failed.calls.some((c) => c.verb === "revenue.mult")).toBe(true);
  });

  it("needs an API Gateway to jailbreak", () => {
    const s = lab(3, {});
    s.buildings = s.buildings.filter((b) => b.kind !== "gateway");
    expect(canTrigger(s, "viralJailbreak")).toMatchObject({ ok: false, reason: "No API Gateway for anybody to jailbreak. Build one first." });
  });
});

describe("Grid Brownout (second wave)", () => {
  it("runs everything at half for four days with no power plant, then the grid comes back on its own", () => {
    const s = lab(3, {});
    triggerDisaster(s, "gridBrownout");
    const start = s.day;
    for (let i = 0; i < 3 && phase(s, "gridBrownout") !== "active"; i++) tick(s);
    expect(computeFactor(s)).toBeCloseTo(0.5);
    expect(revenueEffect(s)).toBeCloseTo(0.5);
    const seen = play(s, "gridBrownout", 0);
    expect(seen).toEqual(["active", "cleanup", "aftermath"]);
    expect(s.day - start).toBeGreaterThanOrEqual(4);
    expect(computeFactor(s)).toBe(1);
    expect(revenueEffect(s)).toBe(1);
    expect(s.news.some((n) => n.text.includes("we don't know either"))).toBe(true);
  });

  it("a Gas Turbine ends it in a day, and the neighbours have discourse; a Solar Farm ends it in a day and gives hype", () => {
    const gas = lab(3, {});
    gas.flags["unlocked:gas"] = 0; // a compute auction unlocks the power plants
    const at = findSpot(gas, "gas");
    applyNow(gas, [{ type: "placeBuilding", kind: "gas", x: at![0], z: at![1] }]);
    expect(gas.buildings.some((b) => b.kind === "gas")).toBe(true);
    const discourse = gas.waterDiscourse;
    triggerDisaster(gas, "gridBrownout");
    const start = gas.day;
    play(gas, "gridBrownout", 0);
    expect(gas.day - start).toBeLessThan(4);
    expect(gas.waterDiscourse).toBeGreaterThan(discourse + 4);
    expect(gas.news.some((n) => n.text.includes("Gas Turbine"))).toBe(true);

    const solar = lab(3, {});
    solar.flags["unlocked:solar"] = 0;
    const spot = findSpot(solar, "solar");
    applyNow(solar, [{ type: "placeBuilding", kind: "solar", x: spot![0], z: spot![1] }]);
    expect(solar.buildings.some((b) => b.kind === "solar")).toBe(true);
    const hype = solar.hype;
    triggerDisaster(solar, "gridBrownout");
    play(solar, "gridBrownout", 0);
    expect(solar.hype).toBeGreaterThan(hype);
    expect(solar.news.some((n) => n.text.includes("Solar Farm"))).toBe(true);
  });
});

describe("what the renderer and the sound layer are told", () => {
  it("the watcher turns a disaster's cues into focus, shake and sound events, once each", () => {
    const s = lab(3, {});
    const watch = createWatch();
    expect(watch.poll(s)).toEqual([]); // the baseline poll
    triggerDisaster(s, "gpuFire");
    const events = watch.poll(s);
    expect(events.map((e) => e.type)).toEqual(["cue", "shake", "focus"]);
    expect(events.find((e) => e.type === "cue")).toMatchObject({ cue: "breakdown" });
    const focus = events.find((e) => e.type === "focus") as { x: number; z: number; zoom: number };
    const cluster = s.buildings.find((b) => b.id === s.disasters.runs[0]!.target)!;
    expect(focus.x).toBeCloseTo(cluster.x + cluster.w / 2 - 12);
    expect(focus.z).toBeCloseTo(cluster.z + cluster.d / 2 - 12);
    expect(watch.poll(s)).toEqual([]);
  });
});

// ---- random disasters ------------------------------------------------------------------------------------------------

/** A year in a working lab, with cards answered and the bank topped up (so bankruptcy never ends the run early). */
function year(seed: number, risk: Risk): GameState {
  const s = lab(seed, { security: 2, sre: 1 });
  setRisk(s, risk);
  for (let i = 0; i < 360 * TICKS_PER_DAY; i++) {
    if (i % TICKS_PER_DAY === 0) s.cash = Math.max(s.cash, 20_000_000);
    tick(s, answer(s));
  }
  return s;
}

describe("random disasters", () => {
  it("fire at the configured rate: none when off, then rare < normal < chaos, over a year in a headless run", { timeout: 90_000 }, () => {
    const seeds = [1, 2, 3, 4];
    const started = (risk: Risk) => seeds.map((seed) => year(seed, risk).disasters.started);
    const off = year(1, "off");
    expect(off.disasters.started).toBe(0);
    expect(off.disasters.history).toEqual([]);
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const rare = mean(started("rare"));
    const normal = mean(started("normal"));
    const chaos = mean(started("chaos"));
    expect(rare).toBeGreaterThan(0.5);
    expect(rare).toBeLessThan(4);
    expect(normal).toBeGreaterThan(rare);
    expect(normal).toBeGreaterThan(2);
    expect(normal).toBeLessThan(9);
    expect(chaos).toBeGreaterThan(normal * 2);
    expect(chaos).toBeGreaterThan(12);
    expect(chaos).toBeLessThan(45);
  });

  it("chaos plays every kind, and every one of them ends (nothing is left running, burning or diverted a fortnight later)", { timeout: 60_000 }, () => {
    const s = year(2, "chaos");
    const kinds = new Set([...s.disasters.history.map((h) => h.id), ...s.disasters.runs.map((r) => r.id)]);
    expect([...kinds].sort()).toEqual(["gpuFire", "gridBrownout", "rogueSwarm", "viralJailbreak", "weightsLeak"]);
    setRisk(s, "off");
    for (let i = 0; i < 14 * TICKS_PER_DAY; i++) tick(s, answer(s));
    expect(s.disasters.runs).toEqual([]);
    expect(s.disasters.effects.filter((e) => e.until < 0)).toEqual([]);
    expect(s.staff.some((o) => o.divert)).toBe(false);
    expect(s.buildings.filter((b) => b.broken).length).toBeLessThanOrEqual(1);
  });

  it("stays quiet through the first weeks (nothing has a minimum day before 30), and the dice come from their own stream", () => {
    // The clock has not been moved on for these two: it is the first weeks, before anything is unlocked.
    const off = lab(3, undefined, false);
    const on = lab(3, undefined, false);
    setRisk(on, "normal");
    for (let i = 0; i < 25 * TICKS_PER_DAY; i++) {
      tick(off, answer(off));
      tick(on, answer(on));
    }
    expect(on.disasters.started).toBe(0);
    // The main random stream is untouched by the setting.
    expect(on.rngState).toBe(off.rngState);
    expect(JSON.stringify({ ...on, disasters: null })).toBe(JSON.stringify({ ...off, disasters: null }));
  });

  it("is deterministic: same seed, setting and answers give the same game, and it survives a save and load mid-disaster", { timeout: 60_000 }, () => {
    const run = () => {
      const s = lab(5);
      setRisk(s, "chaos");
      for (let i = 0; i < 90 * TICKS_PER_DAY; i++) {
        if (i % TICKS_PER_DAY === 0) s.cash = Math.max(s.cash, 20_000_000);
        tick(s, answer(s, i % 3));
      }
      return s;
    };
    const a = run();
    const b = run();
    expect(a.disasters.started).toBeGreaterThan(3);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));

    // Mid-disaster: the World is plain JSON, and a copy restored from it plays on identically.
    const mid = lab(5);
    triggerDisaster(mid, "rogueSwarm");
    for (let i = 0; i < 30; i++) tick(mid, answer(mid));
    const copy = JSON.parse(JSON.stringify(mid)) as GameState;
    expect(copy).toEqual(mid);
    for (let i = 0; i < 200; i++) {
      tick(mid, answer(mid));
      tick(copy, answer(copy));
    }
    expect(JSON.stringify(copy)).toBe(JSON.stringify(mid));
  });
});

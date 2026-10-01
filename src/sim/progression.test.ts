import { enableCollusion } from "./collusion/driver";
import { PROGRESSION, SCRUTINY_WAKES } from "../content/progression";
import { baseContent, baseRules, baseVocabulary } from "../mods/base-game";
import { withDefs } from "./defs";
import { makeSnapshot } from "../app/hud";
import { playableOf } from "../ui/hud/playable";
import { fixtureInput } from "../ui/hud/fixtures";
import { hudViewModel } from "../ui/hud/vm";
import { canPlace } from "./commands";
import { progressOf, systemUnlocked, updateProgression } from "./progression";
import { canHire, hire, updateStaff } from "./staff";
import { createInitialState } from "./state";
import { applyNow, tick } from "./tick";
import { createRng } from "./rng";
import { seedWalkers } from "./walkers";
import { rectContains, routeToRect } from "./pathfind";
import type { GameState } from "./types";

/** FLT-54: Scrutiny's packs wake one at a time after the rung opens. Run the calendar on until every one is up. */
function wakeAll(s: GameState, days = 120) {
  for (let i = 0; i < days && s.progression?.value === "waking"; i++) {
    s.day++;
    updateProgression(s);
  }
}

describe("the playable ladder", () => {
  it("gates placement and hiring, then unlocks five levels and queues every card", () => {
    const s = createInitialState(1);
    expect(s.buildings.map((b) => b.kind)).toEqual(["cluster"]);
    expect(canPlace(s, "hall", 12, 19).ok).toBe(true);
    expect(canPlace(s, "gateway", 12, 20).ok).toBe(false);
    expect(canPlace(s, "security", 12, 19).ok).toBe(false);
    applyNow(s, [{ type: "placeBuilding", kind: "gateway", x: 12, z: 20 }, { type: "hire", job: "sre" }]);
    expect(s.buildings).toHaveLength(1); expect(s.staff).toHaveLength(0);
    s.models.push("Fixture-1"); updateProgression(s);
    expect(progressOf(s)).toMatchObject({ level: 2, levelName: "Open for business" });
    expect(canPlace(s, "gateway", 12, 20).ok).toBe(true);
    expect(makeSnapshot(s).hud.visible).toMatchObject({ revenue: true, vibes: true, staff: false, news: false });
    // Level 2 asks for both halves: the money and the visitors shown round.
    s.ledger.income = 40_000; s.flags.visitorsServed = 11; updateProgression(s); expect(progressOf(s).level).toBe(2);
    expect(progressOf(s).goal.status).toBe("Revenue $40K of $40K a day · 11 of 12 visitors");
    s.flags.visitorsServed = 12; updateProgression(s); expect(progressOf(s).level).toBe(3);
    expect(canHire(s, "sre").ok).toBe(true); expect(systemUnlocked(s, "breakdowns")).toBe(true);
    // Level 3: the first spill and the first breakdown are booked for right after it opens, so the hires have work.
    expect(s.flags.firstSpillDay).toBe(s.day + 1); expect(s.flags.firstBreakdownDay).toBe(s.day + 3);
    s.flags.mopped = 20; updateProgression(s); expect(progressOf(s).level).toBe(3);
    hire(s, "sre"); hire(s, "janitor"); updateProgression(s); expect(progressOf(s).level).toBe(3);
    expect(progressOf(s).goal.status).toBe("SRE ✓ · Janitor ✓ · fixed ✗ · 20 of 20 puddles");
    s.flags.repaired = 1; updateProgression(s); expect(progressOf(s).level).toBe(4);
    expect(s.leapfrog.enabled).toBe(true);
    expect(s.auditors).toBeUndefined();
    // Level 4: the field was seeded so you start behind most of it, and the goal is the podium.
    expect(s.race.rank).toBeGreaterThan(3);
    s.race.rank = 4; updateProgression(s); expect(progressOf(s).level).toBe(4);
    s.race.rank = 3; updateProgression(s); expect(progressOf(s).level).toBe(5);
    expect(canHire(s, "security").ok).toBe(true);
    // FLT-54: the rung opens with the protests and the event cards; the rest wake one at a time, disasters first.
    expect(s.papers?.enabled ?? false).toBe(false); expect(s.hearing?.enabled ?? false).toBe(false);
    expect(systemUnlocked(s, "events")).toBe(true); expect(systemUnlocked(s, "disasters")).toBe(false);
    wakeAll(s);
    expect(s.progression?.value).toBe("complete");
    expect(s.papers?.enabled).toBe(true);
    // Collusion is on the Scrutiny rung, so earning it wakes the pack (it used to stay asleep in normal play).
    expect(s.collusion?.enabled).toBe(true);
    expect(s.hearing?.enabled).toBe(true); expect(s.yacht?.enabled).toBe(true);
    expect(s.auditors?.enabled).toBe(true);
    expect(s.promises?.enabled).toBe(true); expect(s.bill?.enabled).toBe(true);
    s.cash = 350_000; expect(canPlace(s, "security", 12, 19).ok).toBe(true);
    expect(s.unlockCards?.map((c) => c.id)).toEqual(["business", "team", "race", "scrutiny", ...SCRUTINY_WAKES.filter((w) => !w.silent).map((w) => `wake:${w.id}`)]);
    applyNow(s, [{ type: "dismissUnlock" }]); expect(makeSnapshot(s).unlockCard?.id).toBe("team");
  });
  it("never shows a met last rung: the note moves on to the next open objective, then hides (FLT-48)", () => {
    const s = createInitialState(1);
    s.progression = { value: "complete", context: { level: 5 } };
    const line = () => hudViewModel({ ...fixtureInput(), snap: makeSnapshot(s) }).progress.goal.line;
    expect(line()).toBe("Ship 3 models · 0 of 3");
    s.models.push("A", "B", "C");
    const set = (patch: Record<string, { value?: number; met?: boolean; held?: number }>) => {
      s.goals = { ...s.goals, context: { ...s.goals.context, goals: s.goals.context.goals.map((g) => ({ ...g, ...patch[g.id] })) } };
    };
    set({ release: { met: true }, era: { value: 2 } });
    expect(progressOf(s).goal).toMatchObject({ text: "Reach Era 3: Superhuman Coder", objective: "era" });
    expect(line()).toBe("Reach Era 3: Superhuman Coder · 2/3");
    set({ era: { met: true }, arena: { value: 2 } }); // #6 of 7
    expect(line()).toBe("Hold Top 3 on the Arena for 30 days in Era 3 · Arena #6, need top 3");
    set({ arena: { value: 6, held: 12 } }); // #2, twelve days into the hold (FLT-86)
    expect(line()).toBe("Hold Top 3 on the Arena for 30 days in Era 3 · Arena #2 · day 12 of 30");
    set({ arena: { met: true } });
    expect(line()).toBe("");
  });
  it("wakes every earned pack, honours ?<pack>=off, and starts a campus with all of them awake", () => {
    const s = createInitialState(4);
    s.flags.collusionOff = 1;
    s.progression = { value: "growing", context: { level: 4 } };
    expect(s.leapfrog.enabled).toBe(false);
    updateProgression(s); // nothing met: no level-up, nothing wakes
    expect(s.leapfrog.enabled).toBe(false);
    s.race.rank = 3; updateProgression(s);
    expect(progressOf(s).level).toBe(5);
    wakeAll(s);
    expect(s.papers?.enabled).toBe(true);
    expect(s.collusion?.enabled ?? false).toBe(false);
    const campus = createInitialState(4, "campus");
    expect([campus.leapfrog.enabled, campus.papers?.enabled, campus.collusion?.enabled]).toEqual([true, true, true]);
    // A garage's first rung has no packs, so a new game starts with all of them asleep.
    const garage = createInitialState(4);
    expect([garage.leapfrog.enabled, garage.papers?.enabled ?? false, garage.collusion?.enabled ?? false]).toEqual([false, false, false]);
  });

  it("keeps locked systems asleep, and visitors wait for a gateway", () => {
    const s = createInitialState(1); s.day = 100; s.waterDiscourse = 80; s.disasters.risk = "chaos";
    enableCollusion(s);
    const before = structuredClone({ race: s.race, leapfrog: s.leapfrog, disasters: s.disasters, collusion: s.collusion });
    for (let i = 0; i < 100; i++) tick(s);
    expect({ race: s.race, leapfrog: s.leapfrog, disasters: s.disasters, collusion: s.collusion }).toEqual(before);
    expect(s.walkers.some((w) => w.kind === "visitor" || w.kind === "protester")).toBe(false);
    expect(s.slop.some(Boolean)).toBe(false); expect(s.buildings[0]?.reliability).toBe(1);
    expect(Object.values(s.arcs).some((a) => a.value === "cardOpen")).toBe(false);
    expect(s.hearing).toBeUndefined(); expect(s.yacht).toBeUndefined();
    expect(s.defection).toBeUndefined(); expect(s.poaching).toBeUndefined(); expect(s.auditors).toBeUndefined();
    expect(s.promises).toBeUndefined(); expect(s.bill).toBeUndefined(); expect(s.factions).toBeUndefined();
  });

  // FLT-52: every pack in the merge train is on the Scrutiny rung and has its own off switch. FLT-54: each wakes on its own
  // day after the rung opens, with its own New! card.
  const WAVE = ["hearing", "yacht", "defection", "poaching", "auditors", "promises", "capture"] as const;
  it.each(WAVE)("%s sleeps until Scrutiny, wakes on its day after it is earned, and stays asleep with ?%s=off", (id) => {
    expect(PROGRESSION.find((r) => r.id === "scrutiny")?.systems).toContain(id);
    // Regulatory Capture keeps its state in `bill`.
    const awake = (s: ReturnType<typeof createInitialState>) => s[id === "capture" ? "bill" : id]?.enabled ?? false;
    const s = createInitialState(4);
    s.progression = { value: "growing", context: { level: 4 } };
    expect(systemUnlocked(s, id)).toBe(false);
    updateProgression(s);
    expect(awake(s)).toBe(false);
    s.race.rank = 3; updateProgression(s);
    expect(progressOf(s).level).toBe(5);
    const wake = SCRUTINY_WAKES.find((w) => w.id === id)!;
    const opened = s.day;
    expect(systemUnlocked(s, id)).toBe(false);
    expect(awake(s)).toBe(false);
    while (!systemUnlocked(s, id) && s.day < opened + 200) { s.day++; updateProgression(s); }
    expect(s.day - opened).toBeGreaterThanOrEqual(wake.after);
    expect(awake(s)).toBe(true);
    expect(s.unlockCards?.at(-1)?.id).toBe(`wake:${id}`);
    const off = createInitialState(4);
    off.flags[`${id}Off`] = 1;
    off.progression = { value: "growing", context: { level: 4 } };
    off.race.rank = 3; updateProgression(off); wakeAll(off);
    expect(progressOf(off).level).toBe(5);
    expect(awake(off)).toBe(false);
    // A campus (every rung earned) starts with it awake; a garage without.
    expect(awake(createInitialState(4, "campus"))).toBe(true);
    expect(awake(createInitialState(4))).toBe(false);
  });
  // FLT-33 (#59): the factions are on the Race rung instead, a level earlier than the wave.
  it("wakes the factions at The Race, names them on its New! card, and keeps them asleep with ?factions=off", () => {
    expect(PROGRESSION.find((r) => r.id === "race")?.systems).toContain("factions");
    const race = (off: boolean) => {
      const s = createInitialState(4);
      if (off) s.flags.factionsOff = 1;
      s.progression = { value: "growing", context: { level: 3 } };
      // FLT-58's Level 3 goal: an SRE and a Janitor Bot on the payroll, 20 puddles mopped, and the first breakdown fixed.
      hire(s, "sre"); hire(s, "janitor");
      s.flags.mopped = 20; s.flags.repaired = 1;
      expect(s.factions).toBeUndefined();
      updateProgression(s);
      expect(progressOf(s).level).toBe(4);
      return s;
    };
    const s = race(false);
    expect(systemUnlocked(s, "factions")).toBe(true);
    expect(s.factions).toBeDefined();
    const card = makeSnapshot(s).unlockCard!;
    expect(card.items).toContain("factions");
    expect(playableOf({ unlockCard: card }).unlock!.items).toContain("Factions");
    expect(race(true).factions).toBeUndefined();
    expect(createInitialState(4, "campus").factions).toBeDefined();
    expect(createInitialState(4).factions).toBeUndefined();
  });
  it("gives every wave pack its own small New! card, a few days apart, most dramatic first", () => {
    const s = createInitialState(4);
    s.progression = { value: "growing", context: { level: 4 } };
    s.race.rank = 3; updateProgression(s);
    const card = makeSnapshot(s).unlockCard!;
    for (const id of WAVE) expect(card.items).not.toContain(id);
    expect(playableOf({ unlockCard: card }).unlock!.items.length).toBeLessThanOrEqual(8);
    const woke: { id: string; day: number; title: string }[] = [];
    const opened = s.day;
    for (let i = 0; i < 120; i++) {
      s.day++;
      const before = s.unlockCards?.length ?? 0;
      updateProgression(s);
      for (const c of s.unlockCards!.slice(before)) woke.push({ id: c.id, day: s.day - opened, title: c.title });
    }
    expect(woke.map((w) => w.id)).toEqual(expect.arrayContaining(WAVE.map((id) => `wake:${id}`)));
    expect(woke[0]!.id).toBe("wake:disasters");
    for (let i = 1; i < woke.length; i++) expect(woke[i]!.day - woke[i - 1]!.day).toBeGreaterThanOrEqual(4);
    for (const w of woke) expect(w.title).toMatch(/^New! /);
  });
  it("teases what is locked as one row per milestone, not one ??? per item", () => {
    const s = createInitialState(1);
    expect(progressOf(s).teasers).toEqual([
      { label: "2 more", hint: "Ship your first model" },
      { label: "5 more", hint: "Earn $40K a day and give 12 visitors the tour" },
      { label: "5 more", hint: "Top 3 on the Arena" },
    ]);
    s.models.push("Fixture-1"); updateProgression(s);
    expect(progressOf(s).teasers.map((t) => t.hint)).toEqual(["Earn $40K a day and give 12 visitors the tour", "Top 3 on the Arena"]);
  });
  it("reads modded goal thresholds from identified data rows", () => {
    const def = { content: { ...baseContent, progression: PROGRESSION.map((r) => r.level === 1 ? { ...r, goal: { ...r.goal, target: 2 } } : r) }, rules: baseRules, vocabulary: baseVocabulary };
    const s = createInitialState(1, "garage", def);
    withDefs(def, () => {
      s.models.push("Fixture-1"); updateProgression(s); expect(progressOf(s).level).toBe(1);
      s.models.push("Fixture-2"); updateProgression(s); expect(progressOf(s).level).toBe(2);
    });
  });
});
describe("people have somewhere to be", () => {
  it.each([1, 2, 3, 42, 2027])("walks a new path within 15 seconds at 1× (seed %i)", (seed) => {
    const s = createInitialState(seed);
    applyNow(s, [18, 17, 16].map((z) => ({ type: "placePath" as const, x: 11, z })));
    const before = new Map(s.walkers.map((w) => [w.id, [w.x, w.z]])); let moved = false;
    for (let i = 0; i < 50; i++) {
      tick(s);
      for (const w of s.walkers) {
        const p = before.get(w.id);
        if (p && Math.hypot(w.x - p[0]!, w.z - p[1]!) >= 2) moved = true;
        expect(rectContains(s.gate, w.x, w.z)).toBe(false);
      }
    }
    expect(moved).toBe(true);
  });
  it("gives each walker its own route and invalidates destination routes after construction", () => {
    const s = createInitialState(1), cluster = s.buildings[0]!;
    const first = routeToRect(s, 11.5, 22.5, cluster)!;
    const expected = structuredClone(first);
    first[0]![0] = 99; first.shift();
    expect(routeToRect(s, 11.5, 22.5, cluster)).toEqual(expected);
    applyNow(s, [{ type: "bulldoze", x: 11, z: 20 }]);
    expect(routeToRect(s, 11.5, 22.5, cluster)).toBeNull();
  });
  it("patrols the fence and waits in a comms break spot until protesters exist", () => {
    const s = createInitialState(1); delete s.progression;
    applyNow(s, [{ type: "placeBuilding", kind: "gateway", x: 12, z: 20 }]);
    hire(s, "security"); hire(s, "comms"); const rng = createRng(5);
    for (let i = 0; i < 300; i++) { s.tick++; updateStaff(s, rng); }
    const guard = s.staff.find((w) => w.job === "security")!; const rep = s.staff.find((w) => w.job === "comms")!;
    expect(Math.min(guard.x, 24 - guard.x, guard.z, 24 - guard.z)).toBeLessThan(1);
    expect(Math.hypot(rep.x - 13, rep.z - 21)).toBeLessThan(3); expect(rectContains(s.gate, rep.x, rep.z)).toBe(false);
    const pos = [rep.x, rep.z];
    for (let i = 0; i < 30; i++) { s.tick++; updateStaff(s, rng); }
    expect([rep.x, rep.z]).toEqual(pos);
    seedWalkers(s, "protester", 1, rng);
    let responded = false;
    for (let i = 0; i < 10; i++) { s.tick++; updateStaff(s, rng); responded ||= rep.machine.value === "going" || rep.machine.value === "working"; }
    expect(responded).toBe(true);
  });
});

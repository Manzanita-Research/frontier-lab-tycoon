import { enableCollusion } from "./collusion/driver";
import { PROGRESSION } from "../content/progression";
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
    s.ledger.income = 20_000; updateProgression(s);
    expect(canHire(s, "sre").ok).toBe(true); expect(systemUnlocked(s, "breakdowns")).toBe(true);
    seedWalkers(s, "researcher", 5, createRng(2));
    s.vibes.value = 499; updateProgression(s); expect(progressOf(s).level).toBe(3);
    s.vibes.value = 500; updateProgression(s); expect(progressOf(s).level).toBe(4);
    expect(s.leapfrog.enabled).toBe(true);
    expect(s.auditors).toBeUndefined();
    s.race.rank = 6; updateProgression(s); expect(progressOf(s).level).toBe(4);
    s.race.rank = 5; updateProgression(s); expect(progressOf(s).level).toBe(5);
    expect(canHire(s, "security").ok).toBe(true); expect(s.papers?.enabled).toBe(true);
    // Collusion is on the Scrutiny rung, so earning it wakes the pack (it used to stay asleep in normal play).
    expect(s.collusion?.enabled).toBe(true);
    expect(s.hearing?.enabled).toBe(true); expect(s.yacht?.enabled).toBe(true);
    expect(s.auditors?.enabled).toBe(true);
    s.cash = 350_000; expect(canPlace(s, "security", 12, 19).ok).toBe(true);
    expect(s.unlockCards?.map((c) => c.id)).toEqual(["business", "team", "race", "scrutiny"]);
    applyNow(s, [{ type: "dismissUnlock" }]); expect(makeSnapshot(s).unlockCard?.id).toBe("team");
  });
  it("never shows a met last rung: the note moves on to the next open objective, then hides (FLT-48)", () => {
    const s = createInitialState(1);
    s.progression = { value: "complete", context: { level: 5 } };
    const line = () => hudViewModel({ ...fixtureInput(), snap: makeSnapshot(s) }).progress.goal.line;
    expect(line()).toBe("Ship model #3 · 0/3");
    s.models.push("A", "B", "C");
    const set = (patch: Record<string, { value?: number; met?: boolean }>) => {
      s.goals = { ...s.goals, context: { ...s.goals.context, goals: s.goals.context.goals.map((g) => ({ ...g, ...patch[g.id] })) } };
    };
    set({ release: { met: true }, era: { value: 2 } });
    expect(progressOf(s).goal).toMatchObject({ text: "Reach Era 3: Superhuman Coder", objective: "era" });
    expect(line()).toBe("Reach Era 3: Superhuman Coder · 2/3");
    set({ era: { met: true }, arena: { value: 2 } }); // #6 of 7
    expect(line()).toBe("Top 3 on the Arena in Era 3 · Arena #6, need top 3");
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
    s.race.rank = 5; updateProgression(s);
    expect(progressOf(s).level).toBe(5);
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
  });

  // FLT-52: every pack in the merge train is on the Scrutiny rung, wakes the day it is earned, and has its own off switch.
  const WAVE = ["hearing", "yacht", "defection", "poaching", "auditors"] as const;
  it.each(WAVE)("%s sleeps until Scrutiny, wakes when it is earned, and stays asleep with ?%s=off", (id) => {
    expect(PROGRESSION.find((r) => r.id === "scrutiny")?.systems).toContain(id);
    const awake = (s: ReturnType<typeof createInitialState>) => s[id]?.enabled ?? false;
    const s = createInitialState(4);
    s.progression = { value: "growing", context: { level: 4 } };
    expect(systemUnlocked(s, id)).toBe(false);
    updateProgression(s);
    expect(awake(s)).toBe(false);
    s.race.rank = 5; updateProgression(s);
    expect(progressOf(s).level).toBe(5);
    expect(systemUnlocked(s, id)).toBe(true);
    expect(awake(s)).toBe(true);
    const off = createInitialState(4);
    off.flags[`${id}Off`] = 1;
    off.progression = { value: "growing", context: { level: 4 } };
    off.race.rank = 5; updateProgression(off);
    expect(progressOf(off).level).toBe(5);
    expect(awake(off)).toBe(false);
    // A campus (every rung earned) starts with it awake; a garage without.
    expect(awake(createInitialState(4, "campus"))).toBe(true);
    expect(awake(createInitialState(4))).toBe(false);
  });
  it("names every wave pack on the New! card, in words", () => {
    const s = createInitialState(4);
    s.progression = { value: "growing", context: { level: 4 } };
    s.race.rank = 5; updateProgression(s);
    const card = makeSnapshot(s).unlockCard!;
    for (const id of WAVE) expect(card.items).toContain(id);
    const shown = playableOf({ unlockCard: card }).unlock!.items;
    expect(shown).toEqual(expect.arrayContaining(["The Hearing", "The yacht summit", "Defection", "The Poaching War", "Evals Without Borders"]));
    for (const id of WAVE) expect(shown).not.toContain(id);
  });
  it("teases what is locked as one row per milestone, not one ??? per item", () => {
    const s = createInitialState(1);
    expect(progressOf(s).teasers).toEqual([
      { label: "2 more", hint: "Ship your first model" },
      { label: "4 more", hint: "Earn $20K a day" },
      { label: "4 more", hint: "Top 5 on the Arena" },
    ]);
    s.models.push("Fixture-1"); updateProgression(s);
    expect(progressOf(s).teasers.map((t) => t.hint)).toEqual(["Earn $20K a day", "Top 5 on the Arena"]);
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

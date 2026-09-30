// The rival and era machines on their own: transition() only, no World, no rng.
import { RIVAL_BY_ID } from "../../content/rivals";
import { eraOf } from "../../content/eras";
import { initialStored, step } from "../machines/run";
import { eraMachine, eraNumber } from "./era";
import { opensThisTime, rivalMachine, runWeeks, type RivalContext } from "./rival";

const ctx = (id: keyof typeof RIVAL_BY_ID, over: Partial<RivalContext> = {}): RivalContext => {
  const d = RIVAL_BY_ID[id];
  return { id, personality: d.personality, capability: d.startCapability, hype: d.startHype, baseHype: d.startHype, weeks: 0, releases: 0, open: false, momentum: 1, model: "", lastRelease: -1, ...over };
};
const week = (over: Record<string, unknown> = {}) => ({ type: "WEEK" as const, week: 1, aggro: 1, pace: 1, chase: 1, lengthRoll: 0.5, gainRoll: 0.5, openRoll: 0.5, poachRoll: 0.99, name: "Model-1", hold: false, closed: false, ...over });
const fresh = (id: keyof typeof RIVAL_BY_ID, over: Partial<RivalContext> = {}) => initialStored(rivalMachine, ctx(id, over));

describe("rival machine", () => {
  it("starts idle, and the first week starts a run", () => {
    const s = fresh("anthro");
    expect(s.value).toBe("idle");
    const next = step(rivalMachine, s, week());
    expect(next.stored.value).toBe("training");
    expect(next.stored.context.weeks).toBeGreaterThan(0);
    expect(next.effects).toEqual([]);
  });

  it("trains for about its cadence, then releases: capability and hype go up, and it says so", () => {
    let s = fresh("anthro"); // cadence 11
    const effects: unknown[] = [];
    let weeks = 0;
    for (; s.value !== "releasing" && weeks < 30; weeks++) {
      const r = step(rivalMachine, s, week({ week: weeks + 1, name: "Sestina-1" }));
      s = r.stored;
      effects.push(...r.effects);
    }
    expect(weeks).toBe(runWeeks(ctx("anthro"), { lengthRoll: 0.5, pace: 1 })); // 11 weeks at a middling roll
    expect(s.context.releases).toBe(1);
    expect(s.context.capability).toBeGreaterThan(RIVAL_BY_ID.anthro.startCapability);
    expect(s.context.model).toBe("Sestina-1");
    expect(effects).toHaveLength(1);
    expect(effects[0]).toMatchObject({ type: "RELEASED", id: "anthro", model: "Sestina-1", open: false });
  });

  it("a slow lab takes a press-tour cooldown after launch week, then goes idle and starts again", () => {
    const releasing = { value: "releasing" as const, context: ctx("anthro", { releases: 1 }) };
    const cool = step(rivalMachine, releasing, week());
    expect(cool.stored.value).toBe("cooldown");
    const idle = step(rivalMachine, cool.stored, week());
    expect(idle.stored.value).toBe("idle");
    expect(step(rivalMachine, idle.stored, week()).stored.value).toBe("training");
  });

  it("a lab that ships every week never leaves releasing", () => {
    let s = fresh("openish");
    let releases = 0;
    for (let w = 1; w <= 6; w++) {
      const r = step(rivalMachine, s, week({ week: w, name: `Chatty-${w}` }));
      s = r.stored;
      releases += r.effects.filter((e) => e.type === "RELEASED").length;
    }
    expect(releases).toBe(6);
    expect(s.value).toBe("releasing");
    expect(s.context.releases).toBe(6);
  });

  it("the era makes runs shorter and releases bigger", () => {
    const calm = runWeeks(ctx("metameta"), { lengthRoll: 0.5, pace: 1 });
    const fast = runWeeks(ctx("metameta"), { lengthRoll: 0.5, pace: 1.5 });
    expect(fast).toBeLessThan(calm);
    const gain = (aggro: number) => {
      const r = step(rivalMachine, { value: "releasing", context: ctx("openish") }, week({ aggro }));
      return r.effects.find((e) => e.type === "RELEASED")!.gain;
    };
    expect(gain(2)).toBeCloseTo(gain(1) * 2);
  });

  it("chasing the leader: a lab far behind grows faster, one far ahead eases off", () => {
    const gain = (chase: number) => step(rivalMachine, { value: "releasing", context: ctx("openish") }, week({ chase })).effects.find((e) => e.type === "RELEASED")!.gain;
    expect(gain(1.4)).toBeGreaterThan(gain(1));
    expect(gain(0.6)).toBeLessThan(gain(1));
  });

  it("open weights follow the personality: Sirocco always, Macrohard never, and the middle flip-flops", () => {
    expect(opensThisTime(ctx("sirocco"), 0.99)).toBe(true);
    expect(opensThisTime(ctx("macrohard"), 0)).toBe(false);
    // MetaMeta (openness 0.5): a lab that just went open is likelier to close up again.
    expect(opensThisTime(ctx("metameta", { open: false }), 0.6)).toBe(true);
    expect(opensThisTime(ctx("metameta", { open: true }), 0.6)).toBe(false);
  });

  it("poaches when the weekly roll comes in under its poaching rate (scaled by the era)", () => {
    const releasing = { value: "releasing" as const, context: ctx("metameta") };
    expect(step(rivalMachine, releasing, week({ poachRoll: 0.2 })).effects.some((e) => e.type === "POACH")).toBe(true);
    expect(step(rivalMachine, releasing, week({ poachRoll: 0.3 })).effects.some((e) => e.type === "POACH")).toBe(false);
    expect(step(rivalMachine, releasing, week({ poachRoll: 0.3, aggro: 2 })).effects.some((e) => e.type === "POACH")).toBe(true);
    expect(step(rivalMachine, { value: "releasing", context: ctx("sirocco") }, week({ poachRoll: 0 })).effects.some((e) => e.type === "POACH")).toBe(false);
  });

  it("a shock knocks capability, hype and momentum, and momentum recovers a little each week", () => {
    const hit = step(rivalMachine, fresh("sirocco"), { type: "SHOCK", capability: -3, hype: -15, momentum: -0.45 }).stored;
    expect(hit.context.momentum).toBeCloseTo(0.55);
    expect(hit.context.hype).toBe(RIVAL_BY_ID.sirocco.startHype - 15);
    const later = step(rivalMachine, hit, week()).stored;
    expect(later.context.momentum).toBeGreaterThan(0.55);
    expect(later.context.hype).toBeGreaterThan(hit.context.hype); // drifting back to its base
  });
});

describe("era machine", () => {
  const fresh = () => initialStored(eraMachine, { peak: 1 });
  const day = (s: ReturnType<typeof fresh>, mult: number) => step(eraMachine, s, { type: "DAY", mult });

  it("maps the multiplier to eras at 2x, 5x and above 25x", () => {
    expect([0.5, 1.99, 2, 4.99, 5, 25, 25.01, 400].map(eraOf)).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
  });

  it("starts in era 1 and climbs, announcing each new era exactly once", () => {
    let s = fresh();
    expect(eraNumber(s)).toBe(1);
    expect(day(s, 1.9).effects).toEqual([]);
    const two = day(s, 2.1);
    expect(two.effects).toEqual([{ type: "ERA_REACHED", era: 2 }]);
    s = two.stored;
    expect(day(s, 2.5).effects).toEqual([]);
    const three = day(s, 6);
    expect(three.effects).toEqual([{ type: "ERA_REACHED", era: 3 }]);
    expect(eraNumber(day(three.stored, 40).stored)).toBe(4);
  });

  it("never goes back down when the multiplier falls (a new hall means more researchers)", () => {
    const three = day(fresh(), 6).stored;
    expect(eraNumber(three)).toBe(3);
    const later = day(three, 1.2);
    expect(eraNumber(later.stored)).toBe(3);
    expect(later.effects).toEqual([]);
    expect(later.stored.context.peak).toBe(6);
  });

  it("can jump straight past an era", () => {
    const r = day(fresh(), 30);
    expect(r.effects).toEqual([{ type: "ERA_REACHED", era: 4 }]);
  });
});

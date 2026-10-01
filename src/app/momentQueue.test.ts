// FLT-76: the big beats go on one at a time, a couple of real seconds apart, and an ending always has the screen to itself.
import { describe, expect, it } from "vitest";
import type { UiToast } from "./hud";
import { gateToasts } from "./notices";
import { BEAT_GAP_MS, ENDING_SOLO_MS, enqueue, newMoments, NO_STAGE, release, SHIP_MS, spot, stageOf, type Seen } from "./moments";

const calm: Seen = { models: 3, unlock: null, event: null, outcome: "playing" };
const toast = (id: number, text: string, extra: Partial<UiToast> = {}): UiToast => ({ id, text, tone: "good", importance: "you", ...extra });
const shipped = toast(1, "Frontier-4 is out! Launch week: +$120K", { source: "training" });
const record = toast(2, "New benchmark record!", { source: "race" });
const takeover = toast(3, "Frontier-9: Congratulations! You won. I'll take the wheel from here. You look tired.", { source: "endings" });

describe("spotting the big moments", () => {
  it("finds the PLAY IT second (Level 5, a ship and the Open-weights card) and puts them in order", () => {
    const after: Seen = { models: 4, unlock: "scrutiny", event: { id: "openWeights", day: 85 }, outcome: "playing" };
    const { moments, rest } = spot(calm, after, [record, shipped]);
    expect(moments.map((m) => m.kind)).toEqual(["ship", "level", "card"]);
    // The release toast goes with its ship; the rest is for the notice policy.
    expect(moments[0]!.toasts).toEqual([shipped]);
    expect(rest).toEqual([record]);
  });

  it("calls an era card an era", () => {
    expect(spot(calm, { ...calm, event: { id: "era3", day: 120 } }, []).moments.map((m) => m.kind)).toEqual(["era"]);
  });

  it("sees nothing when nothing changed", () => {
    const open: Seen = { ...calm, unlock: "team", event: { id: "x", day: 3 } };
    expect(spot(open, open, [record])).toEqual({ moments: [], rest: [record] });
  });

  it("takes every ending toast out of the notice flow, so the Takeover can never be folded into a batch", () => {
    const { moments, rest } = spot(calm, calm, [record, takeover]);
    expect(moments).toEqual([{ kind: "ending", key: `ending:${takeover.text}`, toasts: [takeover] }]);
    expect(rest).toEqual([record]);
    // What the notice policy gets cannot hold it: the pile is the record alone.
    const gated = gateToasts({ lastAt: 0, held: [toast(9, "Something else", { source: "race" })] }, rest, { now: 20_000, day: 100, leapfrog: undefined, rank: null, seq: 1 });
    expect(gated.toasts.some((t) => t.text.includes("Congratulations") || t.batch?.some((b) => b.text.includes("Congratulations")))).toBe(false);
  });

  it("calls a new outcome an ending", () => {
    expect(spot(calm, { ...calm, outcome: "ended" }, []).moments).toEqual([{ kind: "ending", key: "ending:ended", toasts: [] }]);
  });
});

describe("the moment queue", () => {
  const second = () => spot(calm, { models: 4, unlock: "scrutiny", event: { id: "openWeights", day: 85 }, outcome: "playing" }, [shipped]).moments;

  it("plays them one at a time, a beat apart", () => {
    const q = enqueue(newMoments(), second(), 1000);
    expect(q.waiting.map((m) => [m.kind, m.at])).toEqual([["ship", 1000], ["level", 1000 + BEAT_GAP_MS], ["card", 1000 + 2 * BEAT_GAP_MS]]);
    const first = release(q, 1000);
    expect(first.out.map((m) => m.kind)).toEqual(["ship"]);
    expect(release(first.queue, 1000 + BEAT_GAP_MS - 1).out).toEqual([]);
    const two = release(first.queue, 1000 + BEAT_GAP_MS);
    expect(two.out.map((m) => m.kind)).toEqual(["level"]);
    expect(release(two.queue, 1000 + 2 * BEAT_GAP_MS).out.map((m) => m.kind)).toEqual(["card"]);
  });

  it("keeps the spacing across reports: a moment right after another waits its turn", () => {
    let q = enqueue(newMoments(), [{ kind: "ship", key: "ship:4", toasts: [] }], 0);
    q = release(q, 0).queue;
    q = enqueue(q, [{ kind: "level", key: "level:race", toasts: [] }], 400);
    expect(q.waiting[0]!.at).toBe(BEAT_GAP_MS);
    // Long after, there is no wait at all.
    q = release(q, BEAT_GAP_MS).queue;
    q = enqueue(q, [{ kind: "card", key: "card:x:9", toasts: [] }], 60_000);
    expect(q.waiting[0]!.at).toBe(60_000);
  });

  it("never queues the same moment twice", () => {
    const m = [{ kind: "card" as const, key: "card:x:9", toasts: [] }];
    expect(enqueue(enqueue(newMoments(), m, 0), m, 100).waiting).toHaveLength(1);
  });

  it("gives an ending the screen to itself: nothing goes on with it or during it", () => {
    let q = enqueue(newMoments(), spot(calm, { ...calm, models: 4 }, [shipped, takeover]).moments, 0);
    expect(q.waiting.map((m) => [m.kind, m.at])).toEqual([["ship", 0], ["ending", BEAT_GAP_MS]]);
    q = release(q, 0).queue;
    const on = release(q, BEAT_GAP_MS);
    expect(on.out).toHaveLength(1);
    expect(on.out[0]!.toasts).toEqual([takeover]);
    q = on.queue;
    expect(stageOf(q, BEAT_GAP_MS + 10, NO_STAGE).solo).toBe(true);
    // A card that comes a second later waits for the whole solo.
    q = enqueue(q, [{ kind: "card", key: "card:y:1", toasts: [] }], BEAT_GAP_MS + 1000);
    expect(q.waiting[0]!.at).toBe(BEAT_GAP_MS + ENDING_SOLO_MS);
    expect(stageOf(q, BEAT_GAP_MS + ENDING_SOLO_MS, NO_STAGE).solo).toBe(false);
  });

  it("tells the HUD what is waiting, and keeps the shipped sticker up in real time", () => {
    let q = enqueue(newMoments(), second(), 0);
    q = release(q, 0).queue;
    const a = stageOf(q, 0, NO_STAGE);
    expect(a).toEqual({ waiting: ["level", "card"], solo: false, shipped: true });
    expect(stageOf(q, 10, a)).toBe(a);
    q = release(q, 2 * BEAT_GAP_MS).queue;
    expect(stageOf(q, SHIP_MS, a)).toBe(NO_STAGE);
  });
});

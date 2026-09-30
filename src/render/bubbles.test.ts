import { GAP, LIFT, layoutBubbles, MAX_BUBBLES, type BubbleIn } from "./bubbles";

const bubble = (item: string, x: number, y: number, depth: number, w = 120, h = 40): BubbleIn<string> => ({ item, x, y, w, h, depth });
const box = (b: { x: number; y: number }, w = 120, h = 40) => ({ l: b.x - w / 2, r: b.x + w / 2, t: b.y - LIFT - h, b: b.y - LIFT });
const overlaps = (p: ReturnType<typeof box>, q: ReturnType<typeof box>) => p.l < q.r && q.l < p.r && p.t < q.b && q.t < p.b;

describe("thought bubbles", () => {
  it("keeps at most three on screen, the ones closest to the camera", () => {
    const list = [bubble("far", 100, 300, 0.9), bubble("a", 400, 300, 0.1), bubble("b", 700, 300, 0.3), bubble("c", 1000, 300, 0.2), bubble("d", 1300, 300, 0.5)];
    const shown = layoutBubbles(list);
    expect(shown).toHaveLength(MAX_BUBBLES);
    expect(shown.map((s) => s.item)).toEqual(["a", "c", "b"]);
  });

  it("leaves bubbles that are already apart exactly where they were", () => {
    const shown = layoutBubbles([bubble("a", 200, 300, 0.1), bubble("b", 600, 300, 0.2)]);
    expect(shown.map((s) => [s.x, s.y])).toEqual([[200, 300], [600, 300]]);
  });

  it("nudges a bubble that would overlap another one upward until they clear", () => {
    const shown = layoutBubbles([bubble("near", 300, 300, 0.1), bubble("mid", 330, 310, 0.2), bubble("far", 290, 305, 0.3)]);
    expect(shown).toHaveLength(3);
    for (let i = 0; i < shown.length; i++) for (let j = i + 1; j < shown.length; j++) expect(overlaps(box(shown[i]!), box(shown[j]!)), `${shown[i]!.item} vs ${shown[j]!.item}`).toBe(false);
    // The closest bubble is not the one that moves.
    const near = shown.find((s) => s.item === "near")!;
    expect([near.x, near.y]).toEqual([300, 300]);
    // The ones that moved went up (a smaller y), by a bubble's height or so, not sideways.
    for (const s of shown.filter((s) => s.item !== "near")) expect(s.y).toBeLessThan(310);
    expect(shown.find((s) => s.item === "mid")!.x).toBe(330);
    expect(GAP).toBeGreaterThan(0);
  });
});

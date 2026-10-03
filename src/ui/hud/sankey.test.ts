import { describe, expect, it } from "vitest";
import { layoutSankey, SANKEY_H, SANKEY_TOP, SANKEY_W, type SankeyInput } from "./sankey";

const chart: SankeyInput = {
  units: "expected hugs",
  nodes: [
    { id: "a", label: "Alpha" },
    { id: "b", label: "Bravo", sub: "4 utils/hr" },
    { id: "x", label: "Library" },
    { id: "y", label: "Orangery" },
    { id: "z", label: "Left early" },
    { id: "end", label: "Kitchen" },
  ],
  flows: [
    { from: "a", to: "x", value: 3 },
    { from: "a", to: "y", value: 1 },
    { from: "b", to: "y", value: 2 },
    { from: "b", to: "z", value: 1 },
    { from: "x", to: "end", value: 3 },
    { from: "y", to: "end", value: 3 },
  ],
};

describe("layoutSankey (FLT-101)", () => {
  it("puts nodes in columns by depth, and every sink in the last column", () => {
    const s = layoutSankey(chart);
    const col = Object.fromEntries(s.nodes.map((n) => [n.id, n.column]));
    expect(s.columns).toBe(3);
    expect(col).toEqual({ a: 0, b: 0, x: 1, y: 1, z: 2, end: 2 });
  });

  it("honours a column the mod pins", () => {
    const s = layoutSankey({ ...chart, nodes: chart.nodes.map((n) => (n.id === "z" ? { ...n, column: 1 } : n)) });
    expect(s.nodes.find((n) => n.id === "z")!.column).toBe(1);
  });

  it("sizes a node by the larger of what flows in and out, on one scale", () => {
    const s = layoutSankey(chart);
    const h = Object.fromEntries(s.nodes.map((n) => [n.id, n.h]));
    const v = Object.fromEntries(s.nodes.map((n) => [n.id, n.value]));
    expect(v).toEqual({ a: 4, b: 3, x: 3, y: 3, z: 1, end: 6 });
    expect(h.a! / h.b!).toBeCloseTo(4 / 3, 1);
    expect(h.end! / h.z!).toBeCloseTo(6, 0);
  });

  it("keeps every node inside the box and never stacks two on each other", () => {
    const s = layoutSankey(chart);
    for (const n of s.nodes) {
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.x + n.w).toBeLessThanOrEqual(SANKEY_W);
      expect(n.y).toBeGreaterThanOrEqual(SANKEY_TOP);
      expect(n.y + n.h).toBeLessThanOrEqual(SANKEY_H + 0.01);
    }
    for (let c = 0; c < s.columns; c++) {
      const col = s.nodes.filter((n) => n.column === c).sort((p, q) => p.y - q.y);
      for (let i = 1; i < col.length; i++) expect(col[i]!.y).toBeGreaterThanOrEqual(col[i - 1]!.y + col[i - 1]!.h);
    }
  });

  it("draws a band per flow as thick as its value, leaving the source and landing on the target", () => {
    const s = layoutSankey(chart);
    expect(s.links).toHaveLength(6);
    const a = s.nodes.find((n) => n.id === "a")!;
    const out = s.links.filter((l) => l.from === "a");
    expect(out.reduce((t, l) => t + l.width, 0)).toBeCloseTo(a.h, 0);
    for (const l of s.links) expect(l.d).toMatch(/^M[\d.]+ [\d.]+C.*Z$/);
    // A flow wears its source's tint, so you can follow one person across the page.
    expect(out.every((l) => l.tint === a.tint)).toBe(true);
  });

  it("labels the last column on the left of its node and the rest on the right", () => {
    const s = layoutSankey(chart);
    const end = s.nodes.find((n) => n.id === "end")!;
    const a = s.nodes.find((n) => n.id === "a")!;
    expect(end.anchor).toBe("end");
    expect(end.lx).toBeLessThan(end.x);
    expect(a.anchor).toBe("start");
    expect(a.lx).toBeGreaterThan(a.x + a.w);
    expect(s.nodes.find((n) => n.id === "b")!.sub).toBe("4 utils/hr");
  });

  it("is deterministic, and survives a loop or a flow to nowhere", () => {
    expect(layoutSankey(chart)).toEqual(layoutSankey(chart));
    const odd = layoutSankey({ units: "u", nodes: [{ id: "p", label: "P" }, { id: "q", label: "Q" }], flows: [{ from: "p", to: "q", value: 1 }, { from: "q", to: "p", value: 1 }, { from: "p", to: "ghost", value: 2 }] });
    expect(odd.nodes).toHaveLength(2);
    expect(odd.links.every((l) => l.from !== "ghost" && l.to !== "ghost")).toBe(true);
    for (const n of odd.nodes) expect(Number.isFinite(n.y)).toBe(true);
  });
});

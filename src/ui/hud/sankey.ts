// A small Sankey layout (FLT-101): a mod's chart document (nodes, flows, units) turned into plain shapes a skin can draw
// as SVG. Pure and deterministic; the HUD view model runs it so skins only paint.
import type { SankeyVM } from "./types";

export interface SankeyInput {
  units: string;
  /** Headings over the columns, left to right ("Who", "Breakout", "Ended up in"). */
  columns?: readonly string[];
  nodes: readonly { id: string; label: string; sub?: string; column?: number }[];
  flows: readonly { from: string; to: string; value: number }[];
}

/** The drawing box, in SVG units. Headings sit above SANKEY_TOP. */
export const SANKEY_W = 600;
export const SANKEY_H = 300;
export const SANKEY_TOP = 22;
const NODE_W = 12;
const PAD = 10;
const LABEL_GAP = 5;
const TINTS = 6;

const r = (n: number) => Math.round(n * 10) / 10;

export function layoutSankey(input: SankeyInput): SankeyVM {
  const ids = new Set(input.nodes.map((n) => n.id));
  const flows = input.flows.filter((f) => ids.has(f.from) && ids.has(f.to) && f.from !== f.to && f.value > 0);
  // Depth: the longest path from a source. A loop stops growing after one pass per node.
  const depth = new Map(input.nodes.map((n) => [n.id, 0]));
  for (let pass = 0; pass < input.nodes.length; pass++) {
    let moved = false;
    for (const f of flows) {
      const d = depth.get(f.from)! + 1;
      if (d > depth.get(f.to)! && d < input.nodes.length) { depth.set(f.to, d); moved = true; }
    }
    if (!moved) break;
  }
  const inflow = new Map<string, number>();
  const outflow = new Map<string, number>();
  for (const f of flows) {
    outflow.set(f.from, (outflow.get(f.from) ?? 0) + f.value);
    inflow.set(f.to, (inflow.get(f.to) ?? 0) + f.value);
  }
  const deepest = Math.max(0, ...input.nodes.map((n) => n.column ?? depth.get(n.id)!));
  // Justified: anything nothing flows out of ends up in the last column.
  const columnOf = (n: SankeyInput["nodes"][number]) => n.column ?? (outflow.has(n.id) ? depth.get(n.id)! : deepest);
  const columns = deepest + 1;
  const value = (id: string) => Math.max(inflow.get(id) ?? 0, outflow.get(id) ?? 0, 0);

  const byColumn: SankeyInput["nodes"][number][][] = Array.from({ length: columns }, () => []);
  for (const n of input.nodes) byColumn[Math.min(columnOf(n), deepest)]!.push(n);
  const height = SANKEY_H - SANKEY_TOP;
  const scale = Math.min(...byColumn.filter((c) => c.length > 0).map((c) => {
    const total = c.reduce((t, n) => t + value(n.id), 0);
    return total > 0 ? (height - PAD * (c.length - 1)) / total : Infinity;
  }));
  const k = Number.isFinite(scale) ? scale : 0;
  const gap = columns > 1 ? (SANKEY_W - NODE_W) / (columns - 1) : 0;

  const nodes: SankeyVM["nodes"] = [];
  byColumn.forEach((col, c) => {
    const used = col.reduce((t, n) => t + value(n.id) * k, 0) + PAD * (col.length - 1);
    let y = SANKEY_TOP + Math.max(0, (height - used) / 2);
    const x = columns > 1 ? c * gap : (SANKEY_W - NODE_W) / 2;
    col.forEach((n, i) => {
      const h = Math.max(value(n.id) * k, 1);
      const last = c === columns - 1 && columns > 1;
      nodes.push({
        id: n.id, label: n.label, sub: n.sub ?? "", column: c, value: value(n.id),
        x: r(x), y: r(y), w: NODE_W, h: r(h), tint: (c === 0 ? i : nodes.length) % TINTS,
        lx: r(last ? x - LABEL_GAP : x + NODE_W + LABEL_GAP), ly: r(y + h / 2), anchor: last ? "end" : "start",
      });
      y += h + PAD;
    });
  });
  const at = new Map(nodes.map((n) => [n.id, n]));
  // A flow wears its source's tint; a flow out of a middle node wears the tint of what fed it most.
  for (const n of nodes) {
    if (n.column === 0) continue;
    const feeder = flows.filter((f) => f.to === n.id).sort((p, q) => q.value - p.value)[0];
    if (feeder) n.tint = at.get(feeder.from)!.tint;
  }
  const yOf = (id: string) => at.get(id)!.y;
  const outOrder = [...flows].sort((p, q) => yOf(p.from) - yOf(q.from) || yOf(p.to) - yOf(q.to));
  const inOrder = [...flows].sort((p, q) => yOf(p.to) - yOf(q.to) || yOf(p.from) - yOf(q.from));
  const sy = new Map<SankeyInput["flows"][number], number>();
  const ty = new Map<SankeyInput["flows"][number], number>();
  const used = new Map<string, number>();
  for (const f of outOrder) { const o = used.get(`o:${f.from}`) ?? 0; sy.set(f, o); used.set(`o:${f.from}`, o + f.value * k); }
  for (const f of inOrder) { const o = used.get(`i:${f.to}`) ?? 0; ty.set(f, o); used.set(`i:${f.to}`, o + f.value * k); }

  const links: SankeyVM["links"] = flows.map((f) => {
    const s = at.get(f.from)!;
    const t = at.get(f.to)!;
    const w = f.value * k;
    const x0 = r(s.x + s.w), x1 = r(t.x), xm = r((x0 + x1) / 2);
    const y0 = r(s.y + sy.get(f)!), y1 = r(t.y + ty.get(f)!);
    const d = `M${x0} ${y0}C${xm} ${y0} ${xm} ${y1} ${x1} ${y1}L${x1} ${r(y1 + w)}C${xm} ${r(y1 + w)} ${xm} ${r(y0 + w)} ${x0} ${r(y0 + w)}Z`;
    return { from: f.from, to: f.to, value: f.value, width: r(w), d, tint: s.tint };
  });
  const headings = (input.columns ?? []).slice(0, columns).map((text, c) => ({ text, x: r(columns > 1 ? c * gap + (c === columns - 1 ? NODE_W : 0) : SANKEY_W / 2), anchor: c === columns - 1 && columns > 1 ? "end" as const : "start" as const }));
  return { width: SANKEY_W, height: SANKEY_H, units: input.units, columns, headings, nodes, links };
}

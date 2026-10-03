import type { SankeyVM } from "../../../ui/hud/types";

/** Six warm inks for the base skin. A skin passes its own (Frontier 95 uses the 16-colour palette). */
export const SANKEY_INKS = ["#d4572a", "#3c7d8c", "#8a5bb0", "#c9952b", "#5b8a3c", "#b0466e"];

/**
 * A laid-out Sankey chart (FLT-101) as one SVG: bands first, then the nodes, then the labels over both. Every band has a
 * tooltip ("Clementine → The Library: 3 expected hugs"), so the chart reads without a legend.
 */
export function SankeyChart({ chart, inks = SANKEY_INKS, label }: { chart: SankeyVM; inks?: readonly string[]; label: string }) {
  const name = new Map(chart.nodes.map((n) => [n.id, n.label]));
  const ink = (t: number) => inks[t % inks.length]!;
  return (
    <svg className="sankey" viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-label={label} preserveAspectRatio="xMidYMid meet">
      {chart.headings.map((h) => (
        <text key={h.text} className="sankey-heading" x={h.x} y={12} textAnchor={h.anchor}>
          {h.text}
        </text>
      ))}
      <g className="sankey-links">
        {chart.links.map((l) => (
          <path key={`${l.from}>${l.to}`} d={l.d} fill={ink(l.tint)} fillOpacity={0.42}>
            <title>{`${name.get(l.from)} → ${name.get(l.to)}: ${l.value} ${chart.units}`}</title>
          </path>
        ))}
      </g>
      <g className="sankey-nodes">
        {chart.nodes.map((n) => (
          <rect key={n.id} x={n.x} y={n.y} width={n.w} height={n.h} fill={ink(n.tint)} />
        ))}
      </g>
      <g className="sankey-labels">
        {chart.nodes.map((n) => (
          <text key={n.id} x={n.lx} y={n.sub ? n.ly - 2 : n.ly + 4} textAnchor={n.anchor}>
            {n.label}
            {n.sub && (
              <tspan className="sankey-sub" x={n.lx} dy={12}>
                {n.sub}
              </tspan>
            )}
          </text>
        ))}
      </g>
    </svg>
  );
}

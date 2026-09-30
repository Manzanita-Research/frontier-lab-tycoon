import type { VoiceVM } from "../../ui/hud/types";

const DAYS = 60;
/** Even with a day of history the lines get a fifth of the graph to themselves, rather than a dot in the corner. */
const MIN_SPAN = 24;

/**
 * The news cycle over the last sixty game days as a small line graph: yours in bold, the loudest rivals behind it, each
 * in its own colour. Pure SVG (no state, no timers), so it is cheap at 5 Hz; style `.vg-*` in your skin.css.
 * With only a day or two of history it draws flat lines rather than nothing.
 */
export function VoiceGraph({ voice, width = 240, height = 96, className = "" }: { voice: VoiceVM; width?: number; height?: number; className?: string }) {
  const peak = Math.max(0.3, ...voice.series.flatMap((s) => s.points)) * 1.15;
  const y = (v: number) => height - 2 - (v / peak) * (height - 4);
  const have = Math.max(0, ...voice.series.map((s) => s.points.length));
  const span = Math.min(DAYS, Math.max(MIN_SPAN, have));
  const step = width / (span - 1);
  const line = (points: number[]) => {
    const pts = points.length === 1 ? [points[0]!, points[0]!] : points;
    const first = span - pts.length;
    return pts.map((v, i) => `${((first + i) * step).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  };
  const grid = [0.25, 0.5, 0.75].map((f) => height * f);
  return (
    <svg className={`vg ${className}`} viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={voice.headline} preserveAspectRatio="none">
      {grid.map((g) => (
        <line key={g} className="vg-grid" x1={0} x2={width} y1={g} y2={g} />
      ))}
      {[1, 2, 3, 4, 5].map((d) => (
        <line key={d} className="vg-grid" x1={(width * d) / 6} x2={(width * d) / 6} y1={0} y2={height} />
      ))}
      {voice.series
        .slice()
        .sort((a, b) => Number(a.you) - Number(b.you))
        .map((s) => s.points.length > 0 && <polyline key={s.id} className={`vg-line ${s.you ? "you" : ""}`} points={line(s.points)} fill="none" stroke={s.color} strokeWidth={s.you ? 2.4 : 1.4} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />)}
    </svg>
  );
}

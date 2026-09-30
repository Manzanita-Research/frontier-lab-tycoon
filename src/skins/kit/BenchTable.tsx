import { useT } from "../context";
import type { LeapfrogVM } from "../../ui/hud/types";

/**
 * The benchmark leaderboard as a table: labs down the side, benchmarks across, your row marked, the record holder's
 * cell badged SOTA (blinking for a few seconds after it changes hands), benchmaxxed scores asterisked with the excuse
 * underneath, and solved benchmarks struck through with a SOLVED stamp. Plain semantic classes (`bench-*`) so a skin
 * dresses it from its own CSS; Frontier 95 and the base both use it.
 */
export function BenchTable({ leapfrog, className = "" }: { leapfrog: LeapfrogVM; className?: string }) {
  const t = useT();
  const { columns, rows } = leapfrog;
  if (columns.length === 0 || rows.length === 0) return <p className={`bench-empty ${className}`}>{t("bench.empty")}</p>;
  return (
    <div className={`bench-scroll ${className}`}>
      <table className="bench-table">
        <thead>
          <tr>
            <th scope="col" className="bench-lab">
              {t("bench.colLab")}
            </th>
            {columns.map((c) => (
              <th key={c.id} scope="col" className={`bench-col ${c.status} ${c.isNew ? "new" : ""} ${c.ghost ? "ghost" : ""}`} title={`${c.name}. Best: ${c.bestText}${c.holder ? ` (${c.holder})` : ""}`}>
                <span className="bench-name">{c.short}</span>
                {c.status === "saturated" && <span className="bench-stamp">{t("bench.solved")}</span>}
                {c.isNew && c.status !== "saturated" && <span className="bench-new">{t("bench.new")}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={`bench-row ${r.you ? "you" : ""} ${r.flash ? "flash" : ""}`} title={r.model ? `${r.name}: ${r.model}` : r.name}>
              <th scope="row" className="bench-lab">
                <i className="bench-dot" style={{ background: r.color }} aria-hidden />
                <span>{r.label}</span>
              </th>
              {r.cells.map((cell, k) => (
                <td key={columns[k]!.id} className={`bench-cell ${columns[k]!.status} ${cell.sota ? "sota" : ""} ${cell.flash ? "flash" : ""}`}>
                  {cell.sota && <b className="bench-badge">{t("bench.sota")}</b>}
                  <span className="bench-score">
                    {cell.text}
                    {cell.maxx && <sup aria-label="benchmaxxed">*</sup>}
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {leapfrog.hasMaxx && <p className="bench-foot">{leapfrog.footnote}</p>}
    </div>
  );
}

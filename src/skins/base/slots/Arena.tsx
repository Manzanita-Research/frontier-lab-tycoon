import { Odometer } from "../../kit";
import { useT } from "../../context";
import type { SlotPropsMap } from "../../types";

const ROW = 31;

/**
 * The right-hand column of the race: the R&D multiplier shown big, the era it puts you in, and the Frontier Arena,
 * whose rows slide to their new places every week.
 */
export function Arena({ arena }: SlotPropsMap["Arena"]) {
  const t = useT();
  const rd = arena.rd;
  return (
    <div className={`race-panel ${arena.open ? "open" : ""} ${arena.alert ? "alert" : ""}`}>
      <div className={`rd panel era-${rd.era}`}>
        <div className="rd-top">
          <span className="rd-label">{t("stats.rd")}</span>
          <span className="era-pill">{t("arena.eraPill", { n: rd.era, name: rd.eraName })}</span>
        </div>
        <div className="rd-big">
          <Odometer value={rd.mult} format={(n) => `${n.toFixed(1)}×`} />
          <span className="rd-sub">{t("arena.faster")}</span>
        </div>
        <div className="era-meter" aria-hidden="true">
          <span style={{ width: `${Math.round(rd.eraPct * 100)}%` }} />
        </div>
        <div className="era-next">{rd.nextText}</div>
        {rd.drop && (
          <div className="drop-banner" title={`${rd.drop.model} is free`}>
            {t("arena.drop", { days: rd.drop.daysLeft })}
          </div>
        )}
      </div>
      {arena.open && (
        <div className="arena panel" aria-label={t("arena.title")}>
          <div className="arena-head">
            <b>{t("arena.title")}</b>
            <span>{arena.week === 0 ? t("arena.loading") : t("arena.week", { n: arena.week })}</span>
          </div>
          <div className="arena-rows" style={{ height: arena.rows.length * ROW }}>
            {arena.rows.map((row) => (
              <div key={row.id} className={`arena-row ${row.you ? "you" : ""} ${row.moved ? `moved-${row.moved}` : ""}`} style={{ transform: `translateY(${(row.rank - 1) * ROW}px)` }} title={row.title}>
                <span className="ar-rank">{row.rank}</span>
                <i className="ar-dot" style={{ background: row.color }} />
                <span className="ar-name">
                  {row.short}
                  {row.open && <em className="ar-open">open</em>}
                </span>
                <span className="ar-score">{row.score}</span>
                <span className={`ar-delta ${row.delta > 0 ? "good" : "bad"}`}>{row.deltaText}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

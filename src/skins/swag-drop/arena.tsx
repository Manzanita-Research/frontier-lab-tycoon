// The Race on the desk: the AI R&D multiplier as an enamel medal, and the Frontier Arena as a scoreboard whose rows slide to
// their new places every week.
import { Odometer, useT } from "../kit";
import type { SlotPropsMap } from "../types";

const ROW = 27;

export function Arena({ arena }: SlotPropsMap["Arena"]) {
  const t = useT();
  const rd = arena.rd;
  return (
    <div className={`sd-arena ${arena.open ? "open" : ""} ${arena.alert ? "alert" : ""}`}>
      <div className={`sd-rd era-${rd.era}`}>
        <span className="sd-medal">
          <Odometer className="sd-mult" value={rd.mult} format={(n) => `${n.toFixed(1)}×`} flash={false} />
        </span>
        <div className="txt">
          <div className="top">
            <span className="k">{t("stats.rd")}</span>
            <span className="flag">{t("arena.eraPill", { n: rd.era, name: rd.eraName })}</span>
          </div>
          <div className="sub">{t("arena.faster")}</div>
          <div className="meter" aria-hidden>
            <span style={{ width: `${Math.round(rd.eraPct * 100)}%` }} />
          </div>
          <div className="next">{rd.nextText}</div>
        </div>
        {rd.drop && (
          <div className="drop" title={`${rd.drop.model} is free`}>
            {t("arena.drop", { days: rd.drop.daysLeft })}
          </div>
        )}
      </div>
      {arena.open && (
        <div className="sd-board" aria-label={t("arena.title")}>
          <div className="head">
            <b>{t("arena.title")}</b>
            <span>{arena.week === 0 ? t("arena.loading") : t("arena.week", { n: arena.week })}</span>
          </div>
          <div className="rows" style={{ height: arena.rows.length * ROW }}>
            {arena.rows.map((row) => (
              <div key={row.id} className={`row ${row.you ? "you" : ""} ${row.moved ? `moved-${row.moved}` : ""}`} style={{ transform: `translateY(${(row.rank - 1) * ROW}px)` }} title={row.title}>
                <span className="rk">{row.rank}</span>
                <i className="dot" style={{ background: row.color }} />
                <span className="nm">
                  {row.short}
                  {row.open && <em>open</em>}
                </span>
                <span className="sc">{row.score}</span>
                <span className={`dl ${row.delta > 0 ? "up" : row.delta < 0 ? "down" : ""}`}>{row.deltaText}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

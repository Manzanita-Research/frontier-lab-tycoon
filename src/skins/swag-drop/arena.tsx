// The Race on the desk: the AI R&D multiplier as an enamel medal, the news cycle as a one-line bar, and the Frontier Arena as a
// scoreboard whose rows slide to their new places every week. The scoreboard has a second tab, the Release Leapfrog benchmark
// table (so the Layout does not place the Benchmarks or Voice slots on their own).
import { useState } from "react";
import { BenchTable, Odometer, VoiceGraph, useT } from "../kit";
import type { SlotPropsMap } from "../types";

const ROW = 27;

export function Arena({ arena, leapfrog, layout }: SlotPropsMap["Arena"]) {
  const t = useT();
  const rd = arena.rd;
  const [tab, setTab] = useState<"arena" | "bench">("arena");
  const [graph, setGraph] = useState(false);
  const bench = leapfrog.enabled;
  const voice = leapfrog.voice;
  const lead = leapfrog.rows.find((r) => r.you);
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
        {bench && !layout.compact && (
          <section className={`sd-voice ${voice.youOwn ? "owned" : ""}`} aria-label={t("voice.title")}>
            <button type="button" className="head" onClick={() => setGraph((g) => !g)} aria-expanded={graph} title={voice.headline}>
              <b>{t("voice.title")}</b>
              <span className={`you ${voice.trend}`}>
                {t("voice.you")} {voice.yoursText}
              </span>
            </button>
            <div className="bar" role="img" aria-label={voice.headline}>
              {voice.shares.map((sh) => (
                <i key={sh.id} className={sh.you ? "you" : ""} style={{ width: `${Math.max(1, sh.share * 100)}%`, background: sh.color }} title={`${sh.short} ${sh.pctText}`} />
              ))}
            </div>
            {graph && <VoiceGraph voice={voice} width={250} height={64} className="sd-vgraph" />}
          </section>
        )}
        {rd.drop && (
          <div className="drop" title={`${rd.drop.model} is free`}>
            {t("arena.drop", { days: rd.drop.daysLeft })}
          </div>
        )}
      </div>
      {arena.open && (
        <div className={`sd-board ${tab === "bench" && bench ? "bench-tab" : ""} ${leapfrog.rows.some((r) => r.flash) ? "flashing" : ""}`} aria-label={t("arena.title")}>
          <div className="head">
            {bench ? (
              <div className="tabs" role="tablist" aria-label={t("arena.title")}>
                <button type="button" role="tab" aria-selected={tab === "arena"} className={tab === "arena" ? "on" : ""} onClick={() => setTab("arena")}>
                  {t("stats.arena")}
                </button>
                <button type="button" role="tab" aria-selected={tab === "bench"} className={tab === "bench" ? "on" : ""} onClick={() => setTab("bench")}>
                  {t("bench.tab")}
                </button>
              </div>
            ) : (
              <b>{t("arena.title")}</b>
            )}
            <span>{tab === "bench" && bench ? `${lead ? `${lead.wins} SOTA` : ""}` : arena.week === 0 ? t("arena.loading") : t("arena.week", { n: arena.week })}</span>
          </div>
          {(tab === "arena" || !bench) && (
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
          )}
          {tab === "bench" && bench && (
            <>
              <BenchTable leapfrog={leapfrog} className="sd-bench" />
              <p className="sd-bench-sub">{leapfrog.drop ? leapfrog.drop.text : leapfrog.nextText}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

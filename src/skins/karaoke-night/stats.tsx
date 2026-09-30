// The console: a lilac plastic body with a glowing screen in it. The lab name and date on top, Vibes as the big pink score,
// cash, runway and capability as glowing numbers, hype as a VU meter, and the race's two chips (the Arena, AI R&D).
import { useEffect, useRef, useState } from "react";
import { Odometer, money } from "../kit";
import { useT } from "../context";
import type { SlotPropsMap } from "../types";
import type { StatsVM } from "../../ui/hud/types";
import { Heart, Trend } from "./art";

const VU_BARS = 10;
const perDay = (n: number) => `${n >= 0 ? "+" : "-"}${money(Math.abs(n))}/day`;

/** The pink score. A hover (mouse) or a tap (finger) opens "where the vibes come from" as a scorecard. */
function Vibes({ vibes }: { vibes: StatsVM["vibes"] }) {
  const t = useT();
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hover || pinned;
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) {
        setHover(false);
        setPinned(false);
      }
    };
    window.addEventListener("pointerdown", away);
    return () => window.removeEventListener("pointerdown", away);
  }, [open]);
  const words = vibes.trend === "flat" ? "steady" : vibes.trend === "up" ? "rising" : "falling";
  return (
    <div className="kn-vibes" ref={root} onPointerEnter={(e) => e.pointerType === "mouse" && setHover(true)} onPointerLeave={(e) => e.pointerType === "mouse" && setHover(false)}>
      <button type="button" className={`kn-vibes-btn trend-${vibes.trend}`} onClick={() => setPinned((p) => !p)} aria-expanded={open} aria-label={`${t("stats.vibes")} ${vibes.value}, ${words}`}>
        <Odometer className="kn-score" value={vibes.value} flash={false} />
        <span className="kn-vibes-label">
          <Heart /> {t("stats.vibes")} <Trend trend={vibes.trend} />
        </span>
      </button>
      {open && (
        <div className="kn-scorecard" role="tooltip">
          <div className="kn-scorecard-title">
            {t("vibes.tipTitle")} <span>{`${vibes.value} of ${vibes.max}`}</span>
          </div>
          {vibes.rows.map((r) => (
            <div key={r.label} className="kn-vrow">
              <span className="kn-vlabel">
                {r.label} {r.note && <small>{r.note}</small>}
              </span>
              <span className="kn-vbar">
                <i className={r.points < 0 ? "neg" : ""} style={{ width: `${Math.round(r.fill * 100)}%` }} />
              </span>
              <span className={`kn-vpts ${r.points < 0 ? "bad" : ""}`}>
                {r.points > 0 ? "+" : ""}
                {r.points}
              </span>
            </div>
          ))}
          <div className="kn-scorecard-foot">{t("vibes.tipFoot", { target: vibes.target })}</div>
        </div>
      )}
    </div>
  );
}

export function Stats({ stats, layout, actions }: SlotPropsMap["Stats"]) {
  const t = useT();
  const compact = layout.compact;
  // On a phone the console is one row (Vibes, cash, runway); the caret opens the rest.
  const [expanded, setExpanded] = useState(false);
  const a = stats.arena;
  const lit = Math.round((Math.max(0, Math.min(100, stats.hype.value)) / 100) * VU_BARS);
  return (
    <div className={`kn-console kn-plastic ${compact ? "compact" : ""} ${expanded ? "expanded" : ""}`}>
      <div className="kn-screen">
        <div className="kn-lab">
          <span className="kn-lab-name">
            {stats.labName}
          </span>
          <span className="kn-lab-date">
            {stats.date}
          </span>
        </div>
        <Vibes vibes={stats.vibes} />
        <div className="kn-stats">
          <div className="kn-st kn-cash">
            <span className="kn-l">{t("stats.cash")}</span>
            <Odometer className={`kn-v ${stats.cash.negative ? "hot" : "gold"}`} value={stats.cash.value} format={money} flash={false} />
            <Odometer className={`kn-s ${stats.net.good ? "mint" : "hot"}`} value={stats.net.value} format={perDay} flash={false} />
          </div>
          <div className="kn-st kn-runway">
            <span className="kn-l">{t("stats.runway")}</span>
            <span className={`kn-v ${stats.runway.warning ? "hot" : "gold"}`}>{stats.runway.text}</span>
            <span className={`kn-s ${stats.runway.warning ? "hot" : "dim"}`}>{stats.runway.warning ? "LOW!" : "COMFY"}</span>
          </div>
          <div className="kn-st kn-cap">
            <span className="kn-l">{t("stats.capability")}</span>
            <Odometer className="kn-v cyan" value={stats.capability.value} flash={false} />
            <span className="kn-s dim" title={stats.capability.latestModel ?? undefined}>
              {stats.capability.latestModel}
            </span>
          </div>
          <div className="kn-st kn-hype">
            <span className="kn-l">
              {t("stats.hype")} <Odometer className="kn-hype-n" value={stats.hype.value} flash={false} />
            </span>
            <span className="kn-vu" role="img" aria-label={`${t("stats.hype")} ${Math.round(stats.hype.value)}`}>
              {Array.from({ length: VU_BARS }, (_, i) => (
                <i key={i} className={`${i < lit ? "on" : ""} ${i >= 8 ? "r" : i >= 6 ? "y" : ""}`} style={{ height: `${28 + i * 8}%` }} />
              ))}
            </span>
          </div>
          <button
            type="button"
            className={`kn-st kn-arena ${a.flinch ? "flinch" : ""} ${a.top ? "top" : ""}`}
            onClick={() => actions.toggleArena()}
            aria-expanded={a.open}
            aria-label={`You are number ${a.rank} on the Frontier Arena. Click to ${a.open ? "hide" : "show"} the leaderboard.`}
          >
            <span className="kn-l">{t("stats.arena")}</span>
            <span className="kn-v pink">
              {`#${a.rank}`}
              {a.rankDelta !== 0 && (
                <span className={`kn-delta ${a.tone}`}>
                  <Trend trend={a.rankDelta > 0 ? "up" : "down"} />
                  {String(Math.abs(a.rankDelta))}
                </span>
              )}
            </span>
            <span className="kn-s dim">{a.top ? t("stats.arenaTop") : t("stats.arenaOn")}</span>
          </button>
          <div className="kn-st kn-rd">
            <span className="kn-l">{t("stats.rd")}</span>
            <Odometer className="kn-v mint" value={stats.rd.mult} format={(n) => `${n.toFixed(1)}×`} flash={false} />
            <span className="kn-s dim">{t("stats.era", { n: stats.rd.era })}</span>
          </div>
        </div>
        {compact && (
          <button type="button" className="kn-more" onClick={() => setExpanded((e) => !e)} aria-expanded={expanded} aria-label={expanded ? t("stats.fewerStats") : t("stats.moreStats")}>
            <Trend trend={expanded ? "up" : "down"} />
          </button>
        )}
      </div>
    </div>
  );
}

// The banner and the clip-art stickers: Vibes is a gold star, cash a green circle, runway a "hurry!" circle, and
// capability, hype, the Arena and the R&D multiplier are pills and bursts stuck on at odd angles.
import { useEffect, useRef, useState } from "react";
import { ALL_VISIBLE, Odometer, money, useWidget } from "../kit";
import { useCoach, useT } from "../context";
import type { SlotPropsMap } from "../types";
import type { StatsVM } from "../../ui/hud/types";
import { burstPoints, Globe, Icon, STAR_POINTS, Trend } from "./art";

const BURST = burstPoints(14, 48, 39);

/** The gold Vibes star. A hover (mouse) or a tap (finger) opens "where the vibes come from". */
function VibesStar({ vibes, compact }: { vibes: StatsVM["vibes"]; compact: boolean }) {
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
    <div className="dd-vibes" ref={root} onPointerEnter={(e) => e.pointerType === "mouse" && setHover(true)} onPointerLeave={(e) => e.pointerType === "mouse" && setHover(false)}>
      <button type="button" className={`dd-star trend-${vibes.trend}`} onClick={() => setPinned((p) => !p)} aria-expanded={open} aria-label={`${t("stats.vibes")} ${vibes.value}, ${words}`}>
        <svg className="dd-star-art" viewBox="-4 -4 110 106" aria-hidden focusable="false">
          <polygon className="sh" points={STAR_POINTS} transform="translate(4 4)" />
          <polygon className="fg" points={STAR_POINTS} />
        </svg>
        <span className="dd-star-text">
          <Odometer className="n" value={vibes.value} flash={false} />
          <span className="l">
            {t("stats.vibes")}! <Trend trend={vibes.trend} />
          </span>
        </span>
      </button>
      {open && (
        <div className={`dd-vibes-tip ${compact ? "compact" : ""}`} role="tooltip">
          <div className="dd-tip-title">
            {t("vibes.tipTitle")} <span>{vibes.value} of {vibes.max}</span>
          </div>
          {vibes.rows.map((r) => (
            <div key={r.label} className="dd-vrow">
              <span className="dd-vlabel">
                {r.label} {r.note && <small>{r.note}</small>}
              </span>
              <span className="dd-vbar">
                <i className={r.points < 0 ? "neg" : ""} style={{ width: `${Math.round(r.fill * 100)}%` }} />
              </span>
              <span className={`dd-vpts ${r.points < 0 ? "bad" : ""}`}>
                {r.points > 0 ? "+" : ""}
                {r.points}
              </span>
            </div>
          ))}
          <div className="dd-tip-foot">{t("vibes.tipFoot", { target: vibes.target })}</div>
        </div>
      )}
    </div>
  );
}

export function Stats({ stats, layout, visible = ALL_VISIBLE, actions }: SlotPropsMap["Stats"]) {
  const t = useT();
  const coach = useCoach();
  const compact = layout.compact;
  const [expanded, setExpanded] = useState(false);
  useWidget(["properties", "finance"], () => setExpanded(true));
  const rw = stats.runway;
  const a = stats.arena;
  const months = rw.months === null ? "∞" : rw.months.toFixed(1);
  return (
    <div className={`dd-stats ${compact ? "compact" : ""} ${expanded ? "expanded" : ""}`}>
      <div className="dd-banner">
        <Globe className="dd-globe" />
        <span className="dd-ribbon" aria-label={stats.labName}>
          <span className="edge">
            <b>{stats.labName}</b>
          </span>
        </span>
        <span className="dd-date">{stats.date}</span>
      </div>
      <div className="dd-stickers">
        {visible.vibes && <VibesStar vibes={stats.vibes} compact={compact} />}
        <div className={`dd-stk dd-circ dd-cash ${stats.cash.negative ? "neg" : ""}`} title={`${t("stats.cash")} ${stats.cash.text}`}>
          <Odometer className="n" value={stats.cash.value} format={money} flash={false} />
          <span className="l">
            {t("stats.cash")}
            {visible.revenue && <span className="net"> · {stats.net.text} {t("stats.net")}</span>}
          </span>
        </div>
        <div className={`dd-stk dd-circ dd-runway ${rw.warning ? "warn" : ""}`} {...coach.attrs("stat:runway")}>
          <span className="n">{months}</span>
          <span className="l">
            months<span className="long"> of {t("stats.runway").toLowerCase()}</span>
          </span>
          {rw.warning && (
            <span className="hurry">
              <Icon name="clock" size={16} /> hurry!
            </span>
          )}
        </div>
        {compact && (visible.vibes || visible.arena) && (
          <button type="button" className="dd-more" onClick={() => setExpanded((e) => !e)} aria-expanded={expanded} aria-label={expanded ? t("stats.fewerStats") : t("stats.moreStats")}>
            <Icon name="chevron" size={26} />
          </button>
        )}
        {visible.vibes && (
          <>
            <div className="dd-stk dd-pill dd-cap" title={stats.capability.latestModel ?? undefined}>
              <Odometer className="n" value={stats.capability.value} flash={false} />
              <span className="l">{t("stats.capability").toLowerCase()}</span>
            </div>
            <div className="dd-stk dd-pill dd-hype">
              <Odometer className="n" value={stats.hype.value} flash={false} />
              <span className="l">
                {t("stats.hype").toLowerCase()} <Icon name="megaphone" size={16} />
              </span>
            </div>
          </>
        )}
        {visible.arena && (
        <button
          type="button"
          className={`dd-stk dd-pill dd-arena ${a.flinch ? "flinch" : ""} ${a.top ? "top" : ""}`}
          onClick={() => actions.toggleArena()}
          aria-expanded={a.open}
          aria-label={`You are number ${a.rank} on the Frontier Arena. Click to ${a.open ? "hide" : "show"} the leaderboard.`}
        >
          <span className="n">
            #{a.rank}
            <span className={`delta ${a.tone}`}>{a.rankDelta === 0 ? "" : a.deltaText}</span>
          </span>
          <span className="l">
            <Icon name="trophy" size={16} /> {a.top ? t("stats.arenaTop") : t("stats.arenaOn")}
          </span>
        </button>
        )}
        {visible.rnd && (
        <div className="dd-stk dd-burst" title={`${t("stats.rd")} ${stats.rd.multText}`}>
          <svg viewBox="-2 -2 104 104" aria-hidden focusable="false">
            <polygon points={BURST} />
          </svg>
          <span className="txt">
            <Odometer className="n" value={stats.rd.mult} format={(n) => `${n.toFixed(1)}×`} flash={false} />
            <span className="l">
              {t("stats.rd")}
              <span className="era"> · {t("stats.era", { n: stats.rd.era })}</span>
            </span>
          </span>
        </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { Odometer, money, useT } from "../kit";
import type { SlotPropsMap } from "../types";
import type { StatsVM } from "../../ui/hud/types";
import { Caret, InfinityIcon } from "./icons";
import { almanacDate } from "./lore";

const RING = 2 * Math.PI * 31;

/** A signed money figure the way the Almanac writes it: "− $25K a day" (a real minus, and room to breathe). */
const perDay = (n: number) => `${n < 0 ? "−" : "+"} ${money(Math.abs(n))} a day`;

/** Which way a number last moved: UI-only memory, so the Hype caption can say "rising" though the view-model only has a value. */
function useTrend(value: number): "up" | "down" | "flat" {
  const [trend, setTrend] = useState<"up" | "down" | "flat">("flat");
  const last = useRef(Math.round(value));
  useEffect(() => {
    const now = Math.round(value);
    if (now === last.current) return;
    setTrend(now > last.current ? "up" : "down");
    last.current = now;
  }, [value]);
  return trend;
}

function runwayCaption(r: StatsVM["runway"]): string {
  if (r.months === null) return "in the black";
  if (r.warning) return "getting short";
  return r.months >= 12 ? "plenty of road" : "steady";
}

const TREND_WORD = { up: "↑ rising", down: "↓ falling", flat: "holding" } as const;
const VIBES_TREND = { up: "↑", down: "↓", flat: "" } as const;

/** The Vibes ring: a thin arc filled to the score, with a tooltip of where every point came from (hover or tap). */
function VibesRing({ vibes }: { vibes: StatsVM["vibes"] }) {
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
  const frac = Math.max(0, Math.min(1, vibes.value / vibes.max));
  const band = frac < 0.25 ? "lo" : frac < 0.5 ? "mid" : "hi";
  return (
    <div className="fa-vibes" ref={root} onPointerEnter={(e) => e.pointerType === "mouse" && setHover(true)} onPointerLeave={(e) => e.pointerType === "mouse" && setHover(false)}>
      <button className={`fa-ring ${band} trend-${vibes.trend}`} onClick={() => setPinned((p) => !p)} aria-expanded={open} aria-label={`${t("stats.vibes")} ${vibes.value}, ${vibes.trend === "flat" ? "steady" : vibes.trend === "up" ? "rising" : "falling"}`}>
        <svg viewBox="0 0 74 74" aria-hidden>
          <circle className="fa-ring-track" cx="37" cy="37" r="31" />
          <circle className="fa-ring-arc" cx="37" cy="37" r="31" strokeDasharray={`${(frac * RING).toFixed(1)} ${RING.toFixed(1)}`} transform="rotate(-90 37 37)" />
        </svg>
        <span className="fa-ring-n">
          <Odometer value={vibes.value} flash={false} />
          <small>
            {t("stats.vibes")} {VIBES_TREND[vibes.trend]}
          </small>
        </span>
      </button>
      {open && (
        <div className="fa-vibes-tip fa-paper" role="tooltip">
          <div className="fa-vibes-title">
            <i>{t("vibes.tipTitle")}</i>
            <span>
              {vibes.value} of {vibes.max}
            </span>
          </div>
          {vibes.rows.map((r) => (
            <div key={r.label} className="fa-vrow">
              <span className="fa-vrow-label">
                {r.label} {r.note && <small>{r.note}</small>}
              </span>
              <span className="fa-vrow-bar">
                <i className={r.points < 0 ? "neg" : ""} style={{ width: `${Math.round(r.fill * 100)}%` }} />
              </span>
              <span className={`fa-vrow-pts ${r.points < 0 ? "bad" : ""}`}>
                {r.points > 0 ? "+" : r.points < 0 ? "−" : ""}
                {Math.abs(r.points)}
              </span>
            </div>
          ))}
          <p>{t("vibes.tipFoot", { target: vibes.target })}</p>
        </div>
      )}
    </div>
  );
}

/**
 * The header strip: the Vibes ring, the lab's name in italic with the date in words, then the numbers in a soft serif
 * with a line of commentary under each. On a phone it is one row (ring, cash, runway) and a fold arrow opens the rest.
 */
export function Stats({ stats, layout, actions }: SlotPropsMap["Stats"]) {
  const t = useT();
  const compact = layout.compact;
  const [expanded, setExpanded] = useState(false);
  const hype = useTrend(stats.hype.value);
  const a = stats.arena;
  return (
    <div className={`fa-head fa-paper ${compact ? "compact" : ""} ${compact && expanded ? "expanded" : ""}`}>
      <VibesRing vibes={stats.vibes} />
      <div className="fa-title">
        <div className="fa-lab">{stats.labName}</div>
        <div className="fa-date fa-sc">{almanacDate(stats.date)}</div>
      </div>
      <i className="fa-div" aria-hidden />
      <div className="fa-stat fa-cash">
        <span className="fa-sc">{t("stats.cash")}</span>
        <Odometer className={`fa-v ${stats.cash.negative ? "bad" : ""}`} value={stats.cash.value} format={money} />
        <Odometer className={`fa-d ${stats.net.good ? "good" : "bad"}`} value={stats.net.value} format={perDay} flash={false} />
      </div>
      <div className="fa-stat fa-runway" data-coach="stat:runway">
        <span className="fa-sc">{t("stats.runway")}</span>
        <span className={`fa-v ${stats.runway.warning ? "bad" : ""}`}>{stats.runway.months === null ? <InfinityIcon /> : stats.runway.text}</span>
        <span className={`fa-d ${stats.runway.warning ? "bad" : "dim"}`}>{runwayCaption(stats.runway)}</span>
      </div>
      <div className="fa-stat fa-capability">
        <span className="fa-sc">{t("stats.capability")}</span>
        <Odometer className="fa-v" value={stats.capability.value} flash={false} />
        <span className="fa-d plum" title={stats.capability.latestModel ?? undefined}>
          {stats.capability.latestModel ?? "no release yet"}
        </span>
      </div>
      <div className="fa-stat fa-hype">
        <span className="fa-sc">{t("stats.hype")}</span>
        <Odometer className="fa-v" value={stats.hype.value} flash={false} />
        <span className={`fa-d ${hype === "up" ? "good" : hype === "down" ? "bad" : "dim"}`}>{TREND_WORD[hype]}</span>
      </div>
      <i className="fa-div fa-div2" aria-hidden />
      <button className={`fa-stat fa-arena ${a.flinch ? "flinch" : ""} ${a.top ? "top" : ""}`} onClick={() => actions.toggleArena()} aria-expanded={a.open} aria-label={`You are number ${a.rank} on the Frontier Arena. Click to ${a.open ? "hide" : "show"} the leaderboard.`}>
        <span className="fa-sc">{t("stats.arena")}</span>
        <span className="fa-v">#{a.rank}</span>
        <span className={`fa-d ${a.tone || "dim"}`}>{a.top ? t("stats.arenaTop") : a.rankDelta === 0 ? t("stats.arenaOn") : `${a.deltaText} ${t("stats.arenaOn")}`}</span>
      </button>
      <div className="fa-stat fa-rd">
        <span className="fa-sc">{t("stats.rd")}</span>
        <Odometer className="fa-v" value={stats.rd.mult} format={(n) => `${n.toFixed(1)}×`} flash={false} />
        <span className="fa-d dim">{t("stats.era", { n: stats.rd.era })}</span>
      </div>
      {compact && (
        <button className="fa-more" onClick={() => setExpanded((e) => !e)} aria-expanded={expanded} aria-label={expanded ? t("stats.fewerStats") : t("stats.moreStats")}>
          <Caret open={expanded} />
        </button>
      )}
    </div>
  );
}

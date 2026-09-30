// The paper plaque and the instrument beside it: the lab's numbers as enamel pins, and the training run as a dial.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ALL_VISIBLE, Odometer, money, useCoach, useT } from "../kit";
import type { StatsVM } from "../../ui/hud/types";
import type { SlotPropsMap } from "../types";
import { Glyph } from "./icons";

const signed = (n: number) => `${n >= 0 ? "+" : "−"}${money(Math.abs(n))}/d`;
const TREND = { up: "rising", down: "falling", flat: "steady" } as const;

/** One enamel pin: a flat disc or pill with a coloured rim, and a mono label underneath. */
function Pin({ label, rim, className = "", tag, attrs, children }: { label: string; rim: string; className?: string; tag?: ReactNode; attrs?: Record<string, string | undefined>; children: ReactNode }) {
  return (
    <div className={`sd-pin ${className}`} {...attrs}>
      <div className={`sd-badge rim-${rim}`}>
        {children}
        {tag}
      </div>
      <span className="sd-lbl">{label}</span>
    </div>
  );
}

/** The big orange Vibes pin. Hover or tap it for the receipt of where the points came from. */
function VibesPin({ vibes }: { vibes: StatsVM["vibes"] }) {
  const t = useT();
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hover || pinned;
  const root = useRef<HTMLDivElement>(null);

  // A tap elsewhere puts the receipt away (it opens on hover with a mouse and on tap with a finger).
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

  return (
    <div className="sd-vibes" ref={root} onPointerEnter={(e) => e.pointerType === "mouse" && setHover(true)} onPointerLeave={(e) => e.pointerType === "mouse" && setHover(false)}>
      <button
        type="button"
        className={`sd-badge hero trend-${vibes.trend}`}
        onClick={() => setPinned((p) => !p)}
        aria-expanded={open}
        aria-label={`${t("stats.vibes")} ${vibes.value}, ${TREND[vibes.trend]}`}
      >
        <Odometer className="sd-big" value={vibes.value} flash={false} />
        <small>{t("stats.vibes")}</small>
        <span className={`sd-trend ${vibes.trend}`} aria-hidden>
          <Glyph name={vibes.trend} />
        </span>
      </button>
      {open && (
        <div className="sd-receipt" role="tooltip">
          <div className="paper">
            <div className="sd-receipt-title">
              <b>{t("vibes.tipTitle")}</b>
              <span>
                {vibes.value} / {vibes.max}
              </span>
            </div>
            {vibes.rows.map((r) => (
              <div key={r.label} className="sd-vrow">
                <span className="sd-vname">
                  {r.label} {r.note && <i>{r.note}</i>}
                </span>
                <span className="sd-vbar">
                  <span className={r.points < 0 ? "neg" : ""} style={{ width: `${Math.round(r.fill * 100)}%` }} />
                </span>
                <span className={`sd-vpts ${r.points < 0 ? "bad" : ""}`}>
                  {r.points > 0 ? "+" : ""}
                  {r.points}
                </span>
              </div>
            ))}
            <div className="sd-receipt-foot">{t("vibes.tipFoot", { target: vibes.target })}</div>
          </div>
        </div>
      )}
    </div>
  );
}

/** A half-dial arc for the Hype pin: 0 to 100 around the top, the number in the middle. */
function HypeDial({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <span className="sd-hype">
      <svg viewBox="0 0 74 48" aria-hidden>
        <path className="trk" d="M14 38a23 23 0 0 1 46 0" pathLength={100} />
        <path className="arc" d="M14 38a23 23 0 0 1 46 0" pathLength={100} strokeDasharray={`${v} 100`} />
      </svg>
      <Odometer className="sd-num" value={value} flash={false} />
    </span>
  );
}

/** The top-left plaque: lab name, date, and the pins. On a phone it is one row (Vibes, cash, runway) and a tab opens the rest. */
export function Stats({ stats, layout, visible = ALL_VISIBLE, actions }: SlotPropsMap["Stats"]) {
  const t = useT();
  const coach = useCoach();
  const compact = layout.compact;
  const [expanded, setExpanded] = useState(false);
  const a = stats.arena;
  return (
    <div className={`sd-plaque ${compact ? "compact" : ""} ${compact && expanded ? "expanded" : ""}`}>
      <div className="sd-head">
        <h1 className="sd-lab">{stats.labName}</h1>
        <span className="sd-date">{stats.date}</span>
      </div>
      <div className="sd-pins">
        {visible.vibes && <VibesPin vibes={stats.vibes} />}
        <Pin
          label={t("stats.cash")}
          rim={stats.cash.negative ? "bad" : "gold"}
          className="pin-cash"
          tag={visible.revenue ? <Odometer className={`sd-delta ${stats.net.good ? "good" : "bad"}`} value={stats.net.value} format={signed} flash={false} /> : undefined}
        >
          <Odometer className={`sd-num ${stats.cash.negative ? "bad" : ""}`} value={stats.cash.value} format={money} />
        </Pin>
        <Pin label={t("stats.runway")} rim={stats.runway.warning ? "bad" : "good"} className="pin-runway" attrs={coach.attrs("stat:runway")}>
          <span className={`sd-num ${stats.runway.warning ? "bad" : ""}`}>{stats.runway.text}</span>
        </Pin>
        {visible.vibes && (
          <>
            <Pin label={t("stats.capability")} rim="research" className="pin-cap">
              <Odometer className="sd-num" value={stats.capability.value} />
            </Pin>
            <Pin label={t("stats.hype")} rim="signal" className="pin-hype">
              <HypeDial value={stats.hype.value} />
            </Pin>
          </>
        )}
      </div>
      <div className="sd-tags">
        {visible.arena && (
        <button
          type="button"
          className={`sd-tag arena ${a.top ? "top" : ""} ${a.flinch ? "flinch" : ""}`}
          onClick={() => actions.toggleArena()}
          aria-expanded={a.open}
          aria-label={`You are number ${a.rank} on the Frontier Arena. Click to ${a.open ? "hide" : "show"} the leaderboard.`}
        >
          <span className="k">{t("stats.arena")}</span>
          <b>#{a.rank}</b>
          <span className={`d ${a.tone}`}>{a.rankDelta === 0 ? "–" : a.deltaText}</span>
          <span className="s">{a.top ? t("stats.arenaTop") : t("stats.arenaOn")}</span>
        </button>
        )}
        {visible.rnd && (
          <div className="sd-tag rd">
            <span className="k">{t("stats.rd")}</span>
            <Odometer className="sd-mult" value={stats.rd.mult} format={(n) => `${n.toFixed(1)}×`} />
            <span className="s">{t("stats.era", { n: stats.rd.era })}</span>
          </div>
        )}
      </div>
      {compact && (visible.vibes || visible.arena) && (
        <button type="button" className="sd-more" onClick={() => setExpanded((e) => !e)} aria-expanded={expanded} aria-label={expanded ? t("stats.fewerStats") : t("stats.moreStats")}>
          <span className={`sd-caret ${expanded ? "open" : ""}`} aria-hidden />
        </button>
      )}
    </div>
  );
}

// The dial: a half circle centred on (60, 62), radius 50, with a tick every tenth. Drawn once.
const DIAL_TICKS = Array.from({ length: 11 }, (_, i) => {
  const a = Math.PI * (1 - i / 10);
  const r0 = i % 5 === 0 ? 36 : 40;
  return {
    x1: 60 + r0 * Math.cos(a),
    y1: 62 - r0 * Math.sin(a),
    x2: 60 + 45 * Math.cos(a),
    y2: 62 - 45 * Math.sin(a),
    major: i % 5 === 0,
  };
});

/** The training run as an instrument: a dial with a needle, the model's name, and how long is left. */
export function Training({ training }: SlotPropsMap["Training"]) {
  const t = useT();
  const coach = useCoach();
  if (!training.hasHall) {
    return (
      <div className="sd-gauge off" role="status" {...coach.attrs("training")}>
        <span className="sd-tape">{t("training.noHall")}</span>
      </div>
    );
  }
  const pct = Math.max(0, Math.min(100, Math.floor(training.pct * 100)));
  return (
    <div
      className={`sd-gauge ${training.justShipped ? "shipped" : ""}`}
      {...coach.attrs("training")}
      role="progressbar"
      aria-label={`${t("training.title")} ${training.name}`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
    >
      <svg className="sd-dial" viewBox="0 0 120 72" aria-hidden>
        <path className="face" d="M6 64A54 54 0 0 1 114 64Z" />
        <path className="trk" d="M14 62a46 46 0 0 1 92 0" pathLength={100} />
        <path className="arc" d="M14 62a46 46 0 0 1 92 0" pathLength={100} strokeDasharray={`${pct} 100`} />
        {DIAL_TICKS.map((k, i) => (
          <line key={i} className={k.major ? "gt major" : "gt"} x1={k.x1} y1={k.y1} x2={k.x2} y2={k.y2} />
        ))}
        <g className="needle" style={{ transform: `rotate(${pct * 1.8 - 90}deg)` }}>
          <path d="M60 62 60 24" />
        </g>
        <circle className="hub" cx="60" cy="62" r="5" />
      </svg>
      <div className="sd-readout">
        <span className="k">
          {t("training.title")} #{training.run}
        </span>
        <b className="name">{training.name}</b>
        <span className="pct">{training.pctText}</span>
        <span className="eta">
          {training.etaDays !== null ? t("training.eta", { n: training.etaDays }) : training.computePerDay > 0 ? t("training.compute", { n: training.computePerDay }) : t("training.noCompute")}
        </span>
      </div>
      {training.justShipped && <span className="sd-stamp shipped">{t("training.shipped")}</span>}
    </div>
  );
}

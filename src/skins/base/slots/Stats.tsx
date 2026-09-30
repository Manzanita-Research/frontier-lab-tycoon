import { useState } from "react";
import { Odometer, money, useAutoPause } from "../../kit";
import { useT } from "../../context";
import type { SlotPropsMap } from "../../types";
import { RaceStats } from "./RaceStats";
import { Vibes } from "./Vibes";

/** The top bar: lab name and date, Vibes, cash, runway, capability, hype, and the race's two chips. */
export function Stats({ stats, layout, actions }: SlotPropsMap["Stats"]) {
  const t = useT();
  const compact = layout.compact;
  // On a phone the bar is one row (Vibes, cash, runway); a tap on the caret opens the rest.
  const [expanded, setExpanded] = useState(false);
  useAutoPause(actions, "stats", compact && expanded);
  return (
    <div className={`topbar panel ${compact ? "compact" : ""} ${compact && expanded ? "expanded" : ""}`}>
      <div className="lab">
        <div className="lab-name">{stats.labName}</div>
        <div className="lab-date">{stats.date}</div>
      </div>
      <Vibes vibes={stats.vibes} />
      <div className="stat cash">
        <span className="label">{t("stats.cash")}</span>
        <Odometer className={`value ${stats.cash.negative ? "bad" : ""}`} value={stats.cash.value} format={money} />
        <Odometer className={`sub ${stats.net.good ? "good" : "bad"}`} value={stats.net.value} format={(n) => `${n >= 0 ? "+" : "-"}${money(Math.abs(n))}/day`} flash={false} />
      </div>
      <div className="stat runway">
        <span className="label">{t("stats.runway")}</span>
        <span className={`value ${stats.runway.warning ? "bad" : ""}`}>{stats.runway.text}</span>
      </div>
      <div className="stat">
        <span className="label">{t("stats.capability")}</span>
        <Odometer className="value" value={stats.capability.value} />
      </div>
      <div className="stat hype">
        <span className="label">{t("stats.hype")}</span>
        <Odometer className="value" value={stats.hype.value} />
        <span className="meter">
          <span style={{ width: `${stats.hype.value}%` }} />
        </span>
      </div>
      <RaceStats stats={stats} actions={actions} />
      {compact && (
        <button className="topbar-toggle" onClick={() => setExpanded((e) => !e)} aria-expanded={expanded} aria-label={expanded ? t("stats.fewerStats") : t("stats.moreStats")}>
          <span className={`caret ${expanded ? "open" : ""}`} aria-hidden />
        </button>
      )}
    </div>
  );
}

import { Odometer, money } from "../../kit";
import { useT } from "../../context";
import type { SlotPropsMap } from "../../types";
import { RaceStats } from "./RaceStats";
import { Vibes } from "./Vibes";

/** The top bar: lab name and date, Vibes, cash, runway, capability, hype, and the race's two chips. */
export function Stats({ stats, actions }: SlotPropsMap["Stats"]) {
  const t = useT();
  return (
    <div className="topbar panel">
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
      <div className="stat">
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
    </div>
  );
}

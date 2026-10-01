import { Odometer } from "../../kit";
import { useT } from "../../context";
import type { HudActions, StatsVM, VisibleVM } from "../../../ui/hud/types";

/** The two stats the race adds to the top bar: your place on the Arena ("#4 on Arena ↑2") and the R&D multiplier. */
export function RaceStats({ stats, visible, actions }: { stats: StatsVM; visible: VisibleVM; actions: HudActions }) {
  const t = useT();
  const a = stats.arena;
  return (
    <>
      {visible.arena && (
      <button
        className={`stat arena-chip ${a.flinch ? "flinch" : ""} ${a.top ? "top" : ""}`}
        data-anchor="app:arena"
        onClick={() => actions.toggleArena()}
        aria-expanded={a.open}
        aria-label={`You are number ${a.rank} on the Frontier Arena. Click to ${a.open ? "hide" : "show"} the leaderboard.`}
      >
        <span className="label">{t("stats.arena")}</span>
        <span className="value">
          #{a.rank}
          <span className={`delta ${a.tone}`}>{a.rankDelta === 0 ? "–" : a.deltaText}</span>
        </span>
        <span className="sub">{a.top ? t("stats.arenaTop") : t("stats.arenaOn")}</span>
      </button>
      )}
      {visible.rnd && (
        <div className="stat rd-stat">
          <span className="label">{t("stats.rd")}</span>
          <Odometer className="value" value={stats.rd.mult} format={(n) => `${n.toFixed(1)}×`} />
          <span className="sub">{t("stats.era", { n: stats.rd.era })}</span>
        </div>
      )}
    </>
  );
}

import { useAtomValue } from "@effect/atom-react";
import { useEffect, useRef, useState } from "react";
import { atoms, registry } from "../../app/game";
import { useApp, useAutoPause } from "../../app/hooks";
import { Odometer } from "../juice/Odometer";
import { arenaOpenAtom } from "./arenaState";
import "./race.css";

const ROW = 31;
const MOVE_MS = 2800;

const delta = (d: number) => (d > 0 ? `↑${d}` : d < 0 ? `↓${-d}` : "");

/**
 * The right-hand column of the race: the R&D multiplier shown big, the era it puts you in, and the Frontier Arena,
 * whose rows slide to their new places every week.
 */
export function RacePanel() {
  const race = useApp(atoms.race);
  const open = useAtomValue(arenaOpenAtom);
  useAutoPause("arena", open && window.innerWidth <= 640);
  const ranks = useRef<Record<string, number>>({});
  const [moved, setMoved] = useState<Record<string, "up" | "down">>({});
  const [alert, setAlert] = useState(false);

  // Each row that changed place lights up green or red for a moment; a drop for you shakes the whole panel and opens it.
  useEffect(() => {
    const before = ranks.current;
    const next: Record<string, number> = {};
    const flashed: Record<string, "up" | "down"> = {};
    for (const row of race.board) {
      next[row.id] = row.rank;
      const was = before[row.id];
      if (was !== undefined && was !== row.rank) flashed[row.id] = row.rank < was ? "up" : "down";
    }
    ranks.current = next;
    if (Object.keys(flashed).length === 0) return;
    setMoved(flashed);
    if (flashed.you === "down") {
      setAlert(true);
      registry.set(arenaOpenAtom, true);
    }
    const t = window.setTimeout(() => {
      setMoved({});
      setAlert(false);
    }, MOVE_MS);
    return () => window.clearTimeout(t);
  }, [race.board]);

  return (
    <div className={`race-panel ${open ? "open" : ""} ${alert ? "alert" : ""}`}>
      <div className={`rd panel era-${race.era}`}>
        <div className="rd-top">
          <span className="rd-label">AI R&amp;D</span>
          <span className="era-pill">
            ERA {race.era} · {race.eraName}
          </span>
        </div>
        <div className="rd-big">
          <Odometer value={race.mult} format={(n) => `${n.toFixed(1)}×`} />
          <span className="rd-sub">faster than humans alone</span>
        </div>
        <div className="era-meter" aria-hidden="true">
          <span style={{ width: `${Math.round(race.eraPct * 100)}%` }} />
        </div>
        <div className="era-next">{race.nextAt ? `Era ${race.era + 1} at ${race.nextAt}×` : "No more eras. Allegedly."}</div>
        {race.drop && (
          <div className="drop-banner" title={`${race.drop.model} is free`}>
            Free model out: revenue −30% for {Math.ceil(race.drop.daysLeft)}d
          </div>
        )}
      </div>
      {open && (
        <div className="arena panel" aria-label="Frontier Arena leaderboard">
          <div className="arena-head">
            <b>Frontier Arena</b>
            <span>{race.week === 0 ? "Week 1 loading" : `Week ${race.week}`}</span>
          </div>
          <div className="arena-rows" style={{ height: race.board.length * ROW }}>
            {race.board.map((row) => (
              <div
                key={row.id}
                className={`arena-row ${row.you ? "you" : ""} ${moved[row.id] ? `moved-${moved[row.id]}` : ""}`}
                style={{ transform: `translateY(${(row.rank - 1) * ROW}px)` }}
                title={row.model ? `Latest model: ${row.model}${row.open ? " (open weights)" : ""}` : row.you ? "You" : "No product. Big valuation."}
              >
                <span className="ar-rank">{row.rank}</span>
                <i className="ar-dot" style={{ background: row.color }} />
                <span className="ar-name">
                  {row.you ? `${row.short} (you)` : row.short}
                  {row.open && <em className="ar-open">open</em>}
                </span>
                <span className="ar-score">{row.score}</span>
                <span className={`ar-delta ${row.delta > 0 ? "good" : "bad"}`}>{delta(row.delta)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

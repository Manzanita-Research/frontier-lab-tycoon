import { useAtomValue } from "@effect/atom-react";
import { useEffect, useRef, useState } from "react";
import { atoms, registry } from "../../app/game";
import { useApp } from "../../app/hooks";
import { Odometer } from "../juice/Odometer";
import { arenaOpenAtom } from "./arenaState";
import "./race.css";

const arrow = (delta: number) => (delta > 0 ? `↑${delta}` : delta < 0 ? `↓${-delta}` : "–");

/** The two stats the race adds to the top bar: your place on the Arena ("#4 on Arena ↑2") and the R&D multiplier. */
export function RaceStats() {
  const race = useApp(atoms.race);
  const open = useAtomValue(arenaOpenAtom);
  const last = useRef(race.rank);
  const [shake, setShake] = useState(false);

  // A drop makes the chip flinch (and a climb makes it hop), once per change of rank.
  useEffect(() => {
    if (race.rank === last.current) return;
    setShake(race.rank > last.current);
    last.current = race.rank;
    const t = window.setTimeout(() => setShake(false), 1100);
    return () => window.clearTimeout(t);
  }, [race.rank]);

  const tone = race.rankDelta > 0 ? "good" : race.rankDelta < 0 ? "bad" : "";
  return (
    <>
      <button
        className={`stat arena-chip ${shake ? "flinch" : ""} ${race.rank === 1 ? "top" : ""}`}
        onClick={() => registry.set(arenaOpenAtom, !open)}
        aria-expanded={open}
        aria-label={`You are number ${race.rank} on the Frontier Arena. Click to ${open ? "hide" : "show"} the leaderboard.`}
      >
        <span className="label">Arena</span>
        <span className="value">
          #{race.rank}
          <span className={`delta ${tone}`}>{arrow(race.rankDelta)}</span>
        </span>
        <span className="sub">{race.rank === 1 ? "on top. for now" : "on Arena"}</span>
      </button>
      <div className="stat rd-stat">
        <span className="label">AI R&amp;D</span>
        <Odometer className="value" value={race.mult} format={(n) => `${n.toFixed(1)}×`} />
        <span className="sub">Era {race.era}</span>
      </div>
    </>
  );
}

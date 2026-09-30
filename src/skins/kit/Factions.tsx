// The factions' small parts (FLT-33), for any skin: a chip (inspector cards, the panel's rows), a meter that grows from
// the middle, and a stance track with a "you are here" marker. Semantic `faction-*` classes, styled by the base
// (base/factions.css) so a skin that uses them looks right before it restyles them.
import type { CSSProperties } from "react";
import type { FactionChipVM, FactionRowVM, StanceVM } from "../../ui/hud/types";

const tint = (color: string) => ({ "--faction": color }) as CSSProperties;

/** A faction's colour, short name and (optionally) mood, as a pill. `data-mood` lets a skin tint by mood. */
export function FactionChip({ faction, mood = true, className = "" }: { faction: FactionChipVM; mood?: boolean; className?: string }) {
  return (
    <span className={`faction-chip ${className}`} data-mood={faction.mood} style={tint(faction.color)} title={`${faction.name}: ${faction.moodLabel}`}>
      <i aria-hidden />
      <b>{faction.short}</b>
      {mood && faction.mood !== "calm" && <em>{faction.moodLabel}</em>}
    </span>
  );
}

/** −100 to 100 as a bar that grows left (fed up) or right (adoring) from the middle. */
export function FactionMeter({ row, className = "" }: { row: Pick<FactionRowVM, "meter" | "meterText" | "name" | "color">; className?: string }) {
  const pct = Math.min(50, Math.abs(row.meter) / 2);
  const style = { ...tint(row.color), [row.meter >= 0 ? "left" : "right"]: "50%", width: `${pct}%` } as CSSProperties;
  return (
    <span className={`faction-meter ${row.meter >= 0 ? "pos" : "neg"} ${className}`} role="meter" aria-label={`${row.name} ${row.meterText}`} aria-valuemin={-100} aria-valuemax={100} aria-valuenow={row.meter}>
      <i style={style} />
    </span>
  );
}

/** One axis of the lab's stance: the low word, a track with the lab's marker, the high word. */
export function StanceTrack({ stance, className = "" }: { stance: StanceVM; className?: string }) {
  const at = `${Math.round(((stance.value + 1) / 2) * 100)}%`;
  return (
    <div className={`faction-stance ${className}`} role="meter" aria-label={`${stance.label}: ${stance.value}`} aria-valuemin={-1} aria-valuemax={1} aria-valuenow={stance.value}>
      <span className="lo">{stance.low}</span>
      <span className="track">
        <i style={{ left: at }} />
      </span>
      <span className="hi">{stance.high}</span>
    </div>
  );
}

/** Spread on a bubble's root: `data-faction` and `--faction` when it was said as a faction, nothing otherwise. */
export function factionAttrs(faction?: FactionChipVM | null): { "data-faction"?: string; style?: CSSProperties } {
  return faction ? { "data-faction": faction.id, style: tint(faction.color) } : {};
}

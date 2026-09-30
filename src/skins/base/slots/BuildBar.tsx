import { ICONS } from "../icons";
import { useT } from "../../context";
import type { SlotPropsMap } from "../../types";

/** The build palette: one button per tool, and a tip about the one in hand. */
export function BuildBar({ items, tip, actions }: SlotPropsMap["BuildBar"]) {
  const t = useT();
  return (
    <div className="buildwrap">
      {tip && (
        <div className="tip panel">
          <b>{tip.name}</b> · {tip.text} {tip.upkeepText && <span className="dim">{tip.upkeepText}</span>}
        </div>
      )}
      <div className="buildbar panel">
        {items.map((it) => (
          <button
            key={it.kind}
            className={`tool ${it.race ? "race" : ""} ${it.selected ? "on" : ""} ${it.affordable ? "" : "broke"}`}
            onClick={() => actions.place(it.kind)}
            disabled={!it.affordable && !it.selected}
            aria-pressed={it.selected}
            title={it.name}
          >
            <span className="hot">{it.hotkey ?? "·"}</span>
            <span className="icon">{ICONS[it.kind]}</span>
            <span className="tname">{it.short}</span>
            <span className={`price ${it.free ? "free" : ""}`}>{it.isBulldoze ? t("build.refund") : it.free ? t("build.free") : it.priceText}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

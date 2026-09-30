import { useT } from "../kit";
import type { SlotPropsMap } from "../types";
import { ToolIcon } from "./icons";

/**
 * The tool shelf: one round engraving per tool with its name and price in small capitals, the tool in hand dark and
 * lifted. A line of italic text above it says what the tool in hand does. It scrolls sideways when there are more
 * tools than screen.
 */
export function BuildBar({ items, tip, actions }: SlotPropsMap["BuildBar"]) {
  const t = useT();
  return (
    <div className="fa-shelfwrap">
      {tip && (
        <div className="fa-tip fa-paper" role="status">
          <i>{tip.name}</i> — {tip.text} {tip.upkeepText && <span className="dim">{tip.upkeepText}</span>}
        </div>
      )}
      <div className="fa-shelf fa-paper" role="toolbar" aria-label={t("build.menuTitle")}>
        {items.map((it) => (
          <button
            key={it.kind}
            className={`fa-tool ${it.selected ? "on" : ""} ${it.affordable ? "" : "poor"} ${it.race ? "race" : ""}`}
            onClick={() => actions.place(it.kind)}
            disabled={!it.affordable && !it.selected}
            aria-pressed={it.selected}
            title={it.name}
          >
            {it.hotkey !== null && <span className="fa-hot">{it.hotkey}</span>}
            <span className="fa-well">
              <ToolIcon kind={it.kind} />
            </span>
            <span className="fa-tname">{it.isBulldoze ? "Clear land" : it.short}</span>
            <span className={`fa-price ${it.free ? "free" : ""}`}>{it.isBulldoze ? t("build.refund") : it.free ? t("build.free") : it.priceText}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

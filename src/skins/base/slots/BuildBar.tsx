import { useEffect, useRef } from "react";
import { ICONS } from "../icons";
import { useHighlight, useT } from "../../context";
import type { SlotPropsMap } from "../../types";

/** The build palette: one button per tool, and a tip about the one in hand. */
export function BuildBar({ items, tip, actions }: SlotPropsMap["BuildBar"]) {
  const t = useT();
  const hl = useHighlight();
  const bar = useRef<HTMLDivElement>(null);
  // The tutorial points at a tool ("build:hall", or "staff:hire" for the Staff tile) until it is in hand.
  const pointedAt = (kind: string) => (hl(`build:${kind}`) || (kind === "staff" && hl("staff:hire"))) && !items.find((i) => i.kind === kind)?.selected;
  const target = items.find((it) => pointedAt(it.kind))?.kind ?? null;
  // The bar scrolls sideways on a phone: bring the tool it points at into view.
  useEffect(() => {
    if (target) bar.current?.querySelector<HTMLElement>(`[data-kind="${target}"]`)?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [target]);
  return (
    <div className="buildwrap">
      {tip && (
        <div className="tip panel">
          <b>{tip.name}</b> · {tip.text} {tip.upkeepText && <span className="dim">{tip.upkeepText}</span>}
        </div>
      )}
      <div className="buildbar panel" ref={bar}>
        {items.map((it) => (
          <button
            key={it.kind}
            data-kind={it.kind}
            className={`tool ${it.kind === "staff" ? "staff-tool" : ""} ${it.race ? "race" : ""} ${it.selected ? "on" : ""} ${it.affordable ? "" : "broke"} ${pointedAt(it.kind) ? "flt-hl" : ""}`}
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

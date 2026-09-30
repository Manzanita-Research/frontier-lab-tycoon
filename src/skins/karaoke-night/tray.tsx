// The arcade: every build tool is a round button with a little LCD under it for the name and the price. The tool in hand
// is pressed down and ringed in white; one you cannot afford goes grey.
import type { CSSProperties } from "react";
import { useT } from "../context";
import type { SlotPropsMap } from "../types";
import { BuildIcon, buttonColours, D } from "./art";

export function BuildBar({ items, tip, actions }: SlotPropsMap["BuildBar"]) {
  const t = useT();
  return (
    <div className="kn-buildwrap">
      {tip && (
        <div className="kn-tip" role="status">
          <b>
            <D>{tip.name}</D>
          </b>
          <span>{tip.text}</span>
          {tip.upkeepText && <small>{tip.upkeepText}</small>}
        </div>
      )}
      <div className="kn-tray kn-plastic" role="toolbar" aria-label={t("build.menuTitle")}>
        {items.map((it) => {
          const [face, rim] = buttonColours(it.kind);
          return (
            <button
              key={it.kind}
              type="button"
              className={`kn-ab ${it.selected ? "on" : ""} ${it.affordable ? "" : "poor"} ${it.race ? "race" : ""}`}
              style={{ "--c": face, "--cd": rim } as CSSProperties}
              onClick={() => actions.place(it.kind)}
              disabled={!it.affordable && !it.selected}
              aria-pressed={it.selected}
              aria-label={`${it.name}, ${it.isBulldoze ? t("build.refund") : it.free ? t("build.free") : it.priceText}`}
              title={it.blurb ?? it.name}
            >
              <span className="kn-btnr">
                <BuildIcon kind={it.kind} />
                {it.hotkey !== null && <span className="kn-k">{it.hotkey}</span>}
              </span>
              <span className="kn-lcd">
                <b>{it.short}</b>
                <span className={it.free ? "free" : ""}>
                  <D>{it.isBulldoze ? "50% BACK" : it.free ? t("build.free") : it.priceText.toUpperCase()}</D>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

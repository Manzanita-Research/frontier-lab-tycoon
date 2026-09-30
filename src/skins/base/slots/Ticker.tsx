import { Marquee } from "../../kit";
import { useT } from "../../context";
import type { SlotPropsMap } from "../../types";

/** Endless news tape along the bottom of the screen. */
export function Ticker({ items }: SlotPropsMap["Ticker"]) {
  const t = useT();
  return (
    <div className="ticker" aria-label={t("ticker.aria")}>
      <div className="ticker-tag">{t("ticker.label")}</div>
      <div className="ticker-view">
        <Marquee items={items} className="ticker-track" />
      </div>
    </div>
  );
}

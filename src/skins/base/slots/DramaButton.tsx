import { useT } from "../../context";
import { DramaIcon } from "../../kit/DramaIcon";
import type { SlotPropsMap } from "../../types";

/** Today's Drama: a pill by the News Room, with NEW on a pack the player hasn't opened and ON AIR while one is playing. */
export function DramaButton({ drama, actions }: SlotPropsMap["DramaButton"]) {
  const t = useT();
  return (
    <button className={`drama-button panel${drama.fresh ? " fresh" : ""}`} onClick={() => actions.openDrama()} aria-label={t("drama.open")} title={t("drama.open")}>
      <DramaIcon /> <span>{t("drama.button")}</span>
      {drama.on ? <b className="drama-badge on">{t("drama.on")}</b> : drama.fresh && <b className="drama-badge">{t("drama.new")}</b>}
    </button>
  );
}

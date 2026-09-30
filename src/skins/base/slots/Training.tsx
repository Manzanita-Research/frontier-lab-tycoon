import { useCoach, useT } from "../../context";
import type { SlotPropsMap } from "../../types";

/** The training chip: which model is cooking and how far along it is. */
export function Training({ training }: SlotPropsMap["Training"]) {
  const t = useT();
  const coach = useCoach();
  if (!training.hasHall) {
    return (
      <div className="chip panel" {...coach.attrs("training")}>
        <div className="chip-title">{t("training.noHall")}</div>
      </div>
    );
  }
  return (
    <div className="chip panel" {...coach.attrs("training")}>
      <div className="chip-title">
        {t("training.title")} <b>{training.name}</b> · {training.pctText}
      </div>
      <div className="bar">
        <span style={{ width: `${Math.floor(training.pct * 100)}%` }} />
      </div>
      <div className="chip-sub">{training.computePerDay > 0 ? t("training.compute", { n: training.computePerDay }) : t("training.noCompute")}</div>
    </div>
  );
}

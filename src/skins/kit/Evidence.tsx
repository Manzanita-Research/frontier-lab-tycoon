import { useT } from "../context";
import type { InvestigationVM } from "../../ui/hud/types";

/**
 * The collusion-sign card's evidence: how far the scores are up, the packet log, and who would go and look. Plain
 * semantic classes (`evidence-*`) so a skin dresses it from its own CSS; every skin's EventCard draws it when
 * `event.investigation` is set.
 */
export function Evidence({ investigation }: { investigation: InvestigationVM }) {
  const t = useT();
  return (
    <div className="evidence">
      <div className="evidence-top">
        <span>
          {t("inv.bonus")} <b className="evidence-bonus">{investigation.bonusText}</b>
        </span>
        <span className={investigation.guards === 0 ? "evidence-none" : ""}>{investigation.guardsText}</span>
      </div>
      <div className="evidence-label">{t("inv.log")}</div>
      <pre className="evidence-log">{investigation.log.join("\n")}</pre>
      <small className="evidence-note">{investigation.note}</small>
    </div>
  );
}

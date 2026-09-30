import { useT } from "../../context";
import type { SlotPropsMap } from "../../types";

/**
 * The sign over the auditors' heads (or over the gate during the countdown): what they are doing, and a progress bar
 * while they stand at a stop. The game pins it to the group every frame; only drawn while `audit.line` is set.
 */
export function AuditPin({ audit }: SlotPropsMap["AuditPin"]) {
  const t = useT();
  return (
    <div className={`audit-pin ${audit.evals ? "audit-evals" : ""}`}>
      <span className="audit-pin-who">{t("audit.who")}</span>
      <span className="audit-pin-line">
        {audit.line}
        {audit.stopsText && <span className="audit-pin-stops"> · {audit.stopsText}</span>}
      </span>
      {audit.progress !== null && (
        <span className="audit-pin-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(audit.progress * 100)}>
          <i style={{ width: audit.progressText }} />
        </span>
      )}
    </div>
  );
}

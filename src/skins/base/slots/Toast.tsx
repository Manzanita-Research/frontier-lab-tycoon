import { SnagCopy, useT } from "../../kit";
import type { SlotPropsMap } from "../../types";

/**
 * One toast. A click dismisses it early (the game also expires each one after about five seconds). A hint is a standing
 * tip and a warning is a standing problem ("your entrance isn't connected"): neither can be dismissed, they go when it is fixed.
 */
export function Toast({ toast, actions }: SlotPropsMap["Toast"]) {
  const t = useT();
  if (toast.snag) {
    // The recovery toast (FLT-84): the game caught an error and kept going. A div, so its two buttons aren't inside a third.
    return (
      <div className="toast panel bad snag" role="alert">
        <span>{t("snag.text")}</span>
        <SnagCopy id={toast.id} actions={actions} />
        <button type="button" className="snag-ok" onClick={() => actions.dismissToast(toast.id)}>
          {t("snag.ok")}
        </button>
      </div>
    );
  }
  if (toast.tone === "hint" || toast.tone === "warn") {
    return (
      <div className={`toast panel ${toast.tone}`} role={toast.tone === "warn" ? "status" : undefined}>
        {toast.text}
      </div>
    );
  }
  return (
    <button className={`toast panel ${toast.tone}${toast.pinned ? " pinned" : ""}`} onClick={() => actions.dismissToast(toast.id)}>
      {toast.text}
    </button>
  );
}

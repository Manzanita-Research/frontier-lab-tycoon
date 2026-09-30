import type { SlotPropsMap } from "../../types";

/**
 * One toast. A click dismisses it early (the game also expires each one after about five seconds). A hint is a standing
 * tip and a warning is a standing problem ("your entrance isn't connected"): neither can be dismissed, they go when it is fixed.
 */
export function Toast({ toast, actions }: SlotPropsMap["Toast"]) {
  if (toast.tone === "hint" || toast.tone === "warn") {
    return (
      <div className={`toast panel ${toast.tone}`} role={toast.tone === "warn" ? "status" : undefined}>
        {toast.text}
      </div>
    );
  }
  return (
    <button className={`toast panel ${toast.tone}`} onClick={() => actions.dismissToast(toast.id)}>
      {toast.text}
    </button>
  );
}

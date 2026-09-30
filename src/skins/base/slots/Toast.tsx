import type { SlotPropsMap } from "../../types";

/** One toast. A click dismisses it early (the game also expires each one after about five seconds). */
export function Toast({ toast, actions }: SlotPropsMap["Toast"]) {
  if (toast.tone === "hint") return <div className="toast panel hint">{toast.text}</div>;
  return (
    <button className={`toast panel ${toast.tone}`} onClick={() => actions.dismissToast(toast.id)}>
      {toast.text}
    </button>
  );
}

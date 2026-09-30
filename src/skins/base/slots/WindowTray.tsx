import type { SlotPropsMap } from "../../types";

/** The taskbar's waiting room (FLT-54): windows the game opened while two were up, flashing, and panels with unread news. */
export function WindowTray({ tray, actions }: SlotPropsMap["WindowTray"]) {
  return (
    <div className="window-tray" role="group" aria-label="Waiting windows">
      {tray.map((item) => (
        <button key={item.id} type="button" className={`tray-item panel${item.flashing ? " flashing" : ""}`} onClick={() => actions.openTray(item.id)} title={item.unread > 0 ? `${item.label}: ${item.unread} new` : item.label}>
          <span>{item.label}</span>
          {item.unread > 0 && <b className="tray-unread" aria-label={`${item.unread} new`}>{item.unread > 9 ? "9+" : item.unread}</b>}
        </button>
      ))}
    </div>
  );
}

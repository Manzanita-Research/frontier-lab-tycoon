import { useT } from "../../context";
import type { SlotPropsMap } from "../../types";

export function Speed({ speed, actions }: SlotPropsMap["Speed"]) {
  const t = useT();
  return (
    <div className="speed panel" role="group" aria-label={t("speed.label")}>
      {speed.options.map((o) => (
        <button key={o.value} className={o.active ? "on" : ""} onClick={() => actions.setSpeed(o.value)} aria-label={t(o.key)}>
          {o.value === 0 ? (
            <span className="pause-icon">
              <i />
              <i />
            </span>
          ) : (
            t(`speed.short.${o.value}`)
          )}
        </button>
      ))}
    </div>
  );
}

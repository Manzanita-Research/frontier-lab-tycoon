import { useT } from "../../context";
import type { SlotPropsMap } from "../../types";

/** Pause / 1× / 3× / 10×, and under them a gentle "Paused" note whenever the game itself is holding time. */
export function Speed({ speed, pause, actions }: SlotPropsMap["Speed"]) {
  const t = useT();
  // A card says "Paused" itself, and the pause button already shows it is pressed.
  const note = pause.auto && pause.reason !== "card" ? pause.reason : null;
  return (
    <>
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
      {note && (
        <div className="pause-pill panel" role="status">
          <span className="pause-icon" aria-hidden>
            <i />
            <i />
          </span>
          <span>{t(`pause.${note}`)}</span>
        </div>
      )}
    </>
  );
}

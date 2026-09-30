import { useCoach, useT } from "../../context";
import { SpeedGlyph } from "../../kit/SpeedGlyph";
import type { SlotPropsMap } from "../../types";

export function Speed({ speed, actions }: SlotPropsMap["Speed"]) {
  const t = useT();
  const coach = useCoach();
  return (
    <div className="speed panel" role="group" aria-label={t("speed.label")}>
      {speed.options.map((o) => (
        <button key={o.value} className={o.active ? "on" : ""} {...(o.value === 3 ? coach.attrs("speed") : {})} onClick={() => actions.setSpeed(o.value)} aria-label={t(o.key)}>
          {o.value === 0 ? (
            <span className="pause-icon">
              <i />
              <i />
            </span>
          ) : (
            <SpeedGlyph value={o.value} />
          )}
        </button>
      ))}
    </div>
  );
}

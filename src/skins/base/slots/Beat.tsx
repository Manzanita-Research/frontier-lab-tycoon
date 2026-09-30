import type { SlotPropsMap } from "../../types";

/**
 * A camera beat (FLT-56): letterbox bars slide in over the docked HUD while the camera makes its move, with the kicker
 * up top and the caption below. Time keeps running; Skip (or Esc) ends it. Keyed by id, so a new beat slides in anew.
 * A beat may offer one button while it plays (the leak's "Bury it").
 */
export function Beat({ beat, actions }: SlotPropsMap["Beat"]) {
  return (
    <div key={beat.id} className={`beat beat-${beat.kind}`} role="status" aria-live="polite">
      <div className="beat-bar beat-top">
        <span className="beat-kicker">{beat.kicker}</span>
      </div>
      <div className="beat-bar beat-bottom">
        <div className="beat-words">
          <p className="beat-caption">{beat.caption}</p>
          {beat.sub && <p className="beat-sub">{beat.sub}</p>}
        </div>
        {beat.action && (
          <button className="beat-skip beat-action" disabled={!beat.action.enabled} onClick={() => actions.beatAction(beat.action!.id)}>
            {beat.action.label}
          </button>
        )}
        <button className="beat-skip" onClick={() => actions.skipBeat()} title="Esc">
          {beat.skipLabel}
        </button>
      </div>
    </div>
  );
}

import { useAutoPause } from "../../kit";
import type { SlotPropsMap } from "../../types";

/**
 * A trip (FLT-105): before it starts, one line ("Contains intense colour and motion. [Continue] [Skip]") with the game
 * held until the player answers; once they say yes, an "I've had enough" button that stays on screen until it is over.
 * The look itself is the host's. Nothing here moves.
 */
export function Trip({ trip, actions }: SlotPropsMap["Trip"]) {
  const asking = trip.consent === "ask";
  useAutoPause(actions, "trip", asking);
  if (asking)
    return (
      <div className="trip-warn" role="alertdialog" aria-label={trip.label} aria-describedby="trip-warn-text">
        <span id="trip-warn-text">{trip.warning}</span>
        <button type="button" className="trip-go" onClick={() => actions.tripContinue(trip.id)} autoFocus>
          {trip.continueLabel}
        </button>
        <button type="button" onClick={() => actions.tripSkip(trip.id)}>
          {trip.skipLabel}
        </button>
      </div>
    );
  if (trip.consent !== "on") return null;
  return (
    <button type="button" className="trip-enough" onClick={() => actions.tripEnough(trip.id)} title={trip.label}>
      {trip.enoughLabel}
    </button>
  );
}

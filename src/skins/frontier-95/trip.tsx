// FLT-105: the trip's warning, as a 1995 message box, and its "I've had enough" button, a plain raised button that
// stays put in the top right corner whatever the trip does to the windows. Neither one moves.
import { useAutoPause } from "../kit";
import type { SlotPropsMap } from "../types";
import { Btn, Win } from "./parts";
import { Ico } from "./icons";

export function Trip({ trip, actions }: SlotPropsMap["Trip"]) {
  const asking = trip.consent === "ask";
  useAutoPause(actions, "trip", asking);
  if (asking)
    return (
      <div className="f95-tripwarn">
        <Win className="f95-msgbox" title="Display Properties" icon="warn" role="alertdialog" label={`${trip.label}: ${trip.warning}`}>
          <div className="f95-msgbody">
            <Ico name="warn" size={36} />
            <p>{trip.warning}</p>
          </div>
          <div className="f95-row">
            <Btn def autoFocus onClick={() => actions.tripContinue(trip.id)}>
              {trip.continueLabel}
            </Btn>
            <Btn onClick={() => actions.tripSkip(trip.id)}>{trip.skipLabel}</Btn>
          </div>
        </Win>
      </div>
    );
  if (trip.consent !== "on") return null;
  return (
    <Btn className="f95-enough" onClick={() => actions.tripEnough(trip.id)} title={trip.label}>
      {trip.enoughLabel}
    </Btn>
  );
}

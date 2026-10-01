import { Dialog } from "../../kit";
import type { SlotPropsMap } from "../../types";

/** "Welcome back" (FLT-65): the lab you left, one click away, and the fresh garage behind it for anyone who'd rather. */
export function Welcome({ welcome, saves, actions }: SlotPropsMap["Welcome"]) {
  return (
    <Dialog label="Welcome back" close={actions.dismissWelcome} layerClass="news-backdrop saves-backdrop" dialogClass="news-dialog welcome-dialog">
      <div className="welcome-box">
        <p className="welcome-kicker">Welcome back</p>
        <h2>{welcome.lab} kept the lights on.</h2>
        <button className="welcome-continue" onClick={() => actions.continueSave()} disabled={saves.busy}>
          <b>Continue "{welcome.lab}"</b>
          <span>
            {welcome.date} · {welcome.label}, saved {welcome.ago}
          </span>
        </button>
        <button className="welcome-new" onClick={() => actions.dismissWelcome()} disabled={saves.busy}>
          New lab
        </button>
        {saves.status && <p className={`saves-status ${saves.status.tone}`}>{saves.status.text}</p>}
        <small>A new lab takes over the autosave after its first month. Keep this one in a slot (Save/Load) if you want both.</small>
      </div>
    </Dialog>
  );
}

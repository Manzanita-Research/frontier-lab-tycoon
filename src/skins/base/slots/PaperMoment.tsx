import { useT } from "../../context";
import { Dialog, PaperMomentBody, useAutoPause } from "../../kit";
import type { HudActions, PaperMomentVM } from "../../../ui/hud/types";
import type { SlotPropsMap } from "../../types";

export function MomentButtons({ moment, actions, className = "choice" }: { moment: PaperMomentVM; actions: HudActions; className?: string }) {
  return (
    <div className="moment-buttons">
      {moment.buttons.map((label, i) => (
        <button key={label} type="button" className={`${className} ${i === moment.buttons.length - 1 ? "plain" : ""}`} onClick={() => actions.dismissPaperMoment(moment.key)}>
          <span className="choice-text">
            <b>{label}</b>
          </span>
        </button>
      ))}
    </div>
  );
}

/** A paper moment: the arXive drop, getting scooped, or a Best Paper. Time is held while it is up; every button just closes it. */
export function PaperMoment({ moment, actions }: SlotPropsMap["PaperMoment"]) {
  const t = useT();
  useAutoPause(actions, "paper-moment", true);
  return (
    <Dialog label={moment.headline} close={() => actions.dismissPaperMoment(moment.key)} layerClass="modal-backdrop" dialogClass={`modal-card event-card paper-moment moment-${moment.kind} tone-${moment.kind === "scoop" ? "bad" : "good"}`}>
      <div className="card-stripe">
        <span>{t(`moment.${moment.kind}`)}</span>
      </div>
      <div className="card-body">
        <h2>{moment.headline}</h2>
        <PaperMomentBody moment={moment} />
        <MomentButtons moment={moment} actions={actions} />
      </div>
    </Dialog>
  );
}

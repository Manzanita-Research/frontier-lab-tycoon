import { useT } from "../../context";
import { Dialog } from "../../kit";
import type { SlotPropsMap } from "../../types";

/**
 * "This leaves 1.8 months of runway": a spend the game wants a second look at. Time is held while it is up. The safe answer
 * is the default one (it is focused, Escape and a click outside both give it).
 */
export function Confirm({ confirm, actions }: SlotPropsMap["Confirm"]) {
  const t = useT();
  return (
    <Dialog label={t("confirm.title")} close={() => actions.cancelSpend()} layerClass="modal-backdrop" dialogClass="modal-card event-card confirm-card tone-bad">
      <div className="card-stripe">
        <span>{t("confirm.stripe")}</span>
        <span className="paused">{t("event.paused")}</span>
      </div>
      <div className="card-body">
        <h2>{t("confirm.title")}</h2>
        <p>{confirm.message}</p>
        <p className="confirm-facts">
          {t("confirm.cost")}: <b>{confirm.costText}</b> · {t("confirm.runway")}: <b>{confirm.runwayText}</b>
        </p>
        <div className="choices">
          <button type="button" className="choice" onClick={() => actions.cancelSpend()}>
            <span className="choice-text">
              <b>{t("confirm.cancel")}</b>
            </span>
          </button>
          <button type="button" className="choice plain" onClick={() => actions.confirmSpend()}>
            <span className="choice-text">
              <b>{t("confirm.ok")}</b>
            </span>
          </button>
        </div>
      </div>
    </Dialog>
  );
}

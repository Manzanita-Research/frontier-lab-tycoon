import { useT } from "../../context";
import { Dialog } from "../../kit";
import type { SlotPropsMap } from "../../types";

/**
 * The base has no helper character: hints and toasts are the Toasts slot's job. It hosts one thing, the spend check ("this
 * leaves 1.8 months of runway"): a plain card, with the safe answer first. Time is held while it is up; Escape and a click
 * outside keep the runway.
 */
export function Assistant({ vm, actions }: SlotPropsMap["Assistant"]) {
  const t = useT();
  const confirm = vm.confirm;
  if (!confirm) return null;
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

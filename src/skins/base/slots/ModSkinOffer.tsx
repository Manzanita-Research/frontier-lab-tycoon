import { Dialog } from "../../kit";
import type { SlotPropsMap } from "../../types";

/** FLT-55: a mod brought a skin and would like to put it on. Nothing changes until the player says so; no is the easy way out. */
export function ModSkinOffer({ offer, actions }: SlotPropsMap["ModSkinOffer"]) {
  return (
    <Dialog label={`${offer.modName} brought a skin`} close={() => actions.declineSkinOffer()} layerClass="modal-backdrop" dialogClass="modal-card event-card confirm-card skin-offer">
      <div className="card-stripe">
        <span>A mod brought a skin</span>
      </div>
      <div className="card-body">
        <h2>Put on {offer.name}?</h2>
        {offer.preview && <img className="skin-offer-preview" src={offer.preview} alt={`${offer.name}, a preview`} />}
        <p>
          <b>{offer.modName}</b> would like to dress the lab as <b>{offer.name}</b>. {offer.description}
        </p>
        <p className="confirm-facts">You can change it any time in Display.</p>
        <div className="choices">
          <button type="button" className="choice" autoFocus onClick={() => actions.acceptSkinOffer()}>
            <span className="choice-text">
              <b>Put it on</b>
            </span>
          </button>
          <button type="button" className="choice plain" onClick={() => actions.declineSkinOffer()}>
            <span className="choice-text">
              <b>Keep this one</b>
            </span>
          </button>
        </div>
      </div>
    </Dialog>
  );
}

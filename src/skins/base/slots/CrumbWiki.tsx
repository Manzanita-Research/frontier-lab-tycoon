import { CrumbWikiBody, Dialog, useAutoPause } from "../../kit";
import type { SlotPropsMap } from "../../types";

/** The reveal: what the agents were doing, on the wiki they were doing it on. Time is held while it is up. */
export function CrumbWiki({ wiki, actions }: SlotPropsMap["CrumbWiki"]) {
  useAutoPause(actions, "crumbwiki", true);
  return (
    <Dialog label={wiki.site} close={() => actions.closeCrumbWiki(wiki.key)} layerClass="modal-backdrop" dialogClass={`modal-card crumbwiki tone-${wiki.tone}`}>
      <div className="wiki-url">{wiki.url}</div>
      <div className="card-body">
        <CrumbWikiBody wiki={wiki} />
        <div className="choices">
          <button type="button" className="choice" onClick={() => actions.closeCrumbWiki(wiki.key)}>
            <span className="choice-text">
              <b>{wiki.closeLabel}</b>
            </span>
          </button>
        </div>
      </div>
    </Dialog>
  );
}

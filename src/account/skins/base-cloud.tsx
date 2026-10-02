import { createPortal } from "react-dom";
import { Dialog } from "../../skins/kit/Dialog";
import type { CloudActions, CloudSlotVM, CloudVM } from "../cloud/controller";
import { useHost } from "../host";

const label = (slot: string) => (slot === "auto" ? "Autosave" : `Slot ${slot}`);

/** Cloud saves for skins without their own (FLT-67): a ☁ list under the slots, and a Continue in "Welcome back". */
export function BaseCloud({ cloud, actions }: { cloud: CloudVM; actions: CloudActions }) {
  const list = useHost(() => after(".saves-box .saves-list"), "flt-cloud-saves", "div", cloud.on);
  const welcome = useHost(() => after(".welcome-box .welcome-continue"), "flt-cloud-welcome", "div", cloud.offerIn === "welcome");
  const offer = cloud.offer;
  return (
    <>
      {list && createPortal(<CloudList cloud={cloud} actions={actions} />, list)}
      {offer && welcome && createPortal(<ContinueButton offer={offer} cloud={cloud} actions={actions} />, welcome)}
      {offer && cloud.offerIn === "alone" && (
        <Dialog label="Welcome back" close={actions.dismiss} layerClass="news-backdrop saves-backdrop" dialogClass="news-dialog welcome-dialog">
          <div className="welcome-box">
            <p className="welcome-kicker">Welcome back</p>
            <h2>{offer.lab} is waiting in the cloud.</h2>
            <ContinueButton offer={offer} cloud={cloud} actions={actions} />
            <button className="welcome-new" onClick={actions.dismiss} disabled={cloud.busy}>
              New lab
            </button>
            {cloud.status?.tone === "bad" && <p className="saves-status bad">{cloud.status.text}</p>}
          </div>
        </Dialog>
      )}
    </>
  );
}

const after = (selector: string) => {
  const el = document.querySelector(selector);
  return el?.parentElement ? { parent: el.parentElement, before: el.nextSibling } : null;
};

function ContinueButton({ offer, cloud, actions }: { offer: CloudSlotVM; cloud: CloudVM; actions: CloudActions }) {
  return (
    <button className="welcome-continue flt-cloud-continue" onClick={() => actions.load(offer.slot)} disabled={cloud.busy}>
      <b>☁ Continue "{offer.lab}" from the cloud</b>
      <span>
        {offer.date} · {label(offer.slot)}, saved {offer.ago}
      </span>
    </button>
  );
}

function CloudList({ cloud, actions }: { cloud: CloudVM; actions: CloudActions }) {
  return (
    <div className="flt-cloud-list" data-testid="cloud-saves">
      <b className="saves-label">☁ In the cloud</b>
      <ol className="saves-list">
        {cloud.slots.map((s) => (
          <li key={s.slot}>
            <span className="saves-label">☁ {label(s.slot)}</span>
            <span className="saves-what">
              <b>{s.lab}</b> {s.date}
              <small>
                {s.ago} · {s.size}
              </small>
            </span>
            <span className="saves-buttons">
              <button onClick={() => actions.load(s.slot)} disabled={cloud.busy}>
                Load
              </button>
            </span>
          </li>
        ))}
        {cloud.slots.length === 0 && (
          <li className="empty">
            <span className="saves-what">
              <small>Nothing in the cloud yet. Your next save goes up.</small>
            </span>
          </li>
        )}
      </ol>
      {cloud.status && (
        <p className={`saves-status ${cloud.status.tone}`} role="status">
          {cloud.status.text}
        </p>
      )}
    </div>
  );
}

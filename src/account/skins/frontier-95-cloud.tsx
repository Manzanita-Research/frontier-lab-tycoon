import { useState } from "react";
import { createPortal } from "react-dom";
import { Ico } from "../../skins/frontier-95/icons";
import { Btn, Win } from "../../skins/frontier-95/parts";
import { fileName } from "../../skins/frontier-95/saves";
import { Dialog } from "../../skins/kit/Dialog";
import type { CloudActions, CloudSlotVM, CloudVM } from "../cloud/controller";
import { useHost } from "../host";

/**
 * Cloud saves in Frontier 95 (FLT-67): the Frontier Network is a network drive under the floppy in Save As / Open, and
 * "Welcome back" gets a Continue from it when it has a newer lab than this computer.
 */
export function Frontier95Cloud({ cloud, actions, handle }: { cloud: CloudVM; actions: CloudActions; handle: string }) {
  const drive = useHost(() => after(".f95-saves .f95-savebody"), "flt-cloud-drive", "div", cloud.on);
  const side = useHost(() => last(".f95-welcome .f95-welcome-side"), "flt-cloud-side", "div", cloud.offerIn === "welcome");
  const tip = useHost(() => after(".f95-welcome .f95-welcome-tip"), "flt-cloud-tip", "div", cloud.offerIn === "welcome");
  const offer = cloud.offer;
  return (
    <>
      {drive && createPortal(<Drive cloud={cloud} actions={actions} handle={handle} />, drive)}
      {offer && side && createPortal(
        <Btn onClick={() => actions.load(offer.slot)} disabled={cloud.busy}>
          ☁ Continue from the cloud
        </Btn>,
        side,
      )}
      {offer && tip && createPortal(
        <div className="f95-welcome-tip inset f95-cloud-tip">
          <Ico name="net" size={36} />
          <div>
            <b>A newer lab is on the Frontier Network.</b>
            <p>
              <b>{offer.lab}</b>, {offer.date}. Saved {offer.ago} on ☁ {fileName(offer.slot)} ({offer.size}).
            </p>
          </div>
        </div>,
        tip,
      )}
      {offer && cloud.offerIn === "alone" && <Alone offer={offer} cloud={cloud} actions={actions} />}
    </>
  );
}

const after = (selector: string) => {
  const el = document.querySelector(selector);
  return el?.parentElement ? { parent: el.parentElement, before: el.nextSibling } : null;
};
const last = (selector: string) => {
  const el = document.querySelector(selector);
  return el ? { parent: el, before: null } : null;
};

/** The network drive: the cloud's saves as files, double-click (or Open) to load one. */
function Drive({ cloud, actions, handle }: { cloud: CloudVM; actions: CloudActions; handle: string }) {
  const [sel, setSel] = useState<string | null>(null);
  const row = cloud.slots.find((s) => s.slot === sel) ?? cloud.slots[0] ?? null;
  return (
    <div className="f95-cloud">
      <div className="f95-savein">
        <span>Network:</span>
        <span className="f95-combo inset">
          <Ico name="net" size={16} /> \\FRONTIER\LABS ({handle})
        </span>
      </div>
      <div className="f95-savebody">
        <div className="f95-savelist inset" role="listbox" aria-label="Cloud saves" data-testid="cloud-saves">
          <div className="f95-saverow head" aria-hidden>
            <span>Name</span>
            <span>Lab</span>
            <span>Date</span>
            <span>Saved</span>
            <span className="size">Size</span>
          </div>
          {cloud.slots.map((s) => (
            <CloudRow key={s.slot} s={s} on={s.slot === row?.slot} pick={() => setSel(s.slot)} open={() => actions.load(s.slot)} />
          ))}
          {cloud.slots.length === 0 && (
            <div className="f95-saverow empty" aria-hidden>
              <span className="name">
                <Ico name="net" size={16} />
                <i>(nothing here yet)</i>
              </span>
            </div>
          )}
        </div>
        <div className="f95-saveside">
          <Btn onClick={() => row && actions.load(row.slot)} disabled={!row || cloud.busy}>
            Open
          </Btn>
        </div>
      </div>
      {cloud.status && (
        <p className={`f95-hint f95-cloud-status ${cloud.status.tone === "bad" ? "warn" : ""}`} role="status">
          {cloud.status.text}
        </p>
      )}
    </div>
  );
}

function CloudRow({ s, on, pick, open }: { s: CloudSlotVM; on: boolean; pick: () => void; open: () => void }) {
  return (
    <div role="option" aria-selected={on} tabIndex={0} className={`f95-saverow ${on ? "on" : ""}`} onClick={pick} onDoubleClick={open} onKeyDown={(e) => e.key === "Enter" && open()}>
      <span className="name">
        <span className="f95-cloud-mark" aria-label="In the cloud">
          ☁
        </span>
        {fileName(s.slot)}
      </span>
      <span>{s.lab}</span>
      <span>{s.date}</span>
      <span>{s.ago}</span>
      <span className="size">{s.size}</span>
    </div>
  );
}

/** "Welcome back" for a computer with no saves of its own: the lab is on the network. */
function Alone({ offer, cloud, actions }: { offer: CloudSlotVM; cloud: CloudVM; actions: CloudActions }) {
  return (
    <Dialog label="Welcome back" close={actions.dismiss} layerClass="f95-layer f95-dim" dialogClass="f95-dialogbox">
      <Win className="f95-welcome" title="Welcome" icon="net" buttons={[{ g: "close", label: "Close", onClick: actions.dismiss }]}>
        <div className="f95-welcome-body">
          <div className="f95-welcome-main">
            <h2>
              Welcome back to <b>Frontier</b> 95
            </h2>
            <div className="f95-welcome-tip inset f95-cloud-tip">
              <Ico name="net" size={36} />
              <div>
                <b>Your lab is on the Frontier Network.</b>
                <p>
                  <b>{offer.lab}</b>, {offer.date}. Saved {offer.ago} on ☁ {fileName(offer.slot)} ({offer.size}).
                </p>
                <p className="f95-hint">Did you know... this computer has never seen it. It is about to.</p>
              </div>
            </div>
            {cloud.status?.tone === "bad" && <p className="f95-hint warn">{cloud.status.text}</p>}
          </div>
          <div className="f95-welcome-side">
            <Btn def onClick={() => actions.load(offer.slot)} disabled={cloud.busy}>
              ☁ Continue from the cloud
            </Btn>
            <Btn onClick={actions.dismiss} disabled={cloud.busy}>
              New lab
            </Btn>
          </div>
        </div>
        <p className="f95-welcome-small">A new lab stays off the network's AUTOSAVE.FLT until it is further along than this one. Save it to a slot to send it up sooner.</p>
      </Win>
    </Dialog>
  );
}

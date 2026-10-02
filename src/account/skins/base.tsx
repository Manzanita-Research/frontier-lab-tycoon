import { Dialog } from "../../skins/kit/Dialog";
import type { AccountSkinProps } from "../types";
import { BaseCloud } from "./base-cloud";

/**
 * The sign-in for skins that haven't drawn their own yet: a small "Log on" chip in a corner and the base event-card
 * look for the windows, so it takes each skin's tokens (colours, fonts, radii) without knowing anything about it.
 */
export function BaseAccount({ vm, actions, cloud, cloudActions }: AccountSkinProps) {
  const player = vm.status === "member" ? vm.player : null;
  return (
    <>
      <BaseCloud cloud={cloud} actions={cloudActions} />
      <button
        type="button"
        className="flt-account-chip"
        data-testid="account-chip"
        disabled={vm.status === "loading"}
        onClick={() => actions.open(player ? "member" : "logon")}
      >
        {player?.image && <img src={player.image} alt="" width={20} height={20} referrerPolicy="no-referrer" />}
        <span>{player ? (player.handle ? `@${player.handle}` : player.name) : "Log on"}</span>
      </button>
      {vm.open && (
        <Dialog
          label={vm.open === "logon" ? "Log on" : vm.open === "delete" ? "Delete account" : "Your account"}
          close={vm.open === "delete" ? () => actions.open("member") : actions.close}
          layerClass="modal-backdrop flt-account-layer"
          dialogClass={`modal-card event-card flt-account-card ${vm.open === "delete" ? "tone-bad" : ""}`}
        >
          <div className="card-stripe">
            <span>{vm.open === "logon" ? "Log on" : "Your account"}</span>
          </div>
          <div className="card-body">
            {vm.open === "logon" && (
              <>
                <h2>Keep your labs in the cloud</h2>
                <p>Log on with your Hugging Face account and pick your labs up on any computer.</p>
              </>
            )}
            {vm.open === "member" && player && (
              <>
                <h2>{player.name}</h2>
                <p>You are logged on{player.handle ? ` as @${player.handle}` : ""} with Hugging Face.</p>
                {cloud.status && <p className="flt-account-fine">{cloud.status.text}</p>}
              </>
            )}
            {vm.open === "delete" && (
              <>
                <h2>Delete your account?</h2>
                <p>Your account and every lab saved on it go at once. This can't be undone. Labs saved on this computer stay here.</p>
              </>
            )}
            {vm.notice && (
              <p className="flt-account-notice" role="alert">
                {vm.notice}
              </p>
            )}
            {vm.open !== "delete" && <p className="flt-account-fine">{vm.privacy}</p>}
            <div className="choices">
              {vm.open === "logon" && (
                <Choice label={vm.busy ? "Connecting…" : "Log on with Hugging Face"} disabled={vm.busy} onClick={actions.logOn} />
              )}
              {vm.open === "member" && (
                <>
                  <Choice label="Done" onClick={actions.close} />
                  <Choice label="Log off" disabled={vm.busy} onClick={actions.logOff} plain />
                  <Choice label="Delete account…" disabled={vm.busy} onClick={() => actions.open("delete")} plain />
                </>
              )}
              {vm.open === "delete" && (
                <>
                  <Choice label="Keep my account" onClick={() => actions.open("member")} />
                  <Choice label="Delete it" disabled={vm.busy} onClick={actions.deleteAccount} plain />
                </>
              )}
              {vm.open === "logon" && <Choice label="Not now" onClick={actions.close} plain />}
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}

function Choice({ label, onClick, disabled, plain }: { label: string; onClick: () => void; disabled?: boolean; plain?: boolean }) {
  return (
    <button type="button" className={`choice ${plain ? "plain" : ""}`} disabled={disabled} onClick={onClick}>
      <span className="choice-text">
        <b>{label}</b>
      </span>
    </button>
  );
}

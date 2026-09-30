import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Ico } from "../../skins/frontier-95/icons";
import { Btn, Win } from "../../skins/frontier-95/parts";
import { Dialog } from "../../skins/kit/Dialog";
import type { AccountSkinProps } from "../types";

/**
 * Frontier 95's sign-in (FLT-67): "Log On to Frontier Network…" in the Start menu, just above Shut Down, the way a
 * networked desktop in 1998 had "Log Off Ada…" there. It opens a network log-on box; once you're on, the same item
 * says "Log Off @you…" and opens your account.
 */
export function Frontier95Account({ vm, actions }: AccountSkinProps) {
  const item = useStartMenuItem();
  const member = vm.status === "member" && vm.player;
  const label = member ? `Log Off ${vm.player?.handle ? `@${vm.player.handle}` : vm.player?.name}…` : "Log On to Frontier Network…";
  return (
    <>
      {item &&
        createPortal(
          <button
            type="button"
            role="menuitem"
            data-testid="start-account"
            disabled={vm.status === "loading"}
            onClick={() => {
              closeStartMenu();
              actions.open(member ? "member" : "logon");
            }}
          >
            <Ico name="net" size={24} />
            <span>{label}</span>
            <span className="hk" />
            <span className="p" />
          </button>,
          item,
        )}
      {vm.open === "logon" && <LogOn {...{ vm, actions }} />}
      {vm.open === "member" && <Member {...{ vm, actions }} />}
      {vm.open === "delete" && <ConfirmDelete {...{ vm, actions }} />}
    </>
  );
}

function LogOn({ vm, actions }: AccountSkinProps) {
  return (
    <Dialog label="Log On to Frontier Network" close={actions.close} layerClass="f95-layer f95-dim" dialogClass="f95-dialogbox">
      <Win title="Log On to Frontier Network" buttons={[{ g: "close", label: "Close", onClick: actions.close }]} className="f95-logon">
        <div className="f95-logon-body">
          <Ico name="net" size={40} />
          <div className="f95-logon-text">
            <p>Log on to keep your labs on the Frontier Network and pick them up on any computer.</p>
            <p>
              You log on with your <b>Hugging Face</b> account, so there is no password to make up.
            </p>
            {vm.notice && <Notice text={vm.notice} />}
            <p className="f95-logon-fine">{vm.privacy}</p>
          </div>
          <div className="f95-logon-buttons">
            <Btn def disabled={vm.busy} onClick={actions.logOn}>
              {vm.busy ? "Dialing…" : "Log On"}
            </Btn>
            <Btn onClick={actions.close}>Cancel</Btn>
          </div>
        </div>
      </Win>
    </Dialog>
  );
}

function Member({ vm, actions }: AccountSkinProps) {
  const player = vm.player;
  if (!player) return null;
  return (
    <Dialog label="Frontier Network" close={actions.close} layerClass="f95-layer f95-dim" dialogClass="f95-dialogbox">
      <Win title="Frontier Network" buttons={[{ g: "close", label: "Close", onClick: actions.close }]} className="f95-logon">
        <div className="f95-logon-body">
          {player.image ? <img className="f95-logon-avatar" src={player.image} alt="" width={40} height={40} referrerPolicy="no-referrer" /> : <Ico name="net" size={40} />}
          <div className="f95-logon-text">
            <p>
              You are logged on as <b>{player.name}</b>
              {player.handle && <> (@{player.handle})</>}.
            </p>
            {vm.notice && <Notice text={vm.notice} />}
            <p className="f95-logon-fine">{vm.privacy}</p>
          </div>
          <div className="f95-logon-buttons">
            <Btn def onClick={actions.close}>
              OK
            </Btn>
            <Btn disabled={vm.busy} onClick={actions.logOff}>
              Log Off
            </Btn>
            <Btn disabled={vm.busy} onClick={() => actions.open("delete")}>
              Delete…
            </Btn>
          </div>
        </div>
      </Win>
    </Dialog>
  );
}

/** Windows asked before it deleted a file; this asks before it deletes a founder. No is the default. */
function ConfirmDelete({ vm, actions }: AccountSkinProps) {
  const back = () => actions.open("member");
  return (
    <Dialog label="Confirm Account Delete" close={back} layerClass="f95-layer f95-dim" dialogClass="f95-dialogbox">
      <Win title="Confirm Account Delete" buttons={[{ g: "close", label: "Close", onClick: back }]} className="f95-msgbox f95-logon">
        <div className="f95-msgbody">
          <Ico name="warn" size={36} />
          <div>
            <p>Are you sure you want to delete your Frontier Network account and every lab saved on it?</p>
            <p className="f95-logon-fine">This can't be undone. Labs saved on this computer stay here.</p>
          </div>
        </div>
        <div className="f95-row">
          <Btn def onClick={back}>
            No
          </Btn>
          <Btn disabled={vm.busy} onClick={actions.deleteAccount}>
            Yes
          </Btn>
        </div>
      </Win>
    </Dialog>
  );
}

function Notice({ text }: { text: string }) {
  return (
    <p className="f95-logon-notice" role="alert">
      <Ico name="warn" size={16} /> {text}
    </p>
  );
}

const START_MENU = ".f95-startwrap .f95-menu > ul";

/**
 * A list item of our own in the open Start menu, kept just above its last item (Shut Down Lab…) as the menu's
 * submenus open and close. The menu belongs to the skin; this only adds to it, so builds without accounts are
 * untouched (when accounts are on for good, the item moves into the skin's BuildBar).
 */
function useStartMenuItem(): HTMLLIElement | null {
  const [item, setItem] = useState<HTMLLIElement | null>(null);
  useEffect(() => {
    const li = document.createElement("li");
    li.className = "flt-account-item";
    const place = () => {
      const ul = document.querySelector<HTMLUListElement>(START_MENU);
      if (!ul) {
        li.remove();
        setItem(null);
        return;
      }
      const last = [...ul.children].filter((c) => c !== li).at(-1) ?? null;
      if (li.parentElement !== ul || li.nextElementSibling !== last) ul.insertBefore(li, last);
      setItem(li);
    };
    const watch = new MutationObserver(place);
    watch.observe(document.body, { childList: true, subtree: true });
    place();
    return () => {
      watch.disconnect();
      li.remove();
    };
  }, []);
  return item;
}

/** The Start button toggles its menu: a click closes it the way the player would. */
const closeStartMenu = () => document.querySelector<HTMLButtonElement>('[data-testid="start-button"][aria-expanded="true"]')?.click();

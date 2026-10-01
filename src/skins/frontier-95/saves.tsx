// Saving in Frontier 95 (FLT-65): the Welcome screen you got on first boot, and a Save As / Open dialog on a floppy
// that is really the browser's localStorage. Slots are files, deleting one goes to the Recycle Bin, and a .fltsave
// dragged onto the page is a disk put in the drive.
import { useState } from "react";
import { Dialog, ImportButton } from "../kit";
import type { SaveModPromptVM, SaveSlotVM, SavesVM, HudActions } from "../../ui/hud/types";
import type { SlotPropsMap } from "../types";
import { Ico } from "./icons";
import { Blocks, Btn, Win } from "./parts";

/** What the floppy calls a slot. */
export const fileName = (slot: string) => (slot === "auto" ? "AUTOSAVE.FLT" : `SLOT${slot}.FLT`);

/** Welcome back: Frontier 95's Welcome screen, with your lab where the tip of the day would be. */
export function Welcome({ welcome, saves, actions }: SlotPropsMap["Welcome"]) {
  return (
    <Dialog label="Welcome back" close={actions.dismissWelcome} layerClass="f95-layer f95-dim" dialogClass="f95-dialogbox">
      <Win className="f95-welcome" title="Welcome" icon="floppy" buttons={[{ g: "close", label: "Close", onClick: () => actions.dismissWelcome() }]}>
        <div className="f95-welcome-body">
          <div className="f95-welcome-main">
            <h2>
              Welcome back to <b>Frontier</b> 95
            </h2>
            <div className="f95-welcome-tip inset">
              <Ico name="floppy" size={36} />
              <div>
                <b>Your lab is where you left it.</b>
                <p>
                  <b>{welcome.lab}</b>, {welcome.date}. Saved {welcome.ago} on {fileName(welcome.slot)} ({welcome.size}).
                </p>
                <p className="f95-hint">Did you know... time stopped while you were away. Please don't tell the investors.</p>
              </div>
            </div>
            {saves.status && <p className={`f95-hint ${saves.status.tone === "bad" ? "warn" : ""}`}>{saves.status.text}</p>}
          </div>
          <div className="f95-welcome-side">
            <Btn def onClick={() => actions.continueSave()} disabled={saves.busy}>
              Continue
            </Btn>
            <Btn onClick={() => actions.dismissWelcome()} disabled={saves.busy}>
              New lab
            </Btn>
          </div>
        </div>
        <p className="f95-welcome-small">A new lab writes over AUTOSAVE.FLT after its first month. To keep both, Save it to a slot first (Start, then Save / Load…).</p>
      </Win>
    </Dialog>
  );
}

/** The mods question, as a message box with a yellow triangle. */
function ModBox({ prompt, actions }: { prompt: SaveModPromptVM; actions: HudActions }) {
  return (
    <div className="f95-msgbody f95-savemods" role="alertdialog" aria-label="This save uses other mods">
      <Ico name="warn" size={36} />
      <div>
        <h2>"{prompt.lab}" was saved with other mods.</h2>
        {prompt.missing.length > 0 && <p>It needs: {prompt.missing.join(", ")}.</p>}
        {prompt.extra.length > 0 && <p>It was made without: {prompt.extra.join(", ")}.</p>}
        {!prompt.canFetch && prompt.missing.length > 0 && <p className="f95-hint">The save doesn't say where its mods live. Things they added may go missing.</p>}
        <div className="f95-row left">
          {prompt.canFetch && (
            <Btn def onClick={() => actions.fetchModsAndLoad()}>
              Reload with its mods
            </Btn>
          )}
          <Btn def={!prompt.canFetch} onClick={() => actions.loadWithoutMods()}>
            Load anyway
          </Btn>
          <Btn onClick={() => actions.cancelModPrompt()}>Cancel</Btn>
        </div>
      </div>
    </div>
  );
}

function Row({ s, on, pick, open }: { s: SaveSlotVM; on: boolean; pick: () => void; open: () => void }) {
  return (
    <div role="option" aria-selected={on} tabIndex={0} className={`f95-saverow ${on ? "on" : ""} ${s.save ? "" : "empty"}`} onClick={pick} onDoubleClick={open} onKeyDown={(e) => e.key === "Enter" && open()}>
      <span className="name">
        <Ico name={s.save ? "floppy" : "doc"} size={16} />
        {fileName(s.slot)}
      </span>
      <span>{s.save ? s.save.lab : s.broken ? <i className="bad">{s.broken}</i> : <i>(empty)</i>}</span>
      <span>{s.save?.date ?? ""}</span>
      <span>{s.save?.ago ?? ""}</span>
      <span className="size">{s.save?.size ?? ""}</span>
    </div>
  );
}

function Floppy({ saves, actions }: { saves: SavesVM; actions: HudActions }) {
  const [sel, setSel] = useState(saves.slots.find((s) => s.slot !== "auto" && !s.save)?.slot ?? "1");
  const [bin, setBin] = useState<string | null>(null);
  const row = saves.slots.find((s) => s.slot === sel) ?? null;
  const load = (s: SaveSlotVM) => s.save && actions.loadFrom(s.slot);
  return (
    <>
      <div className="f95-savein">
        <span>Save in:</span>
        <span className="f95-combo inset">
          <Ico name="floppy" size={16} /> 3½ Floppy (A:)
        </span>
        <span className="f95-hint">Playing {saves.current.lab}, {saves.current.date}</span>
      </div>
      <div className="f95-savebody">
        <div className="f95-savelist inset" role="listbox" aria-label="Saves">
          <div className="f95-saverow head" aria-hidden>
            <span>Name</span>
            <span>Lab</span>
            <span>Date</span>
            <span>Saved</span>
            <span className="size">Size</span>
          </div>
          {saves.slots.map((s) => (
            <Row key={s.slot} s={s} on={s.slot === sel} pick={() => (setSel(s.slot), setBin(null))} open={() => load(s)} />
          ))}
        </div>
        <div className="f95-saveside">
          <Btn def onClick={() => row && actions.saveTo(row.slot)} disabled={!row || row.slot === "auto" || saves.busy || !saves.available} title={row?.slot === "auto" ? "The autosave writes itself" : undefined}>
            Save
          </Btn>
          <Btn onClick={() => row && load(row)} disabled={!row?.save || saves.busy}>
            Open
          </Btn>
          <Btn onClick={() => row && actions.exportSave(row.slot)} disabled={!row?.save || saves.busy}>
            Export…
          </Btn>
          <Btn onClick={() => row && setBin(row.slot)} disabled={!row || row.slot === "auto" || !(row.save || row.broken) || saves.busy}>
            Delete
          </Btn>
          <Btn onClick={() => actions.closeSaves()}>Cancel</Btn>
        </div>
      </div>
      {bin && (
        <div className="f95-msgbody f95-bin" role="alertdialog" aria-label="Confirm file delete">
          <Ico name="warn" size={36} />
          <div>
            <p>Are you sure you want to send '{fileName(bin)}' to the Recycle Bin?</p>
            <p className="f95-hint">(There is no Recycle Bin. It's gone for good.)</p>
            <div className="f95-row left">
              <Btn def onClick={() => (actions.deleteSave(bin), setBin(null))}>
                Yes
              </Btn>
              <Btn onClick={() => setBin(null)}>No</Btn>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Save/Load: File ▸ Save As, on a floppy that is really this browser. */
export function SaveLoad({ saves, actions }: SlotPropsMap["SaveLoad"]) {
  if (!saves.open && !saves.modPrompt)
    return saves.dragging ? (
      <div className="f95-dropveil" aria-hidden>
        <span>
          <Ico name="floppy" size={36} /> Drop the .fltsave to insert the disk
        </span>
      </div>
    ) : null;
  const close = saves.open ? actions.closeSaves : actions.cancelModPrompt;
  return (
    <Dialog label="Save / Load" close={close} layerClass="f95-layer f95-dim" dialogClass="f95-dialogbox">
      <Win className={`f95-saves ${saves.dragging ? "dragging" : ""}`} title="Save As / Open: 3½ Floppy (A:)" icon="floppy" buttons={[{ g: "close", label: "Close", onClick: () => close() }]}>
        {saves.modPrompt ? <ModBox prompt={saves.modPrompt} actions={actions} /> : <Floppy saves={saves} actions={actions} />}
        {!saves.modPrompt && (
          <>
            {!saves.available && (
              <p className="f95-hint warn">
                <Ico name="error" size={16} /> Drive A: is not ready. (This browser won't keep saves; private browsing?) Export still works.
              </p>
            )}
            <div className="f95-savedisk">
              <span>Disk space:</span>
              <Blocks value={saves.storage.used} label="Save space used" />
              <span>{saves.storage.text}</span>
            </div>
            <div className="f95-row left f95-saveio">
              <Btn onClick={() => actions.exportSave("current")} disabled={saves.busy}>
                Export this lab…
              </Btn>
              <ImportButton className="f95-btn f95-import" onFile={actions.importSave} disabled={saves.busy}>
                Import…
              </ImportButton>
              <span className="f95-hint">{saves.dragging ? "Let go to insert the disk." : "or drag a .fltsave onto the desktop"}</span>
            </div>
          </>
        )}
        <div className="f95-status" role="status">
          {saves.busy ? "Reading drive A:…" : (saves.status?.text ?? "Nothing leaves this computer.")}
        </div>
      </Win>
    </Dialog>
  );
}

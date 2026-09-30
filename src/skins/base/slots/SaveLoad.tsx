import { Dialog, ImportButton } from "../../kit";
import type { SaveModPromptVM, SavesVM, HudActions } from "../../../ui/hud/types";
import type { SlotPropsMap } from "../../types";

/** The question a save made with other mods asks before it loads. Shared by the window and a drop. */
function ModPrompt({ prompt, actions }: { prompt: SaveModPromptVM; actions: HudActions }) {
  return (
    <div className="saves-prompt" role="alertdialog" aria-label="This save uses other mods">
      <b>"{prompt.lab}" was saved with other mods.</b>
      {prompt.missing.length > 0 && <p>It needs: {prompt.missing.join(", ")}.</p>}
      {prompt.extra.length > 0 && <p>It was made without: {prompt.extra.join(", ")}.</p>}
      <div className="saves-row">
        {prompt.canFetch && (
          <button className="saves-primary" onClick={() => actions.fetchModsAndLoad()}>
            Reload with its mods
          </button>
        )}
        <button onClick={() => actions.loadWithoutMods()}>Load anyway</button>
        <button onClick={() => actions.cancelModPrompt()}>Cancel</button>
      </div>
      {!prompt.canFetch && prompt.missing.length > 0 && <small>The save doesn't say where its mods live, so they can't be fetched. Things they added may go missing.</small>}
    </div>
  );
}

function Slots({ saves, actions }: { saves: SavesVM; actions: HudActions }) {
  return (
    <ol className="saves-list">
      {saves.slots.map((s) => (
        <li key={s.slot} className={s.save ? "" : "empty"}>
          <span className="saves-label">{s.label}</span>
          {s.save ? (
            <span className="saves-what">
              <b>{s.save.lab}</b> {s.save.date}
              <small>
                {s.save.ago} · {s.save.size}
                {s.save.mods.length > 0 && ` · ${s.save.mods.length} mod${s.save.mods.length === 1 ? "" : "s"}`}
              </small>
            </span>
          ) : (
            <span className="saves-what">{s.broken ? <small className="bad">{s.broken}</small> : <small>Empty</small>}</span>
          )}
          <span className="saves-buttons">
            {s.slot !== "auto" && (
              <button onClick={() => actions.saveTo(s.slot)} disabled={saves.busy || !saves.available} title={s.save ? `Save over ${s.save.lab}` : undefined}>
                Save
              </button>
            )}
            {s.save && (
              <button onClick={() => actions.loadFrom(s.slot)} disabled={saves.busy}>
                Load
              </button>
            )}
            {s.save && (
              <button onClick={() => actions.exportSave(s.slot)} disabled={saves.busy} aria-label={`Export ${s.label}`}>
                Export
              </button>
            )}
            {(s.save || s.broken) && s.slot !== "auto" && (
              <button onClick={() => actions.deleteSave(s.slot)} disabled={saves.busy} aria-label={`Delete ${s.label}`}>
                ×
              </button>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Save/Load (FLT-65): three slots and the autosave, a file to take the lab anywhere, and a drop zone for one coming back. */
export function SaveLoad({ saves, actions }: SlotPropsMap["SaveLoad"]) {
  if (!saves.open) {
    if (saves.modPrompt)
      return (
        <Dialog label="This save uses other mods" close={actions.cancelModPrompt} layerClass="news-backdrop saves-backdrop" dialogClass="news-dialog saves-dialog">
          <div className="saves-box">
            <ModPrompt prompt={saves.modPrompt} actions={actions} />
          </div>
        </Dialog>
      );
    return saves.dragging ? (
      <div className="saves-drop-veil" aria-hidden>
        <b>Drop a .fltsave to load it</b>
      </div>
    ) : null;
  }
  return (
    <Dialog label="Save / Load" close={actions.closeSaves} layerClass="news-backdrop saves-backdrop" dialogClass="news-dialog saves-dialog">
      <div className={`saves-box${saves.dragging ? " dragging" : ""}`}>
        <div className="news-toolbar">
          <b>Save / Load</b>
          <button onClick={() => actions.closeSaves()} aria-label="Close saves">
            ×
          </button>
        </div>
        <p className="saves-now">
          Playing <b>{saves.current.lab}</b>, {saves.current.date}
        </p>
        {saves.modPrompt ? <ModPrompt prompt={saves.modPrompt} actions={actions} /> : <Slots saves={saves} actions={actions} />}
        {!saves.available && <p className="saves-status bad">This browser won't keep saves (private browsing?). Export still works.</p>}
        {saves.status && (
          <p className={`saves-status ${saves.status.tone}`} role="status">
            {saves.status.text}
          </p>
        )}
        <div className="saves-row">
          <button onClick={() => actions.exportSave("current")} disabled={saves.busy}>
            Export this lab
          </button>
          <ImportButton className="saves-import" onFile={actions.importSave} disabled={saves.busy}>
            Import…
          </ImportButton>
        </div>
        <small>
          {saves.dragging ? "Let go to load it." : "Or drop a .fltsave anywhere."} Saves stay in this browser ({saves.storage.text}); nothing is uploaded.
        </small>
      </div>
    </Dialog>
  );
}

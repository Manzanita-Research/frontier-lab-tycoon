import { Dialog } from "../../kit";
import type { SlotPropsMap } from "../../types";

/** The one example every build ships (FLT-37), so "how do I try a mod?" has a one-click answer. */
export const EXAMPLE_MOD = "?mod=/mods/examples/every-lab-is-steve/mod.json";

/**
 * Settings ▸ Mods…: the lab's mods (in order), what clashed, what failed. Mods come in through the address, or Today's
 * Drama (FLT-78). Remove takes a data-only mod out of the lab on screen; one that needs a fresh start says so, and reloads.
 */
export function ModManager({ mods, actions }: SlotPropsMap["ModManager"]) {
  return (
    <Dialog label="Mods" close={actions.closeMods} layerClass="news-backdrop mixer-backdrop" dialogClass="news-dialog">
      <div className="mixer-box mod-box">
        <div className="news-toolbar">
          <b>Mods</b>
          <button onClick={() => actions.closeMods()} aria-label="Close mods">
            ×
          </button>
        </div>
        {mods.list.length === 0 ? (
          <p className="mixer-intro">No mods loaded. Every lab is still itself.</p>
        ) : (
          <ol className="mod-list">
            {mods.list.map((m) => (
              <li key={m.id}>
                <button className="mod-off" onClick={() => actions.removeMod(m.id)} title={m.needsRestart ? "Reloads without it: a new lab" : "Takes it out of this lab, no reload"}>
                  {m.needsRestart ? "Remove (new lab)" : "Remove"}
                </button>
                <b>{m.name}</b> <span>v{m.version}</span>
                {m.description && <small>{m.description}</small>}
                {m.needsRestart && <small>{m.needsRestart}</small>}
                <code>
                  {m.id} · #{m.hash}
                </code>
              </li>
            ))}
          </ol>
        )}
        {mods.conflicts.length > 0 && (
          <div className="mod-note">
            <b>Clashes</b> (the later mod wins)
            {mods.conflicts.map((c) => (
              <code key={c}>{c}</code>
            ))}
          </div>
        )}
        {mods.errors.length > 0 && (
          <div className="mod-note bad">
            <b>Didn't load</b>
            {mods.errors.map((e) => (
              <code key={e}>{e}</code>
            ))}
          </div>
        )}
        <small>
          Mods load from the address: add <code>?mod=</code> and the URL of a <code>mod.json</code>, then reload. Try{" "}
          <a href={EXAMPLE_MOD}>Every Lab Is Named Steve</a>.{mods.contentHash && ` This run's content: #${mods.contentHash}.`}
        </small>
      </div>
    </Dialog>
  );
}

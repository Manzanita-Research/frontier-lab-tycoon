import { useT } from "../../context";
import { Dialog } from "../../kit";
import type { SlotPropsMap } from "../../types";

/** Help ▸ How to play: the loop in five lines, one line for each building you have unlocked, and what the numbers mean. */
export function HowToPlay({ help, actions }: SlotPropsMap["HowToPlay"]) {
  const t = useT();
  return (
    <Dialog label={help.title} close={() => actions.closeHelp()} layerClass="modal-backdrop" dialogClass="modal-card help-card">
      <div className="card-stripe">
        <span>{help.title}</span>
        <button type="button" className="help-x" onClick={() => actions.closeHelp()} aria-label={t("help.close")}>
          ×
        </button>
      </div>
      <div className="card-body help-body">
        <h3>{t("help.loop")}</h3>
        <ol>
          {help.loop.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
        <h3>{t("help.buildings")}</h3>
        <ul>
          {help.buildings.map((b) => (
            <li key={b.kind}>{b.line}</li>
          ))}
        </ul>
        <h3>{t("help.numbers")}</h3>
        <dl>
          {help.numbers.map((n) => (
            <div key={n.name}>
              <dt>{n.name}</dt>
              <dd>{n.line}</dd>
            </div>
          ))}
        </dl>
        <div className="help-buttons">
          <button type="button" className="choice plain" onClick={() => actions.coachReplay()}>
            <b>{t("help.replay")}</b>
          </button>
          <button type="button" className="choice plain" onClick={() => actions.openBox()}>
            <b>{t("help.box")}</b>
          </button>
          <button type="button" className="choice" onClick={() => actions.closeHelp()}>
            <b>{t("help.close")}</b>
          </button>
        </div>
      </div>
    </Dialog>
  );
}

import { useAutoPause } from "../../kit";
import type { SlotPropsMap } from "../../types";

/** The Memo (FLT-57): a countdown pill while it's coming, then an extra edition the moment a box is ticked. */
export function Memo({ memo, layout, actions }: SlotPropsMap["Memo"]) {
  const extra = memo.phase === "extra" ? memo.extra : null;
  useAutoPause(actions, "memo-extra", !!extra);
  if (!extra) {
    return (
      <div className={`memo-countdown ${memo.daysLeft <= 1 ? "soon" : ""}`} role="status">
        <b>
          <span aria-hidden>📄</span> {memo.title}
        </b>
        <small>{memo.line}</small>
      </div>
    );
  }
  return (
    <div className="modal-backdrop memo-backdrop">
      <article className={`memo-extra front-page ${layout.compact ? "compact" : ""}`} role="dialog" aria-modal="true" aria-label={extra.headline}>
        <div className="paper-eyebrow">
          <span>{extra.kicker}</span>
          <span>The box marked {extra.choice.toUpperCase()}</span>
          <span>Late edition</span>
        </div>
        <h1 className="masthead">{extra.masthead}</h1>
        <span className="memo-extra-flag" aria-hidden>
          {extra.kicker}
        </span>
        <h2>{extra.headline}</h2>
        <p className="paper-deck">{extra.deck}</p>
        {extra.reactions.length > 0 && (
          <div className="memo-reactions">
            <span className="paper-section">Reactions from campus</span>
            {extra.reactions.map((r) => (
              <blockquote key={r.name}>
                <p>“{r.text}”</p>
                <cite>
                  {r.name}, {r.role}
                </cite>
              </blockquote>
            ))}
          </div>
        )}
        <div className="memo-effects">
          <span className="paper-section">From now on</span>
          <ul>
            {extra.effects.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
        <button className="choice plain primary" onClick={() => actions.dismissMemo?.(memo.key)} autoFocus>
          <b>Back to work</b>
        </button>
      </article>
    </div>
  );
}

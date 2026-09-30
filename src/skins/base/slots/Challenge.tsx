import { useAutoPause } from "../../kit";
import type { SlotPropsMap } from "../../types";

/** A friend's challenge (FLT-57): their result, on their seed, and a button that says what you're about to do. */
export function Challenge({ challenge, layout, actions }: SlotPropsMap["Challenge"]) {
  useAutoPause(actions, "challenge", true);
  return (
    <div className="modal-backdrop challenge-backdrop">
      <div className={`challenge tone-${challenge.tone} ${layout.compact ? "compact" : ""}`} role="dialog" aria-modal="true" aria-label={`${challenge.line} ${challenge.ask}`}>
        <span className="paper-section">{challenge.daily ?? "A challenge"}</span>
        <p className="challenge-line">{challenge.line}</p>
        <h2>{challenge.ask}</h2>
        <div className="challenge-result">
          <span className="challenge-stamp">{challenge.ending}</span>
          <small>{challenge.stats}</small>
        </div>
        <p className="challenge-note">Same seed, same campus. Nobody else's name in the link.</p>
        <button className="choice plain primary" onClick={() => actions.dismissChallenge?.()} autoFocus>
          <b>{challenge.cta}</b>
        </button>
      </div>
    </div>
  );
}

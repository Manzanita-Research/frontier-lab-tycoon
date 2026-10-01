import { useT } from "../../context";
import type { SlotPropsMap } from "../../types";

/** The small "New!" card that comes with a level-up: what you can build now. Dismiss it and play on; the game never waits for it. */
export function UnlockCard({ unlock, actions }: SlotPropsMap["UnlockCard"]) {
  const t = useT();
  return (
    <aside className="unlock-card panel" role="status" aria-label={unlock.title}>
      <div className="unlock-burst" aria-hidden>
        <span>NEW!</span>
      </div>
      <div className="unlock-body">
        <h2>{unlock.title}</h2>
        <p>{unlock.body}</p>
        {unlock.items.length > 0 && (
          <ul className="unlock-items">
            {unlock.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
        {unlock.quip && <p className="unlock-quip">{unlock.quip}</p>}
        <button type="button" className="unlock-ok" autoFocus onClick={() => actions.dismissUnlock()}>
          {t("unlock.ok")}
        </button>
      </div>
    </aside>
  );
}

import { useT } from "../../context";
import type { SlotPropsMap } from "../../types";

/**
 * The small "New!" card that comes with a level-up: what you can build now, by kind (FLT-93), each with a Show me. Dismiss
 * it and play on; the game never waits for it.
 */
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
        {unlock.groups?.length ? (
          <div className="unlock-groups">
            {unlock.groups.map((g) => (
              <section key={g.id} className={`unlock-group ${g.id}`}>
                <h3>{g.title}</h3>
                <ul>
                  {g.entries.map((e) => (
                    <li key={e.name}>
                      <span className="unlock-what">
                        <b>{e.name}</b>
                        {e.line && <small>{e.line}</small>}
                      </span>
                      {e.anchor && (
                        <button type="button" className="show-me" data-showme={e.anchor} onClick={() => actions.showMe(e.anchor!)}>
                          {t("showMe")}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          unlock.items.length > 0 && (
            <ul className="unlock-items">
              {unlock.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )
        )}
        {unlock.quip && <p className="unlock-quip">{unlock.quip}</p>}
        <button type="button" className="unlock-ok" autoFocus onClick={() => actions.dismissUnlock()}>
          {t("unlock.ok")}
        </button>
      </div>
    </aside>
  );
}

import { useT } from "../../context";
import type { SlotPropsMap } from "../../types";

/** A friendly little robot head. It nods when a new step arrives (the `key` on the card restarts the animation). */
function Buddy() {
  return (
    <svg viewBox="0 0 40 40" width="38" height="38" aria-hidden>
      <path d="M20 4v6" stroke="var(--flt-color-line)" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="20" cy="4" r="2.8" fill="var(--flt-color-accent)" stroke="var(--flt-color-line)" strokeWidth="2" />
      <rect x="6" y="10" width="28" height="24" rx="9" fill="var(--flt-color-inset)" stroke="var(--flt-color-line)" strokeWidth="2.6" />
      <circle cx="14.5" cy="21" r="3.4" fill="var(--flt-color-panel)" stroke="var(--flt-color-line)" strokeWidth="2" />
      <circle cx="25.5" cy="21" r="3.4" fill="var(--flt-color-panel)" stroke="var(--flt-color-line)" strokeWidth="2" />
      <circle className="buddy-pupil" cx="15.4" cy="21.4" r="1.4" fill="var(--flt-color-line)" />
      <circle className="buddy-pupil" cx="26.4" cy="21.4" r="1.4" fill="var(--flt-color-line)" />
      <path d="M14 28.5q6 3.2 12 0" fill="none" stroke="var(--flt-color-line)" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

/**
 * The guided opening: one sentence per step, a Next button while the game is waiting for one, and a Skip that is always
 * there. It sits above the build bar (the thing it usually points at), centred, where it covers only campus. Once the
 * tutorial is over it draws nothing: toasts and hints keep their own place.
 */
export function Assistant({ vm, actions }: SlotPropsMap["Assistant"]) {
  const t = useT();
  const a = vm.assistant;
  if (!a) return null;
  return (
    <aside key={a.step} className="assistant panel" aria-live="polite" aria-label={t("assistant.title")} data-step={a.step}>
      <div className="assistant-face">
        <Buddy />
      </div>
      <div className="assistant-body">
        <div className="assistant-meta">
          <span className="assistant-step">{t("assistant.step", { n: a.number, total: a.total })}</span>
          <span className="assistant-dots" aria-hidden>
            {Array.from({ length: a.total }, (_, i) => (
              <i key={i} className={i + 1 < a.number ? "done" : i + 1 === a.number ? "now" : ""} />
            ))}
          </span>
        </div>
        <p className="assistant-say">{a.message}</p>
        <div className="assistant-actions">
          {a.paused ? (
            <button type="button" className="assistant-next" onClick={() => actions.continueTutorial()}>
              {t("assistant.next")}
            </button>
          ) : (
            a.waitingForBuild && a.highlight.startsWith("build:") && <span className="assistant-note">{t("assistant.placeIt")}</span>
          )}
          {a.canSkip && (
            <button type="button" className="assistant-skip" onClick={() => actions.skipTutorial()}>
              {t("assistant.skip")}
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

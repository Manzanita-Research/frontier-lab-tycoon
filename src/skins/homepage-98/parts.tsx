// The small parts every Homepage '98 slot is made of: the NEW! sticker, a link that goes nowhere, and the pop-up window.
import type { ReactNode } from "react";

/** The sticker on things that just changed. Blinks, unless the player asked it not to. */
export const New = ({ children = "NEW!" }: { children?: ReactNode }) => <span className="gc-new">{children}</span>;

/** A link that does not go anywhere (the objectives are read-only), in the colour of one you have clicked before. */
export const Fake = ({ visited, children }: { visited?: boolean; children: ReactNode }) => <span className={`gc-link ${visited ? "v" : ""}`}>{children}</span>;

export function Tick() {
  return (
    <svg className="gc-tick" viewBox="0 0 12 12" shapeRendering="crispEdges" aria-label="done" role="img">
      <path d="M1 6l3 3 7-7" fill="none" stroke="#080" strokeWidth="2" />
    </svg>
  );
}

/**
 * A pop-up window: a navy title bar with a close box, and a body. Tooltips, toasts, event cards and the easter egg are
 * all one of these. Without `onClose` the box is decoration (the card underneath has to be answered).
 */
export function Pop({
  title,
  extra,
  className = "",
  role,
  label,
  modal,
  children,
  onClose,
  closeLabel = "Close",
}: {
  title: ReactNode;
  extra?: ReactNode;
  className?: string;
  role?: string;
  label?: string;
  modal?: boolean;
  children: ReactNode;
  onClose?: () => void;
  closeLabel?: string;
}) {
  return (
    <div className={`gc-pop ${className}`} role={role} aria-label={label} aria-modal={modal || undefined}>
      <div className="gc-tt">
        <span className="gc-ttx">{title}</span>
        {extra}
        {onClose ? (
          <button type="button" className="gc-x" onClick={onClose} aria-label={closeLabel}>
            <span aria-hidden>✕</span>
          </button>
        ) : (
          <span className="gc-x dead" aria-hidden>
            ✕
          </span>
        )}
      </div>
      <div className="gc-pc">{children}</div>
    </div>
  );
}

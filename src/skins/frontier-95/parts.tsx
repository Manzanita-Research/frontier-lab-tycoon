// The Win95-shaped building blocks every Frontier 95 slot is made of. Classes are styled in skin.css.
import type { ReactNode } from "react";
import { Ico } from "./icons";
import { InWin, useWinDrag } from "./drag";

export interface TitleButton {
  /** min | max | close | help: drawn in CSS so no font has to have the glyph. */
  g: "min" | "max" | "close" | "help";
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}

/** A window: navy title bar with an icon, a title and buttons, and a grey body. */
export function Win({
  title,
  icon,
  buttons = [],
  className = "",
  children,
  label,
  onTitleClick,
  role,
  attrs,
  place,
}: {
  title: ReactNode;
  icon?: string;
  buttons?: TitleButton[];
  className?: string;
  children?: ReactNode;
  label?: string;
  onTitleClick?: () => void;
  role?: string;
  /** Extra attributes for the window (the coach's `data-coach` hooks). */
  attrs?: Record<string, string | undefined>;
  /**
   * FLT-90: the name its position is remembered by when the player drags it (by default its first class, `f95-lab`),
   * or false for a window that must not move. Message boxes drag too, but open in the middle again next time.
   */
  place?: string | false;
}) {
  const id = place === false ? null : (place ?? className.trim().split(/\s+/)[0] ?? "") || null;
  const remember = !(role === "alertdialog" || role === "alert" || /\bf95-(msgbox|errbox)\b/.test(className));
  const drag = useWinDrag(id, remember);
  return (
    // An open window: the coach's balloon keeps off it (FLT-58), unless it is the window the coach is pointing at.
    <section
      className={`f95-win ${className}${drag.on ? " drag" : ""}${drag.moved ? " moved" : ""}`}
      aria-label={label ?? (typeof title === "string" ? title : undefined)}
      role={role}
      data-coach-avoid=""
      {...attrs}
      {...drag.win}
    >
      <div className={`f95-tb ${onTitleClick ? "clickable" : ""}`} onClick={onTitleClick} {...drag.bar}>
        {icon && <Ico name={icon} size={18} />}
        <span className="f95-tt">{title}</span>
        <span className="f95-btns">
          {buttons.map((b) => (
            <button key={b.g} type="button" className="f95-b" data-g={b.g} aria-label={b.label} title={b.label} onClick={(e) => { e.stopPropagation(); b.onClick?.(); }} disabled={b.disabled}>
              <span className="f95-glyph" aria-hidden>
                {b.g === "help" ? "?" : ""}
              </span>
            </button>
          ))}
        </span>
      </div>
      <InWin.Provider value={true}>{children}</InWin.Provider>
    </section>
  );
}

export function Btn({ children, def, disabled, onClick, className = "", ...rest }: { children: ReactNode; def?: boolean; disabled?: boolean; onClick?: () => void; className?: string } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "children" | "disabled" | "className">) {
  return (
    <button type="button" className={`f95-btn ${def ? "def" : ""} ${className}`} disabled={disabled} onClick={onClick} {...rest}>
      {children}
    </button>
  );
}

/** A blocky progress bar in an inset well. `value` is 0 to 1. */
export function Blocks({ value, label, tone = "navy", className = "" }: { value: number; label: string; tone?: "navy" | "red"; className?: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <span className={`f95-prog inset ${className}`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <i className={tone} style={{ width: `${pct}%` }} />
    </span>
  );
}

export function Tabs<T extends string>({ tabs, active, onChange, label }: { tabs: { id: T; label: string }[]; active: T; onChange: (id: T) => void; label: string }) {
  return (
    <div className="f95-tabs" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button key={t.id} type="button" role="tab" aria-selected={active === t.id} className={`f95-tab ${active === t.id ? "on" : ""}`} onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** A flat primary-colour clip-art sticker stuck on a window. */
export function Sticker({ kind, children }: { kind: "star" | "burst"; children: ReactNode }) {
  return (
    <span className={`f95-sticker ${kind}`} aria-hidden>
      {children}
    </span>
  );
}

/** A field label above an inset value. */
export function Field({ label, children, sub, warn }: { label: string; children: ReactNode; sub?: ReactNode; warn?: boolean }) {
  return (
    <div className="f95-field">
      <span className="f95-fl">{label}</span>
      {children}
      {sub !== undefined && <span className={`f95-fs ${warn ? "warn" : ""}`}>{sub}</span>}
    </div>
  );
}

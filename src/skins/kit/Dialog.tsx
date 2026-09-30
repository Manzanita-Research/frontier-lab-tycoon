import { useEffect, useRef, type ReactNode } from "react";

/**
 * Modal behaviour without any look: keeps the HUD's hotkeys out while it is open, traps Tab, closes on Escape and on a
 * click on the backdrop, and puts focus back where it was. Bring your own classes for the layer and the box.
 */
export function Dialog({ label, close, children, layerClass = "", dialogClass = "" }: { label: string; close: () => void; children: ReactNode; layerClass?: string; dialogClass?: string }) {
  const root = useRef<HTMLDivElement>(null);
  const onClose = useRef(close);
  onClose.current = close;
  useEffect(() => {
    const previous = document.activeElement;
    root.current?.querySelector<HTMLElement>("button, input, [tabindex]")?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      e.stopImmediatePropagation();
      if (e.key === "Escape") {
        e.preventDefault();
        onClose.current();
      }
      if (e.key === "Tab") {
        const all = [...(root.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input, select, a[href], [tabindex="0"]') ?? [])];
        const first = all[0];
        const last = all.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", key, true);
    return () => {
      window.removeEventListener("keydown", key, true);
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);
  return (
    <div
      className={layerClass}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className={dialogClass} ref={root} role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </div>
    </div>
  );
}

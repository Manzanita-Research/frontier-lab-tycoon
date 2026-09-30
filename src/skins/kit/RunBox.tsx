// FLT-63: the Run… box every skin's Start menu can open. `useRunBox` is the state (what is typed, what the list shows, the
// last error); `RunBox` is plain markup (`runbox-*` classes, dressed by the base CSS from tokens) for a skin that does not
// draw its own. Frontier 95 draws a real Run dialog on the hook.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useT } from "../context";
import type { WidgetVM } from "../../ui/hud/types";
import { runFile } from "./launcher";

/** What the box said last time, shared by every skin: Windows remembered, so the lab does too (until the tab closes). */
let lastRun = "";

export interface RunBoxState {
  typed: string;
  setTyped: (s: string) => void;
  /** The widgets the list shows for what is typed (all of them for nothing, or an exact file). */
  shown: WidgetVM[];
  /** The exact file typed, lower-cased, to mark in the list. */
  q: string;
  error: { title: string; text: string } | null;
  dismiss: () => void;
  /** Run `text`: open its widget through `onRun`, or set `error`. */
  go: (text: string) => void;
}

export function useRunBox(widgets: readonly WidgetVM[], onRun: (id: string) => void): RunBoxState {
  const [typed, setTyped] = useState(lastRun);
  const [error, setError] = useState<RunBoxState["error"]>(null);
  const q = typed.trim().toLowerCase();
  const shown = q && !widgets.some((w) => w.file === q) ? widgets.filter((w) => w.file.startsWith(q) || w.name.toLowerCase().includes(q) || w.aliases.some((a) => a.startsWith(q))) : [...widgets];
  return {
    typed,
    setTyped,
    shown,
    q,
    error,
    dismiss: () => setError(null),
    go: (text) => {
      lastRun = text.trim();
      const r = runFile(text, widgets);
      if (r.ok) onRun(r.widget.id);
      else setError({ title: r.title, text: r.text });
    },
  };
}

/**
 * The box: prompt, field, the list below it, and what went wrong (inline, not a modal). `icon` draws a widget's icon in
 * the skin's own art; `label` / `go` relabel the field and the button (a skin's flavour: "Request", "Go to", ...).
 */
export function RunBox({ widgets, onRun, icon, className = "", placeholder = "thoughts.txt" }: { widgets: readonly WidgetVM[]; onRun: (id: string) => void; icon?: (w: WidgetVM) => ReactNode; className?: string; placeholder?: string }) {
  const t = useT();
  const box = useRunBox(widgets, onRun);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus({ preventScroll: true });
    input.current?.select();
  }, []);
  return (
    <form
      className={`runbox ${className}`}
      onSubmit={(e) => {
        e.preventDefault();
        box.go(box.typed);
      }}
    >
      <p className="runbox-prompt">{t("run.prompt")}</p>
      <div className="runbox-field">
        <label>
          <span>{t("run.open")}</span>
          <input
            ref={input}
            value={box.typed}
            placeholder={placeholder}
            onChange={(e) => {
              box.setTyped(e.target.value);
              box.dismiss();
            }}
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            data-testid="run-input"
          />
        </label>
        <button type="submit" className="runbox-go" data-testid="run-ok">
          {t("run.ok")}
        </button>
      </div>
      {box.error && (
        <div className="runbox-err" role="alert">
          <b>{box.error.title}</b> {box.error.text}
        </div>
      )}
      <ul className="runbox-list" aria-label="Widgets">
        {box.shown.map((w) => (
          <li key={w.id}>
            <button type="button" className={w.file === box.q ? "on" : ""} onClick={() => box.go(w.file)} title={w.blurb}>
              {icon && <span className="runbox-icon">{icon(w)}</span>}
              <span className="runbox-file">{w.file}</span>
              <span className="runbox-name">{w.name}</span>
              <small>{w.blurb}</small>
            </button>
          </li>
        ))}
        {box.shown.length === 0 && <li className="runbox-none">{t("run.none")}</li>}
      </ul>
    </form>
  );
}

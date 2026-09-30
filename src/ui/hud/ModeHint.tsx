// FLT-63: the tool in hand says how to put it down. With a mouse, a small hint rides beside the pointer while it is over
// the map ("Placing Training Hall · Esc to stop building"), and parks above the taskbar when the pointer is on the HUD.
// On a touch screen there is no Esc and no right-click, so it is a big Done ✕ button instead. Drawn by the host so every
// skin has it; a skin restyles `.mode-hint` / `.mode-done` and may relabel the `mode.*` strings.
import { useEffect, useRef, useState } from "react";
import { useT } from "../../skins/context";
import type { HudActions, PlaceModeVM } from "./types";

const OFFSET = { x: 18, y: 22 };

const keys: Record<PlaceModeVM["kind"], [string, string]> = {
  building: ["mode.building", "mode.subBuilding"],
  path: ["mode.path", "mode.subPath"],
  bulldoze: ["mode.bulldoze", "mode.subBulldoze"],
  zone: ["mode.zone", "mode.subZone"],
};

/** A touch screen, going by the last pointer (a laptop with a touchscreen switches as you switch). */
function useTouch(): boolean {
  const [touch, setTouch] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.("(hover: none) and (pointer: coarse)").matches);
  useEffect(() => {
    const on = (e: PointerEvent) => setTouch(e.pointerType === "touch");
    window.addEventListener("pointerdown", on, true);
    return () => window.removeEventListener("pointerdown", on, true);
  }, []);
  return touch;
}

export function ModeHint({ mode, actions }: { mode: PlaceModeVM | null; actions: HudActions }) {
  const t = useT();
  const touch = useTouch();
  const box = useRef<HTMLDivElement>(null);
  const [onMap, setOnMap] = useState(false);

  // Follow the pointer without re-rendering: the transform is written straight onto the element.
  useEffect(() => {
    if (!mode || touch) return;
    const move = (e: PointerEvent) => {
      const map = (e.target as Element | null)?.tagName === "CANVAS";
      setOnMap(map);
      const el = box.current;
      if (!el || !map) return;
      const w = el.offsetWidth;
      const x = e.clientX + OFFSET.x + w > window.innerWidth - 8 ? e.clientX - OFFSET.x - w : e.clientX + OFFSET.x;
      el.style.transform = `translate(${Math.round(x)}px, ${Math.round(e.clientY + OFFSET.y)}px)`;
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, [mode, touch]);

  if (!mode) return null;
  const [line, sub] = keys[mode.kind];
  const name = { name: mode.name };
  if (touch)
    return (
      <button type="button" className="mode-done" data-mode={mode.kind} onClick={() => (mode.kind === "zone" ? actions.paintZone(null) : actions.place(null))} aria-label={`${t(line, name)}: ${t("mode.done")}`}>
        <span className="mode-done-name">{mode.name}</span>
        <b>
          {t("mode.done")} <span aria-hidden>×</span>
        </b>
      </button>
    );
  return (
    <div ref={box} className={`mode-hint ${onMap ? "at-pointer" : "docked"}`} data-mode={mode.kind} role="status" aria-live="polite">
      <b>{t(line, name)}</b>
      <small>{t(sub, name)}</small>
    </div>
  );
}

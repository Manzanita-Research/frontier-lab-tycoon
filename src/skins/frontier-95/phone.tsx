// A phone gives the campus the screen (FLT-87). Training, the next goal and the Objectives fold into one strip under the lab
// bar, and the taskbar keeps to one row: tray icons that don't fit wait behind a » button, the way a later desktop hid its
// tray. Only the Layout uses these, and only when `layout.compact`; a desktop never sees them.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useCoach, useT } from "../context";
import type { HudVM } from "../../ui/hud/types";
import { Blocks } from "./parts";
import { Ico } from "./icons";

// Layout effects warn on the server (the skin tests render there); nothing is measured then.
const useLayout = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** The coach steps that point inside the fold: it opens for them, so the ring has something to circle. */
const POINTS_INSIDE = new Set(["training", "goals"]);

/**
 * Training, Next goal and Objectives as one 44 px strip: the copy dialog's blocks, the goal's sticky note and the
 * objectives count. Tap it to open the three as they are on a desktop; tap again to fold them.
 */
export function Fold({ vm, children }: { vm: HudVM; children: ReactNode }) {
  const t = useT();
  const coach = useCoach();
  const [open, setOpen] = useState(false);
  const shown = open || POINTS_INSIDE.has(coach.target ?? "");
  const { training, objectives, progress } = vm;
  const goal = progress.goal.line ? progress.goal : null;
  const list = !goal || vm.visible.arena;
  const said = [training.hasHall ? `${t("training.title")} ${training.pctText}` : null, goal?.line, list ? `${t("objectives.title")} ${objectives.done}/${objectives.total}` : null].filter(Boolean).join(" · ");
  return (
    <div className={`f95-fold${shown ? " open" : ""}`}>
      <button type="button" className="f95-foldbar" aria-expanded={shown} aria-label={said} title={said} onClick={() => setOpen(!shown)}>
        {training.hasHall && (
          <span className={`run${training.justShipped ? " shipped" : ""}`}>
            <Ico name="doc" size={18} />
            {training.justShipped ? <b>{t("training.shipped")}</b> : <Blocks value={training.pct} label={training.name} />}
          </span>
        )}
        {goal && (
          <span className="goal">
            <span className="tx">{goal.text}</span>
            <b>{goal.progressText}</b>
          </span>
        )}
        {list && (
          <span className={`obj${objectives.urgent ? " bad" : ""}`}>
            <span className="f95-check" aria-hidden />
            {objectives.done}/{objectives.total}
          </span>
        )}
        <span className="chev" aria-hidden />
      </button>
      {shown && <div className="f95-foldbody">{children}</div>}
    </div>
  );
}

/** The tray's buttons, as the measuring sees them: its own, and the waiting windows' (their group is `display: contents`). */
const ITEMS = ":scope > button, :scope > .f95-waiting > button";

/**
 * The tray icons (and the waiting windows) in one row that wraps out of sight: whatever lands past the first line is marked
 * `data-over` and hidden, and the » button shows them in a little panel above the taskbar. The slots stay where React put
 * them (their windows are inside them), so only attributes and two CSS variables are written here.
 */
export function TrayMore({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [over, setOver] = useState(0);
  const [open, setOpen] = useState(false);

  // Measure after every render (the Layout renders at the HUD's 5 Hz) and whenever the row changes width.
  const measure = useRef(() => {});
  measure.current = () => {
    const row = box.current;
    if (!row) return;
    const items = [...row.querySelectorAll<HTMLElement>(ITEMS)];
    for (const el of items) el.removeAttribute("data-over");
    const top = row.getBoundingClientRect().top;
    const spill = items.filter((el) => el.offsetParent !== null && el.getBoundingClientRect().top > top + 4);
    const cols = Math.min(4, spill.length);
    spill.forEach((el, i) => {
      el.setAttribute("data-over", "");
      el.style.setProperty("--c", String(i % cols));
      el.style.setProperty("--r", String(Math.floor(i / cols)));
    });
    row.style.setProperty("--cols", String(cols));
    row.style.setProperty("--rows", String(Math.ceil(spill.length / Math.max(1, cols))));
    if (spill.length !== over) setOver(spill.length);
  };
  useLayout(() => measure.current());
  useEffect(() => {
    if (typeof ResizeObserver === "undefined" || !box.current) return;
    const watch = new ResizeObserver(() => measure.current());
    watch.observe(box.current);
    return () => watch.disconnect();
  }, []);

  // A tap anywhere else (or Escape) puts the panel away; a tap on an icon in it does too, once the icon has done its thing.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      const at = e.target as Node | null;
      if (at && !box.current?.contains(at) && !(at as Element).closest?.(".f95-chev")) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away, true);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away, true);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  const shown = open && over > 0;

  return (
    <>
      <div ref={box} className={`f95-more${shown ? " open" : ""}`} onClick={(e) => shown && (e.target as Element).closest?.("[data-over]") && setOpen(false)}>
        {children}
      </div>
      {over > 0 && (
        <button type="button" className={`f95-s f95-chev${shown ? " on" : ""}`} aria-label={`${over} more`} title={`${over} more`} aria-expanded={shown} aria-pressed={shown} onClick={() => setOpen(!shown)}>
          »
        </button>
      )}
    </>
  );
}

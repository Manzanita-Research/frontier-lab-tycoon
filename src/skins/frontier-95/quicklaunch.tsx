// FLT-94: Quick Launch, the little icons beside Start, and the leaderboard rank in the tray. Quick Launch launches
// applets and nothing else (building tools live in the Facilities palette and Start ▸ Programs ▸ Facilities). A desktop
// shows eight and keeps the rest behind a »; a phone keeps only the palette by Start, and the rest ride in the tray's ».
import { useEffect, useRef, useState } from "react";
import { useT } from "../context";
import type { HudActions, HudVM, WidgetVM } from "../../ui/hud/types";
import { Ico } from "./icons";
import { openPalette, palette, usePalette } from "./palette";
import { IN_TRAY, QUICK_SHOWN, quickLaunch, rankChip, type QuickApp } from "./quick";

function useLaunch(actions: HudActions) {
  const paletteOpen = usePalette();
  return (app: QuickApp) => {
    if (app.id !== "facilities") return actions.openWidget(app.id);
    if (paletteOpen) palette.set(false);
    else openPalette(actions);
  };
}

function AppButton({ app, on, onClick, className = "f95-qb" }: { app: QuickApp; on: boolean; onClick: () => void; className?: string }) {
  return (
    <button type="button" className={`${className}${on ? " on" : ""}`} data-anchor={app.anchor} title={app.tip} aria-label={app.name} aria-pressed={app.id === "facilities" ? on : undefined} onClick={onClick}>
      <Ico name={app.icon} size={16} />
    </button>
  );
}

/** The Quick Launch bar beside Start (the Start menu draws it). On a phone, only the palette: the rest go in the tray (`QuickTray`). */
export function QuickLaunch({ widgets, staffOpen, phone, actions }: { widgets: readonly WidgetVM[]; staffOpen: boolean; phone: boolean; actions: HudActions }) {
  const paletteOpen = usePalette();
  const launch = useLaunch(actions);
  const [more, setMore] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  const apps = quickLaunch(widgets);
  const shown = phone ? apps.slice(0, 1) : apps.slice(0, QUICK_SHOWN);
  const rest = phone ? [] : apps.slice(QUICK_SHOWN);
  const on = (app: QuickApp) => (app.id === "facilities" ? paletteOpen : app.id === "staff" ? staffOpen : false);

  useEffect(() => {
    if (!more) return;
    const away = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setMore(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMore(false);
    window.addEventListener("pointerdown", away);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", esc);
    };
  }, [more]);

  return (
    <span className="f95-qs" role="group" aria-label="Quick Launch" data-anchor="quicklaunch" ref={root}>
      {shown.map((app) => (
        <AppButton key={app.id} app={app} on={on(app)} onClick={() => launch(app)} />
      ))}
      {rest.length > 0 && (
        <>
          <button type="button" className={`f95-qb f95-qmore${more ? " on" : ""}`} data-anchor="apps" title={`${rest.length} more`} aria-label={`${rest.length} more apps`} aria-haspopup="menu" aria-expanded={more} onClick={() => setMore(!more)}>
            »
          </button>
          {more && (
            <div className="f95-win f95-menu f95-qmenu" role="menu" aria-label="More apps">
              <ul>
                {rest.map((app) => (
                  <li key={app.id}>
                    <button type="button" role="menuitem" data-anchor={app.anchor} title={app.tip} onClick={() => { setMore(false); launch(app); }}>
                      <Ico name={app.icon} size={16} />
                      <span>{app.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </span>
  );
}

/** On a phone: the applets after the palette (less the ones the tray already has), as tray icons, behind its ». */
export function QuickTray({ vm, actions }: { vm: HudVM; actions: HudActions }) {
  const launch = useLaunch(actions);
  return (
    <>
      {quickLaunch(vm.widgets)
        .slice(1)
        .filter((app) => !IN_TRAY.has(app.id))
        .map((app) => (
          <AppButton key={app.id} app={app} on={app.id === "staff" && vm.staff.open} className="f95-s f95-qapp" onClick={() => launch(app)} />
        ))}
    </>
  );
}

/** "#3 ▲" in the tray: the lab's place on the Frontier Arena. Click it for the leaderboard. A drop makes it flinch. */
export function TrayRank({ vm, actions }: { vm: HudVM; actions: HudActions }) {
  const t = useT();
  if (!vm.visible.arena) return null;
  const arena = vm.stats.arena;
  const chip = rankChip(arena);
  return (
    <button
      type="button"
      className={`f95-rank${arena.tone ? ` ${arena.tone}` : ""}${arena.top ? " top" : ""}${arena.flinch ? " flinch" : ""}`}
      data-anchor="tray:rank"
      title={chip.tip}
      aria-label={`${t("stats.arena")} ${chip.text}${chip.arrow === "▲" ? ", up" : chip.arrow === "▼" ? ", down" : ""}. Open the leaderboard`}
      onClick={() => actions.openWidget("arena")}
    >
      {arena.top && <Ico name="trophy" size={14} />}
      <span>{chip.text}</span>
      {chip.arrow && <i aria-hidden>{chip.arrow}</i>}
    </button>
  );
}

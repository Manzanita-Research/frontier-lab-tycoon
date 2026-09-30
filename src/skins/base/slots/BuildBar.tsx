import { useEffect, useRef, useState } from "react";
import { ICONS } from "../icons";
import { useCoach, useT } from "../../context";
import { coachInFacilities, facilityGroups, RunBox } from "../../kit";
import type { SlotPropsMap } from "../../types";
import type { BuildItemVM } from "../../../ui/hud/types";

const Hammer = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M14 6l4 4M4 20l8.5-8.5M11 4.5l7 7-2.5 2.5-7-7z" fill="var(--flt-color-inset)" />
  </svg>
);
const Lock = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="5" y="11" width="14" height="9" rx="2.5" fill="var(--flt-color-inset)" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);
const Help = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="9" fill="var(--flt-color-inset)" />
    <path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1.9-1.1 1.8M12 17h.01" />
  </svg>
);

const Folder = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="var(--flt-color-inset)" />
  </svg>
);
const Prompt = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="4" width="18" height="16" rx="3" fill="var(--flt-color-inset)" />
    <path d="M7 10l3 2-3 2M12 15h5" />
  </svg>
);

type View = "top" | "facilities" | "run";

/**
 * The build menu is a panel you open: one Build button, and only what you have unlocked inside it, then the things you have
 * not (locked, with what unlocks them), then Help. Hotkeys 1 to 9 still pick a tool without opening it.
 * FLT-63: the top level is the tools (Path, Bulldoze), Facilities (the buildings, grouped) and Run… (the widgets).
 */
export function BuildBar({ items, tip, teasers = [], widgets = [], actions }: SlotPropsMap["BuildBar"]) {
  const t = useT();
  const coach = useCoach();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("top");
  const root = useRef<HTMLDivElement>(null);
  const toggle = (next: boolean) => {
    setOpen(next);
    setView("top");
    actions.buildPanel(next);
  };

  // A tap outside, or Escape, shuts the panel.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", away);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);

  const held = items.find((it) => it.selected && !it.panel);
  // While the coach points at something inside the panel and the panel is shut, the Build button stands in for it.
  const inside = coach.intoPanel(items);
  const { tools, groups } = facilityGroups(items);
  const tile = (it: BuildItemVM) => (
    <button
      key={it.kind}
      role="menuitem"
      {...coach.attrs(`build:${it.kind}`)}
      className={`tool ${it.panel ? "staff-tool" : ""} ${it.race ? "race" : ""} ${it.selected ? "on" : ""} ${it.affordable ? "" : "broke"}`}
      onClick={() => {
        actions.place(it.kind);
        toggle(false);
      }}
      disabled={!it.affordable && !it.selected}
      aria-pressed={it.selected}
      title={it.blurb ? `${it.name}: ${it.blurb}` : it.name}
    >
      <span className="hot">{it.hotkey ?? "·"}</span>
      <span className="icon">{ICONS[it.kind]}</span>
      <span className="tname">{it.short}</span>
      <span className={`price ${it.free ? "free" : ""}`}>{it.isBulldoze ? t("build.refund") : it.free ? t("build.free") : it.priceText}</span>
    </button>
  );
  const back = (title: string) => (
    <div className="buildmenu-bar">
      <button type="button" className="buildmenu-back" onClick={() => setView("top")}>
        ‹ {t("run.back")}
      </button>
      <b>{title}</b>
    </div>
  );
  return (
    <div className="buildwrap" ref={root}>
      {tip && (
        <div className="tip panel">
          <b>{tip.name}</b> · {tip.text} {tip.upkeepText && <span className="dim">{tip.upkeepText}</span>}
        </div>
      )}
      {open && (
        <div className={`buildmenu panel view-${view}`} data-coach-panel role="menu" aria-label={t("build.menuTitle")}>
          {view === "top" && (
            <div className="buildmenu-grid">
              {tools.map(tile)}
              <button role="menuitem" className="tool folder-tool" data-testid="start-facilities" {...coach.attrs("start:facilities", coachInFacilities(coach.target, items) && inside)} onClick={() => setView("facilities")}>
                <span className="hot">▸</span>
                <span className="icon">
                  <Folder />
                </span>
                <span className="tname">{t("build.facilities")}</span>
                <span className="price">{t("build.facilitiesCount", { n: groups.reduce((n, g) => n + g.items.length, 0) })}</span>
              </button>
              <button role="menuitem" className="tool folder-tool" data-testid="start-run" onClick={() => { if (held) actions.place(null); setView("run"); }}>
                <span className="hot">▸</span>
                <span className="icon">
                  <Prompt />
                </span>
                <span className="tname">{t("build.run")}</span>
                <span className="price">{t("build.runCount", { n: widgets.length })}</span>
              </button>
              <button
                role="menuitem"
                className="tool help-tool"
                onClick={() => {
                  actions.openHelp();
                  toggle(false);
                }}
              >
                <span className="icon">
                  <Help />
                </span>
                <span className="tname">{t("build.help")}</span>
                <span className="price">{t("help.title")}</span>
              </button>
            </div>
          )}
          {view === "facilities" && (
            <>
              {back(t("build.facilities"))}
              {groups.map((g) => (
                <section key={g.id} className="buildmenu-group" aria-label={t(`build.group.${g.id}`)}>
                  <h4>{t(`build.group.${g.id}`)}</h4>
                  <div className="buildmenu-grid">{g.items.map(tile)}</div>
                </section>
              ))}
              {teasers.length > 0 && (
                <section className="buildmenu-group" aria-label={t("build.locked")}>
                  <h4>{t("build.locked")}</h4>
                  <div className="buildmenu-grid">
                    {teasers.map((teaser, i) => (
                      <div key={`${teaser.label}-${i}`} className="tool locked" role="menuitem" aria-disabled title={`${t("build.locked")}: ${teaser.hint}`}>
                        <span className="icon">
                          <Lock />
                        </span>
                        <span className="tname">{teaser.label}</span>
                        <span className="price">{teaser.hint}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
          {view === "run" && (
            <>
              {back(t("run.title"))}
              <RunBox
                widgets={widgets}
                onRun={(id) => {
                  toggle(false);
                  actions.openWidget(id);
                }}
              />
            </>
          )}
        </div>
      )}
      <div className="buildbar panel bar-closed">
        <button type="button" className={`build-open ${open ? "on" : ""}`} aria-expanded={open} aria-haspopup="menu" onClick={() => toggle(!open)} {...coach.attrs("start", !open && inside)}>
          <Hammer />
          <span>{t("build.open")}</span>
        </button>
        {held && (
          <button type="button" className="build-held" onClick={() => actions.place(null)} title={t("build.putAway")}>
            <span className="icon">{ICONS[held.kind]}</span>
            <span>{t("build.placing", { name: held.short })}</span>
            <span aria-hidden className="x">
              ×
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

// The arcade: every build tool is a round button with a little LCD under it for the name and the price. The tool in hand
// is pressed down and ringed in white; one you cannot afford goes grey. The whole row sits behind one BUILD button you press
// (the tools, Facilities for the buildings and Run… for the widgets, then Help; FLT-63).
import { useState, type CSSProperties } from "react";
import { RunBox, useCoach, useStartMenu, useT, type StartView } from "../kit";
import type { SlotPropsMap } from "../types";
import type { BuildItemVM } from "../../ui/hud/types";
import { BuildIcon, buttonColours } from "./art";

const W = "#fff";
const LockIcon = () => (
  <svg className="kn-bicon" viewBox="0 0 32 32" fill="none" stroke={W} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="8" y="14" width="16" height="11" rx="3" fill={W} fillOpacity=".25" />
    <path d="M11 14v-3a5 5 0 0 1 10 0v3" />
  </svg>
);
const HelpIcon = () => (
  <svg className="kn-bicon" viewBox="0 0 32 32" fill="none" stroke={W} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="16" cy="16" r="10" fill={W} fillOpacity=".25" />
    <path d="M12.8 12.8a3.3 3.3 0 1 1 4.7 3c-.9.5-1.5 1.2-1.5 2.2M16 22h.01" />
  </svg>
);

const BookIcon = () => (
  <svg className="kn-bicon" viewBox="0 0 32 32" fill="none" stroke={W} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M6 8h8a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H6zM26 8h-8a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h8z" fill={W} fillOpacity=".25" />
  </svg>
);
const MicIcon = () => (
  <svg className="kn-bicon" viewBox="0 0 32 32" fill="none" stroke={W} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="12" y="5" width="8" height="13" rx="4" fill={W} fillOpacity=".25" />
    <path d="M8 15a8 8 0 0 0 16 0M16 23v4M12 27h8" />
  </svg>
);
const BackIcon = () => (
  <svg className="kn-bicon" viewBox="0 0 32 32" fill="none" stroke={W} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M19 9l-7 7 7 7" />
  </svg>
);

/**
 * What is inside the open arcade. The top row is the tools (Path, Bulldoze), Facilities (the buildings, in
 * labelled rows) and Run… (the widgets, in a Run box), then Help. `done` shuts it.
 */
export function Arcade({ items, teasers = [], widgets = [], actions, done, view }: Pick<SlotPropsMap["BuildBar"], "items" | "teasers" | "actions" | "widgets"> & { done: () => void; view?: StartView }) {
  const t = useT();
  const coach = useCoach();
  const menu = useStartMenu(items, view);
  const tool = (it: BuildItemVM) => {
    const [face, rim] = buttonColours(it.kind);
    return (
      <button
        key={it.kind}
        type="button"
        {...coach.attrs(`build:${it.kind}`)}
        className={`kn-ab ${it.selected ? "on" : ""} ${it.affordable ? "" : "poor"} ${it.race ? "race" : ""}`}
        style={{ "--c": face, "--cd": rim } as CSSProperties}
        onClick={() => {
          actions.place(it.kind);
          done();
        }}
        disabled={!it.affordable && !it.selected}
        aria-pressed={it.selected}
        aria-label={`${it.name}, ${it.isBulldoze ? t("build.refund") : it.free ? t("build.free") : it.priceText}`}
        title={it.blurb ?? it.name}
      >
        <span className="kn-btnr">
          <BuildIcon kind={it.kind} />
          {it.hotkey !== null && <span className="kn-k">{it.hotkey}</span>}
        </span>
        <span className="kn-lcd">
          <b>{it.short}</b>
          <span className={it.free ? "free" : ""}>{it.isBulldoze ? "50% BACK" : it.free ? t("build.free") : it.priceText.toUpperCase()}</span>
        </span>
      </button>
    );
  };
  const back = (
    <button type="button" className="kn-ab back" style={{ "--c": "#6d5a92", "--cd": "#46376a" } as CSSProperties} onClick={() => menu.setView("top")}>
      <span className="kn-btnr">
        <BackIcon />
      </span>
      <span className="kn-lcd">
        <b>{t("run.back")}</b>
        <span>&nbsp;</span>
      </span>
    </button>
  );
  return (
    <div className={`kn-tray kn-plastic view-${menu.view}`} role="toolbar" aria-label={t("build.menuTitle")} data-coach-panel>
      {menu.view === "top" && (
        <>
          {menu.tools.map(tool)}
          <button type="button" className="kn-ab folder" data-testid="start-facilities" style={{ "--c": "#f2a531", "--cd": "#b86f12" } as CSSProperties} onClick={() => menu.setView("facilities")} {...menu.facilities}>
            <span className="kn-btnr">
              <BookIcon />
            </span>
            <span className="kn-lcd">
              <b>{t("build.facilities")}</b>
              <span>{t("build.facilitiesCount", { n: menu.count }).toUpperCase()}</span>
            </span>
          </button>
          <button
            type="button"
            className="kn-ab folder"
            data-testid="start-run"
            style={{ "--c": "#e0478f", "--cd": "#9c2260" } as CSSProperties}
            onClick={() => {
              if (items.some((it) => it.selected && !it.panel)) actions.place(null);
              menu.setView("run");
            }}
          >
            <span className="kn-btnr">
              <MicIcon />
            </span>
            <span className="kn-lcd">
              <b>{t("build.run")}</b>
              <span>{t("build.runCount", { n: widgets.length }).toUpperCase()}</span>
            </span>
          </button>
          <button
            type="button"
            className="kn-ab help"
            style={{ "--c": "#3fb4d8", "--cd": "#2380a0" } as CSSProperties}
            onClick={() => {
              actions.openHelp();
              done();
            }}
          >
            <span className="kn-btnr">
              <HelpIcon />
            </span>
            <span className="kn-lcd">
              <b>{t("build.help")}</b>
              <span>{t("help.title").toUpperCase()}</span>
            </span>
          </button>
        </>
      )}
      {menu.view === "facilities" && (
        <>
          {back}
          {menu.groups.map((g) => (
            <div key={g.id} className="kn-row" role="group" aria-label={t(`build.group.${g.id}`)}>
              <span className="kn-rowname">{t(`build.group.${g.id}`)}</span>
              <div className="kn-rowkeys">{g.items.map(tool)}</div>
            </div>
          ))}
          {teasers.length > 0 && (
            <div className="kn-row" role="group" aria-label={t("build.locked")}>
              <span className="kn-rowname">{t("build.locked")}</span>
              <div className="kn-rowkeys">
                {teasers.map((teaser, i) => (
                  <div key={`${teaser.label}-${i}`} className="kn-ab locked" aria-disabled title={`${t("build.locked")}: ${teaser.hint}`} style={{ "--c": "#5a4a78", "--cd": "#3a2c55" } as CSSProperties}>
                    <span className="kn-btnr">
                      <LockIcon />
                    </span>
                    <span className="kn-lcd">
                      <b>{teaser.label}</b>
                      <span>{teaser.hint.toUpperCase()}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      {menu.view === "run" && (
        <>
          {back}
          <RunBox
            className="kn-run"
            placeholder="thoughts.mp3"
            widgets={widgets}
            onRun={(id) => {
              done();
              actions.openWidget(id);
            }}
          />
        </>
      )}
    </div>
  );
}

export function BuildBar({ items, tip, teasers = [], widgets = [], actions }: SlotPropsMap["BuildBar"]) {
  const t = useT();
  const coach = useCoach();
  const [open, setOpen] = useState(false);
  const toggle = (next: boolean) => {
    setOpen(next);
    actions.buildPanel(next);
  };
  const held = items.find((it) => it.selected && !it.panel);
  const inside = coach.intoPanel(items);
  const [face, rim] = buttonColours("path");
  return (
    <div className="kn-buildwrap">
      {tip && (
        <div className="kn-tip" role="status">
          <b>{tip.name}</b>
          <span>{tip.text}</span>
          {tip.upkeepText && <small>{tip.upkeepText}</small>}
        </div>
      )}
      {open && <Arcade items={items} teasers={teasers} widgets={widgets} actions={actions} done={() => toggle(false)} />}
      <div className="kn-tray kn-plastic kn-tray-closed">
        <button
          type="button"
          className={`kn-ab open ${open ? "on" : ""}`}
          style={{ "--c": face, "--cd": rim } as CSSProperties}
          aria-expanded={open}
          aria-haspopup="true"
          onClick={() => toggle(!open)}
          {...coach.attrs("start", !open && inside)}
        >
          <span className="kn-btnr">
            <BuildIcon kind="path" />
          </span>
          <span className="kn-lcd">
            <b>{t("build.open")}</b>
            <span>{held ? held.short.toUpperCase() : "\u00a0"}</span>
          </span>
        </button>
      </div>
    </div>
  );
}

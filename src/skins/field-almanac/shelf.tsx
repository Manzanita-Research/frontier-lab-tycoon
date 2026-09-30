import { useState } from "react";
import { RunBox, useCoach, useStartMenu, useT, type StartView } from "../kit";
import type { SlotPropsMap } from "../types";
import type { BuildItemVM } from "../../ui/hud/types";
import { ToolIcon } from "./icons";

const LockIcon = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="5.5" y="11" width="13" height="9" rx="2" />
    <path d="M8.5 11V8.5a3.5 3.5 0 0 1 7 0V11" />
  </svg>
);
const HelpIcon = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M9.6 9.6a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1.1.9-1.1 1.7M12 16.8h.01" />
  </svg>
);

const GuideIcon = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M5 4.5h10.5a3 3 0 0 1 3 3v12H8a3 3 0 0 1-3-3z" />
    <path d="M5 16.5a3 3 0 0 1 3-3h10.5M9 8h6" />
  </svg>
);
const IndexIcon = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="10.5" cy="10.5" r="5.5" />
    <path d="M14.5 14.5l5 5" />
  </svg>
);
const BackIcon = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M14 6l-6 6 6 6" />
  </svg>
);

/**
 * What is inside the open shelf. The top shelf is the tools (Path, Clear land), Facilities (the
 * buildings, one captioned plate per group) and Run… (the widgets), then Help. `done` shuts the shelf.
 */
export function Shelf({ items, teasers = [], widgets = [], actions, done, view }: Pick<SlotPropsMap["BuildBar"], "items" | "teasers" | "actions" | "widgets"> & { done: () => void; view?: StartView }) {
  const t = useT();
  const coach = useCoach();
  const menu = useStartMenu(items, view);
  const tool = (it: BuildItemVM) => (
    <button
      key={it.kind}
      className={`fa-tool ${it.selected ? "on" : ""} ${it.affordable ? "" : "poor"} ${it.race ? "race" : ""}`}
      onClick={() => {
        actions.place(it.kind);
        done();
      }}
      disabled={!it.affordable && !it.selected}
      aria-pressed={it.selected}
      title={it.name}
      {...coach.attrs(`build:${it.kind}`)}
    >
      {it.hotkey !== null && <span className="fa-hot">{it.hotkey}</span>}
      <span className="fa-well">
        <ToolIcon kind={it.kind} />
      </span>
      <span className="fa-tname">{it.isBulldoze ? "Clear land" : it.short}</span>
      <span className={`fa-price ${it.free ? "free" : ""}`}>{it.isBulldoze ? t("build.refund") : it.free ? t("build.free") : it.priceText}</span>
    </button>
  );
  const back = (
    <button className="fa-tool fa-back" onClick={() => menu.setView("top")}>
      <span className="fa-well">
        <BackIcon />
      </span>
      <span className="fa-tname">{t("run.back")}</span>
    </button>
  );
  return (
    <div className={`fa-shelf fa-paper view-${menu.view}`} role="toolbar" aria-label={t("build.menuTitle")} data-coach-panel>
      {menu.view === "top" && (
        <>
          {menu.tools.map(tool)}
          <button className="fa-tool fa-folder" data-testid="start-facilities" onClick={() => menu.setView("facilities")} {...menu.facilities}>
            <span className="fa-well">
              <GuideIcon />
            </span>
            <span className="fa-tname">{t("build.facilities")}</span>
            <span className="fa-price">{t("build.facilitiesCount", { n: menu.count })}</span>
          </button>
          <button
            className="fa-tool fa-folder"
            data-testid="start-run"
            onClick={() => {
              if (items.some((it) => it.selected && !it.panel)) actions.place(null);
              menu.setView("run");
            }}
          >
            <span className="fa-well">
              <IndexIcon />
            </span>
            <span className="fa-tname">{t("build.run")}</span>
            <span className="fa-price">{t("build.runCount", { n: widgets.length })}</span>
          </button>
          <button
            className="fa-tool"
            onClick={() => {
              actions.openHelp();
              done();
            }}
          >
            <span className="fa-well">
              <HelpIcon />
            </span>
            <span className="fa-tname">{t("build.help")}</span>
            <span className="fa-price">{t("help.title")}</span>
          </button>
        </>
      )}
      {menu.view === "facilities" && (
        <>
          {back}
          {menu.groups.map((g, i) => (
            <figure key={g.id} className="fa-guide" role="group" aria-label={t(`build.group.${g.id}`)}>
              <div className="fa-guide-tools">{g.items.map(tool)}</div>
              <figcaption>
                <b>{t("build.groupNo", { n: ["I", "II", "III", "IV", "V"][i] ?? String(i + 1) })}</b> {t(`build.group.${g.id}`)}
              </figcaption>
            </figure>
          ))}
          {teasers.length > 0 && (
            <figure className="fa-guide" role="group" aria-label={t("build.locked")}>
              <div className="fa-guide-tools">
                {teasers.map((teaser, i) => (
                  <div key={`${teaser.label}-${i}`} className="fa-tool locked" aria-disabled title={`${t("build.locked")}: ${teaser.hint}`}>
                    <span className="fa-well">
                      <LockIcon />
                    </span>
                    <span className="fa-tname">{teaser.label}</span>
                    <span className="fa-price">{teaser.hint}</span>
                  </div>
                ))}
              </div>
              <figcaption>{t("build.locked")}</figcaption>
            </figure>
          )}
        </>
      )}
      {menu.view === "run" && (
        <>
          {back}
          <RunBox
            className="fa-run"
            placeholder="thoughts.txt"
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

/**
 * The tool shelf, behind one "Build" engraving you press: only the tools you have unlocked, round engravings with their name
 * and price in small capitals, then the ones still locked (and what unlocks them), then Help. A line of italic text above says
 * what the tool in hand does. It scrolls sideways when there are more tools than screen.
 */
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
  return (
    <div className="fa-shelfwrap">
      {tip && (
        <div className="fa-tip fa-paper" role="status">
          <i>{tip.name}</i> — {tip.text} {tip.upkeepText && <span className="dim">{tip.upkeepText}</span>}
        </div>
      )}
      {open && <Shelf items={items} teasers={teasers} widgets={widgets} actions={actions} done={() => toggle(false)} />}
      <div className="fa-shelf fa-paper fa-shelf-closed">
        <button className={`fa-tool fa-open ${open ? "on" : ""}`} aria-expanded={open} aria-haspopup="true" onClick={() => toggle(!open)} {...coach.attrs("start", !open && inside)}>
          <span className="fa-well">
            <ToolIcon kind="path" />
          </span>
          <span className="fa-tname">{t("build.open")}</span>
          {held && <span className="fa-price">{held.short}</span>}
        </button>
      </div>
    </div>
  );
}

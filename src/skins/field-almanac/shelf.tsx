import { useState } from "react";
import { useCoach, useT } from "../kit";
import type { SlotPropsMap } from "../types";
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

/** What is inside the open shelf: the unlocked tools, the locked ones and Help. `done` shuts the shelf. */
export function Shelf({ items, teasers = [], actions, done }: Pick<SlotPropsMap["BuildBar"], "items" | "teasers" | "actions"> & { done: () => void }) {
  const t = useT();
  const coach = useCoach();
  return (
    <div className="fa-shelf fa-paper" role="toolbar" aria-label={t("build.menuTitle")} data-coach-panel>
      {items.map((it) => (
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
      ))}
      {teasers.map((teaser, i) => (
        <div key={`${teaser.label}-${i}`} className="fa-tool locked" aria-disabled title={`${t("build.locked")}: ${teaser.hint}`}>
          <span className="fa-well">
            <LockIcon />
          </span>
          <span className="fa-tname">{teaser.label}</span>
          <span className="fa-price">{teaser.hint}</span>
        </div>
      ))}
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
    </div>
  );
}

/**
 * The tool shelf, behind one "Build" engraving you press: only the tools you have unlocked, round engravings with their name
 * and price in small capitals, then the ones still locked (and what unlocks them), then Help. A line of italic text above says
 * what the tool in hand does. It scrolls sideways when there are more tools than screen.
 */
export function BuildBar({ items, tip, teasers = [], actions }: SlotPropsMap["BuildBar"]) {
  const t = useT();
  const coach = useCoach();
  const [open, setOpen] = useState(false);
  const toggle = (next: boolean) => {
    setOpen(next);
    actions.buildPanel(next);
  };
  const held = items.find((it) => it.selected && it.kind !== "staff");
  const inside = coach.intoPanel(items);
  return (
    <div className="fa-shelfwrap">
      {tip && (
        <div className="fa-tip fa-paper" role="status">
          <i>{tip.name}</i> — {tip.text} {tip.upkeepText && <span className="dim">{tip.upkeepText}</span>}
        </div>
      )}
      {open && <Shelf items={items} teasers={teasers} actions={actions} done={() => toggle(false)} />}
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

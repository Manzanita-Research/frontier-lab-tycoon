// The arcade: every build tool is a round button with a little LCD under it for the name and the price. The tool in hand
// is pressed down and ringed in white; one you cannot afford goes grey. The whole row sits behind one BUILD button you press
// (only what the lab has unlocked inside it, then the buttons still dark, then Help).
import { useState, type CSSProperties } from "react";
import { useCoach, useT } from "../context";
import type { SlotPropsMap } from "../types";
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

/** What is inside the open arcade: the unlocked buttons, the dark ones (with what lights them) and Help. `done` shuts it. */
export function Arcade({ items, teasers = [], actions, done }: Pick<SlotPropsMap["BuildBar"], "items" | "teasers" | "actions"> & { done: () => void }) {
  const t = useT();
  const coach = useCoach();
  return (
    <div className="kn-tray kn-plastic" role="toolbar" aria-label={t("build.menuTitle")} data-coach-panel>
      {items.map((it) => {
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
      })}
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
    </div>
  );
}

export function BuildBar({ items, tip, teasers = [], actions }: SlotPropsMap["BuildBar"]) {
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
      {open && <Arcade items={items} teasers={teasers} actions={actions} done={() => toggle(false)} />}
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

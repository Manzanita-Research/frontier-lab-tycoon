// The Build Stamps: a Kid Pix-style tray of rubber stamps, one per thing you can build.
import { useState, type ReactNode } from "react";
import { useCoach, useT } from "../context";
import type { SlotPropsMap } from "../types";
import { Icon } from "./art";

const INK = "#111";
const S = { stroke: INK, strokeLinejoin: "round", strokeLinecap: "round" } as const;

/** 32 x 32 clip art for each tool, in the primary colours of the mockup. */
const ART: Record<string, ReactNode> = {
  path: <path d="M3 20 16 27 29 20 16 13Z" fill="#E8C37A" strokeWidth="2.5" {...S} />,
  cluster: (
    <>
      <rect x="5" y="6" width="10" height="21" fill="#1A5BD6" strokeWidth="2.5" {...S} />
      <rect x="17" y="11" width="10" height="16" fill="#1A5BD6" strokeWidth="2.5" {...S} />
      <path d="M8 11h4M8 16h4M20 16h4" stroke="#FFD400" strokeWidth="2.5" />
    </>
  ),
  hall: (
    <>
      <path d="M4 25a12 12 0 0 1 24 0Z" fill="#fff" strokeWidth="2.5" {...S} />
      <rect x="2" y="24" width="28" height="4" fill="#7B3FC4" strokeWidth="2" {...S} />
    </>
  ),
  gateway: <path d="M6 28V14a10 10 0 0 1 20 0v14h-6V15a4 4 0 0 0-8 0v13Z" fill="#FF8A00" strokeWidth="2.5" {...S} />,
  kombucha: <path d="M12 3h8v5l4 4v17H8V12l4-4Z" fill="#FFD400" strokeWidth="2.5" {...S} />,
  nap: (
    <>
      <rect x="3" y="13" width="26" height="12" rx="6" fill="#7fd0ff" strokeWidth="2.5" {...S} />
      <path d="M21 4h6l-6 6h6" fill="none" strokeWidth="2.5" {...S} />
    </>
  ),
  snack: (
    <>
      <rect x="4" y="5" width="24" height="22" rx="2" fill="#fff" strokeWidth="2.5" {...S} />
      <rect x="7" y="8" width="6" height="6" fill="#E4222B" stroke={INK} strokeWidth="1.5" />
      <rect x="15" y="8" width="6" height="6" fill="#FFD400" stroke={INK} strokeWidth="1.5" />
      <rect x="7" y="17" width="6" height="6" fill="#1FA24A" stroke={INK} strokeWidth="1.5" />
      <rect x="15" y="17" width="6" height="6" fill="#1A5BD6" stroke={INK} strokeWidth="1.5" />
      <rect x="23" y="8" width="2.5" height="15" fill="#FF8A00" stroke={INK} strokeWidth="1.2" />
    </>
  ),
  demo: (
    <>
      <rect x="4" y="4" width="24" height="16" fill="#E4222B" strokeWidth="2.5" {...S} />
      <path d="M13 8v8l6-4Z" fill="#fff" />
      <path d="M16 20v7M10 28h12" fill="none" strokeWidth="2.5" {...S} />
    </>
  ),
  datacenter: (
    <>
      <rect x="4" y="5" width="24" height="7" fill="#1A5BD6" strokeWidth="2.5" {...S} />
      <rect x="4" y="14" width="24" height="7" fill="#1A5BD6" strokeWidth="2.5" {...S} />
      <rect x="4" y="23" width="24" height="5" fill="#1A5BD6" strokeWidth="2.5" {...S} />
      <path d="M8 8.5h4M8 17.5h4" stroke="#FFD400" strokeWidth="2.5" />
      <circle cx="23" cy="8.5" r="1.5" fill="#1FA24A" />
      <circle cx="23" cy="17.5" r="1.5" fill="#1FA24A" />
    </>
  ),
  gas: (
    <>
      <rect x="4" y="16" width="16" height="12" fill="#fff" strokeWidth="2.5" {...S} />
      <rect x="21" y="3" width="6" height="25" fill="#FF8A00" strokeWidth="2.5" {...S} />
      <path d="M8 16V11h4v5" fill="#E4222B" strokeWidth="2.2" {...S} />
    </>
  ),
  solar: (
    <>
      <path d="M4 24 9 12h19l-5 12Z" fill="#1A5BD6" strokeWidth="2.5" {...S} />
      <path d="M8 18h17M14 12 11 24M20 12l-3 12" stroke="#fff" strokeWidth="1.5" />
      <circle cx="7" cy="6" r="3.5" fill="#FFD400" stroke={INK} strokeWidth="2" />
    </>
  ),
  bulldoze: (
    <>
      <rect x="8" y="9" width="15" height="11" fill="#FFD400" strokeWidth="2.5" {...S} />
      <circle cx="11" cy="25" r="3.5" fill="#fff" strokeWidth="2.5" {...S} />
      <circle cx="21" cy="25" r="3.5" fill="#fff" strokeWidth="2.5" {...S} />
    </>
  ),
  locked: (
    <>
      <rect x="7" y="14" width="18" height="14" rx="2" fill="#bbb" strokeWidth="2.5" {...S} />
      <path d="M11 14v-3a5 5 0 0 1 10 0v3" fill="none" strokeWidth="2.5" {...S} />
      <circle cx="16" cy="21" r="2" fill={INK} />
    </>
  ),
  help: (
    <>
      <circle cx="16" cy="16" r="12" fill="#FFD400" strokeWidth="2.5" {...S} />
      <path d="M12 13a4 4 0 1 1 6 3.4c-1.300.8-2 1.600-2 3" fill="none" strokeWidth="2.5" {...S} />
      <circle cx="16" cy="24" r="1.600" fill={INK} />
    </>
  ),
  staff: (
    <>
      <circle cx="16" cy="19" r="6.5" fill="#f0c090" strokeWidth="2.5" {...S} />
      <path d="M8.5 17a7.5 7.5 0 0 1 15 0Z" fill="#FFD400" strokeWidth="2.5" {...S} />
      <path d="M8 30q8-8 16 0" fill="#1FA24A" strokeWidth="2.5" {...S} />
    </>
  ),
};

/** A stamp's picture. An unknown tool gets a gold star, so a new building never draws a hole. */
export function StampArt({ kind }: { kind: string }) {
  return (
    <svg className="dd-stamp-art" viewBox="0 0 32 32" aria-hidden focusable="false">
      {ART[kind] ?? <path d="M16 3l3.5 9.5 10 .5-8 6 3 10L16 24l-8.5 5 3-10-8-6 10-.5z" fill="#FFD400" strokeWidth="2.5" {...S} />}
    </svg>
  );
}

/** The stamps in the open tray, then the ones still in the box (locked, with what unlocks them), then Help. */
export function Stamps({ items, teasers, onPick, onHelp, actions }: { items: SlotPropsMap["BuildBar"]["items"]; teasers: NonNullable<SlotPropsMap["BuildBar"]["teasers"]>; onPick: () => void; onHelp: () => void; actions: SlotPropsMap["BuildBar"]["actions"] }) {
  const t = useT();
  const coach = useCoach();
  return (
    <div className="dd-tray-row" role="toolbar" aria-label={t("build.menuTitle")}>
            {items.map((it) => (
              <button
                key={it.kind}
                type="button"
                {...coach.attrs(`build:${it.kind}`)}
                className={`dd-stamp ${it.selected ? "on" : ""} ${it.affordable ? "" : "poor"} ${it.race ? "race" : ""} ${it.kind === "staff" ? "dd-staff-tool" : ""}`}
                onClick={() => {
                  actions.place(it.kind);
                  onPick();
                }}
                disabled={!it.affordable && !it.selected}
                aria-pressed={it.selected}
                title={it.name}
              >
                {it.hotkey !== null && <span className="dd-key">{it.hotkey}</span>}
                <StampArt kind={it.kind} />
                <span className="dd-sname">{it.short}</span>
                <span className={`dd-price ${it.free ? "free" : ""}`}>{it.isBulldoze ? "½" : it.kind === "staff" ? t("staff.hire") : it.free ? t("build.free") : it.priceText}</span>
                {it.race && <span className="dd-prize" aria-hidden><Icon name="trophy" size={14} /></span>}
              </button>
            ))}
            {/* Not yet: stamps still in the box, and what unlocks them. */}
            {teasers.map((teaser, i) => (
              <div key={`${teaser.label}-${i}`} className="dd-stamp locked" aria-disabled title={`${t("build.locked")}: ${teaser.hint}`}>
                <StampArt kind="locked" />
                <span className="dd-sname">{teaser.label}</span>
                <span className="dd-price">{teaser.hint}</span>
              </div>
            ))}
            <button
              type="button"
              className="dd-stamp dd-help-stamp"
              onClick={onHelp}
            >
              <StampArt kind="help" />
              <span className="dd-sname">{t("build.help")}</span>
              <span className="dd-price">{t("help.title")}</span>
            </button>
          </div>
  );
}

/** The tray: a starry blue box of rubber stamps behind a red "BUILD STAMPS" tab you press to open it. Number keys 1 to 9 pick a stamp. */
export function BuildBar({ items, tip, teasers = [], layout, actions }: SlotPropsMap["BuildBar"]) {
  const t = useT();
  const coach = useCoach();
  const [open, setOpen] = useState(false);
  const toggle = (next: boolean) => {
    setOpen(next);
    actions.buildPanel(next);
  };
  const held = items.find((it) => it.selected && it.kind !== "staff");
  // While the coach points at a stamp and the tray is shut, the tab stands in for it.
  const inside = coach.target?.startsWith("build:") ?? false;
  return (
    <div className={`dd-stamps ${layout.compact ? "compact" : ""}`}>
      {tip && (
        <div className="dd-stamp-tip" role="status">
          <b>{tip.name}</b> {tip.text} {tip.upkeepText && <em>{tip.upkeepText}</em>}
        </div>
      )}
      <div className={`dd-tray ${open ? "" : "closed"}`} data-coach-panel={open ? "" : undefined}>
        <button type="button" className="dd-tray-label" aria-expanded={open} onClick={() => toggle(!open)} {...coach.attrs("start", !open && inside)}>
          {t("build.menuTitle")}
          {held && !open ? ` · ${held.short}` : ""}
        </button>
        {open && <Stamps items={items} teasers={teasers} onPick={() => toggle(false)} onHelp={() => { actions.openHelp(); toggle(false); }} actions={actions} />}
      </div>
    </div>
  );
}

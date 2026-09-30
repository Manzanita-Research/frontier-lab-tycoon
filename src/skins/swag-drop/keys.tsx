// The keyboard on the desk: the build palette, the speed keys, the camera and the news/sound/skin dock, all keycaps.
// A keycap is a cream face over a darker front band; pressing it sinks it (CSS: `.on` and `:active`).
import { useState, type ReactNode } from "react";
import { ALL_VISIBLE, DramaIcon, RunBox, useCoach, useStartMenu, useT, type StartView } from "../kit";
import type { SlotPropsMap } from "../types";
import type { BuildItemVM } from "../../ui/hud/types";
import { Glyph, KEY_ICONS } from "./icons";

/** A keycap's two parts. `band` is the front edge (the price on the build keys). */
function Cap({ face, band }: { face: ReactNode; band?: ReactNode }) {
  return (
    <>
      <span className="face">{face}</span>
      <span className="band">{band}</span>
    </>
  );
}

const LockGlyph = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="5" y="11" width="14" height="9" rx="2.5" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);
const HelpGlyph = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1.9-1.1 1.8M12 17h.01" />
  </svg>
);

const BackGlyph = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M14 6l-6 6 6 6" />
  </svg>
);
const FnGlyph = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="4" width="7.5" height="7.5" rx="1.5" />
    <rect x="13.5" y="4" width="7.5" height="7.5" rx="1.5" />
    <rect x="3" y="14.5" width="7.5" height="7.5" rx="1.5" />
    <path d="M17.25 15v6M14.25 18h6" />
  </svg>
);
const RunGlyph = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <path d="M7 10l3 2-3 2M12.5 15h4.5" />
  </svg>
);

/**
 * What is inside the open deck. The top row is the tools (Path, Bulldoze), Facilities (the buildings, in
 * labelled clusters of keys) and Run… (the widgets, in a Run box), then Help. `done` shuts the deck.
 */
export function Deck({ items, teasers = [], widgets = [], actions, done, view }: Pick<SlotPropsMap["BuildBar"], "items" | "teasers" | "actions" | "widgets"> & { done: () => void; view?: StartView }) {
  const t = useT();
  const coach = useCoach();
  const menu = useStartMenu(items, view);
  const key = (it: BuildItemVM) => (
    <button
      key={it.kind}
      type="button"
      className={`sd-key build k-${it.kind} ${it.race ? "race" : ""} ${it.selected ? "on" : ""} ${it.affordable ? "" : "broke"}`}
      onClick={() => {
        actions.place(it.kind);
        done();
      }}
      disabled={!it.affordable && !it.selected}
      aria-pressed={it.selected}
      title={it.name}
      {...coach.attrs(`build:${it.kind}`)}
    >
      <Cap
        face={
          <>
            <span className="leg">{it.hotkey ?? "·"}</span>
            <span className="pic">{KEY_ICONS[it.kind] ?? KEY_ICONS.path}</span>
            <span className="nm">{it.short}</span>
          </>
        }
        band={<span className={`pr ${it.free ? "free" : ""}`}>{it.isBulldoze ? t("build.refund") : it.free ? t("build.free") : it.priceText}</span>}
      />
    </button>
  );
  const back = (
    <button type="button" className="sd-key build back" onClick={() => menu.setView("top")}>
      <Cap
        face={
          <>
            <span className="pic">
              <BackGlyph />
            </span>
            <span className="nm">{t("run.back")}</span>
          </>
        }
      />
    </button>
  );
  return (
    <div className={`sd-deck view-${menu.view}`} role="toolbar" aria-label={t("build.menuTitle")} data-coach-panel>
      {menu.view === "top" && (
        <>
          {menu.tools.map(key)}
          <button type="button" className="sd-key build folder" data-testid="start-facilities" onClick={() => menu.setView("facilities")} {...menu.facilities}>
            <Cap
              face={
                <>
                  <span className="leg">fn</span>
                  <span className="pic">
                    <FnGlyph />
                  </span>
                  <span className="nm">{t("build.facilities")}</span>
                </>
              }
              band={<span className="pr">{t("build.facilitiesCount", { n: menu.count })}</span>}
            />
          </button>
          <button
            type="button"
            className="sd-key build folder"
            data-testid="start-run"
            onClick={() => {
              if (items.some((it) => it.selected && !it.panel)) actions.place(null);
              menu.setView("run");
            }}
          >
            <Cap
              face={
                <>
                  <span className="leg">run</span>
                  <span className="pic">
                    <RunGlyph />
                  </span>
                  <span className="nm">{t("build.run")}</span>
                </>
              }
              band={<span className="pr">{t("build.runCount", { n: widgets.length })}</span>}
            />
          </button>
          <button
            type="button"
            className="sd-key build help"
            onClick={() => {
              actions.openHelp();
              done();
            }}
          >
            <Cap
              face={
                <>
                  <span className="pic">
                    <HelpGlyph />
                  </span>
                  <span className="nm">{t("build.help")}</span>
                </>
              }
              band={<span className="pr">{t("help.title")}</span>}
            />
          </button>
        </>
      )}
      {menu.view === "facilities" && (
        <>
          {back}
          {menu.groups.map((g) => (
            <div key={g.id} className="sd-keygroup" role="group" aria-label={t(`build.group.${g.id}`)}>
              <span className="sd-keygroup-name">{t(`build.group.${g.id}`)}</span>
              <div className="sd-keygroup-keys">{g.items.map(key)}</div>
            </div>
          ))}
          {teasers.length > 0 && (
            <div className="sd-keygroup" role="group" aria-label={t("build.locked")}>
              <span className="sd-keygroup-name">{t("build.locked")}</span>
              <div className="sd-keygroup-keys">
                {teasers.map((teaser, i) => (
                  <div key={`${teaser.label}-${i}`} className="sd-key build locked" aria-disabled title={`${t("build.locked")}: ${teaser.hint}`}>
                    <Cap
                      face={
                        <>
                          <span className="pic">
                            <LockGlyph />
                          </span>
                          <span className="nm">{teaser.label}</span>
                        </>
                      }
                      band={<span className="pr">{teaser.hint}</span>}
                    />
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
            className="sd-run"
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
 * The build keys, behind one "Build" keycap you press: only the tools you have unlocked (one key each, its price on the front
 * band, its hotkey as the legend), then the keys still blank (locked, with what unlocks them), then Help.
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
    <div className="sd-deckwrap">
      {tip && (
        <div className="sd-tip" role="status">
          <b>{tip.name}</b> {tip.text} {tip.upkeepText && <span className="dim">{tip.upkeepText}</span>}
        </div>
      )}
      {open && <Deck items={items} teasers={teasers} widgets={widgets} actions={actions} done={() => toggle(false)} />}
      <div className="sd-deck sd-deck-closed">
        <button type="button" className={`sd-key build k-path open ${open ? "on" : ""}`} aria-expanded={open} aria-haspopup="true" onClick={() => toggle(!open)} {...coach.attrs("start", !open && inside)}>
          <Cap
            face={
              <>
                <span className="pic">{KEY_ICONS.path}</span>
                <span className="nm">{t("build.open")}</span>
              </>
            }
            band={<span className="pr">{held ? held.short : ""}</span>}
          />
        </button>
      </div>
    </div>
  );
}

/** Pause / 1× / 3× / 10× as four keys in a dark tray. The camera key (PhotoButton) sits in the fifth space. */
export function Speed({ speed, actions }: SlotPropsMap["Speed"]) {
  const t = useT();
  const coach = useCoach();
  return (
    <div className="sd-tray" role="group" aria-label={t("speed.label")}>
      {speed.options.map((o) => (
        <button key={o.value} type="button" className={`sd-key spd ${o.active ? "on" : ""}`} {...(o.value === 3 ? coach.attrs("speed") : {})} onClick={() => actions.setSpeed(o.value)} aria-label={t(o.key)} aria-pressed={o.active}>
          <Cap
            face={
              o.value === 0 ? (
                <span className="sd-pause" aria-hidden>
                  <i />
                  <i />
                </span>
              ) : (
                t(`speed.short.${o.value}`)
              )
            }
          />
        </button>
      ))}
      <span className="sd-slot" aria-hidden />
    </div>
  );
}

/** The camera key: it sits over the empty fifth space of the speed tray (see the CSS). */
export function PhotoButton({ photo, actions }: SlotPropsMap["PhotoButton"]) {
  const t = useT();
  if (photo.on) return null;
  return (
    <div className="sd-tray solo">
      <button type="button" className="sd-key camera" onClick={() => actions.setPhoto(true)} aria-label={t("photo.open")} title={t("photo.open")}>
        <Cap face={<Glyph name="camera" />} />
      </button>
    </div>
  );
}

/** The News Room, mute, mixer and skin keys, in a row at the bottom-left. */
export function NewsControls({ newsroom, sound, skins, visible = ALL_VISIBLE, actions }: SlotPropsMap["NewsControls"]) {
  const t = useT();
  return (
    <div className="sd-dock" role="group" aria-label={t("news.button")}>
      {visible.news && (
        <button type="button" className="sd-key dock news" onClick={() => actions.openNews()} aria-label={t("news.open")} title={t("news.open")}>
          <Cap face={<Glyph name="news" />} />
          {newsroom.unread > 0 && <b className="sd-unread">{newsroom.unread}</b>}
        </button>
      )}
      <button
        type="button"
        className="sd-key dock"
        onClick={() => actions.setMuted(!sound.muted)}
        aria-label={sound.muted ? t("sound.unmute") : t("sound.mute")}
        aria-pressed={sound.muted}
        title={sound.muted ? t("sound.unmute") : t("sound.mute")}
      >
        <Cap face={<Glyph name={sound.muted ? "muted" : "sound"} />} />
      </button>
      <button type="button" className="sd-key dock" onClick={() => actions.openMixer()} aria-label={t("sound.openMixer")} title={t("sound.openMixer")}>
        <Cap face={<Glyph name="mixer" />} />
      </button>
      {skins.list.length > 1 && (
        <button type="button" className="sd-key dock" onClick={() => actions.openSkinPicker()} aria-label={t("skin.open")} title={t("skin.open")}>
          <Cap face={<Glyph name="skin" />} />
        </button>
      )}
    </div>
  );
}

/** Today's Drama: one more keycap by the camera, with a sticker when there's a new pack. */
export function DramaButton({ drama, actions }: SlotPropsMap["DramaButton"]) {
  const t = useT();
  return (
    <div className="sd-tray solo">
      <button type="button" className={`sd-key camera drama${drama.on ? " on" : ""}`} onClick={() => actions.openDrama()} aria-label={t("drama.open")} title={t("drama.open")}>
        <Cap face={<DramaIcon size={24} stroke={2.2} />} />
        {drama.on ? <b className="sd-unread">{t("drama.on")}</b> : drama.fresh && <b className="sd-unread">{t("drama.new")}</b>}
      </button>
    </div>
  );
}

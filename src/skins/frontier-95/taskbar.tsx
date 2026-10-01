// The taskbar: Start (and its menu), quick-launch, the news tape, and the tray (speed, news, sound, camera, clock).
import { useEffect, useRef, useState } from "react";
import { ALL_VISIBLE, anchor, coachInFacilities, Dialog, door, facilityGroups, Marquee, useRunBox } from "../kit";
import { useCoach, useT } from "../context";
import type { SlotPropsMap } from "../types";
import type { BuildItemVM, WidgetVM } from "../../ui/hud/types";
import { Ico, SunriseMark } from "./icons";
import { Btn, Win } from "./parts";
import { useResetPlaces } from "./drag";

type Confirm = null | "ask" | "off" | "restart";

/** The joke confirm dialog behind "Shut Down Lab…". Nothing it says does anything to the game. */
function ShutDown({ lab, onClose }: { lab: string; onClose: () => void }) {
  const [choice, setChoice] = useState<"off" | "restart" | "stay">("off");
  const [stage, setStage] = useState<"ask" | "off" | "restart">("ask");
  useEffect(() => {
    if (stage === "ask") return;
    const id = window.setTimeout(onClose, stage === "restart" ? 2600 : 60_000);
    const key = () => onClose();
    window.addEventListener("keydown", key, true);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("keydown", key, true);
    };
  }, [stage, onClose]);
  if (stage !== "ask") {
    return (
      <div className="f95-blackout" onPointerDown={onClose} role="alertdialog" aria-label={stage === "off" ? "It is now safe to turn off your lab" : "Restarting"}>
        {stage === "off" ? (
          <>
            <p>It's now safe to turn off {lab}.</p>
            <small>(Just kidding. Click or press any key to keep shipping.)</small>
          </>
        ) : (
          <>
            <p>Starting Frontier 95…</p>
            <small>Loading vibes.sys ▮</small>
          </>
        )}
      </div>
    );
  }
  return (
    <Dialog label="Shut Down Lab" close={onClose} layerClass="f95-layer f95-dim" dialogClass="f95-dialogbox">
      <Win title="Shut Down Lab" buttons={[{ g: "close", label: "Close", onClick: onClose }]} className="f95-shut">
        <div className="f95-shutbody">
          <Ico name="off" size={40} />
          <fieldset>
            <legend>What do you want the lab to do?</legend>
            {(
              [
                ["off", `Shut down ${lab}`],
                ["restart", "Restart the lab in Energy Saver mode"],
                ["stay", "Keep shipping"],
              ] as const
            ).map(([id, label]) => (
              <label key={id}>
                <input type="radio" name="f95-shut" checked={choice === id} onChange={() => setChoice(id)} /> {label}
              </label>
            ))}
          </fieldset>
        </div>
        <div className="f95-row">
          <Btn def onClick={() => (choice === "stay" ? onClose() : setStage(choice))}>Yes</Btn>
          <Btn onClick={onClose}>No</Btn>
        </div>
      </Win>
    </Dialog>
  );
}

/** Where Frontier 95 draws each Run… widget from its own sprite. */
const WIDGET_ICONS: Record<string, string> = {
  properties: "info", finance: "chart", arena: "globe", benchmarks: "chart", thoughts: "chat", traffic: "net", discourse: "megaphone",
  papers: "doc", news: "news", staff: "staff", senate: "senate", disasters: "siren", drama: "drama", saves: "floppy", mods: "programs", display: "display",
  sound: "sound", help: "help",
};
const widgetIcon = (w: WidgetVM) => WIDGET_ICONS[w.id] ?? "doc";

/** Start ▸ Run…: type a file name ("thoughts.txt", "arena.exe") or pick one from the list below it. */
function RunDialog({ widgets, onRun, onClose }: { widgets: WidgetVM[]; onRun: (id: string) => void; onClose: () => void }) {
  const t = useT();
  const { typed, setTyped, shown, q, error, dismiss, go } = useRunBox(widgets, onRun);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);
  return (
    <Dialog label={t("run.title")} close={() => (error ? dismiss() : onClose())} layerClass="f95-layer" dialogClass="f95-dialogbox f95-rundialog">
      <Win title={t("run.title")} buttons={[{ g: "close", label: "Close", onClick: onClose }]} className="f95-run">
        <form
          className="f95-runbody"
          onSubmit={(e) => {
            e.preventDefault();
            go(typed);
          }}
        >
          <div className="f95-runhead">
            <Ico name="run" size={32} />
            <p>{t("run.prompt")}</p>
          </div>
          <label className="f95-runopen">
            <span>
              <u>O</u>pen:
            </span>
            <input ref={input} className="inset" value={typed} onChange={(e) => setTyped(e.target.value)} spellCheck={false} autoComplete="off" autoCapitalize="off" aria-label={t("run.open")} list="f95-run-files" data-testid="run-input" />
          </label>
          <datalist id="f95-run-files">
            {widgets.map((w) => (
              <option key={w.id} value={w.file} />
            ))}
          </datalist>
          <ul className="f95-runlist inset" role="listbox" aria-label="Widgets">
            {shown.map((w) => (
              <li key={w.id} role="option" aria-selected={w.file === q}>
                <button type="button" onClick={() => go(w.file)} onPointerEnter={(e) => e.pointerType === "mouse" && setTyped(w.file)} title={w.blurb}>
                  <Ico name={widgetIcon(w)} size={20} />
                  <span className="f">{w.file}</span>
                  <span className="n">{w.name}</span>
                  <small>{w.blurb}</small>
                </button>
              </li>
            ))}
            {shown.length === 0 && <li className="none">{t("run.none")}</li>}
          </ul>
          <div className="f95-row">
            <Btn def type="submit" data-testid="run-ok">
              {t("run.ok")}
            </Btn>
            <Btn onClick={onClose}>{t("run.cancel")}</Btn>
          </div>
        </form>
      </Win>
      {/* The error box sits inside the Run dialog, so its Esc (the dialog's) shuts the box first and the dialog second. */}
      {error && (
        <div className="f95-layer f95-runerr" role="alertdialog" aria-label={error.title}>
          <Win title={error.title} buttons={[{ g: "close", label: "Close", onClick: dismiss }]} className="f95-errbox">
            <div className="f95-shutbody">
              <Ico name="error" size={32} />
              <p>{error.text}</p>
            </div>
            <div className="f95-row">
              <Btn def autoFocus onClick={() => { dismiss(); input.current?.select(); }}>{t("run.ok")}</Btn>
            </div>
          </Win>
        </div>
      )}
    </Dialog>
  );
}

type Fly = null | "facilities" | "programs" | "settings";

/**
 * Start button and its menu (FLT-63): Path and Bulldoze… on top, every building in Facilities ▸ (grouped, like Programs
 * in the real thing), the widgets in Programs ▸ and behind Run…, then Help, Settings ▸ and Shut Down Lab…. A flyout opens
 * on hover or click; on a phone it opens in place instead.
 */
export function BuildBar({ items, tip, teasers = [], disasters, widgets = [], actions, speed }: SlotPropsMap["BuildBar"]) {
  const t = useT();
  const coach = useCoach();
  const [openRaw, setOpenRaw] = useState(false);
  const open = openRaw;
  const [fly, setFly] = useState<Fly>(null);
  // The first coach step waits for the menu to open, so say so each time it does.
  const setOpen = (next: boolean) => {
    setOpenRaw(next);
    setFly(null);
    if (next) actions.buildPanel(true);
  };
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [run, setRun] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const places = useResetPlaces();

  // A tap outside, or Escape, closes the menu.
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

  // On a phone a flyout opens in place and the menu grows upward: bring its entry to the top of the (scrolling) menu.
  useEffect(() => {
    const li = fly ? root.current?.querySelector<HTMLElement>(`[data-fly="${fly}"]`) : null;
    const sub = li?.querySelector<HTMLElement>(".f95-fly");
    if (li && sub && getComputedStyle(sub).position === "static") li.scrollIntoView({ block: "start" });
  }, [fly]);

  const { tools, groups } = facilityGroups(items);
  const path = tools.find((i) => i.isPath);
  const bulldoze = tools.find((i) => i.isBulldoze);
  const quick = items
    .filter((i) => !i.isPath && !i.isBulldoze && !i.panel)
    .map((it, order) => ({ it, order }))
    .sort((a, b) => b.it.built - a.it.built || a.order - b.order)
    .slice(0, 3)
    .map((x) => x.it);
  const held = items.find((i) => i.selected && !i.panel);
  const pick = (kind: string) => {
    actions.place(kind);
    setOpen(false);
  };
  const launch = (id: string) => {
    setOpen(false);
    setRun(false);
    actions.openWidget(id);
  };
  // The coach points at a building while Facilities ▸ is shut: its entry stands in, so the spotlight has something to light.
  const facCoach = fly !== "facilities" && coach.intoPanel(items) && coachInFacilities(coach.target, items);
  // Hover opens a flyout (a mouse only: a tap is a click); a click only ever opens, so hover-then-click never shuts it.
  const flyProps = (id: Exclude<Fly, null>) => ({
    onPointerEnter: (e: React.PointerEvent) => e.pointerType === "mouse" && setFly(id),
  });
  const hoverShut = { onPointerEnter: (e: React.PointerEvent) => e.pointerType === "mouse" && setFly(null) };
  const opener = (id: Exclude<Fly, null>) => ({ role: "menuitem", "aria-haspopup": "menu" as const, "aria-expanded": fly === id, className: fly === id ? "on" : "", onClick: () => setFly(id) });
  const row = (it: BuildItemVM, size = 24) => (
    <button type="button" role="menuitem" {...coach.attrs(`build:${it.kind}`)} {...(it.kind === "staff" ? door("hire:*") : {})} className={it.selected ? "on" : ""} disabled={!it.affordable && !it.selected} onClick={() => pick(it.kind)}>
      <Ico name={it.kind} size={size} />
      <span>{it.name}</span>
      <span className="hk">{it.hotkey ?? ""}</span>
      <span className="p">{it.free ? t("build.free") : it.priceText}</span>
    </button>
  );

  return (
    <div className="f95-startwrap" ref={root}>
      {open && (
        <div className="f95-win f95-menu" data-coach-panel role="menu" aria-label={t("build.menuTitle")}>
          <div className="side f95-dither" aria-hidden>
            <b>Frontier</b>95
          </div>
          <ul>
            {path && <li {...hoverShut}>{row(path)}</li>}
            {bulldoze && (
              <li {...hoverShut}>
                <button type="button" role="menuitem" {...coach.attrs(`build:${bulldoze.kind}`)} className={bulldoze.selected ? "on" : ""} onClick={() => pick(bulldoze.kind)}>
                  <Ico name="bulldoze" size={24} />
                  <span>{t("build.bulldoze")}…</span>
                  <span className="hk">{bulldoze.hotkey ?? ""}</span>
                  <span className="p">½ back</span>
                </button>
              </li>
            )}
            <li className="sep" role="separator" />
            <li className="fly" data-fly="facilities" {...flyProps("facilities")}>
              <button type="button" {...opener("facilities")} {...coach.attrs("start:facilities", facCoach)} {...door("build:*", "hire:*")} data-testid="start-facilities">
                <Ico name="folder" size={24} />
                <span>{t("build.facilities")}</span>
                <span className="hk" />
                <span className="p arrow" aria-hidden />
              </button>
              {fly === "facilities" && (
                <div className="f95-win f95-fly f95-facilities" role="menu" aria-label={t("build.facilities")} data-coach-panel>
                  {groups.map((g) => (
                    <ul key={g.id} role="group" aria-label={t(`build.group.${g.id}`)}>
                      <li className="hd" role="presentation">
                        {t(`build.group.${g.id}`)}
                      </li>
                      {g.items.map((it) => (
                        <li key={it.kind}>{row(it, 20)}</li>
                      ))}
                    </ul>
                  ))}
                  {teasers.length > 0 && (
                    <ul role="group" aria-label={t("build.locked")} className="locked-group">
                      <li className="hd" role="presentation">
                        {t("build.locked")}
                      </li>
                      {teasers.map((teaser, i) => (
                        <li key={`${teaser.label}-${i}`} className="locked">
                          <button type="button" role="menuitem" disabled aria-disabled title={`${t("build.locked")}: ${teaser.hint}`}>
                            <Ico name="lock" size={20} />
                            <span>
                              {teaser.label}
                              {teaser.hint && <> · {teaser.hint}</>}
                            </span>
                            <span className="hk" />
                            <span className="p" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
            <li className="fly" data-fly="programs" {...flyProps("programs")}>
              <button type="button" {...opener("programs")} {...door("app:*")}>
                <Ico name="programs" size={24} />
                <span>Programs</span>
                <span className="hk" />
                <span className="p arrow" aria-hidden />
              </button>
              {fly === "programs" && (
                <div className="f95-win f95-fly" role="menu" aria-label="Programs">
                  <ul>
                    {widgets.map((w) => (
                      <li key={w.id}>
                        <button type="button" role="menuitem" title={w.blurb} {...anchor(`app:${w.id}`)} {...(w.id === "staff" ? door("hire:*") : {})} onClick={() => launch(w.id)}>
                          <Ico name={widgetIcon(w)} size={20} />
                          <span>{w.id === "drama" ? t("drama.button") : w.name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
            <li {...hoverShut}>
              <button type="button" role="menuitem" data-testid="start-run" onClick={() => { setOpen(false); if (held) actions.place(null); setRun(true); }}>
                <Ico name="run" size={24} />
                <span>{t("build.run")}</span>
              </button>
            </li>
            <li {...hoverShut}>
              <button type="button" role="menuitem" data-testid="start-saves" onClick={() => launch("saves")}>
                <Ico name="floppy" size={24} />
                <span>{t("saves.open")}…</span>
                <span className="hk">Ctrl+S</span>
              </button>
            </li>
            <li {...hoverShut}>
              <button type="button" role="menuitem" onClick={() => { setOpen(false); actions.openHelp(); }}>
                <Ico name="help" size={24} />
                <span>{t("build.help")}…</span>
                <span className="hk" />
                <span className="p" />
              </button>
            </li>
            <li className="fly" data-fly="settings" {...flyProps("settings")}>
              <button type="button" {...opener("settings")}>
                <Ico name="display" size={24} />
                <span>{t("build.settings")}</span>
                <span className="hk" />
                <span className="p arrow" aria-hidden />
              </button>
              {fly === "settings" && (
                <div className="f95-win f95-fly" role="menu" aria-label={t("build.settings")}>
                  <ul>
                    <li>
                      <button type="button" role="menuitem" onClick={() => { setOpen(false); actions.openSkinPicker(); }}>
                        <Ico name="display" size={20} />
                        <span>{t("build.display")}</span>
                      </button>
                    </li>
                    <li>
                      <button type="button" role="menuitem" onClick={() => { setOpen(false); actions.openMixer(); }}>
                        <Ico name="sound" size={20} />
                        <span>Sound…</span>
                      </button>
                    </li>
                    <li>
                      <button type="button" role="menuitem" onClick={() => { setOpen(false); actions.openMods(); }}>
                        <Ico name="programs" size={20} />
                        <span>Mods…</span>
                      </button>
                    </li>
                    {speed && (
                      <li>
                        <button type="button" role="menuitemcheckbox" aria-checked={speed.slowForBadNews} data-testid="start-slow-bad-news" onClick={() => { setOpen(false); actions.setSlowForBadNews(!speed.slowForBadNews); }}>
                          <span className={`f95-menu-tick${speed.slowForBadNews ? " on" : ""}`} aria-hidden />
                          <span>{t("speed.slowForBadNews")}</span>
                        </button>
                      </li>
                    )}
                    {places.shown && (
                      <li>
                        <button type="button" role="menuitem" data-testid="start-reset-windows" disabled={!places.any} title={places.any ? undefined : "Drag a window by its title bar first"} onClick={() => { setOpen(false); places.reset(); }}>
                          <Ico name="windows" size={20} />
                          <span>Reset window positions</span>
                        </button>
                      </li>
                    )}
                    {disasters?.enabled && (
                      <li>
                        <button type="button" role="menuitem" data-testid="start-disasters" onClick={() => { setOpen(false); actions.openDisasters(); }}>
                          <Ico name="siren" size={20} />
                          <span>{t("disasters.more")}</span>
                        </button>
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </li>
            <li className="sep" role="separator" />
            <li {...hoverShut}>
              <button type="button" role="menuitem" onClick={() => { setOpen(false); setConfirm("ask"); }}>
                <Ico name="off" size={24} />
                <span>{t("build.shutdown")}</span>
              </button>
            </li>
          </ul>
        </div>
      )}
      {tip && (
        <div className="f95-tooltip buildtip" role="status">
          <b>{tip.name}</b> {tip.text} {tip.upkeepText && <small>{tip.upkeepText}</small>}
        </div>
      )}
      <button type="button" {...coach.attrs("start", !open && coach.intoPanel(items))} className={`f95-start ${open ? "on" : ""}`} data-testid="start-button" {...door("build:*", "hire:*", "app:*")} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        <SunriseMark />
        <span>{t("build.menuTitle")}</span>
      </button>
      <span className="f95-qs" role="group" aria-label="Quick launch">
        {quick.map((it) => (
          <button key={it.kind} type="button" className={`f95-qb ${it.selected ? "on" : ""}`} title={`${it.name} (${it.priceText})`} aria-label={it.name} aria-pressed={it.selected} disabled={!it.affordable && !it.selected} onClick={() => actions.place(it.kind)}>
            <Ico name={it.kind} size={20} />
          </button>
        ))}
      </span>
      {held && (
        <button type="button" className="f95-task on" onClick={() => actions.place(null)} title="Put the tool away (Esc)">
          <Ico name={held.kind} size={16} />
          <span>{t("build.placing", { name: held.short })}</span>
        </button>
      )}
      {run && <RunDialog widgets={widgets} onRun={launch} onClose={() => setRun(false)} />}
      {confirm && <ShutDown lab="the lab" onClose={() => setConfirm(null)} />}
    </div>
  );
}

/** What each waiting window is called on a 1995 taskbar, and its icon. */
const TASKS: Record<SlotPropsMap["WindowTray"]["tray"][number]["id"], { name: string; icon: string }> = {
  arena: { name: "Task Mangler", icon: "chart" },
  news: { name: "Frontier Times", icon: "news" },
  unlock: { name: "Frontier 95", icon: "info" },
  paper: { name: "arXive", icon: "doc" },
  wiki: { name: "CrumbWiki", icon: "globe" },
  papers: { name: "Publish or Perish", icon: "doc" },
  factions: { name: "Discourse Monitor", icon: "megaphone" },
};

/**
 * FLT-54: the windows the game opened while two were already up wait here as taskbar buttons that flash navy, the way a
 * 1995 program asked for you; a folded window with news the ticker already told gets a red dot and the count.
 */
export function WindowTray({ tray, actions }: SlotPropsMap["WindowTray"]) {
  return (
    <span className="f95-waiting" role="group" aria-label="Waiting windows">
      {tray.map((item) => {
        const task = TASKS[item.id];
        return (
          <button key={item.id} type="button" className={`f95-wait${item.flashing ? " flashing" : ""}`} onClick={() => actions.openTray(item.id)} title={item.unread > 0 ? `${task.name}: ${item.unread} new` : `${task.name}: ${item.label}`}>
            <Ico name={task.icon} size={16} />
            <span>{task.name}</span>
            {item.unread > 0 && <b className="f95-unread">{item.unread > 9 ? "9+" : item.unread}</b>}
          </button>
        );
      })}
    </span>
  );
}

const SPEED_GLYPHS: Record<number, number> = { 1: 1, 3: 2, 10: 3 };

/** Speed in the tray: pause and one, two, three triangles (the coach says "Press ▶▶"), plain tooltips, and the clock. */
export function Speed({ speed, stats, actions }: SlotPropsMap["Speed"]) {
  const t = useT();
  const coach = useCoach();
  return (
    <>
      <div className="f95-speed" role="group" aria-label={t("speed.label")}>
        {speed.options.map((o) => (
          <button key={o.value} type="button" className={`f95-s ${o.active ? "on" : ""}`} title={t(o.key)} aria-label={t(o.key)} aria-pressed={o.active} {...(o.value === 3 ? coach.attrs("speed") : {})} onClick={() => actions.setSpeed(o.value)}>
            <svg width="16" height="14" viewBox="0 0 16 14" shapeRendering="crispEdges" aria-hidden>
              {o.value === 0 ? (
                <>
                  <rect x="3" y="2" width="3" height="10" />
                  <rect x="9" y="2" width="3" height="10" />
                </>
              ) : (
                Array.from({ length: SPEED_GLYPHS[o.value] ?? 1 }, (_, i) => <path key={i} d={`M${2 + i * 4} 2v10l4-5z`} />)
              )}
            </svg>
          </button>
        ))}
      </div>
      <span className="f95-clock" aria-label={`${stats.dateShort}, ${stats.time}`}>
        {stats.dateShort} · {stats.time}
      </span>
    </>
  );
}

/** The inset "PointPast News ▸" strip. */
export function Ticker({ items }: SlotPropsMap["Ticker"]) {
  const t = useT();
  return (
    <div className="f95-news inset" aria-label={t("ticker.aria")}>
      <b>{t("ticker.label")}</b>
      <div className="f95-newsview">
        <Marquee items={items} className="ticker-track" />
      </div>
    </div>
  );
}

export function NewsControls({ newsroom, sound, visible = ALL_VISIBLE, actions }: SlotPropsMap["NewsControls"]) {
  const t = useT();
  return (
    <>
      {visible.news && (
        <button type="button" className="f95-s news" onClick={() => actions.openNews()} aria-label={t("news.open")} title={t("news.button")}>
          <Ico name="news" size={18} />
          {newsroom.unread > 0 && <b className="f95-badge-n">{newsroom.unread}</b>}
        </button>
      )}
      <button type="button" className="f95-s snd" onClick={() => actions.setMuted(!sound.muted)} aria-label={sound.muted ? t("sound.unmute") : t("sound.mute")} aria-pressed={sound.muted} title={sound.muted ? t("sound.unmute") : t("sound.mute")}>
        <Ico name={sound.muted ? "mute" : "sound"} size={18} />
      </button>
    </>
  );
}

/** Today's Drama in the tray: a megaphone, with a red "!" when there's a pack you haven't opened. */
export function DramaButton({ drama, actions }: SlotPropsMap["DramaButton"]) {
  const t = useT();
  const label = drama.on ? `${t("drama.open")} (${drama.on.title} is on)` : t("drama.open");
  return (
    <button type="button" className={`f95-s drama ${drama.fresh ? "fresh" : ""} ${drama.on ? "on" : ""}`} onClick={() => actions.openDrama()} aria-label={label} title={label}>
      <Ico name="drama" size={18} />
      {drama.fresh && <b className="f95-badge-n">!</b>}
    </button>
  );
}

export function PhotoButton({ photo, actions }: SlotPropsMap["PhotoButton"]) {
  const t = useT();
  if (photo.on) return null;
  return (
    <button type="button" className="f95-s cam" onClick={() => actions.setPhoto(true)} aria-label={t("photo.open")} title={t("photo.open")}>
      <Ico name="camera" size={18} />
    </button>
  );
}

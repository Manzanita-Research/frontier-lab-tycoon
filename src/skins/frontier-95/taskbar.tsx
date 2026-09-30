// The taskbar: Start (and its menu), quick-launch, the news tape, and the tray (speed, news, sound, camera, clock).
import { useEffect, useRef, useState } from "react";
import { ALL_VISIBLE, Dialog, Marquee } from "../kit";
import { useCoach, useT } from "../context";
import type { SlotPropsMap } from "../types";
import { Flag, Ico } from "./icons";
import { Btn, Win } from "./parts";

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

/** Start button, its menu (every building, Bulldoze…, Settings, Shut Down Lab…), quick-launch, and the tool in hand. */
export function BuildBar({ items, tip, teasers = [], actions }: SlotPropsMap["BuildBar"]) {
  const t = useT();
  const coach = useCoach();
  const [openRaw, setOpenRaw] = useState(false);
  const open = openRaw;
  // The first coach step waits for the menu to open, so say so each time it does.
  const setOpen = (next: boolean) => {
    setOpenRaw(next);
    if (next) actions.buildPanel(true);
  };
  const [settings, setSettings] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const root = useRef<HTMLDivElement>(null);

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

  const buildings = items.filter((i) => !i.isBulldoze);
  const bulldoze = items.find((i) => i.isBulldoze);
  const quick = buildings
    .filter((i) => !i.isPath && i.kind !== "staff")
    .map((it, order) => ({ it, order }))
    .sort((a, b) => b.it.built - a.it.built || a.order - b.order)
    .slice(0, 3)
    .map((x) => x.it);
  const held = items.find((i) => i.selected && i.kind !== "staff");
  const pick = (kind: string) => {
    actions.place(kind);
    setOpen(false);
  };

  return (
    <div className="f95-startwrap" ref={root}>
      {open && (
        <div className="f95-win f95-menu" data-coach-panel role="menu" aria-label={t("build.menuTitle")}>
          <div className="side f95-dither" aria-hidden>
            <b>Frontier</b>95
          </div>
          <ul>
            {buildings.map((it) => (
              <li key={it.kind}>
                <button type="button" role="menuitem" {...coach.attrs(`build:${it.kind}`)} className={it.selected ? "on" : ""} disabled={!it.affordable && !it.selected} onClick={() => pick(it.kind)}>
                  <Ico name={it.kind} size={24} />
                  <span>{it.name}</span>
                  <span className="hk">{it.hotkey ?? ""}</span>
                  <span className="p">{it.free ? t("build.free") : it.priceText}</span>
                </button>
              </li>
            ))}
            {/* What you have not unlocked yet, and what unlocks it. */}
            {teasers.map((teaser, i) => (
              <li key={`${teaser.label}-${i}`} className="locked">
                <button type="button" role="menuitem" disabled aria-disabled title={`${t("build.locked")}: ${teaser.hint}`}>
                  <Ico name="lock" size={24} />
                  <span>
                    {teaser.label}
                    {teaser.hint && <> · {teaser.hint}</>}
                  </span>
                  <span className="hk" />
                  <span className="p" />
                </button>
              </li>
            ))}
            <li className="sep" role="separator" />
            {bulldoze && (
              <li>
                <button type="button" role="menuitem" className={bulldoze.selected ? "on" : ""} onClick={() => pick(bulldoze.kind)}>
                  <Ico name="bulldoze" size={24} />
                  <span>{t("build.bulldoze")}…</span>
                  <span className="hk" />
                  <span className="p">½ back</span>
                </button>
              </li>
            )}
            <li>
              <button type="button" role="menuitem" onClick={() => { setOpen(false); actions.openHelp(); }}>
                <Ico name="help" size={24} />
                <span>{t("build.help")}…</span>
                <span className="hk" />
                <span className="p" />
              </button>
            </li>
            <li>
              <button type="button" role="menuitem" aria-expanded={settings} onClick={() => setSettings(!settings)}>
                <Ico name="display" size={24} />
                <span>{t("build.settings")}</span>
                <span className="hk" />
                <span className={`p arrow ${settings ? "down" : ""}`} aria-hidden />
              </button>
            </li>
            {settings && (
              <>
                <li className="sub">
                  <button type="button" role="menuitem" onClick={() => { setOpen(false); actions.openSkinPicker(); }}>
                    <span />
                    <span>{t("build.display")}</span>
                  </button>
                </li>
                <li className="sub">
                  <button type="button" role="menuitem" onClick={() => { setOpen(false); actions.openMixer(); }}>
                    <span />
                    <span>Sound…</span>
                  </button>
                </li>
              </>
            )}
            <li>
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
      <button type="button" {...coach.attrs("start", !open && coach.intoPanel(items))} className={`f95-start ${open ? "on" : ""}`} data-testid="start-button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Flag />
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
      {confirm && <ShutDown lab="the lab" onClose={() => setConfirm(null)} />}
    </div>
  );
}

const SPEED_GLYPHS: Record<number, number> = { 1: 1, 3: 2, 10: 3 };

/** Speed in the tray, labelled with pace words as tooltips (Rest, Steady, Strenuous, Grueling), and the clock. */
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

export function PhotoButton({ photo, actions }: SlotPropsMap["PhotoButton"]) {
  const t = useT();
  if (photo.on) return null;
  return (
    <button type="button" className="f95-s cam" onClick={() => actions.setPhoto(true)} aria-label={t("photo.open")} title={t("photo.open")}>
      <Ico name="camera" size={18} />
    </button>
  );
}

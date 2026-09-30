// The small controls: the Oregon Trail Pace buttons, the "DID YOU KNOW?" tape, and the row of round sticker buttons
// (News Room, sound, mixer, skins, camera).
import { useState } from "react";
import { ALL_VISIBLE, DramaIcon, Marquee } from "../kit";
import { useCoach, useT } from "../context";
import type { SlotPropsMap } from "../types";
import { Icon } from "./art";

const CAPTION: Record<number, string> = {
  0: "Everybody takes a nap.",
  1: "The lab makes good progress.",
  3: "The interns are getting tired.",
  10: "The interns are questioning everything.",
};

/** Rest / Steady / Strenuous / Grueling, like the wagon party's pace on the trail. */
export function Speed({ speed, actions }: SlotPropsMap["Speed"]) {
  const t = useT();
  const coach = useCoach();
  return (
    <div className="dd-pace" role="group" aria-label={t("speed.label")}>
      <div className="dd-pace-row">
        <span className="dd-pace-l">
          <Icon name="wagon" size={28} /> {t("speed.label")}:
        </span>
        {speed.options.map((o) => (
          <button key={o.value} type="button" className={`dd-pb ${o.active ? "on" : ""}`} {...(o.value === 3 ? coach.attrs("speed") : {})} onClick={() => actions.setSpeed(o.value)} aria-pressed={o.active} title={CAPTION[o.value]}>
            {o.value === 0 && <Icon name="pause" size={14} />}
            {t(o.key)}
          </button>
        ))}
      </div>
      <span className="dd-pace-cap">{CAPTION[speed.value]}</span>
    </div>
  );
}

export function Ticker({ items }: SlotPropsMap["Ticker"]) {
  const t = useT();
  return (
    <div className="dd-ticker" aria-label={t("ticker.aria")}>
      <span className="dd-ticker-tag">{t("ticker.label")}</span>
      <div className="dd-ticker-view">
        <Marquee items={items} className="dd-ticker-track" />
      </div>
    </div>
  );
}

export function NewsControls({ newsroom, sound, skins, visible = ALL_VISIBLE, actions }: SlotPropsMap["NewsControls"]) {
  const t = useT();
  // On a phone the sound, mixer and skin buttons fold behind one "more" button (CSS decides; on a desktop it's hidden).
  const [open, setOpen] = useState(false);
  return (
    <div className={`dd-tools ${open ? "open" : ""}`} role="group" aria-label="Tools">
      {visible.news && (
        <button type="button" className="dd-tool news" onClick={() => actions.openNews()} aria-label={t("news.open")} title={t("news.button")}>
          <Icon name="news" size={26} />
          {newsroom.unread > 0 && <b className="dd-unread">{newsroom.unread}</b>}
        </button>
      )}
      <button type="button" className="dd-tool dd-fold" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="More tools" title="More tools">
        <Icon name="more" size={26} />
      </button>
      <div className="dd-pop">
        <button type="button" className="dd-tool sound" onClick={() => actions.setMuted(!sound.muted)} aria-label={sound.muted ? t("sound.unmute") : t("sound.mute")} aria-pressed={sound.muted} title={sound.muted ? t("sound.unmute") : t("sound.mute")}>
          <Icon name={sound.muted ? "mute" : "sound"} size={26} />
        </button>
        <button type="button" className="dd-tool mixer" onClick={() => actions.openMixer()} aria-label={t("sound.openMixer")} title={t("sound.title")}>
          <Icon name="sliders" size={26} />
        </button>
        {skins.list.length > 1 && (
          <button type="button" className="dd-tool skin" onClick={() => actions.openSkinPicker()} aria-label={t("skin.open")} title={t("skin.open")}>
            <Icon name="palette" size={26} />
          </button>
        )}
      </div>
    </div>
  );
}

export function PhotoButton({ photo, actions }: SlotPropsMap["PhotoButton"]) {
  const t = useT();
  if (photo.on) return null;
  return (
    <button type="button" className="dd-tool cam" onClick={() => actions.setPhoto(true)} aria-label={t("photo.open")} title={t("photo.open")}>
      <Icon name="camera" size={26} />
    </button>
  );
}

export function NewsArrival({ arrival, actions }: SlotPropsMap["NewsArrival"]) {
  const t = useT();
  return (
    <aside className="dd-extra" role="status">
      <span className="dd-extra-tag">EXTRA!</span>
      <span className="dd-extra-text">{arrival.text}</span>
      <span className="dd-extra-btns">
        <button type="button" className="read" onClick={() => actions.viewNews(arrival.id)}>
          {t("news.read")}
        </button>
        <button type="button" onClick={() => actions.skipNews()}>
          {t("news.skip")}
        </button>
      </span>
    </aside>
  );
}

/** Today's Drama: one more big round button on the toolbar. */
export function DramaButton({ drama, actions }: SlotPropsMap["DramaButton"]) {
  const t = useT();
  return (
    <button type="button" className={`dd-tool dd-drama${drama.on ? " on" : ""}`} onClick={() => actions.openDrama()} aria-label={t("drama.open")} title={t("drama.button")}>
      <DramaIcon size={26} stroke={2.2} />
      {drama.on ? <b className="dd-unread">{t("drama.on")}</b> : drama.fresh && <b className="dd-unread">{t("drama.new")}</b>}
    </button>
  );
}

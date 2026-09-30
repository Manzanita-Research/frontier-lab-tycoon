import { ALL_VISIBLE } from "../kit";
// The tape deck: Stop / Play / Fast forward / Encore as chunky white keys, the record key (photo mode) beside them, and a
// row of small keys for the News Room, sound, the mixer and the skin picker. Plus the "EXTRA!" sticker when the paper lands.
import { useState } from "react";
import { useT } from "../context";
import type { SlotPropsMap } from "../types";
import { Star, Tape, ToolIcon } from "./art";

export function Speed({ speed, actions }: SlotPropsMap["Speed"]) {
  const t = useT();
  return (
    <div className="kn-speed" role="group" aria-label={t("speed.label")}>
      {speed.options.map((o) => (
        <button key={o.value} type="button" className={`kn-key ${o.active ? "on" : ""}`} onClick={() => actions.setSpeed(o.value)} aria-pressed={o.active} aria-label={t(o.key)} title={t(o.key)}>
          <Tape n={o.value} />
        </button>
      ))}
    </div>
  );
}

export function PhotoButton({ photo, actions }: SlotPropsMap["PhotoButton"]) {
  const t = useT();
  if (photo.on) return null;
  return (
    <button type="button" className="kn-key rec" onClick={() => actions.setPhoto(true)} aria-label={t("photo.open")} title={t("photo.open")}>
      <ToolIcon name="record" />
    </button>
  );
}

export function NewsControls({ newsroom, sound, skins, actions, visible = ALL_VISIBLE }: SlotPropsMap["NewsControls"]) {
  const t = useT();
  // On a phone the sound, mixer and skin keys fold behind one "more" key (the CSS decides; on a desktop it is hidden).
  const [open, setOpen] = useState(false);
  return (
    <div className={`kn-tools ${open ? "open" : ""}`} role="group" aria-label="Tools">
      {visible.news && (<button type="button" className="kn-key news" onClick={() => actions.openNews()} aria-label={newsroom.unread > 0 ? `${t("news.open")}, ${newsroom.unread} unread` : t("news.open")} title={t("news.button")}>
        <ToolIcon name="news" />
        <span className="kn-key-label">{t("news.button")}</span>
        {newsroom.unread > 0 && <b className="kn-unread">{newsroom.unread}</b>}
      </button>)}
      <button type="button" className="kn-key fold" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="More tools" title="More tools">
        <ToolIcon name="more" />
      </button>
      <div className="kn-tools-more">
        <button type="button" className="kn-key sound" onClick={() => actions.setMuted(!sound.muted)} aria-label={sound.muted ? t("sound.unmute") : t("sound.mute")} aria-pressed={sound.muted} title={sound.muted ? t("sound.unmute") : t("sound.mute")}>
          <ToolIcon name={sound.muted ? "mute" : "sound"} />
        </button>
        <button type="button" className="kn-key mixer" onClick={() => actions.openMixer()} aria-label={t("sound.openMixer")} title={t("sound.title")}>
          <ToolIcon name="mixer" />
        </button>
        {skins.list.length > 1 && (
          <button type="button" className="kn-key skins" onClick={() => actions.openSkinPicker()} aria-label={t("skin.open")} title={t("skin.open")}>
            <ToolIcon name="skins" />
          </button>
        )}
      </div>
    </div>
  );
}

export function NewsArrival({ arrival, actions }: SlotPropsMap["NewsArrival"]) {
  const t = useT();
  return (
    <aside className="kn-extra" role="status">
      <span className="kn-extra-tag">
        <Star /> EXTRA! <Star />
      </span>
      <span className="kn-extra-text">{arrival.text}</span>
      <span className="kn-extra-btns">
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

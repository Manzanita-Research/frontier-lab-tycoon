// The small controls: the Oregon Trail Pace buttons, the "DID YOU KNOW?" tape, and the row of round sticker buttons
// (News Room, sound, mixer, skins, camera).
import { Marquee } from "../kit";
import { useT } from "../context";
import type { SlotPropsMap } from "../types";
import { Icon } from "./art";

/** Rest / Steady / Strenuous / Grueling, like the wagon party's pace on the trail. */
export function Speed({ speed, actions }: SlotPropsMap["Speed"]) {
  const t = useT();
  return (
    <div className="dd-pace" role="group" aria-label={t("speed.label")}>
      <span className="dd-pace-l">
        <Icon name="wagon" size={28} /> {t("speed.label")}:
      </span>
      {speed.options.map((o) => (
        <button key={o.value} type="button" className={`dd-pb ${o.active ? "on" : ""}`} onClick={() => actions.setSpeed(o.value)} aria-pressed={o.active}>
          {o.value === 0 && <Icon name="pause" size={14} />}
          {t(o.key)}
        </button>
      ))}
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

export function NewsControls({ newsroom, sound, skins, actions }: SlotPropsMap["NewsControls"]) {
  const t = useT();
  return (
    <div className="dd-tools" role="group" aria-label="Tools">
      <button type="button" className="dd-tool news" onClick={() => actions.openNews()} aria-label={t("news.open")} title={t("news.button")}>
        <Icon name="news" size={26} />
        {newsroom.unread > 0 && <b className="dd-unread">{newsroom.unread}</b>}
      </button>
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

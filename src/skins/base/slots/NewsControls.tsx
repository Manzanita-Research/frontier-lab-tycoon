import { useT } from "../../context";
import type { SlotPropsMap } from "../../types";

/** The News Room button (with its unread badge), the mute switch, the mixer, and the way to the skin picker. */
export function NewsControls({ newsroom, sound, skins, actions }: SlotPropsMap["NewsControls"]) {
  const t = useT();
  return (
    <div className="news-controls panel">
      <button onClick={() => actions.openNews()} aria-label={t("news.open")}>
        ▤ <span>{t("news.button")}</span>
        {newsroom.unread > 0 && <b className="unread-count">{newsroom.unread}</b>}
      </button>
      <button onClick={() => actions.setMuted(!sound.muted)} aria-label={sound.muted ? t("sound.unmute") : t("sound.mute")}>
        {sound.muted ? "♪̸" : "♪"}
      </button>
      <button onClick={() => actions.openMixer()} aria-label={t("sound.openMixer")}>
        ☷
      </button>
      {skins.list.length > 1 && (
        <button onClick={() => actions.openSkinPicker()} aria-label={t("skin.open")} title={t("skin.open")}>
          ✦
        </button>
      )}
    </div>
  );
}

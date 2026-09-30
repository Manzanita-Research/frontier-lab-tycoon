import { ALL_VISIBLE } from "../kit";
import { useCoach } from "../kit";
// The keyboard on the desk: the build palette, the speed keys, the camera and the news/sound/skin dock, all keycaps.
// A keycap is a cream face over a darker front band; pressing it sinks it (CSS: `.on` and `:active`).
import type { ReactNode } from "react";
import { useT } from "../kit";
import type { SlotPropsMap } from "../types";
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

/** The build palette: one key per tool, its price on the front band, its hotkey as the legend. */
export function BuildBar({ items, tip, actions }: SlotPropsMap["BuildBar"]) {
  const coachApi = useCoach();
  const t = useT();
  return (
    <div className="sd-deckwrap">
      {tip && (
        <div className="sd-tip" role="status">
          <b>{tip.name}</b> {tip.text} {tip.upkeepText && <span className="dim">{tip.upkeepText}</span>}
        </div>
      )}
      <div className="sd-deck" role="toolbar" aria-label={t("build.menuTitle")} {...coachApi.attrs("start")} onClick={() => actions.buildPanel(true)}>
        {items.map((it) => (
          <button
            key={it.kind}
            type="button"
            className={`sd-key build k-${it.kind} ${it.race ? "race" : ""} ${it.selected ? "on" : ""} ${it.affordable ? "" : "broke"}`}
            onClick={() => actions.place(it.kind)}
            disabled={!it.affordable && !it.selected}
            aria-pressed={it.selected}
            title={it.name}
            {...coachApi.attrs(`build:${it.kind}`)}
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
        ))}
      </div>
    </div>
  );
}

/** Pause / 1× / 3× / 10× as four keys in a dark tray. The camera key (PhotoButton) sits in the fifth space. */
export function Speed({ speed, actions }: SlotPropsMap["Speed"]) {
  const t = useT();
  return (
    <div className="sd-tray" role="group" aria-label={t("speed.label")}>
      {speed.options.map((o) => (
        <button key={o.value} type="button" className={`sd-key spd ${o.active ? "on" : ""}`} onClick={() => actions.setSpeed(o.value)} aria-label={t(o.key)} aria-pressed={o.active}>
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
export function NewsControls({ newsroom, sound, skins, actions, visible = ALL_VISIBLE }: SlotPropsMap["NewsControls"]) {
  const t = useT();
  return (
    <div className="sd-dock" role="group" aria-label={t("news.button")}>
      {visible.news && (<button type="button" className="sd-key dock news" onClick={() => actions.openNews()} aria-label={t("news.open")} title={t("news.open")}>
        <Cap face={<Glyph name="news" />} />
        {newsroom.unread > 0 && <b className="sd-unread">{newsroom.unread}</b>}
      </button>)}
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

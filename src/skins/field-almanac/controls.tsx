import { useState } from "react";
import { ALL_VISIBLE, DramaIcon, SpeedGlyph, useCoach, useT, useWidget } from "../kit";
import type { SlotPropsMap } from "../types";
import { BubbleIcon, Caret, LeafIcon, LensIcon, LetterIcon, MixerIcon, PauseIcon, SoundIcon } from "./icons";

/** Pause, ▶, ▶▶, ▶▶▶ (1×, 3×, 10×) as round-ended buttons; the one that is running is ink. (The Layout puts the lens beside them.) */
export function Speed({ speed, actions }: SlotPropsMap["Speed"]) {
  const t = useT();
  const coach = useCoach();
  return (
    <div className="fa-speed" role="group" aria-label={t("speed.label")}>
      {speed.options.map((o) => (
        <button key={o.value} className={o.active ? "on" : ""} {...(o.value === 3 ? coach.attrs("speed") : {})} onClick={() => actions.setSpeed(o.value)} aria-label={t(o.key)} aria-pressed={o.active}>
          {o.value === 0 ? <PauseIcon /> : <SpeedGlyph value={o.value} />}
        </button>
      ))}
    </div>
  );
}

/** The camera: photo mode. (P does it from the keyboard; the game handles that.) */
export function PhotoButton({ photo, actions }: SlotPropsMap["PhotoButton"]) {
  const t = useT();
  if (photo.on) return null;
  return (
    <button className="fa-lens" onClick={() => actions.setPhoto(true)} aria-label={t("photo.open")} title={t("photo.open")}>
      <LensIcon />
    </button>
  );
}

/** The reading room (the News Room, with its unread count), the sound switch, the mixer and the way to the skin picker. */
export function NewsControls({ newsroom, sound, skins, visible = ALL_VISIBLE, actions }: SlotPropsMap["NewsControls"]) {
  const t = useT();
  return (
    <div className="fa-tools fa-paper" role="group">
      {visible.news && (
        <button className="wide" onClick={() => actions.openNews()} aria-label={t("news.open")}>
          <LetterIcon />
          <span>{t("news.button")}</span>
          {newsroom.unread > 0 && <b className="fa-unread">{newsroom.unread}</b>}
        </button>
      )}
      <button onClick={() => actions.setMuted(!sound.muted)} aria-label={sound.muted ? t("sound.unmute") : t("sound.mute")} aria-pressed={sound.muted}>
        <SoundIcon muted={sound.muted} />
      </button>
      <button onClick={() => actions.openMixer()} aria-label={t("sound.openMixer")} title={t("sound.openMixer")}>
        <MixerIcon />
      </button>
      {skins.list.length > 1 && (
        <button onClick={() => actions.openSkinPicker()} aria-label={t("skin.open")} title={t("skin.open")}>
          <LeafIcon />
        </button>
      )}
    </div>
  );
}

/**
 * "Overheard": everybody's thoughts, counted, most common first, in the italic serif of the bubbles. Tap a row to
 * light up who thinks it. It opens by default on a desktop and folds to a small button (with the tally) on a phone.
 */
export function ThoughtsPanel({ rows, layout, actions }: SlotPropsMap["ThoughtsPanel"]) {
  const t = useT();
  const [open, setOpen] = useState(() => !layout.compact);
  useWidget("thoughts", () => setOpen(true));
  const total = rows.reduce((n, r) => n + r.count, 0);
  return (
    <section className={`fa-overheard fa-paper ${open ? "open" : ""} ${layout.compact ? "compact" : ""}`} aria-label={t("thoughts.title")}>
      <button className="fa-over-head" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={`${t("thoughts.title")}, ${rows.length} kinds`}>
        <BubbleIcon />
        <span className="fa-over-title">{t("thoughts.title")}</span>
        <span className="fa-count">{total}</span>
        <Caret open={open} />
      </button>
      {open && (
        <ul className="fa-over-list">
          {rows.map((r) => (
            <li key={r.key}>
              <button className={`fa-thought kind-${r.kind} ${r.highlighted ? "on" : ""}`} onClick={() => actions.highlight(r.key)} aria-pressed={r.highlighted}>
                <span className="fa-count">{r.count}</span>
                <span className="fa-thought-body">
                  <span className="fa-who">{r.noun}</span> <q>{r.text}</q>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Today's Drama: a slip of paper pinned under the tools. */
export function DramaButton({ drama, actions }: SlotPropsMap["DramaButton"]) {
  const t = useT();
  return (
    <div className="fa-tools fa-paper fa-drama" role="group">
      <button className="wide" onClick={() => actions.openDrama()} aria-label={t("drama.open")}>
        <DramaIcon size={18} stroke={2} />
        <span>{t("drama.button")}</span>
        {drama.on ? <b className="fa-unread">{t("drama.on")}</b> : drama.fresh && <b className="fa-unread">{t("drama.new")}</b>}
      </button>
    </div>
  );
}

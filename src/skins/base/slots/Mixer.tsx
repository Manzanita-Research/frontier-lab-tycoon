import { Dialog } from "../../kit";
import { useT } from "../../context";
import type { SlotPropsMap } from "../../types";

const CHANNELS = [
  ["master", "Master"],
  ["music", "Music"],
  ["sfx", "Effects & ambience"],
] as const;

export function Mixer({ sound, actions }: SlotPropsMap["Mixer"]) {
  const t = useT();
  return (
    <Dialog label="Sound mixer" close={actions.closeMixer} layerClass="news-backdrop mixer-backdrop" dialogClass="news-dialog">
      <div className="mixer-box">
        <div className="news-toolbar">
          <b>{t("sound.title")}</b>
          <button onClick={() => actions.closeMixer()} aria-label="Close sound mixer">
            ×
          </button>
        </div>
        <p className="mixer-intro">Little sounds for big ambitions.</p>
        <button className="mute-button" aria-pressed={sound.muted} onClick={() => actions.setMuted(!sound.muted)}>
          {sound.muted ? "Unmute campus" : "Mute campus"}
        </button>
        {CHANNELS.map(([channel, label]) => (
          <label className="mixer-slider" key={channel}>
            <span>{label}</span>
            <input type="range" aria-label={channel} min={0} max={100} value={Math.round(sound[channel] * 100)} onChange={(e) => actions.setVolume(channel, Number(e.target.value) / 100)} />
            <output>{Math.round(sound[channel] * 100)}%</output>
          </label>
        ))}
        <small>{sound.ready ? "Settings saved on this device." : "Tap a control to start audio. If your browser blocks it, tap again."}</small>
        <details className="sound-audition">
          <summary>Try the sounds</summary>
          <div>
            {sound.cues.map((cue) => (
              <button key={cue.id} onClick={() => actions.playCue(cue.id)}>
                {cue.label}
              </button>
            ))}
          </div>
        </details>
      </div>
    </Dialog>
  );
}

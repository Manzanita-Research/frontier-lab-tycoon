import { useAtomValue } from "@effect/atom-react";
import { registry } from "../../app/game";
import { audioReadyAtom, mixerAtom, mixerOpenAtom, playCue, setMixer } from "../../audio/state";
import { CUES } from "../../audio/score";
import { Dialog } from "./Dialog";
export function Mixer() {
  const mixer = useAtomValue(mixerAtom);
  const open = useAtomValue(mixerOpenAtom);
  const ready = useAtomValue(audioReadyAtom);
  if (!open) return null;
  return <Dialog label="Sound mixer" close={() => registry.set(mixerOpenAtom, false)} className="mixer-backdrop"><div className="mixer-box"><div className="news-toolbar"><b>Campus sound</b><button onClick={() => registry.set(mixerOpenAtom, false)} aria-label="Close sound mixer">×</button></div><p className="mixer-intro">Little sounds for big ambitions.</p><button className="mute-button" aria-pressed={mixer.muted} onClick={() => setMixer({ muted: !mixer.muted })}>{mixer.muted ? "Unmute campus" : "Mute campus"}</button>{(["master", "music", "sfx"] as const).map((channel) => <label className="mixer-slider" key={channel}><span>{channel === "sfx" ? "Effects & ambience" : ({ master: "Master", music: "Music", sfx: "Effects & ambience" })[channel]}</span><input type="range" aria-label={channel} min={0} max={100} value={Math.round(mixer[channel] * 100)} onChange={(e) => setMixer({ [channel]: Number(e.target.value) / 100 })}/><output>{Math.round(mixer[channel] * 100)}%</output></label>)}<small>{ready ? "Settings saved on this device." : "Tap a control to start audio. If your browser blocks it, tap again."}</small><details className="sound-audition"><summary>Try the sounds</summary><div>{CUES.map((cue) => <button key={cue} onClick={() => playCue(cue)}>{({ place: "Place", coin: "Coin", bulldoze: "Bulldoze", card: "News card", choice: "Choice", release: "Release", era: "New era", breakdown: "Alarm" })[cue]}</button>)}</div></details></div></Dialog>;
}

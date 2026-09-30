import { Atom } from "effect/unstable/reactivity";
import { registry } from "../app/game";
import { DEFAULT_MIXER, readMixer, type Mixer, type SoundKit } from "./SoundKit";
const KEY = "frontier-lab-mixer-v1";
function initial() { try { return readMixer(localStorage.getItem(KEY)); } catch { return { ...DEFAULT_MIXER }; } }
export const mixerAtom = Atom.make(initial());
export const mixerOpenAtom = Atom.make(false);
export const audioReadyAtom = Atom.make(false);
let active: SoundKit | null = null;
export function bindSound(kit: SoundKit | null) { active = kit; }
export function playCue(cue: string) { active?.cue(cue); }
export function setMixer(patch: Partial<Mixer>) {
  const mixer = { ...registry.get(mixerAtom), ...patch };
  registry.set(mixerAtom, mixer);
  active?.setMixer(mixer);
  try { localStorage.setItem(KEY, JSON.stringify(mixer)); } catch { /* Mixer still works with blocked storage. */ }
}

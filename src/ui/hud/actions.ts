// Everything a skin may ask the game to do, wired to the app machine and the UI atoms. Skins get this object and
// nothing behind it.
import { appNow, debugParams, registry, send } from "../../app/game";
import { SPEEDS, type Speed, type Tool } from "../../app/hud";
import { mixerOpenAtom, playCue, setMixer } from "../../audio/state";
import type { Cue } from "../../audio/score";
import { fx } from "../../render/fx/state";
import { roomAtom, skipNews, viewRoom } from "../../newsroom/state";
import { setPhoto, takePhoto } from "../juice/photo";
import { arenaOpenAtom, chatCountAtom, photoFlashAtom, photoTimeAtom } from "./state";
import { skinActions } from "./skinControl";
import type { HudActions } from "./types";

const TIME_HOURS: Record<string, number | null> = { live: null, day: 13, golden: 18.3, night: 22.5 };

export const hudActions: HudActions = {
  place: (kind) => send({ type: "SET_TOOL", tool: kind as Tool | null }),
  setSpeed: (n) => {
    if ((SPEEDS as readonly number[]).includes(n)) send({ type: "SET_SPEED", speed: n as Speed });
  },
  togglePause: () => send({ type: "TOGGLE_PAUSE" }),
  choose: (eventId, choiceIndex) => {
    // Only the card that is open can be answered: a stale click from a card that just closed does nothing.
    if (appNow()?.event?.id === eventId) send({ type: "CHOOSE", choiceIndex });
  },
  continueEra: () => send({ type: "CHOOSE", choiceIndex: 0 }),
  select: (id) => send({ type: "SELECT", id }),
  follow: (walkerId, on = true) => {
    if (appNow()?.selected !== walkerId) send({ type: "SELECT", id: walkerId });
    send({ type: "SET_FOLLOW", follow: on });
  },
  closeInspector: () => send({ type: "SELECT", id: null }),
  highlight: (key) => send({ type: "HIGHLIGHT", key }),
  dismissToast: (id) => send({ type: "DISMISS_TOAST", id }),
  toggleArena: () => registry.set(arenaOpenAtom, !registry.get(arenaOpenAtom)),
  keepPlaying: () => send({ type: "KEEP_PLAYING" }),
  newLab: () => send({ type: "NEW_LAB" }),

  openNews: () => viewRoom("archive"),
  viewNews: (idOrArchive) => {
    if (idOrArchive === "archive") return viewRoom("archive");
    const edition = registry.get(roomAtom).archive.find((e) => e.id === idOrArchive);
    if (edition) viewRoom(edition);
  },
  closeNews: () => viewRoom(null),
  skipNews,
  revealChat: () => {
    const view = registry.get(roomAtom).view;
    if (view && view !== "archive" && view.type === "chat") registry.set(chatCountAtom, view.messages.length);
  },

  openMixer: () => registry.set(mixerOpenAtom, true),
  closeMixer: () => registry.set(mixerOpenAtom, false),
  setMuted: (muted) => setMixer({ muted }),
  setVolume: (channel, value) => setMixer({ [channel]: Math.max(0, Math.min(1, value)) }),
  playCue: (cue) => playCue(cue as Cue),

  setPhoto: (on) => {
    if (on) registry.set(photoTimeAtom, debugParams.hour !== null ? "" : "live");
    setPhoto(on);
  },
  setPhotoTime: (key) => {
    if (!(key in TIME_HOURS)) return;
    registry.set(photoTimeAtom, key);
    fx.hourOverride = TIME_HOURS[key] ?? null;
  },
  takePhoto: () => {
    registry.set(photoFlashAtom, registry.get(photoFlashAtom) + 1);
    void takePhoto();
  },
  dismissShot: () => undefined,

  ...skinActions,
};

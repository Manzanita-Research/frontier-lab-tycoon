// Everything a skin may ask the game to do, wired to the app machine and the UI atoms. Skins get this object and
// nothing behind it.
import { appNow, debugParams, registry, send } from "../../app/game";
import { SPEEDS, type Speed, type Tool } from "../../app/hud";
import { mixerOpenAtom, playCue, setMixer } from "../../audio/state";
import type { Cue } from "../../audio/score";
import { fx } from "../../render/fx/state";
import { roomAtom, skipNews, viewRoom } from "../../newsroom/state";
import { setPhoto, takePhoto } from "../juice/photo";
import { arenaOpenAtom, chatCountAtom, factionsOpenAtom, helpOpenAtom, modsOpenAtom, photoFlashAtom, photoTimeAtom, staffOpenAtom } from "./state";
import { skinActions } from "./skinControl";
import type { StaffJob } from "../../sim/types";
import type { HudActions } from "./types";

const TIME_HOURS: Record<string, number | null> = { live: null, day: 13, golden: 18.3, night: 22.5 };

export const hudActions: HudActions = {
  place: (kind) => {
    // "staff" is a tile in the palette that opens the payroll instead of picking a tool.
    if (kind === "staff") return void registry.set(staffOpenAtom, !registry.get(staffOpenAtom));
    send({ type: "SET_TOOL", tool: kind as Tool | null });
  },
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
  // The spend is kept in the snapshot: "do it anyway" sends the same command again, marked confirmed.
  confirmSpend: () => {
    const pending = appNow()?.snap.pendingConfirm;
    if (pending) send({ type: "COMMAND", command: { ...pending.command, confirmed: true } });
  },
  cancelSpend: () => send({ type: "COMMAND", command: { type: "cancelConfirm" } }),

  // The coach and the "New!" card (FLT-49's commands; `as Command` until they are in the union).
  coachSkip: () => send({ type: "COMMAND", command: { type: "coachSkip" } }),
  coachReplay: () => {
    registry.set(helpOpenAtom, false);
    send({ type: "COMMAND", command: { type: "coachReplay" } });
  },
  dismissUnlock: () => send({ type: "COMMAND", command: { type: "dismissUnlock" } }),
  // The first coach step waits for the build panel to open: tell the game each time it does.
  buildPanel: (open) => {
    if (open) send({ type: "COMMAND", command: { type: "buildPanelOpened" } });
  },
  openHelp: () => registry.set(helpOpenAtom, true),
  closeHelp: () => registry.set(helpOpenAtom, false),
  holdTime: (id, open) => send({ type: "SET_OVERLAY", id, open }),
  toggleArena: () => registry.set(arenaOpenAtom, !registry.get(arenaOpenAtom)),
  toggleFactions: () => registry.set(factionsOpenAtom, !registry.get(factionsOpenAtom)),
  setSafetySpend: (level) => send({ type: "COMMAND", command: { type: "setSafetySpend", level } }),
  keepPlaying: () => send({ type: "KEEP_PLAYING" }),
  newLab: () => send({ type: "NEW_LAB" }),

  closeStaff: () => {
    send({ type: "SET_ZONE", id: null });
    registry.set(staffOpenAtom, false);
  },
  hire: (job) => send({ type: "COMMAND", command: { type: "hire", job: job as StaffJob } }),
  fire: (id) => send({ type: "COMMAND", command: { type: "fire", id } }),
  paintZone: (id) => {
    const painting = appNow()?.zone ?? null;
    if (id === null ? painting !== null : id !== painting) send({ type: "SET_ZONE", id });
  },
  clearZone: (id) => send({ type: "COMMAND", command: { type: "clearZone", id } }),

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
  openMods: () => registry.set(modsOpenAtom, true),
  closeMods: () => registry.set(modsOpenAtom, false),
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

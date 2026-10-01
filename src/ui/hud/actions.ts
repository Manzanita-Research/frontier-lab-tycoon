// Everything a skin may ask the game to do, wired to the app machine and the UI atoms. Skins get this object and
// nothing behind it.
import { appNow, debugParams, registry, send, SLOW_KEY } from "../../app/game";
import { SPEEDS, type Speed, type Tool } from "../../app/hud";
import { mixerOpenAtom, playCue, setMixer } from "../../audio/state";
import type { Cue } from "../../audio/score";
import { fx } from "../../render/fx/state";
import { skipBeat } from "../../render/fx/beat";
import { roomAtom, skipNews, viewRoom } from "../../newsroom/state";
import { dramaActions } from "../../drama/state";
import { setPhoto, takePhoto } from "../juice/photo";
import { copyLink, copySummary, playDaily, shareEnding } from "../share/share";
import { dismissChallenge, dismissMemo } from "../share/social";
import { arenaChosenAtom, arenaOpenAtom, birdAppOpenAtom, chatCountAtom, disastersOpenAtom, dismissedAtom, factionsOpenAtom, helpOpenAtom, modsOpenAtom, papersOpenAtom, photoFlashAtom, photoTimeAtom, senateOpenAtom, staffOpenAtom, windowBudgetAtom } from "./state";
import { closeWindow, isUp, restoreWindow } from "./windows";
import { skinActions } from "./skinControl";
import { savesActions } from "./saves";
import type { StaffJob } from "../../sim/types";
import type { HudActions } from "./types";
import { announceWidget } from "../../skins/kit/launcher";
import { WIDGET_IDS } from "./widgets";

const dismiss = (key: string) => {
  const seen = registry.get(dismissedAtom);
  if (!seen.includes(key)) registry.set(dismissedAtom, [...seen.slice(-31), key]);
};

/** The player opens or folds the Arena: one they opened is theirs, at full width (FLT-54). */
const openArena = (open: boolean) => {
  registry.set(arenaOpenAtom, open);
  registry.set(arenaChosenAtom, open);
};

/** Text onto the clipboard: the async API where the page may use it, else the old select-and-copy. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.cssText = "position:fixed;left:-9999px;top:0";
    document.body.appendChild(area);
    area.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      area.remove();
    }
  }
}

const TIME_HOURS: Record<string, number | null> = { live: null, day: 13, golden: 18.3, night: 22.5 };

export const hudActions: HudActions = {
  place: (kind) => {
    // "staff" is a tile in the palette that opens the payroll instead of picking a tool.
    if (kind === "staff") return void registry.set(staffOpenAtom, !registry.get(staffOpenAtom));
    if (kind === "senate") return void registry.set(senateOpenAtom, !registry.get(senateOpenAtom));
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
  setSlowForBadNews: (on) => {
    try {
      localStorage.setItem(SLOW_KEY, on ? "on" : "off");
    } catch {
      // Private mode: it holds for this visit.
    }
    send({ type: "SET_SLOW_FOR_BAD_NEWS", on });
  },
  copySnag: async (id) => {
    const report = appNow()?.toasts.find((t) => t.id === id)?.snag;
    if (!report) return false;
    console.info(report);
    return copyText(report);
  },
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
  openDisasters: () => registry.set(disastersOpenAtom, true),
  closeDisasters: () => registry.set(disastersOpenAtom, false),
  // The sim refuses what cannot happen (with a toast), so the menu can send it as it is.
  triggerDisaster: (id) => {
    registry.set(disastersOpenAtom, false);
    send({ type: "COMMAND", command: { type: "disaster", id } });
  },
  setRisk: (risk) => send({ type: "COMMAND", command: { type: "setRisk", risk } }),
  openHelp: () => registry.set(helpOpenAtom, true),
  closeHelp: () => registry.set(helpOpenAtom, false),
  holdTime: (id, open) => send({ type: "SET_OVERLAY", id, open }),
  toggleArena: () => {
    // Up because a rank drop called it (not the player): folding it closes that moment instead.
    const budget = registry.get(windowBudgetAtom);
    if (!registry.get(arenaOpenAtom) && isUp(budget, "arena")) return void registry.set(windowBudgetAtom, closeWindow(budget, "arena"));
    openArena(!registry.get(arenaOpenAtom));
  },
  openTray: (id) => {
    if (id === "papers") return void registry.set(papersOpenAtom, true);
    if (id === "factions") return void registry.set(factionsOpenAtom, true);
    const budget = registry.get(windowBudgetAtom);
    // The Arena from the taskbar is the player's to keep: open it for good, and let the called moment go.
    if (id === "arena") {
      openArena(true);
      return void registry.set(windowBudgetAtom, closeWindow(budget, "arena"));
    }
    registry.set(windowBudgetAtom, restoreWindow(budget, id));
  },
  togglePapers: () => registry.set(papersOpenAtom, !registry.get(papersOpenAtom)),
  setPublicationPolicy: (policy) => {
    if (policy === "Open" || policy === "Selective" || policy === "Closed") send({ type: "COMMAND", command: { type: "setPublicationPolicy", policy } });
  },
  publishPaper: (paperId, route) => {
    const id = Number(paperId);
    if (Number.isInteger(id) && (route === "preprint" || route === "review")) send({ type: "COMMAND", command: { type: "publishPaper", id, route } });
  },
  dismissPaperMoment: dismiss,
  closeCrumbWiki: dismiss,
  toggleFactions: () => registry.set(factionsOpenAtom, !registry.get(factionsOpenAtom)),
  toggleBirdApp: () => registry.set(birdAppOpenAtom, !registry.get(birdAppOpenAtom)),
  setBirdLever: (id, lever) => {
    if (Number.isInteger(id) && (lever === "cook" || lever === "comms" || lever === "logoff")) send({ type: "COMMAND", command: { type: "birdLever", id, lever } });
  },
  setSafetySpend: (level) => send({ type: "COMMAND", command: { type: "setSafetySpend", level } }),
  issueStatement: (faction) => send({ type: "COMMAND", command: { type: "issueStatement", faction } }),
  buryLeak: () => send({ type: "COMMAND", command: { type: "buryLeak" } }),
  // The beat's own button answers it, so the beat is over: the reply toast shows at once instead of waiting it out.
  beatAction: (id) => {
    if (id === "bury") send({ type: "COMMAND", command: { type: "buryLeak" } });
    skipBeat();
  },
  keepPlaying: () => send({ type: "KEEP_PLAYING" }),
  newLab: () => send({ type: "NEW_LAB" }),
  playDaily,
  shareEnding: () => void shareEnding(),
  copySummary: () => void copySummary(),
  foundLab: (perk) => send({ type: "FOUND_LAB", perk }),
  copyLink: () => void copyLink(),
  dismissChallenge,
  dismissMemo,

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

  closeSenate: () => registry.set(senateOpenAtom, false),
  skipBeat: () => skipBeat(),
  lobby: (senator) => send({ type: "COMMAND", command: { type: "lobby", senator } }),
  draftClause: (clause, on) => send({ type: "COMMAND", command: { type: "draftClause", clause, on } }),

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
  // Today's Drama (FLT-34): the window, and the two reloads that switch a pack on or a mod off.
  ...dramaActions,
  // Saves (FLT-65): the Save/Load window, Welcome back, export and import.
  ...savesActions,
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

  // FLT-63: Run…. Opens (never shuts) what the host owns, then tells the skin, whose slots keep the rest (a folded window, a tab).
  openWidget: (id) => {
    if (!WIDGET_IDS.includes(id)) return;
    // A window is opening over the map: put the tool down first, so nothing is left half-held under it (FLT-63).
    const now = appNow();
    if (now?.tool || now?.zone) send({ type: "SET_TOOL", tool: null });
    const open = {
      arena: () => openArena(true),
      benchmarks: () => openArena(true),
      discourse: () => registry.set(factionsOpenAtom, true),
      papers: () => registry.set(papersOpenAtom, true),
      news: () => viewRoom("archive"),
      staff: () => registry.set(staffOpenAtom, true),
      senate: () => registry.set(senateOpenAtom, true),
      disasters: () => registry.set(disastersOpenAtom, true),
      drama: () => hudActions.openDrama(),
      saves: () => savesActions.openSaves(),
      mods: () => registry.set(modsOpenAtom, true),
      display: () => hudActions.openSkinPicker(),
      sound: () => registry.set(mixerOpenAtom, true),
      help: () => registry.set(helpOpenAtom, true),
    }[id];
    open?.();
    announceWidget(id);
  },
};

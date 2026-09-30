// The HUD's non-visual behaviour: hotkeys, photo-mode keys, the news desk and the group chat's playback. It lives in
// the host so every skin gets it and no skin has to (or can) get it wrong.
import { useAtomValue } from "@effect/atom-react";
import { useEffect, useRef } from "react";
import { appNow, registry, send, sim } from "../../app/game";
import { useAutoPause } from "../../app/hooks";
import type { Snapshot } from "../../app/hud";
import { TOOLS } from "../../app/hud";
import { playCue } from "../../audio/state";
import { startDrama } from "../../drama/state";
import { NewsDesk } from "../../newsroom/desk";
import { frontPage, recap } from "../../newsroom/edition";
import { loadRoom, pressCamera, publish, resetRoom, roomAtom, viewRoom } from "../../newsroom/state";
import { fx } from "../../render/fx/state";
import { isBeat, skipBeat } from "../../render/fx/beat";
import { debugParams } from "../../app/game";
import { setPhoto, takePhoto, togglePhoto } from "../juice/photo";
import { chatCountAtom } from "./state";
import { useShareCard, useTakeoverTitle } from "../share/share";
import type { HudVM } from "./types";
import { defs } from "../../sim/defs";

const ERA_GRACE_MS = 700;
const desk = new NewsDesk();

/** Build hotkeys (1-9, Space, Esc), and the keys that answer whichever card is up. */
function useHotkeys(vm: HudVM) {
  const eraOpenedAt = useRef(0);
  // Only the tools the lab has unlocked answer a number key (the build panel lists exactly these).
  const earned = useRef<ReadonlySet<string>>(new Set());
  earned.current = new Set(vm.buildItems.map((b) => b.kind));
  const eraN = vm.eraCard?.n ?? null;
  useEffect(() => {
    if (eraN !== null) eraOpenedAt.current = performance.now();
  }, [eraN]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const st = appNow();
      if (!st) return;
      const def = st.event ? defs().eventById(st.event.id) : undefined;
      if (st.event && def) {
        // A card is up: it owns the keyboard. Keys 1 to 3 choose; an era card takes any key once it has landed.
        if (def.kind === "era") {
          if (performance.now() - eraOpenedAt.current > ERA_GRACE_MS && !["Shift", "Control", "Alt", "Meta", "Tab"].includes(e.key)) {
            e.preventDefault();
            send({ type: "CHOOSE", choiceIndex: 0 });
          }
          return;
        }
        const n = Number(e.key);
        if (Number.isInteger(n) && n >= 1 && n <= def.choices.length) {
          e.preventDefault();
          send({ type: "CHOOSE", choiceIndex: n - 1 });
        }
        return;
      }
      if ((st.outcome !== "playing" && !st.outcomeDismissed) || st.snap.pendingConfirm) return;
      if (e.key === " ") {
        e.preventDefault();
        // A focused button would also treat Space as a click.
        (document.activeElement as HTMLElement | null)?.blur?.();
        send({ type: "TOGGLE_PAUSE" });
      } else if (e.key === "Escape") {
        // Esc skips a camera beat first (FLT-56), then puts the tool away.
        if (isBeat()) skipBeat();
        else send({ type: "SET_TOOL", tool: null });
      }
      else if (/^[1-9]$/.test(e.key)) {
        const tool = TOOLS[Number(e.key) - 1]!;
        if (earned.current.has(tool)) send({ type: "SET_TOOL", tool });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/** P toggles photo mode, Enter takes the shot, Esc leaves; while it is on, the tool hotkeys stay quiet. */
function usePhotoKeys(vm: HudVM) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "p" || e.key === "P") {
        const st = appNow();
        if (!st?.event && !st?.snap.pendingConfirm && (st?.outcome === "playing" || st?.outcomeDismissed)) togglePhoto();
      } else if (!fx.photo) return;
      else if (e.key === "Escape") setPhoto(false);
      else if (e.key === "Enter") void takePhoto();
      else if (/^[1-6]$/.test(e.key)) e.stopImmediatePropagation();
    };
    // Capture phase, so the hotkey handler never sees the keys photo mode has claimed.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
  useEffect(() => {
    if (debugParams.photo) setPhoto(true);
  }, []);
  // A card turning up means the game needs the player: leave photo mode rather than hide it.
  const needsPlayer = vm.event !== null || vm.eraCard !== null || vm.outcome !== null || vm.confirm !== null;
  useEffect(() => {
    if (needsPlayer) setPhoto(false);
  }, [needsPlayer]);
}

/** The group chat's messages arrive one by one (all at once with reduced motion). */
function useChatPlayback() {
  const room = useAtomValue(roomAtom);
  const view = room.view;
  const chat = view && view !== "archive" && view.type === "chat" ? view : null;
  useEffect(() => {
    registry.set(chatCountAtom, 0);
    if (!chat) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "reduced";
    if (reduce) {
      registry.set(chatCountAtom, chat.messages.length);
      return;
    }
    const timers = chat.messages.map((_, i) => window.setTimeout(() => registry.set(chatCountAtom, Math.max(registry.get(chatCountAtom), i + 1)), 900 + i * 1150));
    return () => timers.forEach(clearTimeout);
  }, [chat]);
}

/** The newspaper desk: watches the World for editions to print, and pauses the game while one is being read. */
function useNewsDesk(snap: Snapshot) {
  const room = useAtomValue(roomAtom);
  const demoOpened = useRef(false);
  const pausedForReading = room.view !== null;
  useAutoPause("newsroom", pausedForReading);
  useEffect(() => {
    loadRoom();
  }, []);
  useEffect(() => {
    const result = desk.poll(sim.world);
    if (result.reset) {
      pressCamera.pending.length = 0;
      resetRoom();
    }
    if (result.editions.length) pressCamera.pending.push(result.editions);
  }, [snap]);
  useEffect(() => {
    if (pausedForReading) playCue("card");
  }, [pausedForReading]);
  useEffect(() => {
    if (!new URLSearchParams(location.search).has("debug")) return;
    const demo = () => {
      const lab = sim.world.labName;
      const stories = [
        { id: 701, day: 27, kind: "release" as const, text: `${lab} releases Frontier-4.5-Reasoner-Mini-Pro-Preview; benchmarks up, expectations up, sleep down` },
        { id: 702, day: 26, kind: "protest" as const, text: "Protesters chant 'H2O LIES'; a passing pigeon joins in" },
        { id: 703, day: 25, kind: "rival" as const, text: "Open-ish AI drops free weights on launch day. Again." },
        { id: 704, day: 24, kind: "money" as const, text: "CFO says 'runway is a state of mind'; investors request a different state" },
      ];
      pressCamera.pending.push([frontPage(stories, 28, lab), recap(stories, 30, lab)]);
    };
    Object.assign(window, {
      __press: {
        publish,
        room: () => registry.get(roomAtom),
        // A deterministic showroom, using the real transforms and camera pipeline. No changes to the sim.
        demo,
      },
    });
    if (new URLSearchParams(location.search).has("newsdemo")) demo();
    return () => {
      Reflect.deleteProperty(window, "__press");
    };
  }, []);
  useEffect(() => {
    const mode = new URLSearchParams(location.search).get("newsdemo");
    if (!mode || demoOpened.current || !room.archive.some((e) => e.id === "chat-30")) return;
    demoOpened.current = true;
    viewRoom(mode === "archive" ? "archive" : (room.archive.find((e) => e.id === (mode === "paper" ? "paper-28" : "chat-30")) ?? null));
  }, [room.archive]);
}

/**
 * Panels the host owns hold time while they are open: the payroll, the sound mixer and (on a phone, where it covers the
 * map) the Arena. A slot's own phone sheets (Stats, Objectives, Thoughts) hold it themselves through the kit's
 * `useAutoPause`; the News Room does it in `useNewsDesk`. The game keeps the ids apart, so closing one never resumes
 * time beneath another.
 */
function useOverlays(vm: HudVM) {
  useAutoPause("staff", vm.staff.open);
  useAutoPause("disasters", vm.disasters.open);
  useAutoPause("senate", vm.senate.open);
  useAutoPause("mixer", vm.sound.open);
  useAutoPause("arena", vm.arena.open && vm.layout.compact);
  useAutoPause("drama", vm.drama.open);
}

export function useHudEffects(vm: HudVM, snap: Snapshot) {
  useOverlays(vm);
  useHotkeys(vm);
  usePhotoKeys(vm);
  useChatPlayback();
  useNewsDesk(snap);
  useEffect(startDrama, []);
  useShareCard(vm);
  useTakeoverTitle(vm);
}

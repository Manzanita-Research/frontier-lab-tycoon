// Gathers what the view-model needs from the app actor and the UI atoms, and builds it. React re-renders the HUD when
// any of them changes: the snapshot is throttled to about 5 Hz, and the rest change on a click.
import { useAtomValue } from "@effect/atom-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { atoms, registry } from "../../app/game";
import { useApp } from "../../app/hooks";
import { audioReadyAtom, mixerAtom, mixerOpenAtom } from "../../audio/state";
import { roomAtom } from "../../newsroom/state";
import { photoAtom } from "../../render/fx/photoState";
import { skinList } from "../../skins/registry";
import { shotAtom } from "../juice/photo";
import { arenaOpenAtom, chatCountAtom, nightBubbleAtom, photoFlashAtom, photoTimeAtom, skinUiAtom } from "./state";
import type { BubbleVM, HudVM } from "./types";
import { hudViewModel } from "./vm";

/** The window size, updated on resize (a phone turning around changes the layout). */
export function useViewport() {
  const read = () => ({ width: window.innerWidth, height: window.innerHeight });
  const [size, setSize] = useState(read);
  useEffect(() => {
    const on = () => setSize(read());
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return size;
}

/**
 * "Tap anyone to read their mind": a hint until they do (or it has been up for a while). Then out of the way.
 */
function useTapHint(selected: number | null) {
  const [tapHint, setTapHint] = useState(true);
  useEffect(() => {
    if (selected !== null) setTapHint(false);
    const t = setTimeout(() => setTapHint(false), 22_000);
    return () => clearTimeout(t);
  }, [selected]);
  return tapHint;
}

const RANK_MS = 2800;

/**
 * Rows that changed place light up for a moment, a drop for you shakes the panel and opens it, and the Arena chip
 * flinches (a drop) or hops (a climb). All of it is UI: the sim only says who is where.
 */
function useArenaMotion(board: readonly { id: string; rank: number }[], rank: number) {
  const ranks = useRef<Record<string, number>>({});
  const [moved, setMoved] = useState<Record<string, "up" | "down">>({});
  const [alert, setAlert] = useState(false);
  const [flinch, setFlinch] = useState(false);
  const lastRank = useRef(rank);

  useEffect(() => {
    const before = ranks.current;
    const next: Record<string, number> = {};
    const flashed: Record<string, "up" | "down"> = {};
    for (const row of board) {
      next[row.id] = row.rank;
      const was = before[row.id];
      if (was !== undefined && was !== row.rank) flashed[row.id] = row.rank < was ? "up" : "down";
    }
    ranks.current = next;
    if (Object.keys(flashed).length === 0) return;
    setMoved(flashed);
    if (flashed.you === "down") {
      setAlert(true);
      registry.set(arenaOpenAtom, true);
    }
    const t = window.setTimeout(() => {
      setMoved({});
      setAlert(false);
    }, RANK_MS);
    return () => window.clearTimeout(t);
  }, [board]);

  useEffect(() => {
    if (rank === lastRank.current) return;
    setFlinch(rank > lastRank.current);
    lastRank.current = rank;
    const t = window.setTimeout(() => setFlinch(false), 1100);
    return () => window.clearTimeout(t);
  }, [rank]);

  return { moved, alert, flinch };
}

export function useHudVM(): HudVM {
  const snap = useApp(atoms.snap);
  const speed = useApp(atoms.speed);
  const tool = useApp(atoms.tool);
  const toasts = useApp(atoms.toasts);
  const news = useApp(atoms.news);
  const follow = useApp(atoms.follow);
  const highlight = useApp(atoms.highlight);
  const selected = useApp(atoms.selected);
  const outcomeDismissed = useApp(atoms.outcomeDismissed);
  const arenaOpen = useAtomValue(arenaOpenAtom);
  const room = useAtomValue(roomAtom);
  const chatCount = useAtomValue(chatCountAtom);
  const mixer = useAtomValue(mixerAtom);
  const mixerOpen = useAtomValue(mixerOpenAtom);
  const audioReady = useAtomValue(audioReadyAtom);
  const photoOn = useAtomValue(photoAtom);
  const photoTime = useAtomValue(photoTimeAtom);
  const flash = useAtomValue(photoFlashAtom);
  const shot = useAtomValue(shotAtom);
  const skinUi = useAtomValue(skinUiAtom);
  const night = useAtomValue(nightBubbleAtom);
  const viewport = useViewport();
  const tapHint = useTapHint(selected);
  const motion = useArenaMotion(snap.race.board, snap.race.rank);
  const list = useMemo(() => skinList(), []);

  return useMemo(
    () =>
      hudViewModel({
        snap,
        speed,
        tool,
        follow,
        highlight,
        toasts,
        news,
        outcomeDismissed,
        tapHint,
        arena: { open: arenaOpen, alert: motion.alert, flinch: motion.flinch, moved: motion.moved },
        room,
        chatCount,
        mixer: { open: mixerOpen, ready: audioReady, muted: mixer.muted, master: mixer.master, music: mixer.music, sfx: mixer.sfx },
        photo: { on: photoOn, time: photoTime, shot, flash },
        skins: {
          open: skinUi.picker.open,
          reducedMotion: skinUi.reducedMotion,
          active: skinUi.active,
          original: skinUi.picker.original,
          list,
          rejected: skinUi.refused,
        },
        viewport,
        nightBubble: night as BubbleVM | null,
      }),
    [snap, speed, tool, follow, highlight, toasts, news, outcomeDismissed, tapHint, arenaOpen, motion, room, chatCount, mixer, mixerOpen, audioReady, photoOn, photoTime, shot, flash, skinUi, list, viewport, night],
  );
}

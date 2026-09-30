// Gathers what the view-model needs from the app actor and the UI atoms, and builds it. React re-renders the HUD when
// any of them changes: the snapshot is throttled to about 5 Hz, and the rest change on a click.
import { useAtomValue } from "@effect/atom-react";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { useEffect, useMemo, useRef, useState } from "react";
import { atoms, debugParams, registry } from "../../app/game";
import type { Snapshot } from "../../app/hud";
import { audioReadyAtom, mixerAtom, mixerOpenAtom } from "../../audio/state";
import { roomAtom } from "../../newsroom/state";
import { photoAtom } from "../../render/fx/photoState";
import { skinList } from "../../skins/registry";
import type { LeapfrogView } from "../../sim/race/leapfrog/view";
import { shotAtom } from "../juice/photo";
import { newMotion, NO_MOTION, stepMotion, type Motion, type MotionView } from "./leapfrogMotion";
import { arenaOpenAtom, chatCountAtom, disastersOpenAtom, dismissedAtom, helpOpenAtom, modsOpenAtom, papersOpenAtom, photoFlashAtom, photoTimeAtom, senateOpenAtom, skinUiAtom, staffOpenAtom } from "./state";
import { modSession } from "../../app/mods";
import { playableFixture } from "./previewLadder";
import type { HudVM } from "./types";
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

  return useMemo(() => ({ moved, alert, flinch }), [moved, alert, flinch]);
}

/**
 * Release Leapfrog's real-time flourishes: rows that flash for a few seconds after their lab launches, badges that blink
 * when a record changes hands, solved benchmarks kept on the board a while, and the news cycle's history for the graph.
 * Advances once per new snapshot (never per render), so it is safe to call from a component that renders often.
 */
function useLeapfrogMotion(snap: Snapshot): MotionView {
  const motion = useRef<Motion | null>(null);
  const last = useRef<{ lf: LeapfrogView | null; view: MotionView }>({ lf: null, view: NO_MOTION });
  motion.current ??= newMotion();
  if (last.current.lf !== snap.leapfrog) last.current = { lf: snap.leapfrog, view: stepMotion(motion.current, snap.leapfrog, snap.day, performance.now()) };
  return last.current.view;
}

export type AppSource = {
  snap: Snapshot;
  speed: Parameters<typeof hudViewModel>[0]["speed"];
  tool: Parameters<typeof hudViewModel>[0]["tool"];
  toasts: Parameters<typeof hudViewModel>[0]["toasts"];
  news: Parameters<typeof hudViewModel>[0]["news"];
  follow: boolean;
  highlight: string | null;
  selected: number | null;
  zone: number | null;
  outcomeDismissed: boolean;
};

/** Everything the view-model reads from the app actor, as one atom. */
const appSourceAtom = Atom.make((get): AsyncResult.AsyncResult<AppSource, never> => {
  const snap = get(atoms.snap);
  if (!AsyncResult.isSuccess(snap)) return snap as unknown as AsyncResult.AsyncResult<never, never>;
  const v = <T,>(a: Atom.Atom<AsyncResult.AsyncResult<T, never>>): T => (get(a) as AsyncResult.Success<T, never>).value;
  return AsyncResult.success({
    snap: snap.value,
    speed: v(atoms.speed),
    tool: v(atoms.tool),
    toasts: v(atoms.toasts),
    news: v(atoms.news),
    follow: v(atoms.follow),
    highlight: v(atoms.highlight),
    selected: v(atoms.selected),
    zone: v(atoms.zone),
    outcomeDismissed: v(atoms.outcomeDismissed),
  });
});

const sameSource = (a: AppSource, b: AppSource) => (Object.keys(a) as (keyof AppSource)[]).every((k) => Object.is(a[k], b[k]));

/**
 * The app actor's state, delivered to React only when something the HUD shows has actually changed. (The actor emits
 * a new machine snapshot on every animation frame; `useAtomSuspense` would re-render the whole HUD for each one. This
 * compares the pieces and stays put, so the HUD renders about once per snapshot publish, roughly 5 Hz, and never per frame.)
 */
export function useAppSource(): AppSource | null {
  const [src, setSrc] = useState<AppSource | null>(null);
  useEffect(
    () =>
      registry.subscribe(
        appSourceAtom,
        (r) => {
          if (AsyncResult.isSuccess(r)) setSrc((prev) => (prev && sameSource(prev, r.value) ? prev : r.value));
        },
        { immediate: true },
      ),
    [],
  );
  return src;
}

export function useHudVM({ snap, speed, tool, toasts, news, follow, highlight, selected, zone, outcomeDismissed }: AppSource): HudVM {
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
  const staffOpen = useAtomValue(staffOpenAtom);
  const senateOpen = useAtomValue(senateOpenAtom);
  const helpOpen = useAtomValue(helpOpenAtom);
  const modsOpen = useAtomValue(modsOpenAtom);
  const papersOpen = useAtomValue(papersOpenAtom);
  const dismissed = useAtomValue(dismissedAtom);
  const disastersOpen = useAtomValue(disastersOpenAtom);
  const viewport = useViewport();
  const tapHint = useTapHint(selected);
  // "Build an API Gateway..." twice is one hint too many: once a toast has said it, the standing hint is redundant.
  const toldGateway = useRef(false);
  const newest = toasts.at(-1);
  if (newest && /API Gateway/i.test(newest.text)) toldGateway.current = true;
  const motion = useArenaMotion(snap.race.board, snap.race.rank);
  const leapfrog = useLeapfrogMotion(snap);
  const list = useMemo(() => skinList(), []);
  // The session's mods are fixed at start (main.tsx loads `?mod=` before the game exists); only the window opens and shuts.
  const mods = useMemo(() => {
    const m = modSession();
    return {
      open: modsOpen,
      list: m.mods.map((mod) => ({ ...mod })),
      conflicts: m.conflicts.map((c) => `${c.path}: ${c.earlier} (${c.earlierOperation}), then ${c.later} (${c.laterOperation}); ${c.later} wins`),
      errors: [...m.errors],
      contentHash: m.run?.contentHash ?? null,
    };
  }, [modsOpen]);

  // `?debug=1&ladder=N`: show a rung of the ladder without playing up to it (skins, screenshots). Never in a normal game.
  const shown = useMemo(() => (debugParams.ladder ? ({ ...snap, ...playableFixture(debugParams.ladder.level, debugParams.ladder.coach, debugParams.ladder.unlock) } as unknown as Snapshot) : snap), [snap]);
  const vm = useMemo(
    () =>
      hudViewModel({
        snap: shown,
        speed,
        tool,
        follow,
        highlight,
        toasts,
        news,
        outcomeDismissed,
        tapHint,
        toldGateway: toldGateway.current,
        staffOpen,
        senateOpen,
        zone,
        arena: { open: arenaOpen, alert: motion.alert, flinch: motion.flinch, moved: motion.moved },
        leapfrog,
        room,
        chatCount,
        helpOpen,
        papersOpen,
        dismissed,
        disastersOpen,
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
        mods,
        viewport,
      }),
    [shown, speed, tool, follow, highlight, toasts, news, outcomeDismissed, tapHint, arenaOpen, motion, leapfrog, room, chatCount, helpOpen, disastersOpen, mixer, mixerOpen, audioReady, photoOn, photoTime, shot, flash, skinUi, list, mods, viewport, staffOpen, senateOpen, zone, papersOpen, dismissed],
  );
  return vm;
}

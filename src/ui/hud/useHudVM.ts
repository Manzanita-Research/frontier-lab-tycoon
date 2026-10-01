// Gathers what the view-model needs from the app actor and the UI atoms, and builds it. React re-renders the HUD when
// any of them changes: the snapshot is throttled to about 5 Hz, and the rest change on a click.
import { useAtomValue } from "@effect/atom-react";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { useEffect, useMemo, useRef, useState } from "react";
import { atoms, debugParams, probeHud, registry, saveDesk } from "../../app/game";
import type { Snapshot } from "../../app/hud";
import { audioReadyAtom, mixerAtom, mixerOpenAtom } from "../../audio/state";
import { roomAtom } from "../../newsroom/state";
import { GAME_CRT, crtAtom } from "../../render/crt/state";
import { photoAtom } from "../../render/fx/photoState";
import { beatAtom } from "../../render/fx/beatState";
import { skinList } from "../../skins/registry";
import type { LeapfrogView } from "../../sim/race/leapfrog/view";
import { shotAtom } from "../juice/photo";
import { useShareInput } from "../share/share";
import { useSocialInput } from "../share/social";
import { newMotion, NO_MOTION, stepMotion, type Motion, type MotionView } from "./leapfrogMotion";
import { arenaCallAtom, arenaChosenAtom, arenaOpenAtom, birdAppOpenAtom, chatCountAtom, disastersOpenAtom, dismissedAtom, factionsOpenAtom, helpOpenAtom, modsOpenAtom, papersOpenAtom, photoFlashAtom, photoTimeAtom, seenNewsAtom, senateOpenAtom, skinUiAtom, staffOpenAtom, windowBudgetAtom } from "./state";
import { newestOf, unreadOf, wantsOf, windowed } from "./tray";
import { autoUp, nextClose, stepBudget } from "./windows";
import { hudActions } from "./actions";
import { modSession } from "../../app/mods";
import { modsRevision } from "../../app/liveMods";
import { dramaPath, dramaViewModel } from "../../drama/feed";
import { dramaAtom } from "../../drama/state";
import { playableFixture } from "./previewLadder";
import type { HudVM } from "./types";
import { hudViewModel } from "./vm";
import { savesAtom } from "./saves";
import type { SavesInput } from "./saves.vm";

const saveDeskAvailable = () => saveDesk.store.available;

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
let drops = 0;

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
      // Ask for the Arena: the window budget (FLT-54) opens it, or puts it on the taskbar if two windows are already up.
      registry.set(arenaCallAtom, `drop:${++drops}`);
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
  const arenaChosen = useAtomValue(arenaChosenAtom);
  const room = useAtomValue(roomAtom);
  const chatCount = useAtomValue(chatCountAtom);
  const mixer = useAtomValue(mixerAtom);
  const mixerOpen = useAtomValue(mixerOpenAtom);
  const audioReady = useAtomValue(audioReadyAtom);
  const photoOn = useAtomValue(photoAtom);
  const photoTime = useAtomValue(photoTimeAtom);
  const flash = useAtomValue(photoFlashAtom);
  const shot = useAtomValue(shotAtom);
  const beat = useAtomValue(beatAtom);
  const skinUi = useAtomValue(skinUiAtom);
  const crt = useAtomValue(crtAtom);
  const staffOpen = useAtomValue(staffOpenAtom);
  const senateOpen = useAtomValue(senateOpenAtom);
  const factionsOpen = useAtomValue(factionsOpenAtom);
  const birdAppOpen = useAtomValue(birdAppOpenAtom);
  const helpOpen = useAtomValue(helpOpenAtom);
  const modsOpen = useAtomValue(modsOpenAtom);
  const papersOpen = useAtomValue(papersOpenAtom);
  const dismissed = useAtomValue(dismissedAtom);
  const disastersOpen = useAtomValue(disastersOpenAtom);
  const dramaUi = useAtomValue(dramaAtom);
  const share = useShareInput();
  const social = useSocialInput();
  const viewport = useViewport();
  const tapHint = useTapHint(selected);
  // "Build an API Gateway..." twice is one hint too many: once a toast has said it, the standing hint is redundant.
  const toldGateway = useRef(false);
  const newest = toasts.at(-1);
  if (newest && /API Gateway/i.test(newest.text)) toldGateway.current = true;
  const motion = useArenaMotion(snap.race.board, snap.race.rank);
  const leapfrog = useLeapfrogMotion(snap);
  const list = useMemo(() => skinList(), []);
  // `?mod=` loads before the game exists (main.tsx); a data-only mod can come or go mid-game too (FLT-78), and says so.
  const modsRev = useAtomValue(modsRevision);
  const lookLabels = useMemo(() => Object.fromEntries(Object.entries(modSession().presentation?.looks ?? {}).flatMap(([target, look]) => (look.label ? [[target, look.label]] : []))), []);
  const mods = useMemo(() => {
    const m = modSession();
    return {
      open: modsOpen,
      list: m.mods.map((mod) => ({ ...mod, drama: dramaPath(mod.source, location.href) !== null })),
      conflicts: m.conflicts.map((c) => `${c.path}: ${c.earlier} (${c.earlierOperation}), then ${c.later} (${c.laterOperation}); ${c.later} wins`),
      errors: [...m.errors],
      contentHash: m.run?.contentHash ?? null,
    };
  }, [modsOpen, modsRev]);
  const drama = useMemo(() => dramaViewModel(dramaUi, modSession().mods, location.href, new Date()), [dramaUi, modsRev]);
  const savesUi = useAtomValue(savesAtom);
  const saves = useMemo((): SavesInput => {
    const { prompt, listing, ...rest } = savesUi;
    return { ...rest, listing, available: saveDeskAvailable(), modPrompt: prompt?.vm ?? null, skinNames: Object.fromEntries(list.map((s) => [s.id, s.name])) };
  }, [savesUi, list]);

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
        factionsOpen,
        birdAppOpen,
        arena: { open: arenaOpen, chosen: arenaChosen, alert: motion.alert, flinch: motion.flinch, moved: motion.moved },
        leapfrog,
        room,
        chatCount,
        helpOpen,
        papersOpen,
        dismissed,
        disastersOpen,
        lookLabels,
        mixer: { open: mixerOpen, ready: audioReady, muted: mixer.muted, master: mixer.master, music: mixer.music, sfx: mixer.sfx },
        photo: { on: photoOn, time: photoTime, shot, flash },
        beat,
        skins: {
          open: skinUi.picker.open,
          reducedMotion: skinUi.reducedMotion,
          active: skinUi.active,
          original: skinUi.picker.original,
          list,
          rejected: skinUi.refused,
          offer: skinUi.offer,
          // No `crt` while the in-game tube is off (FLT-70): the skins show no picture-tube setting.
          ...(GAME_CRT ? { crt: { mode: crt.mode, choice: crt.choice, tier: crt.tier, reduced: crt.reduced } } : {}),
        },
        mods,
        drama,
        saves,
        viewport,
        share,
        social,
      }),
    [share, social, shown, speed, tool, follow, highlight, toasts, news, outcomeDismissed, tapHint, arenaOpen, arenaChosen, motion, leapfrog, room, chatCount, helpOpen, disastersOpen, mixer, mixerOpen, audioReady, photoOn, photoTime, shot, flash, beat, skinUi, crt, list, mods, viewport, staffOpen, senateOpen, zone, papersOpen, dismissed, factionsOpen, birdAppOpen, drama, saves],
  );
  return useWindowBudget(vm, news);
}

/**
 * FLT-54's window budget, applied to the view-model: steps the budget with what the game wants up (at most two, the
 * rest on the taskbar), wakes up when a window is due to close itself, and keeps each panel's unread count.
 */
function useWindowBudget(raw: HudVM, news: AppSource["news"]): HudVM {
  const stored = useAtomValue(windowBudgetAtom);
  const seen = useAtomValue(seenNewsAtom);
  const arenaCall = useAtomValue(arenaCallAtom);
  const [now, setNow] = useState(0);
  // Stepped during render so no frame shows a third window; saved to the atom (where the actions read it) after.
  const budget = useMemo(() => stepBudget(stored, wantsOf(raw, arenaCall), performance.now()), [stored, raw, arenaCall, now]);
  useEffect(() => {
    if (budget !== stored) registry.set(windowBudgetAtom, budget);
  }, [budget, stored]);
  useEffect(() => {
    const at = nextClose(budget);
    if (at === null) return;
    const t = window.setTimeout(() => setNow(performance.now()), Math.max(0, at - performance.now()) + 20);
    return () => window.clearTimeout(t);
  }, [budget]);
  // A New! card whose moment has passed is dismissed for real, or the next one would wait behind it. Once per card.
  const dismissed = useRef<string | null>(null);
  useEffect(() => {
    const card = raw.unlock;
    if (!card || dismissed.current === card.id) return;
    if (budget.some((w) => w.id === "unlock" && w.key === card.id && w.state === "closed")) {
      dismissed.current = card.id;
      hudActions.dismissUnlock();
    }
  }, [budget, raw.unlock]);
  const vm = useMemo(() => windowed(raw, budget, unreadOf(news, seen)), [raw, budget, news, seen]);
  // A panel that is open has read its news.
  useEffect(() => {
    const newest = newestOf(news);
    const open = { arena: vm.arena.open, papers: vm.papers.open, factions: vm.factions.open, birdapp: vm.birdapp.open };
    const next = { ...seen };
    let changed = false;
    for (const p of ["arena", "papers", "factions", "birdapp"] as const) {
      if (open[p] && newest[p] !== undefined && newest[p] !== seen[p]) {
        next[p] = newest[p];
        changed = true;
      }
    }
    if (changed) registry.set(seenNewsAtom, next);
  }, [news, seen, vm.arena.open, vm.papers.open, vm.factions.open, vm.birdapp.open]);
  // The journey test (FLT-53) reads what the budget holds up and what waits on the taskbar.
  useEffect(() => {
    probeHud.windows = () => ({ auto: autoUp(registry.get(windowBudgetAtom)), tray: vm.tray.map((t) => ({ id: t.id, flashing: t.flashing, unread: t.unread })) });
  }, [vm.tray]);
  return vm;
}

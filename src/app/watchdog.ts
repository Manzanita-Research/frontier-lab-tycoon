// FLT-81: the app actor's watchdog. XState ends an actor whose transition throws, and from then on drops every event
// without a word: the clock stops, ▶ and Save do nothing, and the page looks alive. The actions already catch their
// own failures (`survive` in machine.ts); this catches the rest. It watches the actor's status, and when it settles in
// error it logs the cause and starts a new actor on the same World, so the player loses a frame, not the lab.
import { AsyncResult, type Atom, type AtomRegistry } from "effect/unstable/reactivity";

/** A few restarts a minute; past that the bug fires faster than a restart helps, so it says so and stops trying. */
export const RESTART_LIMIT = 3;
export const RESTART_WINDOW_MS = 60_000;

/** Whether one more restart is allowed at `now`, given the times of the earlier ones (pruned in place). */
export function mayRestart(restarts: number[], now: number, limit = RESTART_LIMIT, windowMs = RESTART_WINDOW_MS): boolean {
  while (restarts.length > 0 && now - restarts[0]! >= windowMs) restarts.shift();
  return restarts.length < limit;
}

interface Settled<C> {
  status: string;
  error?: unknown;
  context: C;
}

export interface WatchOptions<C> {
  registry: AtomRegistry.AtomRegistry;
  snapshot: Atom.Atom<AsyncResult.AsyncResult<Settled<C>, unknown>>;
  /** Start a new actor, given the dead one's last context. */
  restart: (last: C) => void;
  now?: () => number;
  log?: (...args: unknown[]) => void;
}

/** Watch the actor until the returned function is called. Subscribing mounts the snapshot, so call this where the actor is mounted. */
export function watchActor<C>({ registry, snapshot, restart, now = Date.now, log = console.error }: WatchOptions<C>): () => void {
  const restarts: number[] = [];
  let gaveUp = false;
  let pending = false;
  return registry.subscribe(snapshot, (result) => {
    if (pending || !AsyncResult.isSuccess(result) || result.value.status !== "error") return;
    const { error, context } = result.value;
    if (!mayRestart(restarts, now())) {
      if (!gaveUp) log(`[app] the app stopped on an error ${RESTART_LIMIT} times in a minute; not restarting it again.`, error);
      gaveUp = true;
      return;
    }
    restarts.push(now());
    log("[app] the app stopped on an error; restarting it on the same World.", error);
    // Not from inside the registry's own notification: rebuild the actor once this one has finished settling.
    pending = true;
    queueMicrotask(() => {
      pending = false;
      restart(context);
    });
  });
}

// React's side of the boundary: read an atom of the app actor, suspending until the runtime has started it.
import { useAtomSuspense } from "@effect/atom-react";
import type { AsyncResult, Atom } from "effect/reactivity";
import { useEffect } from "react";
import { send } from "./game";

export function useApp<T>(atom: Atom.Atom<AsyncResult.AsyncResult<T, never>>): T {
  return useAtomSuspense(atom).value;
}

/** Minimal wiring for existing menus and the future skin/assistant hosts. */
export function useAutoPause(id: string, open: boolean) {
  useEffect(() => {
    send({ type: "SET_OVERLAY", id, open });
    return () => send({ type: "SET_OVERLAY", id, open: false });
  }, [id, open]);
}

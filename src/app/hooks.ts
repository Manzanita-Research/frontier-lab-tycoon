// React's side of the boundary: read an atom of the app actor, suspending until the runtime has started it.
import { useAtomSuspense } from "@effect/atom-react";
import type { AsyncResult, Atom } from "effect/reactivity";

export function useApp<T>(atom: Atom.Atom<AsyncResult.AsyncResult<T, never>>): T {
  return useAtomSuspense(atom).value;
}

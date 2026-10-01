// The right-hand window stack: windows tile down the column, and when they no longer fit, the one that has been open
// longest folds itself to its title bar. (Click a folded window's title to open it again: it is then the newest, so an
// older one folds instead.) The newest window never folds itself, and if a single window is taller than the column the
// column scrolls, as it always did. A window can ask to be kept (FLT-76: the narrow Task Mangler the game opened for a
// launch, which its own scrollbar makes 12 px taller): the next oldest folds instead.
import { createContext, useContext, useEffect, useLayoutEffect, useRef, type ReactNode } from "react";

// Layout effects warn on the server (the skin tests render there); effects are fine, nothing is measured then.
const useLayout = typeof window === "undefined" ? useEffect : useLayoutEffect;

export interface Entry {
  minimised: boolean;
  minimise(): void;
  /** When it last opened: the stack's own clock, so "oldest" does not depend on real time. */
  opened: number;
  /** Never fold this one to make room (it can still be the newest). */
  keep?: boolean;
}

export interface Stack {
  entries: Map<string, Entry>;
  clock: number;
  box: HTMLDivElement | null;
  inner: HTMLDivElement | null;
  /** A fold has been asked for and has not landed yet: what is measured is stale, so nothing else may fold for it. */
  folding: boolean;
  /** A window says whether it is folded (after every change of that). Clears `folding`, then re-checks the fit. */
  report(id: string, minimised: boolean, minimise: () => void, keep?: boolean): void;
  fit(): void;
}

const StackContext = createContext<Stack | null>(null);

/** Exported for the tests: the folding rule needs no DOM beyond two heights. */
export function makeStack(): Stack {
  const stack: Stack = {
    entries: new Map(),
    clock: 0,
    box: null,
    inner: null,
    folding: false,
    report(id, minimised, minimise, keep) {
      const before = stack.entries.get(id);
      const reopened = !minimised && (!before || before.minimised);
      stack.entries.set(id, { minimised, minimise, opened: reopened ? ++stack.clock : (before?.opened ?? 0), keep });
      stack.folding = false;
      stack.fit();
    },
    fit() {
      const { box, inner } = stack;
      if (stack.folding || !box || !inner || inner.offsetHeight <= box.clientHeight + 1) return;
      const open = [...stack.entries.values()].filter((e) => !e.minimised).sort((a, b) => a.opened - b.opened);
      // Never fold the newest (or only) window: it is the one the player just asked for. Nor one that asked to be kept.
      const oldest = open.slice(0, -1).find((e) => !e.keep);
      if (!oldest) return;
      // One fold per shortfall: until it has landed (its window reports back) the measurement is out of date, and two
      // windows reporting in the same commit, or the resize observer, would fold a second one for the same gap.
      oldest.minimised = true;
      stack.folding = true;
      oldest.minimise();
      // If the fold never lands (the window ignored it), do not block the stack for good.
      setTimeout(() => {
        stack.folding = false;
      }, 250);
    },
  };
  return stack;
}

export function WindowStack({ children }: { children: ReactNode }) {
  const stack = useRef<Stack>(undefined as unknown as Stack);
  stack.current ??= makeStack();
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);

  useLayout(() => {
    stack.current.box = box.current;
    stack.current.inner = inner.current;
    stack.current.fit();
  });
  // The column shrinks (a shorter window, the balloon growing) or its contents grow (a longer roster, more rows).
  useEffect(() => {
    if (typeof ResizeObserver === "undefined" || !box.current || !inner.current) return;
    const watch = new ResizeObserver(() => stack.current.fit());
    watch.observe(box.current);
    watch.observe(inner.current);
    return () => watch.disconnect();
  }, []);

  return (
    <StackContext.Provider value={stack.current}>
      <div className="f95-right" ref={box}>
        <div className="f95-stack" ref={inner}>
          {children}
        </div>
      </div>
    </StackContext.Provider>
  );
}

/**
 * A window in the stack reports whether it is folded and how to fold it. Outside a stack (a phone lays its windows
 * out as sheets) this does nothing.
 */
export function useStackWindow(id: string, minimised: boolean, setMinimised: (minimised: boolean) => void, keep = false) {
  const stack = useContext(StackContext);
  const fold = useRef(setMinimised);
  fold.current = setMinimised;
  useLayout(() => {
    stack?.report(id, minimised, () => fold.current(true), keep);
  }, [stack, id, minimised, keep]);
  useLayout(
    () => () => {
      stack?.entries.delete(id);
    },
    [stack, id],
  );
}

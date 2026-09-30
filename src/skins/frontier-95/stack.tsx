// The right-hand window stack: windows tile down the column, and when they no longer fit, the one that has been open
// longest folds itself to its title bar. (Click a folded window's title to open it again: it is then the newest, so an
// older one folds instead.) The newest window never folds itself, and if a single window is taller than the column the
// column scrolls, as it always did.
import { createContext, useContext, useEffect, useLayoutEffect, useRef, type ReactNode } from "react";

// Layout effects warn on the server (the skin tests render there); effects are fine, nothing is measured then.
const useLayout = typeof window === "undefined" ? useEffect : useLayoutEffect;

export interface Entry {
  minimised: boolean;
  minimise(): void;
  /** When it last opened: the stack's own clock, so "oldest" does not depend on real time. */
  opened: number;
}

export interface Stack {
  entries: Map<string, Entry>;
  clock: number;
  box: HTMLDivElement | null;
  inner: HTMLDivElement | null;
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
    fit() {
      const { box, inner } = stack;
      if (!box || !inner || inner.offsetHeight <= box.clientHeight + 1) return;
      const open = [...stack.entries.values()].filter((e) => !e.minimised).sort((a, b) => a.opened - b.opened);
      // Never fold the newest (or only) window: it is the one the player just asked for.
      const oldest = open.length > 1 ? open[0] : undefined;
      if (!oldest) return;
      // Marked at once so two windows reporting in the same commit do not both fold for one shortfall.
      oldest.minimised = true;
      oldest.minimise();
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
export function useStackWindow(id: string, minimised: boolean, setMinimised: (minimised: boolean) => void) {
  const stack = useContext(StackContext);
  const fold = useRef(setMinimised);
  fold.current = setMinimised;
  useLayout(() => {
    if (!stack) return;
    const before = stack.entries.get(id);
    const reopened = !minimised && (!before || before.minimised);
    stack.entries.set(id, { minimised, minimise: () => fold.current(true), opened: reopened ? ++stack.clock : (before?.opened ?? 0) });
    stack.fit();
  }, [stack, id, minimised]);
  useLayout(
    () => () => {
      stack?.entries.delete(id);
    },
    [stack, id],
  );
}

// The right-hand window stack folds the window that has been open longest when they no longer fit, and never the newest.
import { describe, expect, it, vi, type Mock } from "vitest";
import { makeStack } from "./stack";

function stackOf(box: number, inner: number, windows: [id: string, opened: number, minimised?: boolean][]) {
  const stack = makeStack();
  stack.box = { clientHeight: box } as HTMLDivElement;
  stack.inner = { offsetHeight: inner } as HTMLDivElement;
  const folds: Record<string, Mock<() => void>> = {};
  for (const [id, opened, minimised = false] of windows) {
    folds[id] = vi.fn<() => void>();
    stack.entries.set(id, { minimised, opened, minimise: folds[id]! });
  }
  return { stack, folds };
}

describe("the window stack", () => {
  it("does nothing while the windows fit", () => {
    const { stack, folds } = stackOf(600, 600, [["arena", 1], ["thoughts", 2]]);
    stack.fit();
    expect(folds.arena).not.toHaveBeenCalled();
    expect(folds.thoughts).not.toHaveBeenCalled();
  });

  it("folds the window that has been open longest when they do not", () => {
    const { stack, folds } = stackOf(500, 640, [["staff", 3], ["arena", 1], ["thoughts", 2]]);
    stack.fit();
    expect(folds.arena).toHaveBeenCalledTimes(1);
    expect(folds.thoughts).not.toHaveBeenCalled();
    expect(folds.staff).not.toHaveBeenCalled();
  });

  it("folds one window per shortfall: a second report in the same commit does not fold another", () => {
    const { stack, folds } = stackOf(500, 640, [["staff", 3], ["arena", 1], ["thoughts", 2]]);
    stack.fit();
    stack.fit();
    expect(folds.arena).toHaveBeenCalledTimes(1);
    // Once the first fold has landed and it still does not fit, the next oldest goes.
    stack.inner = { offsetHeight: 560 } as HTMLDivElement;
    stack.entries.set("arena", { minimised: true, opened: 1, minimise: folds.arena! });
    stack.fit();
    expect(folds.thoughts).toHaveBeenCalledTimes(1);
  });

  it("skips windows that are already folded, and never folds the newest or the only open window", () => {
    const { stack, folds } = stackOf(100, 400, [["arena", 1, true], ["thoughts", 2]]);
    stack.fit();
    expect(folds.thoughts).not.toHaveBeenCalled();
    const two = stackOf(100, 400, [["arena", 1], ["staff", 2]]);
    two.stack.fit();
    expect(two.folds.arena).toHaveBeenCalledTimes(1);
    expect(two.folds.staff).not.toHaveBeenCalled();
  });

  it("copes with no column yet (the first render, or the server)", () => {
    const stack = makeStack();
    expect(() => stack.fit()).not.toThrow();
  });
});

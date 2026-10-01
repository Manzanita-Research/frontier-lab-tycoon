// The right-hand window stack folds the window that has been open longest when they no longer fit, and never the newest.
import { describe, expect, it, vi, type Mock } from "vitest";
import { makeStack } from "./stack";

function stackOf(box: number, inner: number, windows: [id: string, opened: number, minimised?: boolean, keep?: boolean][]) {
  const stack = makeStack();
  stack.box = { clientHeight: box } as HTMLDivElement;
  stack.inner = { offsetHeight: inner } as HTMLDivElement;
  const folds: Record<string, Mock<() => void>> = {};
  for (const [id, opened, minimised = false, keep] of windows) {
    folds[id] = vi.fn<() => void>();
    stack.entries.set(id, { minimised, opened, minimise: folds[id]!, keep });
  }
  stack.clock = windows.length;
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

  it("folds one window per shortfall: nothing else folds until that fold has landed", () => {
    const { stack, folds } = stackOf(500, 640, [["staff", 3], ["arena", 1], ["thoughts", 2]]);
    stack.fit();
    stack.fit(); // the resize observer, or another window reporting, before the first fold has landed
    expect(folds.arena).toHaveBeenCalledTimes(1);
    expect(folds.thoughts).not.toHaveBeenCalled();
    // The fold lands (the Arena reports it is folded) and it now fits: nothing more folds.
    stack.inner = { offsetHeight: 480 } as HTMLDivElement;
    stack.report("arena", true, folds.arena!);
    expect(folds.thoughts).not.toHaveBeenCalled();
    // If it still does not fit once the first has landed, the next oldest goes.
    const again = stackOf(500, 640, [["staff", 3], ["arena", 1], ["thoughts", 2]]);
    again.stack.fit();
    again.stack.inner = { offsetHeight: 560 } as HTMLDivElement;
    again.stack.report("arena", true, again.folds.arena!);
    expect(again.folds.thoughts).toHaveBeenCalledTimes(1);
  });

  it("gives a window that is opened again the newest stamp, so an older one folds next time", () => {
    const { stack, folds } = stackOf(500, 640, [["arena", 1, true], ["thoughts", 2], ["staff", 3]]);
    stack.report("arena", false, folds.arena!);
    expect(stack.entries.get("arena")!.opened).toBeGreaterThan(stack.entries.get("staff")!.opened);
    stack.fit(); // now: 640 > 500 with thoughts the oldest open one
    expect(folds.thoughts).toHaveBeenCalledTimes(1);
  });

  it("passes over a window that asked to be kept (the Task Mangler the game opened) and folds the next oldest", () => {
    const { stack, folds } = stackOf(500, 512, [["arena", 1, false, true], ["thoughts", 2], ["staff", 3]]);
    stack.fit();
    expect(folds.arena).not.toHaveBeenCalled();
    expect(folds.thoughts).toHaveBeenCalledTimes(1);
    // Kept and the only other open one is the newest: nothing folds, the column scrolls.
    const two = stackOf(500, 512, [["arena", 1, false, true], ["staff", 2]]);
    two.stack.fit();
    expect(two.folds.arena).not.toHaveBeenCalled();
    expect(two.folds.staff).not.toHaveBeenCalled();
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

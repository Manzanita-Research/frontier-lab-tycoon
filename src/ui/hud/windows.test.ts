import { describe, expect, it } from "vitest";
import { AUTO_CLOSE_MS, autoUp, closeWindow, isDocked, isUp, MAX_AUTO, nextClose, restoreWindow, stepBudget, type Budget, type Want } from "./windows";

const news: Want = { id: "news", key: "7" };
const unlock: Want = { id: "unlock", key: "wake:hearing" };
const paper: Want = { id: "paper", key: "drop:3" };

describe("the window budget (FLT-54)", () => {
  it("shows at most two windows the game opened; the third waits on the taskbar and does not pop up later", () => {
    let b: Budget = [];
    b = stepBudget(b, [news, unlock, paper], 0);
    expect(autoUp(b)).toEqual(["news", "unlock"]);
    expect(isDocked(b, "paper")).toBe(true);
    // The paper boy goes: room again, but the docked one keeps flashing until it is clicked.
    b = stepBudget(b, [unlock, paper], 1000);
    expect(autoUp(b)).toEqual(["unlock"]);
    expect(isDocked(b, "paper")).toBe(true);
    b = restoreWindow(b, "paper");
    expect(isUp(b, "paper")).toBe(true);
    expect(autoUp(b).length).toBeLessThanOrEqual(MAX_AUTO);
  });

  it("closes a window when its moment passes; one that holds time waits for the player", () => {
    let b = stepBudget([], [news, paper], 0);
    expect(nextClose(b)).toBe(AUTO_CLOSE_MS);
    b = stepBudget(b, [news, paper], AUTO_CLOSE_MS - 1);
    expect(isUp(b, "news")).toBe(true);
    b = stepBudget(b, [news, paper], AUTO_CLOSE_MS);
    expect(isUp(b, "news")).toBe(false);
    expect(isUp(b, "paper")).toBe(true);
    // Still wanted, still shut: the same moment does not come back.
    expect(stepBudget(b, [news, paper], AUTO_CLOSE_MS + 5000)).toBe(b);
    // A new moment for the same window is a new window.
    b = stepBudget(b, [{ id: "news", key: "8" }, paper], AUTO_CLOSE_MS + 6000);
    expect(isUp(b, "news")).toBe(true);
  });

  it("forgets what the player closed or took over, and returns the same budget when nothing changed", () => {
    let b = stepBudget([], [news, unlock], 0);
    b = closeWindow(b, "news");
    expect(autoUp(b)).toEqual(["unlock"]);
    expect(stepBudget(b, [news, unlock], 10)).toBe(b);
    b = stepBudget(b, [unlock, paper], 20);
    expect(autoUp(b)).toEqual(["unlock", "paper"]);
  });
});

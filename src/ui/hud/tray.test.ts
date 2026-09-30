import { describe, expect, it } from "vitest";
import type { NewsItem } from "../../sim/types";
import { fixtureInput } from "./fixtures";
import { newestOf, unreadOf, wantsOf, windowed } from "./tray";
import type { HudVM } from "./types";
import { hudViewModel } from "./vm";
import { stepBudget } from "./windows";

const busy = (): HudVM => {
  const vm = hudViewModel(fixtureInput({ papers: "drop" }));
  return { ...vm, unlock: { id: "wake:hearing", title: "New! The Hearing", body: "The Senate would like a word.", items: [] }, newsroom: { ...vm.newsroom, arrival: { id: "ed-9", type: "paper", text: "The Frontier Times is here." } } };
};
const none = { arena: 0, papers: 0, factions: 0 };

describe("the window budget in the view-model (FLT-54)", () => {
  it("asks for what the game opened, and hides the third behind a flashing taskbar button", () => {
    const vm = busy();
    const wants = wantsOf(vm, null);
    expect(wants.map((w) => w.id)).toEqual(["news", "unlock", "paper"]);
    const shown = windowed(vm, stepBudget([], wants, 0), none);
    expect(shown.newsroom.arrival).not.toBeNull();
    expect(shown.unlock).not.toBeNull();
    expect(shown.paperMoment).toBeNull();
    expect(shown.tray).toEqual([{ id: "paper", label: "Your paper is out", flashing: true, unread: 0 }]);
  });

  it("calls the Arena up on a rank drop only while it is folded", () => {
    const vm = busy();
    expect(wantsOf(vm, "drop:1").some((w) => w.id === "arena")).toBe(vm.visible.arena && !vm.arena.open);
    const folded = { ...vm, arena: { ...vm.arena, open: false }, visible: { ...vm.visible, arena: true } };
    expect(wantsOf(folded, "drop:1")[0]).toEqual({ id: "arena", key: "drop:1" });
    expect(wantsOf(folded, null).some((w) => w.id === "arena")).toBe(false);
  });

  it("badges a folded panel with the headlines about it since it was last open", () => {
    const news: NewsItem[] = [
      { id: 1, day: 3, text: "Rival ships a model", tone: "bad", panel: "arena" },
      { id: 2, day: 3, text: "Weather", tone: "neutral" },
      { id: 3, day: 4, text: "Rival tops a benchmark", tone: "bad", panel: "arena" },
    ];
    expect(unreadOf(news, {})).toEqual({ arena: 2, papers: 0, factions: 0 });
    expect(unreadOf(news, { arena: 1 }).arena).toBe(1);
    expect(newestOf(news)).toEqual({ arena: 3 });
    const vm = busy();
    const folded = windowed({ ...vm, arena: { ...vm.arena, open: false }, visible: { ...vm.visible, arena: true } }, [], unreadOf(news, {}));
    expect(folded.tray).toContainEqual({ id: "arena", label: "Arena", flashing: false, unread: 2 });
    expect(folded.arena.unread).toBe(2);
    const open = windowed({ ...vm, arena: { ...vm.arena, open: true }, visible: { ...vm.visible, arena: true } }, [], unreadOf(news, {}));
    expect(open.tray.some((t) => t.id === "arena")).toBe(false);
    expect(open.arena.unread).toBe(0);
  });
});

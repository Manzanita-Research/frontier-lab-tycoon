import { describe, expect, it } from "vitest";
import { playableFixture } from "./previewLadder";
import { HUD_PANELS, playableOf } from "./playable";

describe("playableOf (the ladder, read defensively from the snapshot)", () => {
  it("treats a snapshot with no ladder as everything earned and nobody coaching", () => {
    const p = playableOf({});
    expect(p.laddered).toBe(false);
    expect(HUD_PANELS.every((id) => p.visible[id])).toBe(true);
    expect(p.buildings.has("demo")).toBe(true);
    expect(p.buildings.has("path")).toBe(true);
    expect(p.staff.has("security")).toBe(true);
    expect(p.coach).toBeNull();
    expect(p.unlock).toBeNull();
  });

  it("reads the contract as the logic sends it, and hides any panel it does not name", () => {
    const p = playableOf({ ...playableFixture(2, 0, true), hud: { visible: { revenue: true } } });
    expect(p.laddered).toBe(true);
    expect(p.level).toBe(2);
    expect(p.levelName).toBe("Open for business");
    expect(p.visible.revenue).toBe(true);
    expect(p.visible.arena).toBe(false);
    expect(p.buildings.has("gateway")).toBe(true);
    expect(p.buildings.has("nap")).toBe(false);
    expect(p.coach?.target).toBe("start");
    expect(p.unlock?.id).toBe("level-2");
  });

  it("starts every panel hidden once there is a ladder but no visibility list", () => {
    const { hud: _hud, ...rest } = playableFixture(1);
    expect(HUD_PANELS.some((id) => playableOf(rest).visible[id])).toBe(false);
  });
});

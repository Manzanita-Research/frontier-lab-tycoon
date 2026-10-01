import { describe, expect, it } from "vitest";
import { CAMERA_OFFSET } from "./fx/CameraRig";
import { HEAD, HEAD_TOP, OVER, CREW, onScreenShare } from "./people";

describe("people against tiles (FLT-91)", () => {
  it("measures on screen from the game's own camera", () => {
    // The camera is true isometric: equal offsets on every axis.
    expect(CAMERA_OFFSET.x).toBe(CAMERA_OFFSET.y);
    expect(CAMERA_OFFSET.z).toBe(CAMERA_OFFSET.y);
    expect(onScreenShare(Math.sqrt(3))).toBeCloseTo(1);
  });

  it("stands a researcher a third to a half of a tile tall, as RollerCoaster Tycoon's guests are", () => {
    const share = onScreenShare(HEAD_TOP);
    expect(share).toBeGreaterThanOrEqual(1 / 3);
    expect(share).toBeLessThanOrEqual(1 / 2);
    // Staff stand a touch taller and still fit.
    expect(onScreenShare(HEAD * CREW)).toBeLessThanOrEqual(1 / 2);
  });

  it("floats tags and the arrow over the head, and taps the body", () => {
    expect(OVER.tag).toBeGreaterThan(HEAD_TOP);
    expect(OVER.arrow).toBeGreaterThan(OVER.tag);
    expect(OVER.staffTag).toBeGreaterThan(HEAD * CREW);
    expect(OVER.pick).toBeLessThan(HEAD_TOP);
    // A bubble's tail lands on the crown, not in the air above it.
    expect(OVER.bubble).toBeLessThan(HEAD_TOP);
    expect(OVER.bubble).toBeGreaterThan(HEAD_TOP * 0.75);
  });
});

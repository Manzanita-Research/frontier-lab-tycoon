import { describe, expect, it } from "vitest";
import { contentsHidden, LID_FACES, TRAY_INSET, WRAP_GAP } from "./stage/box";
import { BOX_TIMES } from "./stage/rig";

// Jem's screen recordings of the first Preview (FLT-95): a plain white side and a strip at the back's edge as the box
// turned, the shrinkwrap floating off the box on the table, and the contents lying beside the box before it was open.
describe("FLT-95: the box is one closed, printed box until you open it", () => {
  it("prints every outside face: both sides alike (the spine's art), the top and bottom, the front and the back", () => {
    expect(LID_FACES).toHaveLength(6);
    // BoxGeometry's face order: +x, -x, +y, -y, +z, -z.
    expect(LID_FACES[0]).toBe(LID_FACES[1]);
    expect(LID_FACES[4]).toBe("front");
    expect(LID_FACES[5]).toBe("back");
    for (const face of LID_FACES) expect(["side", "top", "front", "back"]).toContain(face);
  });

  it("keeps the tray inside the lid, clear of its faces (no z-fighting), and the shrinkwrap tight to it", () => {
    expect(TRAY_INSET).toBeGreaterThanOrEqual(0.001);
    expect(TRAY_INSET).toBeLessThanOrEqual(0.003);
    // A crinkle's worth off the card: a millimetre or two, never a slab.
    expect(WRAP_GAP).toBeGreaterThan(0);
    expect(WRAP_GAP).toBeLessThanOrEqual(0.002);
  });

  it("hides the contents inside the box until the lid comes off", () => {
    for (const beat of ["shelf", "pulling", "held"]) expect(contentsHidden(beat, 99), beat).toBe(true);
    expect(contentsHidden("unwrapping", 0)).toBe(true);
    expect(contentsHidden("unwrapping", BOX_TIMES.lidOff - 0.01)).toBe(true);
    expect(contentsHidden("unwrapping", BOX_TIMES.lidOff)).toBe(false);
    for (const beat of ["open", "focus", "disc", "warmup"]) expect(contentsHidden(beat, 0), beat).toBe(false);
    // And they only slide out after that.
    expect(BOX_TIMES.itemsOut).toBeGreaterThan(BOX_TIMES.lidOff);
  });
});

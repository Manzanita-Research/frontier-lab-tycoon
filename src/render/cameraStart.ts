/** How much closer a phone starts than its base zoom (FLT-87): a tile about 32 px wide, a thumb's width, instead of 20. */
export const PHONE_START = 1.6;

/** Where the camera looks at first: the gate, with the campus behind it. */
const FOCUS: [number, number] = [10.8, 16.2];
/** A phone, being closer, looks a little to the gate's right, so the gate stays on screen and the ground to build on is beside it. */
const PHONE_FOCUS: [number, number] = [9, 18];

/**
 * The camera at the start of a visit. `base` sets the pinch limits (0.55x to 3.4x of it) and the double-tap focus; `zoom`
 * and `focus` are where it begins. A desktop starts at its base, roughly a building per eighth of the screen width at
 * 1440x900 with the whole gate-to-hall campus in view; a phone starts 1.6x in, so the gate and the first buildings are big
 * enough to tap and a pinch out still shows everything. `?zoom=` and `?focus=` win.
 */
export function cameraStart(w: number, h: number, asked: { zoom?: number | null; focus?: [number, number] | null } = {}) {
  const phone = w < 700;
  const base = asked.zoom ?? (phone ? w / 16 : Math.min(w / 30, h / 17.5));
  return {
    base,
    zoom: asked.zoom ?? (phone ? base * PHONE_START : base),
    focus: asked.focus ?? (phone ? PHONE_FOCUS : FOCUS),
  };
}

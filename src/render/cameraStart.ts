/** How much closer a phone starts than its base zoom (FLT-87): a tile about 32 px wide, a thumb's width, instead of 20. */
export const PHONE_START = 1.6;

/**
 * Where a desktop looks at first (FLT-91): just behind the garage, so it sits in the middle with the plaza under it, the
 * empty lot runs away to the far fence, and there is sky past both edges. Looking at the middle of the lot instead put
 * the garage down in a corner under the windows, a speck in a field.
 */
const FOCUS: [number, number] = [9, 17.5];
/** A phone, being closer, looks a little to the gate's right, so the gate, the plaza and the ground to build on are all in view. */
const PHONE_FOCUS: [number, number] = [9, 18];

/**
 * The camera at the start of a visit. `base` sets the pinch limits (0.55x to 3.4x of it) and the double-tap focus; `zoom`
 * and `focus` are where it begins. A desktop starts at its base: 42 px a unit at 1440x900, a tile 60 px across (RCT's
 * is 64) and 34 px along an edge, with nearly the whole lot in view (FLT-91 pulled it back from 48). A phone starts 1.6x
 * in (FLT-87), a tile about 32 px along an edge, so the gate and the first buildings are big enough to tap and a pinch
 * out still shows everything; smaller people and the plaza open it up instead. `?zoom=` and `?focus=` win.
 */
export function cameraStart(w: number, h: number, asked: { zoom?: number | null; focus?: [number, number] | null } = {}) {
  const phone = w < 700;
  const base = asked.zoom ?? (phone ? w / 16 : Math.min(w / 34, h / 20));
  return {
    base,
    zoom: asked.zoom ?? (phone ? base * PHONE_START : base),
    focus: asked.focus ?? (phone ? PHONE_FOCUS : FOCUS),
  };
}

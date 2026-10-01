// FLT-95: the disc in your hand, to scale and in motion. Plain numbers, so they can be tested without a GPU.

/** A real 120 mm CD-ROM's zones, as fractions of its radius (60 mm). */
export const DISC_ZONES = {
  /** The spindle hole: 15 mm across. */
  hole: 7.5 / 60,
  /** Clear polycarbonate out to 36 mm across: the clamping area, with the stacking ring pressed into it. */
  hub: 18 / 60,
  /** The silver mirror band, up to where the data (and the printed label over it) starts at 46 mm. */
  ring: 23 / 60,
  /** The data, out to 117 mm; past that, a clear lip at the edge. */
  data: 58.5 / 60,
} as const;

const clamp = (v: number, max: number) => Math.max(-max, Math.min(max, v));

/**
 * How the held disc is turned (x and y, radians): your drag while you hold it; otherwise your last tilt plus a slow sway,
 * so the sheen always moves a little and the label never turns away far enough to stop being readable.
 */
export function discTurn(time: number, tilt: { x: number; y: number }, dragging: boolean): { x: number; y: number } {
  if (dragging) return { x: tilt.x, y: tilt.y };
  return { x: clamp(tilt.x + Math.sin(time * 0.37) * 0.16, 0.75), y: clamp(tilt.y + Math.sin(time * 0.29) * 0.5, 0.9) };
}

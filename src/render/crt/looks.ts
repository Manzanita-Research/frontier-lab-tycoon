// The two CRT looks (FLT-73) and everything that has to agree between the shader on the canvas and the CSS tube over
// the DOM: the scanline pitch, the curvature, the vignette and the corners. Pure: no three, no DOM, unit-tested.
import type { CRTPreset, CRTSettings } from "./presets";
import type { CRTOptions } from "./pipeline";

/** The player's choice (Display Properties → Settings). */
export type CrtMode = "off" | "subtle" | "full";
export const CRT_MODES: readonly CrtMode[] = ["off", "subtle", "full"];
export const isCrtMode = (v: unknown): v is CrtMode => typeof v === "string" && (CRT_MODES as readonly string[]).includes(v);

/**
 * What the canvas can afford: the full multi-pass shader, the one-pass lite version (phones, slow machines), or a
 * flat canvas under the CSS tube. The frame-time governor steps down this list; the look (subtle or full) stays.
 */
export type CrtTier = "multi" | "lite" | "flat";
export const CRT_TIERS: readonly CrtTier[] = ["multi", "lite", "flat"];

export interface CrtLook {
  /** CSS pixels per scanline. The shader's input has (screen height / pitch) rows, and the CSS lines repeat at the same pitch. */
  pitch: number;
  /** The upstream preset and the overrides on top of it. */
  preset: CRTPreset;
  shader: Partial<CRTSettings>;
  /** Barrel bow of the picture on the canvas (see `warp`). */
  curve: number;
  /**
   * The world's vignette (in the shader): darkness at the farthest corner and where it starts (share of the
   * centre-to-corner distance). The CSS tube's own vignette sits on top of it, over the canvas and the DOM alike.
   */
  vignette: number;
  vignetteInner: number;
  /** The CSS tube over everything (DOM and canvas alike). Kept faint: text under it must still pass WCAG AA (`worstDarkening`). */
  css: {
    /** Darkness of each scanline's gap row (black at this alpha, 1px per `pitch`). */
    scan: number;
    /** The DOM's vignette, same shape as the world's, far fainter. */
    vignette: number;
    vignetteInner: number;
    /** Corner radius, CSS pixels: the black bezel's inner edge. */
    corner: number;
    /** Phosphor glow on text: text-shadow blur radius (px) and strength (alpha of the text's own colour). */
    glowRadius: number;
    glowAlpha: number;
    /** A slow bright band rolling down the tube (never with reduced motion). */
    roll: number;
    /** Flicker depth: opacity wobble of the scanline layer (never with reduced motion). */
    flicker: number;
  };
  /** The one-pass lite shader: scanline depth and phosphor mask strength. */
  lite: { scan: number; mask: number };
}

export const CRT_LOOKS: Record<Exclude<CrtMode, "off">, CrtLook> = {
  // A nice monitor on a nice desk: you notice the lines when you look for them, and the campus stays sharp enough
  // to read a walker's hoodie.
  subtle: {
    pitch: 2,
    preset: "clean",
    shader: { spread: 0.42, bleed: 0.12, beam: 0.36, bloom: 0.1, glow: 0.05, focus: 0, mask: 0.06, exposure: 1.06 },
    curve: 0.012,
    vignette: 0.24,
    vignetteInner: 0.5,
    css: { scan: 0.03, vignette: 0.02, vignetteInner: 0.6, corner: 12, glowRadius: 2, glowAlpha: 0.2, roll: 0, flicker: 0 },
    lite: { scan: 0.22, mask: 0.05 },
  },
  // The family TV in 1995, the one with a VCR on top. Same line count as subtle: at 300 lines (a 3px pitch) the
  // campus turned to soup, so the TV-ness is thinner beams, a coarser mask, more bow, the roll and the flicker.
  full: {
    pitch: 2,
    preset: "clean",
    shader: { spread: 0.4, bleed: 0.22, beam: 0.24, bloom: 0.16, glow: 0.08, focus: 0.015, mask: 0.18, exposure: 1.1 },
    curve: 0.03,
    vignette: 0.42,
    vignetteInner: 0.35,
    css: { scan: 0.04, vignette: 0.01, vignetteInner: 0.5, corner: 26, glowRadius: 3, glowAlpha: 0.3, roll: 0.035, flicker: 0.04 },
    lite: { scan: 0.42, mask: 0.12 },
  },
};

/** The longest edge of the shader's input for a canvas of this CSS size: (height / pitch) rows at the canvas's aspect. */
export function inputResolution(look: CrtLook, cssWidth: number, cssHeight: number): number {
  return Math.max(32, Math.round(Math.max(cssWidth, cssHeight) / look.pitch));
}

/** The pipeline options for the main screen. The CSS tube draws the corners there (over the DOM too), so the shader leaves them out. */
export function screenOptions(look: CrtLook, cssWidth: number, cssHeight: number): CRTOptions {
  return {
    preset: look.preset,
    ...look.shader,
    inputResolution: inputResolution(look, cssWidth, cssHeight),
    toneMap: true,
    tube: { curve: look.curve, vignette: look.vignette, vignetteInner: look.vignetteInner, corner: 0 },
  };
}

/** The pipeline options for a monitor texture (FLT-70's beige PC): the whole tube is in the picture. */
export function monitorOptions(look: CrtLook, width: number, height: number, cornerPx = look.css.corner): CRTOptions {
  return {
    preset: look.preset,
    ...look.shader,
    inputResolution: inputResolution(look, width, height),
    toneMap: true,
    tube: { curve: look.curve * 1.5, vignette: look.vignette, vignetteInner: look.vignetteInner, corner: cornerPx },
  };
}

/**
 * The tube's bow, in normalised device coordinates (-1..1, either y direction). A point shown at `d` on the glass
 * is the scene at `warp(d)`: x bends with y and y with x, so the centre and the middle of each edge stay put and the
 * corners pull in. It is what the optics stage does to its uv, used to aim a click.
 */
export function warp(curve: number, x: number, y: number): [number, number] {
  return [x * (1 + curve * y * y), y * (1 + curve * x * x)];
}

/** The inverse: where on the glass the scene point `s` shows (a few fixed-point steps; the bow is tiny). Places a label over its walker. */
export function unwarp(curve: number, x: number, y: number): [number, number] {
  if (curve === 0) return [x, y];
  let dx = x;
  let dy = y;
  for (let i = 0; i < 4; i++) {
    const nx = x / (1 + curve * dy * dy);
    const ny = y / (1 + curve * dx * dx);
    dx = nx;
    dy = ny;
  }
  return [dx, dy];
}

/**
 * The most the CSS tube can darken a DOM pixel, as a multiplier on its (display-encoded) colour: a scanline's gap
 * row at the far corner, where the vignette is darkest. Frontier 95's Start button and clock live there, so there
 * is no bezel allowance. The contrast test holds text to WCAG AA under this.
 */
export function worstDarkening(look: CrtLook): number {
  return (1 - look.css.scan) * (1 - look.css.vignette);
}

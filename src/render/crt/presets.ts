/*
 * crt-shader 1.0.1's frozen presets (https://github.com/OutThisLife/crt-shader), unchanged but for types.
 * SPDX-License-Identifier: MIT. Copyright (c) 2026 Brooklyn (OutThisLife). See ./LICENSE and ./NOTICE.md.
 */

/** The shader's scalar settings (upstream's CRTSettings). */
export interface CRTSettings {
  spread: number;
  bleed: number;
  gamma: number;
  beam: number;
  bloom: number;
  glow: number;
  focus: number;
  mask: number;
  exposure: number;
  aspect: number;
  outputGamma: number;
  cameraBlur: number;
  blackLevel: number;
  redGain: number;
  greenGain: number;
  blueGain: number;
  maskPitch: number;
  maskPhase: number;
  slot: number;
  slotPhase: number;
  maskSlant: number;
  beamTilt: number;
  maskWarp: number;
  rg: number;
  rb: number;
  gr: number;
  gb: number;
  br: number;
  bg: number;
}
export type CRTPreset = "reference" | "clean" | "soft" | "photoSoft";

type Row = [key: keyof CRTSettings, label: string, min: number, max: number, step: number, value: number];
export const controlGroups: [string, Row[]][] = [
 ['Signal',[['spread','Horizontal spread',.15,1.6,.01,.64],['bleed','Extra color spread',0,2,.01,.48],['gamma','Blend gamma',1,2.6,.05,2.2]]],
 ['Electron beam',[['beam','Beam width',.1,.65,.01,.24],['bloom','Bright-area expansion',0,.35,.01,.16],['glow','Light diffusion',0,.4,.01,.10]]],
 ['Photograph / surface',[['focus','Photo softness',0,.4,.01,.08],['mask','Phosphor texture',0,.65,.01,.10],['exposure','Exposure',.6,1.8,.01,1.12]]],
 ['Geometry',[['aspect','Pixel height / width',.75,1.5,.01,1.12]]],
 ['Reference / optics',[['outputGamma','Output gamma · 0 = linked',0,3.4,.01,0],['cameraBlur','Camera blur',0,.2,.001,0],['blackLevel','Black level',0,.08,.001,0],['redGain','Red response',.4,2.5,.01,1],['greenGain','Green response',.4,2.5,.01,1],['blueGain','Blue response',.4,2.5,.01,1]]],
 ['Reference / phosphors',[['maskPitch','Triad pitch · 0 = legacy',0,1,.001,0],['maskPhase','RGB phase',-3,3,.01,0],['slot','Phosphor gaps',0,.98,.01,0],['slotPhase','Gap phase',-3,3,.01,0],['maskSlant','Mask tilt',-.1,.1,.001,0],['beamTilt','Beam tilt',-.08,.08,.001,0],['maskWarp','Mask perspective',-2,2,.01,0]]],
 ['Reference / color calibration',[['rg','Green → red',-.4,.4,.01,0],['rb','Blue → red',-.4,.4,.01,0],['gr','Red → green',-.4,.4,.01,0],['gb','Blue → green',-.4,.4,.01,0],['br','Red → blue',-.4,.4,.01,0],['bg','Green → blue',-.4,.4,.01,0]]]
];
const defaults = Object.fromEntries(controlGroups.flatMap(([, rows]) => rows.map((r) => [r[0], r[5]]))) as unknown as CRTSettings;
const match: CRTSettings = {...defaults,spread:.5578709613,bleed:.5636315407,gamma:1.0705261569,outputGamma:.8485562699,beam:.1840719213,bloom:.1548009529,glow:0,focus:0,mask:.1017257735,exposure:1,aspect:19.1960812271/22.3078397702,cameraBlur:.8978557591/22.3078397702,blackLevel:0,redGain:1.0718383876,greenGain:.9021840644,blueGain:.8515301518,maskPitch:9.3194278699/22.3078397702,maskPhase:.1732497797,maskSlant:.0060042998,beamTilt:.0069226077,slot:.0976022686,slotPhase:-.0199341169,rg:-.0680113591,rb:-.1368904736,gr:-.0344967575,gb:.1917875629,br:-.0753665589,bg:.4,maskWarp:.1809592285};
const legacy = {
  soft: { ...defaults },
  rgb: {...defaults,spread:.30,bleed:0,beam:.23,bloom:.08,focus:0,glow:.035,mask:.14,exposure:1.03,aspect:1},
  photo: {...defaults,spread:.82,bleed:.80,beam:.25,bloom:.20,focus:.19,glow:.15,mask:.18,exposure:1.16,aspect:1.16},
  crisp: { ...match, cameraBlur: 0.018, spread: 0.53 },
};

export const PRESETS: Readonly<Record<CRTPreset, Readonly<CRTSettings>>> = Object.freeze({soft:Object.freeze(legacy.soft),clean:Object.freeze(legacy.rgb),photoSoft:Object.freeze(legacy.photo),reference:Object.freeze(legacy.crisp)});
export const SETTING_KEYS = Object.keys(PRESETS.reference) as (keyof CRTSettings)[];

export function resolveSettings(preset: CRTPreset = "reference", overrides: Partial<CRTSettings> = {}): CRTSettings {
  if (!Object.hasOwn(PRESETS, preset)) throw new RangeError(`Unknown CRT preset: ${preset}`);
  const result = { ...PRESETS[preset] };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) continue;
    if (!Object.hasOwn(result, key) || !Number.isFinite(value)) throw new TypeError(`Invalid CRT setting: ${key}`);
    result[key as keyof CRTSettings] = value;
  }
  return result;
}

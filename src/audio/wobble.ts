// FLT-105 (pass 2): the trip's tape wow. The band plays through a short delay line whose length an LFO swings back and
// forth, so the whole mix glides sharp and flat together, like a warped record: everything bends, nothing clashes
// (the first pass detuned each new note instead, which only sounded out of tune against the notes still ringing).
//
// A delay line read at a moving point is a pitch shift: if the delay is D + A·sin(2πft), the pitch is multiplied by
// 1 − 2πfA·cos(2πft). So `wowDelay` turns "± this many cents at this rate" into the swing in seconds.
//
// Off (no trip), the dry path is the whole signal at unity and the wet path is silent: the band sounds as it always did.
// It eases both ways: the wet/dry blend follows the trip's strength quickly, but the swing itself only ever grows or
// shrinks slowly (`DEPTH_TAU`), because a swing that collapsed fast would bend the pitch on its way out.

/** Seconds of delay the swing is centred on (it needs room either side). */
export const WOW_CENTRE = 0.06;
/** Time constants (s): how fast the blend follows the trip, and how slowly the swing's depth changes. */
const MIX_TAU = 0.15;
const DEPTH_TAU = 1.5;

export interface WowShape {
  /** The slow wow: cents either way, and its rate in Hz. */
  cents: number;
  rate: number;
  /** A light flutter on top (cents, Hz): the warble that makes it sound like tape. */
  flutter: number;
  flutterRate: number;
  /** How much of the dry signal is left at full strength (0: all wow; a little dry makes it shimmer). */
  dry: number;
}

/** The full trip: about ±80 cents (most of a semitone) every 4 s, a quick light flutter, and a touch of shimmer. */
export const WOW_FULL: WowShape = { cents: 80, rate: 0.25, flutter: 12, flutterRate: 4.2, dry: 0.22 };
/** Reduced motion's trip: a gentler, slower sway and no flutter (it is still sound; nothing on screen moves). */
export const WOW_CALM: WowShape = { cents: 35, rate: 0.16, flutter: 0, flutterRate: 4.2, dry: 0.4 };

/** The delay swing (s) that bends the pitch `cents` either way at `rate` Hz. */
export const wowDelay = (cents: number, rate: number) => (rate > 0 ? (2 ** (cents / 1200) - 1) / (2 * Math.PI * rate) : 0);

/** The pitch (cents) a delay of `centre + swing·sin(2π·rate·t)` gives at time `t`: what the ear hears. */
export const wowCentsAt = (swing: number, rate: number, t: number) => 1200 * Math.log2(Math.max(1e-6, 1 - 2 * Math.PI * rate * swing * Math.cos(2 * Math.PI * rate * t)));

export class Wobble {
  readonly input: GainNode;
  private dry: GainNode;
  private wet: GainNode;
  private wow: GainNode;
  private flutter: GainNode;
  private lfos: OscillatorNode[];
  private level = 0;
  private shape: WowShape = WOW_FULL;

  constructor(private ctx: BaseAudioContext, out: AudioNode) {
    this.input = ctx.createGain();
    this.dry = ctx.createGain();
    this.wet = ctx.createGain();
    this.wet.gain.value = 0;
    const delay = ctx.createDelay(0.2);
    delay.delayTime.value = WOW_CENTRE;
    this.input.connect(this.dry).connect(out);
    this.input.connect(delay).connect(this.wet).connect(out);
    const lfo = (hz: number, depth: GainNode) => {
      const o = ctx.createOscillator();
      o.frequency.value = hz;
      depth.gain.value = 0;
      o.connect(depth).connect(delay.delayTime);
      o.start();
      return o;
    };
    this.wow = ctx.createGain();
    this.flutter = ctx.createGain();
    this.lfos = [lfo(WOW_FULL.rate, this.wow), lfo(WOW_FULL.flutterRate, this.flutter)];
  }

  /** The trip's strength now (0 to 1), and which shape (calm or full). Call it every frame; it only writes on a change. */
  set(level: number, calm: boolean, at = this.ctx.currentTime) {
    const k = Math.max(0, Math.min(1, level));
    const shape = calm ? WOW_CALM : WOW_FULL;
    if (Math.abs(k - this.level) < 0.002 && shape === this.shape) return;
    this.level = k;
    if (shape !== this.shape) {
      this.shape = shape;
      this.lfos[0]!.frequency.setTargetAtTime(shape.rate, at, DEPTH_TAU);
      this.lfos[1]!.frequency.setTargetAtTime(shape.flutterRate, at, DEPTH_TAU);
    }
    this.dry.gain.setTargetAtTime(1 - (1 - shape.dry) * k, at, MIX_TAU);
    this.wet.gain.setTargetAtTime(k, at, MIX_TAU);
    this.wow.gain.setTargetAtTime(k * wowDelay(shape.cents, shape.rate), at, DEPTH_TAU);
    this.flutter.gain.setTargetAtTime(k * wowDelay(shape.flutter, shape.flutterRate), at, DEPTH_TAU);
  }

  dispose() {
    for (const o of this.lfos) o.stop();
  }
}

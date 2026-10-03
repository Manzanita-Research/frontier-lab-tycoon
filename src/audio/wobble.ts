// FLT-105 (pass 2): the trip's tape wow. The band plays through a short delay line whose length an LFO swings back and
// forth, so the whole mix glides sharp and flat together, like a warped record: everything bends, nothing clashes
// (the first pass detuned each new note instead, which only sounded out of tune against the notes still ringing).
//
// A delay line read at a moving point is a pitch shift: if the delay is D + A·sin(2πft), the pitch is multiplied by
// 1 − 2πfA·cos(2πft). So `wowDelay` turns "± this many cents at this rate" into the swing in seconds.
//
// The music always goes through the line (60 ms late, which nobody hears: the band is scheduled ahead anyway), and
// with no trip the swing is zero, so it is exactly in tune. Only the swing's depth follows the trip's strength, eased
// (`DEPTH_TAU`) both ways: there is no crossfade to a dry copy, so nothing combs, dips or swoops on the way out.

/** Seconds of delay the swing is centred on (it needs room either side). */
export const WOW_CENTRE = 0.06;
/**
 * How slowly the swing's depth follows the trip (s). A depth that shrinks fast bends the pitch on its own way out
 * (the delay's slope is the bend); at one second, "I've had enough" swings no further than about 1.2× the wow it
 * stops, and the music is back in tune a couple of seconds later.
 */
const DEPTH_TAU = 1;

export interface WowShape {
  /** The slow wow: cents either way, and its rate in Hz. */
  cents: number;
  rate: number;
  /** A light flutter on top (cents, Hz): the warble that makes it sound like tape. */
  flutter: number;
  flutterRate: number;
}

/** The full trip: about ±80 cents (most of a semitone) every 4 s, and a quick light flutter. */
export const WOW_FULL: WowShape = { cents: 80, rate: 0.25, flutter: 12, flutterRate: 4.2 };
/** Reduced motion's trip: a gentler, slower sway and no flutter (it is still sound; nothing on screen moves). */
export const WOW_CALM: WowShape = { cents: 35, rate: 0.16, flutter: 0, flutterRate: 4.2 };

/** The delay swing (s) that bends the pitch `cents` either way at `rate` Hz. */
export const wowDelay = (cents: number, rate: number) => (rate > 0 ? (2 ** (cents / 1200) - 1) / (2 * Math.PI * rate) : 0);

/** The pitch (cents) a delay of `centre + swing·sin(2π·rate·t)` gives at time `t`: what the ear hears. */
export const wowCentsAt = (swing: number, rate: number, t: number) => 1200 * Math.log2(Math.max(1e-6, 1 - 2 * Math.PI * rate * swing * Math.cos(2 * Math.PI * rate * t)));

export class Wobble {
  readonly input: GainNode;
  private wow: GainNode;
  private flutter: GainNode;
  private lfos: OscillatorNode[];
  private level = 0;
  private shape: WowShape = WOW_FULL;

  constructor(private ctx: BaseAudioContext, out: AudioNode) {
    this.input = ctx.createGain();
    const delay = ctx.createDelay(0.2);
    delay.delayTime.value = WOW_CENTRE;
    this.input.connect(delay).connect(out);
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
    this.wow.gain.setTargetAtTime(k * wowDelay(shape.cents, shape.rate), at, DEPTH_TAU);
    this.flutter.gain.setTargetAtTime(k * wowDelay(shape.flutter, shape.flutterRate), at, DEPTH_TAU);
  }

  dispose() {
    for (const o of this.lfos) o.stop();
  }
}

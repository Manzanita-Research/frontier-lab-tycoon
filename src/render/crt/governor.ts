// The CRT's frame-time governor (FLT-73): if the game drops under ~50 fps with the tube on, step the canvas down a tier
// (multi-pass → lite → flat) and see whether that helped. If it did not, the tube was not the problem (a slow
// machine is slow with or without it), so the step is undone and the governor stops. It only ever steps down on its
// own; picking a look in Display Properties starts it over. Pure, driven by frame times; unit-tested.
import { CRT_TIERS, type CrtTier } from "./looks";

export interface GovernorOptions {
  /** Mean frame time (ms) above which the tier steps down. 20 ms is 50 fps: room under 60 fps for a busy frame. */
  budgetMs: number;
  /** Frames ignored after each change (shader compiles, targets allocate). */
  warmup: number;
  /** Frames averaged per verdict. */
  window: number;
  /** A step down counts as helping if it cut the mean frame time by at least this share. */
  helped: number;
}

export const GOVERNOR_DEFAULTS: GovernorOptions = { budgetMs: 20, warmup: 45, window: 90, helped: 0.12 };

export class CrtGovernor {
  tier: CrtTier;
  /** The tier it started at: below it, the canvas has been turned down. */
  readonly start: CrtTier;
  /** Settled: stopped watching (the canvas is flat, or a step down showed the tube was not the cost). */
  settled = false;
  /** The tier stepped down from, and the mean frame time there, while the step is on trial. */
  private trial: { from: CrtTier; mean: number } | null = null;
  private skip: number;
  private sum = 0;
  private count = 0;
  private readonly o: GovernorOptions;

  constructor(start: CrtTier, options: Partial<GovernorOptions> = {}) {
    this.o = { ...GOVERNOR_DEFAULTS, ...options };
    this.tier = start;
    this.start = start;
    this.skip = this.o.warmup;
    if (start === "flat") this.settled = true;
  }

  /** Feed one frame's duration. Returns the tier to use from now on (the same one, most frames). */
  frame(ms: number): CrtTier {
    // A hidden tab or a breakpoint is not a slow frame.
    if (this.settled || !(ms > 0) || ms > 250) return this.tier;
    if (this.skip > 0) {
      this.skip--;
      return this.tier;
    }
    this.sum += ms;
    this.count++;
    if (this.count < this.o.window) return this.tier;
    const mean = this.sum / this.count;
    this.sum = 0;
    this.count = 0;
    this.skip = this.o.warmup;
    if (this.trial) {
      const { from, mean: before } = this.trial;
      this.trial = null;
      if (mean > before * (1 - this.o.helped)) {
        // The step did not buy anything: the tube is not what is slow. Put it back and stop.
        this.tier = from;
        this.settled = true;
        return this.tier;
      }
    }
    // Keeping up: keep watching (a busy late game can slow down long after the first verdict).
    if (mean <= this.o.budgetMs) return this.tier;
    const next = CRT_TIERS[CRT_TIERS.indexOf(this.tier) + 1];
    if (!next) {
      this.settled = true;
      return this.tier;
    }
    this.trial = { from: this.tier, mean };
    this.tier = next;
    return this.tier;
  }
}

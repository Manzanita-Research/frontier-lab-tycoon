import { Context } from "effect";

export interface RulesApi {
  readonly tunables: Readonly<Record<string, number>>;
  readonly safeRanges: Readonly<Record<string, readonly [number, number]>>;
  readonly runCostGrowth: readonly number[];
  /** Machine patching is reserved for M3; the M1 manifest cannot supply code. */
  readonly machinePatches: Readonly<Record<string, never>>;
}
export class Rules extends Context.Service<Rules, RulesApi>()("@flt/Rules") {}

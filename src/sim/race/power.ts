// Datacenters, and what powers them. Each Gas Turbine or Solar Farm keeps one Datacenter running; a Datacenter
// without a plant is a very large bunker that makes no compute.
import { COMPUTE_PER_DATACENTER } from "../constants";
import type { GameState } from "../types";

/** Discourse a Gas Turbine adds per game day (a cluster adds 0.5). */
export const DISCOURSE_PER_GAS = 0.4;
/** Hype the resting level rises by for each Solar Farm, up to the cap. */
export const HYPE_PER_SOLAR = 4;
export const SOLAR_HYPE_CAP = 12;

export interface Power {
  datacenters: number;
  gas: number;
  solar: number;
  /** Datacenters with a plant to run them. */
  powered: number;
}

export function powerOf(state: Pick<GameState, "buildings">): Power {
  let datacenters = 0;
  let gas = 0;
  let solar = 0;
  for (const b of state.buildings) {
    if (b.broken) continue; // a Datacenter or plant that is down is not running
    if (b.kind === "datacenter") datacenters++;
    else if (b.kind === "gas") gas++;
    else if (b.kind === "solar") solar++;
  }
  return { datacenters, gas, solar, powered: Math.min(datacenters, gas + solar) };
}

/** Compute a day from the powered Datacenters. */
export const datacenterCompute = (state: Pick<GameState, "buildings">): number => powerOf(state).powered * COMPUTE_PER_DATACENTER;

/** Extra water discourse each day from the Gas Turbines. */
export const gasDiscourse = (state: Pick<GameState, "buildings">): number => powerOf(state).gas * DISCOURSE_PER_GAS;

/** Solar Farms lift what the hype settles at. */
export const solarHype = (state: Pick<GameState, "buildings">): number => Math.min(SOLAR_HYPE_CAP, powerOf(state).solar * HYPE_PER_SOLAR);

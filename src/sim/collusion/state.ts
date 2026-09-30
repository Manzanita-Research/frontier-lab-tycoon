import type { GameState, Point } from "../types";
import type { SwarmStored } from "./machine";

export type SwarmStage = "dormant" | "seeded" | "spreading" | "organized" | "contained" | "partlyContained" | "exposed";
export type SwarmEnding = Extract<SwarmStage, "contained" | "partlyContained" | "exposed">;
export interface Investigation {
  startedDay: number;
  days: number;
  to: number;
  job: "security" | "sre" | "comms" | "janitor";
}
/** Presentation is a request, independent of the actors' current representation. */
export interface CollusionState {
  enabled: boolean;
  rngState: number;
  machine: SwarmStored;
  invalidUntil: number;
  ending: SwarmEnding | null;
  history: { day: number; stage: SwarmStage }[];
  packets: { id: number; tick: number; from: Point; to: Point; presentation: "offmap"; page: string }[];
  gathering: { buildingId: number; entityKind: "agent"; presentation: "gathering"; members: number; active: boolean } | null;
  /** Persistent front-page hooks; not subject to the ticker's 50-item retention. */
  classified: { day: number; text: string } | null;
  frontPage: { day: number; title: string; kind: "scandal" } | null;
  heartbeat: { day: number; page: string; text: string } | null;
}
export const activeSwarm = (s: GameState): boolean => !!s.collusion?.enabled && ["seeded", "spreading", "organized"].includes(s.collusion.machine.value);

// Neo labs: rivals your own people found (FLT-26 Defection, FLT-20 Poaching War). They race on the Frontier Arena
// like the six built-in labs, but they live here, not in `race.rivals`, so a lab with neither pack on is unchanged.
import type { PersonalitySchema, RivalStored } from "../race/rival";

export type NeoOrigin = "defection" | "poaching";
/** A friendly lab (you let them go gracefully) hardly poaches and sends goodwill; a hostile one wants your people. */
export type NeoMood = "friendly" | "hostile";

export interface NeoLab {
  /** "neo:1", "neo:2", ... Never a built-in rival id. */
  id: string;
  name: string;
  short: string;
  color: string;
  /** Who walked out to start it, and who walked out with them. */
  founder: string;
  followers: string[];
  manifesto: string;
  origin: NeoOrigin;
  mood: NeoMood;
  /** Game day it was founded. */
  founded: number;
  /** It has decided you are the one to beat. */
  nemesis: boolean;
  /** Researchers it has taken from you since. */
  poached: number;
  /** A rival machine like the built-in labs', stepped weekly with this module's own dice. */
  rival: RivalStored;
  /** The pack's words for its news: releases, poaches, the nemesis turn. */
  lines: { release: string[]; poach: string[]; nemesis: string[]; goodwill: string[] };
  /** FLT-56: the seed round it raised, in $B. Missing for older saves and for Poaching War labs (they get the default). */
  seed?: number;
}

export interface NeoLabsState {
  /** Its own random stream: founding a lab never shifts the main one. */
  rngState: number;
  seq: number;
  labs: NeoLab[];
}

export type Personality = typeof PersonalitySchema.Type;
export const isNeoId = (id: string) => id.startsWith("neo:");

/**
 * FLT-56: what the lab is "worth", in $B, for the balloon over its campus. Zero product, so it is the seed round
 * times the hype, and nothing else. Pure; the renderer and the view-model call it.
 */
export function neoValuation(lab: Pick<NeoLab, "seed" | "rival">): number {
  const seed = lab.seed ?? 2;
  return Math.round(seed * (1 + Math.max(0, lab.rival.context.hype) / 12) * 10) / 10;
}

import { initialStored } from "../../machines/run";
import { policyMachine, type PolicyStored } from "./policy";
import type { PublicationStored } from "./publication";
export interface Paper {
  id: number;
  /** A release index or an era milestone; papers are off-map entities, independent of walkers. */
  source: string;
  title: string;
  authors: number;
  venue: string;
  route: "preprint" | "review" | null;
  machine: PublicationStored;
}
export interface PapersState {
  enabled: boolean;
  policy: PolicyStored;
  list: Paper[];
  modelsSeen: number;
  eraSeen: number;
  nextId: number;
  reputation: number;
  /** Total capability delivered through rivals' SHOCK hooks, for headless comparisons. */
  knowledgeSpill: number;
  published: number;
  scoops: number;
  awards: number;
  critiques: number;
}
export const createPapers = (): PapersState => ({
  enabled: true, policy: initialStored(policyMachine, { publishPressure: 0 }), list: [],
  modelsSeen: 0, eraSeen: 1, nextId: 1, reputation: 0, knowledgeSpill: 0,
  published: 0, scoops: 0, awards: 0, critiques: 0,
});

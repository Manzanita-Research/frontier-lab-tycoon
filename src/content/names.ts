// Names: the lab, its models, and the neighbours. Parody only: nobody real, nobody named.
import type { Rng } from "../sim/rng";

export const LAB_NAMES = [
  "Emergent Behavior Inc.",
  "Gradient Descent & Sons",
  "Attention Is All We Have",
  "Scaling Laws Are Real Corp",
  "Loss Landscape Labs",
  "Yes And Labs",
  "Vibes-Based Intelligence",
  "Stochastic Parrots Anonymous",
  "Mostly Harmless Compute",
  "Unreasonable Effectiveness LLC",
  "Reward Hacking Holdings",
  "The Bitter Lesson Company",
];

export const RIVALS = [
  "Anthropomorphic",
  "Open-ish AI",
  "MetaMeta Superintelligence Labs",
  "Very Safe Superintelligence Inc.",
  "Sirocco",
  "Macrohard",
  "Vaporware Labs",
  "Freeweights Collective",
  "BigCo Cloud",
];

const TIERS = ["Mini", "Pro", "Max", "Ultra", "Lite", "Flash", "Turbo", "Nano", "Plus"];
const SKILLS = ["Reasoner", "Thinking", "Agentic", "Coder", "Omni", "Vision", "Chat"];
const STAGES = ["Preview", "Beta", "RC1", "Experimental", "Final", "Final-v2", "Final-FINAL"];

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * "Frontier-2", "Frontier-3-Reasoner", "Frontier-4-Mini-Pro-Preview-0925", ...
 * Run 1 is the plain one; the names get sillier every release.
 */
export function modelName(run: number, rng: Rng, day: number): string {
  // The third release is Frontier-4, which is what the scenario asks for.
  const base = `Frontier-${1 + run}`;
  if (run <= 1) return base;
  if (run === 2) return `${base}-Reasoner`;
  const parts = [base];
  const used = new Set<string>();
  const add = (pool: string[]) => {
    for (let i = 0; i < 6; i++) {
      const p = rng.pick(pool);
      if (!used.has(p)) {
        used.add(p);
        parts.push(p);
        return;
      }
    }
  };
  if (rng.chance(0.5)) add(SKILLS);
  add(TIERS);
  if (rng.chance(0.6)) add(TIERS);
  add(STAGES);
  if (rng.chance(0.7)) {
    const month = Math.floor((day % 360) / 30) + 1;
    parts.push(`${pad(month)}${pad((day % 30) + 1)}`);
  }
  return parts.join("-");
}

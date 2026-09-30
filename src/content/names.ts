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
  "MetaMeta Metaintelligence Labs",
  "Very Very Super Super Intelligence",
  "Sirocco",
  "Macrohard",
  "Vaporware Labs",
  "Freeweights Collective",
  "BigCo Cloud",
];

/** Short forms of RIVALS, in the same order, for thoughts and personnel files ("Turned down MetaMeta twice"). */
export const RIVAL_SHORT = [
  "Anthropomorphic",
  "Open-ish AI",
  "MetaMeta",
  "Super Super",
  "Sirocco",
  "Macrohard",
  "Vaporware",
  "Freeweights",
  "BigCo",
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

// People. First names come from everywhere; surnames are all puns about the trade. Nobody real, nobody named.
export const FIRST_NAMES = [
  "Ada", "Kevin", "Priya", "Wei", "Sam", "Chidi", "Marisol", "Dmitri", "Fatima", "Noor", "Tobias", "Yuki",
  "Ingrid", "Omar", "Beatriz", "Kwame", "Lena", "Rohan", "Astrid", "Mateo", "Hana", "Felix", "Zainab", "Ravi",
  "Nadia", "Otto", "Imani", "Bjorn", "Leila", "Pablo", "Mei", "Gus", "Sunita", "Callum", "Dalia", "Ezra",
  "Talia", "Hugo", "Amara", "Jules", "Petra", "Nico", "Kiri", "Wren", "Soren", "Bao", "Lucia", "Milo",
];

export const LAST_NAMES = [
  "Gradient", "Backprop", "Overfit", "Softmax", "Epoch", "Logit", "Hessian", "Dropout", "Batchnorm", "Perceptron",
  "Latent", "Sigmoid", "Tokenizer", "Embedding", "Regularizer", "Finetune", "Checkpoint", "Rollout", "Prior", "Posterior",
  "Bottleneck", "Ablation", "Saturate", "Heuristic", "Bayesian", "Kernel", "Argmax", "Eigen", "Stochastic", "Vector",
  "Noisefloor", "Rewardhack", "Loss-Spike", "Underfit", "Baseline", "Beamsearch", "Hallucin", "Outlier", "Momentum", "Warmup",
  "Sparse", "Dense", "Attention", "Residual", "Gaussian", "Manifold", "Cosine", "Tensor",
];

export const RESEARCHER_ROLES = [
  "Member of Technical Staff",
  "Member of Technical Staff",
  "Member of Technical Staff",
  "Senior Member of Technical Staff",
  "Research Scientist",
  "Prompt Whisperer",
  "Loss Curve Astrologer",
  "Distinguished Intern",
  "Principal Bikeshedder",
  "Head of Vibes",
  "Evals Enjoyer",
  "Staff Ablation Engineer",
];

export const AGENT_NICKNAMES = [
  "Sparky", "Chip", "Gizmo", "Bolt", "Pixel", "Widget", "Ziggy", "Turbo", "Nugget", "Beep", "Clank", "Doodle",
  "Fizz", "Gadget", "Jinx", "Kernel", "Mochi", "Nibbles", "Pogo", "Quirk", "Rusty", "Sprocket", "Tater", "Waffles",
];

export const VISITOR_ROLES = ["Venture Capitalist", "Journalist", "Enterprise Buyer", "Influencer"] as const;
export type VisitorRole = (typeof VISITOR_ROLES)[number];

/** Pronoun sets for headlines: she/her, he/his, they/their. Assigned at random, independent of the name. */
export const THEIR = ["her", "his", "their"] as const;

const pad4 = (n: number) => String(n).padStart(4, "0");

export interface Identity {
  name: string;
  role: string;
  /** Index into THEIR. */
  pro: number;
}

/** The word pools behind the names. A mod can swap them (FLT-37); the algorithms below stay put. */
export interface PeoplePools {
  FIRST_NAMES: readonly string[];
  LAST_NAMES: readonly string[];
  RESEARCHER_ROLES: readonly string[];
  AGENT_NICKNAMES: readonly string[];
}
const BASE_PEOPLE: PeoplePools = { FIRST_NAMES, LAST_NAMES, RESEARCHER_ROLES, AGENT_NICKNAMES };

/** "Dr. Ada Gradient" or "Kevin Backprop", plus a job title. */
export function researcherIdentity(rng: Rng, pools: PeoplePools = BASE_PEOPLE): Identity {
  const name = `${rng.chance(0.3) ? "Dr. " : ""}${rng.pick(pools.FIRST_NAMES)} ${rng.pick(pools.LAST_NAMES)}`;
  return { name, role: rng.pick(pools.RESEARCHER_ROLES), pro: rng.int(0, 2) };
}

/** "Agent-0042 'Sparky'". `n` is the running agent number. */
export function agentIdentity(n: number, rng: Rng, pools: PeoplePools = BASE_PEOPLE): Identity {
  return { name: `Agent-${pad4(n)} '${rng.pick(pools.AGENT_NICKNAMES)}'`, role: "Autonomous Agent", pro: 2 };
}

/**
 * A visitor's name and line of work. Investors turn up more often when the lab has good vibes:
 * `vibes` is 0 to 999.
 */
export function visitorIdentity(rng: Rng, vibes: number, pools: PeoplePools = BASE_PEOPLE): Identity {
  const vc = 0.06 + (vibes / 999) * 0.14;
  const r = rng.next();
  const role: VisitorRole = r < vc ? "Venture Capitalist" : r < vc + (1 - vc) / 3 ? "Journalist" : r < vc + ((1 - vc) * 2) / 3 ? "Enterprise Buyer" : "Influencer";
  return { name: `${rng.pick(pools.FIRST_NAMES)} ${rng.pick(pools.LAST_NAMES)}`, role, pro: rng.int(0, 2) };
}

/** A protester: a first name and the sign they were handed. */
export function protesterIdentity(rng: Rng, pools: PeoplePools = BASE_PEOPLE): Identity {
  return { name: `${rng.pick(pools.FIRST_NAMES)} ${rng.pick(pools.LAST_NAMES)}`, role: "Concerned Citizen", pro: rng.int(0, 2) };
}

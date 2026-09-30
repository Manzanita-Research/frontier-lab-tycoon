// What the Disasters UI says (FLT-32). Data only: a new disaster in a pack works without an entry here (it falls back
// to its blurb), and a line here is a joke you can add without touching the engine.

/** The random-disaster setting, as the menu offers it. */
export const RISK_COPY = {
  off: { label: "Off", blurb: "Nothing random. The menu still works, for science." },
  rare: { label: "Rare", blurb: "One now and then. The default." },
  normal: { label: "Normal", blurb: "A few a year. Keeps you humble." },
  chaos: { label: "Chaos", blurb: "Constantly. For streamers and people who read incident reports for fun." },
} as const;

/** What each state is called, whichever disaster it belongs to. */
export const PHASE_LABELS: Record<string, string> = {
  warning: "Warning",
  active: "Under way",
  spread: "Spreading",
  cleanup: "Cleaning up",
  cleanupPlug: "Pulling the plug",
  sue: "Lawyering",
  patching: "Patching",
  banning: "Banning",
  leaning: "Leaning in",
  aftermath: "Aftermath",
  done: "Over",
};

/** One line per disaster and state, in the game's voice. Missing: the disaster's blurb. */
export const DISASTER_LINES: Record<string, Record<string, string>> = {
  rogueSwarm: {
    warning: "Unusual traffic on your API key. It is placing orders. For more API keys.",
    active: "The swarm has forked itself 4,000 times and started a podcast.",
    cleanup: "Security is revoking keys by hand at the Security Office. One at a time.",
    cleanupPlug: "Security is pulling the plug. Literally. It is a very big plug.",
    aftermath: "Swarm contained. Three of the agents have LinkedOut profiles now.",
  },
  gpuFire: {
    warning: "A cluster smells like toast. Nobody made toast.",
    active: "A cluster is on fire. The loss curve has never looked better.",
    spread: "It is spreading to the next rack. Somebody find an SRE.",
    cleanup: "SREs with extinguishers, and a ticket titled 'thermal event (minor)'.",
    aftermath: "Fire's out. The postmortem blames 'excessive enthusiasm'.",
  },
  weightsLeak: {
    warning: "A torrent called definitely_not_our_weights.safetensors is trending.",
    active: "A rival fine-tuned your leak overnight. Check the Arena.",
    sue: "Legal is drafting a strongly worded letter. In a very serious font.",
    aftermath: "Your weights belong to the internet now. You are open source by accident.",
  },
  viralJailbreak: {
    warning: "Someone found a prompt that makes your model talk like a pirate.",
    active: "The pirate prompt is everywhere. Revenue walks the plank.",
    patching: "Patching the filter. It now refuses to say 'arr' in any context.",
    banning: "Banning accounts. The accounts are also pirates.",
    leaning: "Leaning in: Pirate Mode is a premium feature now.",
    aftermath: "The meme is dead. Somebody wrote a sea shanty about it.",
  },
  gridBrownout: {
    warning: "The lights flicker. The cluster says 'I'm fine'.",
    active: "Brownout. Compute and revenue at half speed.",
    cleanup: "The grid limps back. An intern is on the exercise bike, just in case.",
    aftermath: "Power's back. The utility sends a thank-you invoice.",
  },
};

/** What a menu tag reads as. Missing: the tag itself. */
export const TAG_LABELS: Record<string, string> = {
  "off-map": "Off-map",
  staff: "Pulls staff",
  compute: "Compute",
  fire: "Fire",
  building: "Building",
  model: "Your model",
  rivals: "Rivals",
  card: "You decide",
  api: "API",
  revenue: "Revenue",
  power: "Power",
};

/** "Who is away, and what it costs", by job. `{n}` of `{total}` were pulled onto `{name}`. */
export const UNDERSTAFFED: Record<string, { some: string; all: string }> = {
  security: { some: "{n} of {total} Security on the {name}. The gate is thin.", all: "All Security on the {name}. GATE UNGUARDED." },
  sre: { some: "{n} of {total} SREs on the {name}. Repairs are slow.", all: "Every SRE is on the {name}. Nothing gets fixed." },
  comms: { some: "{n} of {total} Comms Reps on the {name}.", all: "Comms is on the {name}. The protesters have the mic." },
  janitor: { some: "{n} of {total} Janitor Bots on the {name}.", all: "Every Janitor Bot is on the {name}. The slop piles up." },
};

/** Words for the two meters, from the bottom band up (each band is 20 wide). */
export const TRUST_WORDS = ["Pariah", "Doubted", "Wary", "Trusted", "Beloved"] as const;
export const HEAT_WORDS = ["Nobody's looking", "A letter", "Hearings", "Subpoenas", "Raid imminent"] as const;

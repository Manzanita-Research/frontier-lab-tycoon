// The rival labs. Data only: a new rival or a new joke is an entry here, never an engine change.
// Personality drives the rival machine (sim/race/rival.ts); the copy is what the news ticker says about them.
// Templates: {rival} {model} {lab}. Parody names only, no nationalities.

export type RivalId = "anthro" | "openish" | "metameta" | "vssi" | "sirocco" | "macrohard";

/** The five knobs that make each lab itself. */
export interface Personality {
  /** Typical weeks between releases. Below 2 they ship every week. */
  cadence: number;
  /** Capability a release adds, before luck, era and momentum. */
  growth: number;
  /** 0 to 1: how likely a release is open weights. In between, they flip-flop. */
  openness: number;
  /** 0 to 1: weekly chance they poach one of your researchers. */
  poaching: number;
  /** How much hype a release earns them (and how loudly they chase it). */
  hypeHunger: number;
}

export interface RivalDef {
  id: RivalId;
  name: string;
  /** Leaderboard label. */
  short: string;
  color: string;
  /** One line for the leaderboard tooltip. */
  tagline: string;
  startCapability: number;
  startHype: number;
  personality: Personality;
  /** Models are named `${base}-${n}` plus a tier. No base means no product. */
  models: { base: string; tiers: string[] } | null;
  headlines: {
    release: string[];
    /** Extra lines for an open-weights release. */
    open?: string[];
    /** No product to ship: this is what they do instead. */
    stunt?: string[];
    poach?: string[];
  };
}

export const RIVAL_DEFS: RivalDef[] = [
  {
    id: "anthro",
    name: "Anthropomorphic",
    short: "Anthropomorphic",
    color: "#c96f3b",
    tagline: "Safety-first. Ships late. Writes essays.",
    startCapability: 28,
    startHype: 42,
    personality: { cadence: 11, growth: 17, openness: 0.02, poaching: 0.02, hypeHunger: 0.4 },
    models: { base: "Sestina", tiers: ["", "", "Pro", "Long-Form"] },
    headlines: {
      release: [
        "{rival} publishes {model} alongside a 12,000-word essay on why it hesitated",
        "{rival} finally ships {model}, six months after saying 'soon'",
        "{rival} releases {model} with a 90-page safety card and a two-page model",
        "{rival} launches {model}; its own researchers call it 'concerningly fine'",
        "{rival} announces {model} and, in the same post, a pause to reflect on {model}",
      ],
      poach: ["{rival} hires a researcher from {lab}; offer letter includes an essay about the offer letter"],
    },
  },
  {
    id: "openish",
    name: "Open-ish AI",
    short: "Open-ish AI",
    color: "#2f9e8f",
    tagline: "Ships every week. Product sprawl.",
    startCapability: 24,
    startHype: 60,
    personality: { cadence: 1, growth: 2, openness: 0.2, poaching: 0.04, hypeHunger: 1.5 },
    models: { base: "Chatty", tiers: ["mini", "turbo", "pro-max", "ish", "lite", "plus"] },
    headlines: {
      release: [
        "{rival} ships {model}. Again. It's Tuesday",
        "{rival} launches {model}, a browser, a phone and a small country, all in one keynote",
        "{rival} unveils {model}, {model}-mini and {model}-'we'll see'",
        "{rival} adds {model} to the app that also does everything else",
        "{rival} announces {model} and a social network nobody asked for; both are in beta",
        "{rival} rebrands {model} as 'a new kind of thing', then rebrands the brand",
      ],
      open: ["{rival} releases {model} as 'open-ish': the weights are open, the license is a riddle"],
      poach: ["{rival} poaches a researcher from {lab} with equity, a hoodie and a new product line"],
    },
  },
  {
    id: "metameta",
    name: "MetaMeta Superintelligence Labs",
    short: "MetaMeta",
    color: "#4f7fe0",
    tagline: "Poaches with $100M offers. Flip-flops on open weights.",
    startCapability: 26,
    startHype: 50,
    personality: { cadence: 7, growth: 10, openness: 0.5, poaching: 0.22, hypeHunger: 1 },
    models: { base: "Superintelligence-Preview", tiers: ["", "Mini", "Behemoth"] },
    headlines: {
      release: [
        "{rival} releases {model}, a superintelligence, in the metaverse, which is empty",
        "{rival} ships {model} and offers every researcher $100M to stay for the demo",
        "{rival} unveils {model}; asked if it is open, its spokesperson says 'define open'",
        "{rival} launches {model} to a crowd of 40 avatars and one very tired lawyer",
      ],
      open: ["{rival} makes {model} open weights on Monday and 'it's complicated' by Friday"],
      poach: [
        "{rival} offers a {lab} researcher $100M; the researcher asks whether that is per week",
        "{rival} poaches a {lab} researcher with a nine-figure offer and a very large chair",
      ],
    },
  },
  {
    id: "vssi",
    name: "Very Safe Superintelligence Inc.",
    short: "Very Safe SI",
    color: "#7a63c9",
    tagline: "No product. $30B valuation.",
    startCapability: 12,
    startHype: 76,
    personality: { cadence: 18, growth: 3, openness: 0, poaching: 0.02, hypeHunger: 2 },
    models: null,
    headlines: {
      release: [],
      stunt: [
        "{rival} shares a slide: 'We are still building it.' Valuation up 40%",
        "{rival} announces it has no product and a new floor of the office",
        "{rival} raises at $30B on a promise to be safe first and exist later",
        "{rival} unveils a 'straight shot' strategy; the shot is not yet visible",
        "{rival} says it will release nothing, safely, at scale",
      ],
      poach: ["{rival} hires a {lab} researcher for a job description that reads 'think, quietly'"],
    },
  },
  {
    id: "sirocco",
    name: "Sirocco",
    short: "Sirocco",
    color: "#e0a030",
    tagline: "Open weights, released by torrent link at 3am.",
    startCapability: 20,
    startHype: 40,
    personality: { cadence: 5, growth: 7, openness: 1, poaching: 0, hypeHunger: 1.1 },
    models: { base: "Zephyr", tiers: ["", "Mini", "Base", "Base-Final"] },
    headlines: {
      release: [
        "{rival} drops {model} via torrent link at 3:07 a.m. No blog post, no README, 4,000 seeders",
        "{rival} posts {model} weights at 3 a.m. with the caption 'here'",
        "{rival}'s {model} is free, open, and already fine-tuned into a pirate",
        "{rival} releases {model} on a torrent; the README is a single shrug",
      ],
      open: ["{rival} makes {model} free to everyone, including your customers"],
    },
  },
  {
    id: "macrohard",
    name: "Macrohard",
    short: "Macrohard",
    color: "#5b6675",
    tagline: "BigCo. Bundles everything into spreadsheet software.",
    startCapability: 30,
    startHype: 45,
    personality: { cadence: 8, growth: 9, openness: 0, poaching: 0.06, hypeHunger: 0.7 },
    models: { base: "Pivot-Table", tiers: ["", "365", "Enterprise", "Home Edition"] },
    headlines: {
      release: [
        "{rival} bundles {model} into spreadsheet software; it now suggests a budget for your feelings",
        "{rival} adds {model} to the start menu, the taskbar and one unclosable window",
        "{rival} announces {model} will be 'available' in every product, including the ones you don't own",
        "{rival} ships {model} inside a spreadsheet; the spreadsheet is delighted",
      ],
      poach: ["{rival} hires a {lab} researcher with a company car and a mandatory update"],
    },
  },
];

export const RIVAL_BY_ID: Record<RivalId, RivalDef> = Object.fromEntries(RIVAL_DEFS.map((r) => [r.id, r])) as Record<RivalId, RivalDef>;

/** You plus the six labs. */
export const ARENA_SIZE = RIVAL_DEFS.length + 1;

/** Arena score: an Elo-looking number from capability and hype. */
export const arenaScore = (capability: number, hype: number): number => Math.round(1000 + 4 * capability + 1.5 * hype);

/** The leaderboard id of the lab that is you. */
export const YOU = "you";

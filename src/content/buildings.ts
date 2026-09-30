// Building catalogue. Data only: adding a building should not need an engine change.
import type { NeedKey } from "./needs";
import type { WalkerKind } from "../sim/types";

export type BuildingKind = "cluster" | "hall" | "gateway" | "kombucha" | "nap" | "snack" | "demo" | "fountain" | "datacenter" | "gas" | "solar" | "security";
/**
 * What the core build palette offers; scenery is placed by events, not by the player. The Security Office (FLT-17) is an
 * office: the palette adds it after these once the Scrutiny rung unlocks it (`OFFICE_TOOLS` in app/hud.ts, FLT-32).
 */
export type PlaceableKind = Exclude<BuildingKind, "fountain" | "security">;

export interface BuildingDef {
  kind: BuildingKind;
  name: string;
  /** Footprint in tiles: [width (x), depth (z)]. */
  size: [number, number];
  price: number;
  upkeepPerDay: number;
  blurb: string;
  /** Accent colour; the body of every building is cream. */
  color: string;
  /** Decoration: walkers never visit it, and it needs no path. */
  scenery?: boolean;
  /** Who goes in. Agents ignore `capacity` and queues; everyone else waits their turn. */
  hosts: readonly WalkerKind[];
  /** How many people (researchers and visitors) fit inside at once. */
  capacity: number;
  /** A stay lasts this many ticks, [min, max]. */
  stay: [number, number];
  /** How much of each need one stay refills, 0 to 1. For fomo a stay lowers it; for everything else it raises it. */
  serves: Partial<Record<WalkerKind, Partial<Record<NeedKey, number>>>>;
  /** Runs shows: the audience is impressed or not depending on capability (see sim/demo.ts). */
  show?: boolean;
  /** Which personnel-file counter a stay here bumps ("Drank 14 kombuchas"). */
  tally?: "sips" | "naps" | "snacks" | "demos";
  /** Hidden from the palette (and refused by the sim) until a compute auction unlocks it. */
  locked?: boolean;
  /** A staff building: walkers never visit it (disasters send staff there). On the palette from Scrutiny (FLT-32). */
  office?: boolean;
}

export const BUILDINGS: Record<BuildingKind, BuildingDef> = {
  cluster: {
    kind: "cluster",
    name: "Compute Cluster",
    size: [2, 2],
    price: 600_000,
    upkeepPerDay: 8_000,
    blurb: "Converts electricity and venture capital into heat.",
    color: "#4f8ff0",
    hosts: ["researcher", "agent", "visitor"],
    capacity: 10,
    stay: [15, 45],
    serves: { researcher: { focus: 0.2, fomo: 0.15 }, visitor: { impressed: 0.12 } },
  },
  hall: {
    kind: "hall",
    name: "Training Hall",
    size: [3, 3],
    price: 900_000,
    upkeepPerDay: 5_000,
    blurb: "Where the loss goes down and the valuation goes up.",
    color: "#8b6cf0",
    hosts: ["researcher", "agent", "visitor"],
    capacity: 14,
    stay: [15, 45],
    serves: { researcher: { fomo: 0.3, focus: 0.1 }, visitor: { impressed: 0.15 } },
  },
  gateway: {
    kind: "gateway",
    name: "API Gateway",
    size: [2, 2],
    price: 400_000,
    upkeepPerDay: 3_000,
    blurb: "Sells tokens by the million, at a loss by the billion.",
    color: "#ff8a4c",
    hosts: ["agent", "visitor"],
    capacity: 12,
    stay: [15, 45],
    serves: { visitor: { impressed: 0.12 } },
  },
  kombucha: {
    kind: "kombucha",
    name: "Kombucha Bar",
    size: [1, 1],
    price: 120_000,
    upkeepPerDay: 1_000,
    blurb: "Fermented morale.",
    color: "#2fbfa0",
    hosts: ["researcher", "visitor"],
    capacity: 4,
    stay: [12, 28],
    serves: { researcher: { energy: 0.5, focus: 0.15 }, visitor: { patience: 0.25, impressed: 0.05 } },
    tally: "sips",
  },
  nap: {
    kind: "nap",
    name: "Nap Pods",
    size: [2, 1],
    price: 200_000,
    upkeepPerDay: 1_500,
    blurb: "Horizontal thought leadership.",
    color: "#7a8cff",
    hosts: ["researcher"],
    capacity: 6,
    stay: [40, 70],
    serves: { researcher: { energy: 0.95 } },
    tally: "naps",
  },
  snack: {
    kind: "snack",
    name: "Snack Wall",
    size: [1, 1],
    price: 80_000,
    upkeepPerDay: 800,
    blurb: "Focus, in a 22-gram bag.",
    color: "#ffb020",
    hosts: ["researcher", "visitor"],
    capacity: 3,
    stay: [8, 16],
    serves: { researcher: { focus: 0.7 }, visitor: { patience: 0.3 } },
    tally: "snacks",
  },
  demo: {
    kind: "demo",
    name: "Demo Stage",
    size: [2, 2],
    price: 500_000,
    upkeepPerDay: 4_000,
    blurb: "Where the model always works. On the recording.",
    color: "#e2559a",
    hosts: ["visitor", "agent"],
    capacity: 12,
    stay: [30, 50],
    // What a good show is worth; a show that flops takes away instead (sim/demo.ts).
    serves: { visitor: { impressed: 0.5 } },
    show: true,
    tally: "demos",
  },
  fountain: {
    kind: "fountain",
    name: "Transparency Fountain",
    size: [1, 1],
    price: 0,
    upkeepPerDay: 0,
    blurb: "Water you can see through. Unlike the report.",
    color: "#4fc3e8",
    scenery: true,
    hosts: [],
    capacity: 0,
    stay: [0, 0],
    serves: {},
  },
  datacenter: {
    kind: "datacenter",
    name: "Datacenter",
    size: [4, 4],
    price: 2_500_000,
    upkeepPerDay: 18_000,
    blurb: "Forty thousand GPUs and one very large fan. Without a power plant it is an expensive bunker.",
    color: "#3a6fd8",
    locked: true,
    // Agents stream in and out of it like a cluster (they ignore capacity); nobody else has business there.
    hosts: ["agent"],
    capacity: 0,
    stay: [30, 60],
    serves: {},
  },
  gas: {
    kind: "gas",
    name: "Gas Turbine",
    size: [2, 2],
    price: 350_000,
    upkeepPerDay: 6_000,
    blurb: "Cheap power for a Datacenter. The neighbours will have discourse.",
    color: "#e0704a",
    locked: true,
    hosts: [],
    capacity: 0,
    stay: [0, 0],
    serves: {},
  },
  solar: {
    kind: "solar",
    name: "Solar Farm",
    size: [3, 3],
    price: 1_400_000,
    upkeepPerDay: 2_000,
    blurb: "Pricey power for a Datacenter. Everyone's favourite photo op.",
    color: "#f2b134",
    locked: true,
    hosts: [],
    capacity: 0,
    stay: [0, 0],
    serves: {},
  },
  security: {
    kind: "security",
    name: "Security Office",
    size: [2, 2],
    price: 350_000,
    upkeepPerDay: 2_000,
    blurb: "Where incident response happens. Also where the good coffee is hidden.",
    color: "#3b5bdb",
    office: true,
    hosts: [],
    capacity: 0,
    stay: [0, 0],
    serves: {},
  },
};

export const BUILDING_KINDS = Object.keys(BUILDINGS) as BuildingKind[];
export const PLACEABLE_KINDS = BUILDING_KINDS.filter((k): k is PlaceableKind => !BUILDINGS[k].scenery && !BUILDINGS[k].office);
/** The race's buildings: they show up in the palette once a compute auction has been won. */
export const RACE_KINDS = BUILDING_KINDS.filter((k): k is PlaceableKind => !!BUILDINGS[k].locked);

export const PATH_PRICE = 10_000;
export const BULLDOZE_REFUND = 0.5;

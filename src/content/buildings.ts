// Building catalogue. Data only: adding a building should not need an engine change.

export type BuildingKind = "cluster" | "hall" | "gateway" | "kombucha" | "fountain";
/** What the build palette offers; scenery is placed by events, not by the player. */
export type PlaceableKind = Exclude<BuildingKind, "fountain">;

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
  },
  hall: {
    kind: "hall",
    name: "Training Hall",
    size: [3, 3],
    price: 900_000,
    upkeepPerDay: 5_000,
    blurb: "Where the loss goes down and the valuation goes up.",
    color: "#8b6cf0",
  },
  gateway: {
    kind: "gateway",
    name: "API Gateway",
    size: [2, 2],
    price: 400_000,
    upkeepPerDay: 3_000,
    blurb: "Sells tokens by the million, at a loss by the billion.",
    color: "#ff8a4c",
  },
  kombucha: {
    kind: "kombucha",
    name: "Kombucha Bar",
    size: [1, 1],
    price: 120_000,
    upkeepPerDay: 1_000,
    blurb: "Fermented morale.",
    color: "#2fbfa0",
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
  },
};

export const BUILDING_KINDS = Object.keys(BUILDINGS) as BuildingKind[];
export const PLACEABLE_KINDS = BUILDING_KINDS.filter((k): k is PlaceableKind => !BUILDINGS[k].scenery);

export const PATH_PRICE = 10_000;
export const BULLDOZE_REFUND = 0.5;

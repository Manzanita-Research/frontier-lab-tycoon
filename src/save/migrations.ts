// Old saves keep loading. `MIGRATIONS[n]` turns a v`n` envelope into a v`n+1` one; `migrate` runs every step from the
// save's version up to SAVE_VERSION.
//
// The World inside is gzipped, so a step that changes it goes in `WORLD_MIGRATIONS` instead (same keys): `parseSave`
// unpacks the World of an old save, runs those steps on the plain JSON, and packs it again.
//
// Adding a version: bump SAVE_VERSION in `format.ts`, add `MIGRATIONS[old] = (save) => ...` (and a World step if the
// World changed), freeze a save of the old version in `fixtures/` and extend `migrations.test.ts`. Additive World changes (a new optional field) need none of
// this: the sim already treats a missing field as "an older save" and fills it in.
import { SAVE_VERSION } from "./format";

export type Envelope = { v: number } & Record<string, unknown>;
export type Migration = (save: Envelope) => Envelope;

/** Keyed by the version a step upgrades *from*. Empty while v1 is the only format there has been. */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {};

/** Upgrade `save` step by step to `target` (default: the current version). Throws on a gap in the table. */
export function migrate(save: { v: number }, target = SAVE_VERSION, table: Readonly<Record<number, Migration>> = MIGRATIONS): Envelope {
  let s = save as Envelope;
  while (s.v < target) {
    const step = table[s.v];
    if (!step) throw new Error(`No migration from save v${s.v}`);
    const next = step(s);
    if (next.v !== s.v + 1) throw new Error(`Migration from v${s.v} produced v${next.v}`);
    s = next;
  }
  return s;
}

export type WorldJson = Record<string, unknown>;
export type WorldMigration = (world: WorldJson) => WorldJson;

/** Steps on the unpacked World, keyed like MIGRATIONS (by the version they upgrade from). Most versions need none. */
export const WORLD_MIGRATIONS: Readonly<Record<number, WorldMigration>> = {};

/** Run the World steps for a save first written as v`from`. */
export function migrateWorld(world: WorldJson, from: number, target = SAVE_VERSION, table: Readonly<Record<number, WorldMigration>> = WORLD_MIGRATIONS): WorldJson {
  let w = world;
  for (let v = from; v < target; v++) {
    const step = table[v];
    if (step) w = step(w);
  }
  return w;
}

/** Whether a save first written as v`from` has any World steps to run. */
export const hasWorldSteps = (from: number, target = SAVE_VERSION, table: Readonly<Record<number, WorldMigration>> = WORLD_MIGRATIONS) =>
  Object.keys(table).some((k) => Number(k) >= from && Number(k) < target);

/**
 * A content id renamed (a rival, a building, a pack): every string that *is* the old id, and every key that is, becomes
 * the new one, anywhere in the World. Prose that merely mentions it ("vssi shipped") is left alone.
 * `MIGRATIONS[1] = (s) => ({ ...s, v: 2 })` plus `WORLD_MIGRATIONS[1] = (w) => renameIds(w, { vssi: "supersuper" })`.
 */
export function renameIds<T>(value: T, renames: Readonly<Record<string, string>>): T {
  const to = new Map(Object.entries(renames));
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return to.get(v) ?? v;
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v)) out[to.get(k) ?? k] = walk(x);
      return out;
    }
    return v;
  };
  return walk(value) as T;
}

// Old saves keep loading. `MIGRATIONS[n]` turns a v`n` envelope into a v`n+1` one (the World inside too, if it has to:
// unpack, fix, repack is fine, it is a one-off). `migrate` runs every step from the save's version up to SAVE_VERSION.
//
// Adding a version: bump SAVE_VERSION in `format.ts`, add `MIGRATIONS[old] = (save) => ...`, freeze a save of the old
// version in `fixtures/` and extend `migrations.test.ts`. Additive World changes (a new optional field) need none of
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

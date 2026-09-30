// Direct FLT-15 section-shaped content until M1b. No engine strings or tuning in the driver.
import { Schema } from "effect";
import manifest from "../../../../mods/base-papers/mod.json";
import balance from "../../../../mods/base-papers/balance.json";
import { ModManifest } from "../../../mods/schema";

export const PAPERS_PACK = Schema.decodeUnknownSync(ModManifest)(manifest);
const positive = Schema.Finite.check(Schema.isGreaterThan(0));
const fraction = Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 1 }));
const Balance = Schema.Struct({
  reviewDays: positive, critiqueChance: fraction, critiqueDelay: positive, scoopChance: fraction,
  awardChance: fraction, awardImportance: positive, selectiveImportance: positive,
  preprintReputation: positive, reviewReputation: positive, awardReputation: positive,
  preprintHype: positive, reviewHype: positive, critiqueValue: fraction, scoopValue: fraction,
  spillPerImportance: positive, citationsPerImportance: positive,
  policyPull: Schema.Struct({ Open: positive, Selective: positive, Closed: positive }),
  reputationPull: positive, maxPull: positive, closedPressurePerDay: positive,
  pressureRecovery: positive, maxPressure: positive, runImportance: positive,
  eraImportance: positive, researchImportance: positive, manyAuthorsChance: fraction,
  manyAuthors: positive, authorsMin: positive, authorsMax: positive,
});
export const P = Schema.decodeUnknownSync(Balance)(balance);
export function pool(id: string): readonly string[] {
  const values = PAPERS_PACK.content?.names?.add?.find((p) => p.id === `papers-${id}`)?.values;
  if (!values?.length) throw new Error(`base-papers: missing name pool ${id}`);
  return values;
}

-- FLT-67 cloud saves: one row per (player, slot). The .fltsave bytes live in R2 at saves/<user_id>/<slot>.fltsave;
-- `meta` is the save's JSON summary (src/account/contract.ts SaveMeta). Deleting the user deletes the rows.
CREATE TABLE IF NOT EXISTS "saves" (
  "user_id" TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "slot" TEXT NOT NULL CHECK ("slot" IN ('auto', '1', '2', '3')),
  "size" INTEGER NOT NULL,
  "updated_at" INTEGER NOT NULL,
  "meta" TEXT NOT NULL,
  PRIMARY KEY ("user_id", "slot")
);

-- FLT-67 cloud saves: one row per (player, slot). The .fltsave bytes live in R2 at saves/<user_id>/<slot>.fltsave;
-- `head` is the save's envelope without its state (src/account/contract.ts SaveHead). Deleting the user deletes the rows.
CREATE TABLE IF NOT EXISTS "saves" (
  "user_id" TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "slot" TEXT NOT NULL CHECK ("slot" IN ('auto', '1', '2', '3')),
  "size" INTEGER NOT NULL,
  "updated_at" INTEGER NOT NULL,
  "head" TEXT NOT NULL,
  PRIMARY KEY ("user_id", "slot")
);

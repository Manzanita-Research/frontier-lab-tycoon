# Frontier Lab Tycoon mod authoring

Read the supplied SKILL.md first. Edit mod.json, then run `pnpm test` until green.
This kit is private and linked to the game checkout; nothing needs publishing.
If using mod.ts instead, install the linked SDK, edit it, then run
`flt-mod bundle . mod.json` before the JSON test. Directory commands prefer mod.ts.
Use `pnpm flt-mod` from the game checkout if the bin is not on PATH.

Use parody names only. A content entity's presentation (`walker`, `flow`, `sprite`,
`offmap`) is separate from its logic. Don't turn every actor into a walker.
Shared mods are JSON only; mod.ts is trusted local author code and is executed locally.
Use add for complete new entries, override for existing ids, remove for existing ids.
Nested fields replace whole fields. Do not invent guard/action/condition names.
M1a checks schema, composition and structural references, then replays 365 days.
Read its M1b deferred list: a passing check does not mean new content renders or runs yet.

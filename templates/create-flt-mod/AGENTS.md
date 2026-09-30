# Frontier Lab Tycoon mod authoring

Read the supplied SKILL.md first. Edit mod.json, then run `pnpm test` until green.
This kit is private and linked to the game checkout; nothing needs publishing.
For TypeScript, copy mod.example.ts to mod.ts, install the linked SDK, edit it, then run
`flt-mod bundle . mod.json` before the JSON test. Directory commands prefer mod.ts.
Use `pnpm flt-mod` from the game checkout if the bin is not on PATH.

Use parody names only. A content entity's presentation (`walker`, `flow`, `sprite`,
`offmap`) is separate from its logic. Don't turn every actor into a walker.
Shared mods are JSON only; mod.ts is trusted local author code and is executed locally.
Use add for complete new entries, override for existing ids, remove for existing ids.
Nested fields replace whole fields. Do not invent guard/action/condition names.
The check validates the schema, composition and every guard/action's params, then plays
365 days in the real sim with your mod, twice. It lists the sections that ran and those
nothing reads yet, then checks the presentation (`looks`, `audio`, `skin`, `assets`:
2 MB cap, no remote files). To change how walkers look, use `looks`, not `walkerKinds`.
To see the mod, run `flt-mod dev .` and open the game with
`?mod=http://localhost:5174/mod.json`.

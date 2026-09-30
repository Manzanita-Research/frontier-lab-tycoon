# FLT-36: FLT-15 M2 — modder kit

**FLT-15 M2: the modder kit** (Codex Sol 6.1). It builds on M1a (PR #25, `src/mods/**`; read `src/mods/README.md` first), `docs/MODDING.md` and `docs/EFFECT-FOR-MODDERS.md`.

- **`packages/flt-mod-sdk`** (a pnpm workspace package; don't publish it, since making it public is Jem's call):
  - TypeScript types generated or derived from the Effect Schema.
  - A `defineMod()` helper, so authors get type-checked `mod.ts` → `mod.json`.
  - Re-exports of the canonical ids (rivals, buildings, conditions, guard and action names) as string-literal unions.
- **The `flt-mod` CLI** (a thin wrapper over the M1a checker):
  - `flt-mod check <path>`: the existing 365-day headless check, plus arc reachability (`xstate/graph`), with human-readable output.
  - `flt-mod bundle <dir>`: produces a single `.fltmod.json` with inlined assets.
  - `flt-mod dev <dir>`: serves the mod with CORS on :5174 and prints the `?mod=http://localhost:5174/mod.json&dev=1` link. Live hot-reload in the game is M1b; for now the command just serves.
- **`templates/create-flt-mod/`**: a starter mod with an `AGENTS.md` for modders, one example per content section, and a test that runs `flt-mod check`. Add `pnpm create-mod <name>` to scaffold it.
- **The mod-authoring skill** at `.agents/skills/flt-modding/SKILL.md` (Claude and Codex compatible, with the frontmatter description written for triggering). It covers:
  - the manifest
  - add/override/remove
  - the canonical ids
  - the vocabulary of guards and actions
  - the JSON statechart subset
  - ten worked examples (at least: rename rivals, a headline pack, a new thought set for a faction, a new building, a two-step arc with a card, a new disaster using the FLT-17 verbs if merged, a skin tweak)
  - the golden rule: "run `flt-mod check` until green"

  Keep it tight and example-led; it's also the input for FLT-34 Daily Drama.
- **Fix `docs/EFFECT-FOR-MODDERS.md`** so its example uses the canonical rival ids (`anthro`, `openish`, `metameta`), and re-check that every snippet matches the real API names from M1a.
- **Fresh-agent dry run (evidence):** in a clean temp dir with only the template and the skill, write a mod from the prompt "make a mod where every protester is a golden retriever with opinions", run `flt-mod check` and paste the transcript summary. The public-site load test comes after M1b.
- **Lane:** `packages/**`, `templates/**`, `.agents/skills/flt-modding/**`, `docs/EFFECT-FOR-MODDERS.md`, `docs/MODDING.md` (small updates), and root `package.json`/`pnpm-workspace.yaml`. Don't touch `src/sim/**` or `src/ui/**`.
- **Done when:** `pnpm check` is green and the CLI, template and skill work end to end on the two M1a examples plus the dry-run mod. It merges itself once green, with evidence in the PR.

**FLT-15 M1a: mod-system foundations** (Codex Sol 6.1). Read `docs/MODDING.md` §1b and `docs/EFFECT-FOR-MODDERS.md` first; they're the contract.

Build it **in new files only**, and don't change how the sim is entered yet (that's M1b, after FLT-16 merges):
- **Services** in `src/mods/services/`: `Skin`, `Content`, `Rules`, `Vocabulary`, `Assets`, `Audio`, `GameEvents`, each a `Context.Service`, matching the repo's Effect v4 idioms (see `src/app/sim.ts`).
- **`BaseGame.layer`:** `Layer.mergeAll(...)` built from today's `src/content/*` modules and the skin registry (FLT-14 may be mid-flight; read skins through a thin adapter).
- **The manifest schema** (`src/mods/schema.ts`, Effect Schema, `apiVersion: 1`), including the content sections with `add` / `override` / `remove`, and error messages that point at the exact field (with did-you-mean suggestions).
- **The loader:** `modToLayer(manifest)` builds a *wrapping* Layer per section, plus `composeMods([...])`, which stacks the mods in load order and produces a **conflict report**.
- **`resolveGameDefinition(layer)`:** resolves the services once into a plain `GameDefinition`. Include a test showing the base game's `GameDefinition` equals today's content exactly (no behaviour change).
- **Loading from links:** `?mod=` parsing (repeatable, including `gist:` shorthand), fetch plus validation, and CSS sanitising for skin sections (scoped, no `@import`, `url()` only to bundled assets).
- **`scripts/flt-mod-check.mjs` (`pnpm mod:check <path>`):** validates a mod, composes it on the base, runs the headless sim for 365 days **using today's sim entry points, with content injected via the resolved definition wherever it's already possible**, and reports the errors.
- **Example mods:** `mods/examples/every-lab-is-steve/mod.json` (the EFFECT-FOR-MODDERS example) and a tiny headline pack. Both pass `mod:check`.
- **Tests:** schema errors, add/override/remove semantics, the conflict report, composition order, and the base-definition equality check.

**Done when:** `pnpm check` is green, the examples pass `mod:check`, and the PR explains exactly what M1b must change in the sim entry points. **Merge yourself** once green, with evidence in the PR.

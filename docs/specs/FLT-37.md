# FLT-37: FLT-15 M1b, live mod integration

_Task spec as assigned (explore). Pinned here for the PR._

**FLT-15 M1b: live mod integration** (a cross-cutting sim refactor). **Start only when the sim lanes are quiet:** after FLT-16 (pacing), FLT-17 (Disasters sim) and FLT-27 (Leapfrog sim) have merged, because this replaces content imports across the whole sim. The spec is the **"Exact M1b handoff"** section of `src/mods/README.md` (M1a, PR #25). In short:
- Resolve the definition in the app shell at game start, surface load errors and conflicts, and persist mod ids, versions and content hashes with the run.
- Thread an optional `def` through `createInitialState`, `tick`, `applyNow`, `SimHandle`, debug staging and the headless helpers, with the unmodded baseline byte-identical (goldens unchanged).
- Replace the content imports in every sim system with resolved lookups, and initialise rivals, arcs and goals from the definition.
- Compile JSON arcs against the vocabulary, stepped purely in the tick.
- Move `mods/base-*` content packs (Leapfrog, Disasters, Water) onto the loader.
- `?mod=` works on the public site, plus a minimal **Mod Manager** list (the UI is a Sonnet sub-task if it grows).
- **Done when:** the Every-Lab-Is-Steve example loads via `?mod=` on a PR preview and changes the Arena names, the goldens are unchanged with no mods, and the fresh-agent acceptance test from FLT-15 passes end to end.
- **After integration:** update `.agents/skills/flt-modding/SKILL.md` (from FLT-36, PR #31). Remove the "M1b deferred" caveats, document the runtime param semantics of every guard and action, and add a `?mod=` public-site example. Update `packages/flt-mod-cli` so `check` executes the content rather than reporting it as deferred. Then rerun the **fresh-agent acceptance test** end to end: a fresh agent with only the skill makes a mod that visibly changes a PR preview via `?mod=`.



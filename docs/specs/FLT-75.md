# FLT-75: Koota ECS experiment (spec)

Copied from the FLT-75 task description.

**Experiment: Koota (pmndrs ECS) for entity storage.** Jem: "try it". Timeboxed to about half a day of one Opus builder. **It starts after the Claude 5-hour window resets (22:49 UTC) and after #73, #75, #77 and #49 land.** Draft PR only; no merge unless it's clearly better **and** Jem says so.

**Scope:**
- Port **ONE entity family** to Koota traits and systems inside the existing fixed-step tick. It's **protesters or slop**, whichever is the cleaner test; justify the pick.
- **XState stays for the flows** and **Effect for mods and services**. Koota replaces **only the entity storage** for that family.
- Use Koota's official agent skill (`npx skills add pmndrs/koota`).
- Stay deterministic: no `Math.random`, and use `rng.ts`.

**Measure against the current code, in a results table:**
1. **Code clarity:** lines, plus a short before/after read of the same behaviour.
2. **Mod ergonomics:** can a mod add a trait and a system through the Layer-based mod API? Example: golden retrievers get `WagLevel`, which rises near kombucha. Show the mod JSON or Layer, and what the API would need.
3. **Determinism:** the replay hash is unchanged over `flt-mod check`'s 365-day replay and the golden tests.
4. **Saves:** FLT-65's save/load round-trips (v2 format), including a migration if storage shape changes.
5. **Perf at 800 walkers:** the FLT-39 per-system table, before vs after, strict, 3 runs, same box.
6. **The React/R3F render bridge:** `useQuery`/`useTrait` vs the current approach (instanced meshes read in `useFrame`). Compare frame cost and code.

**End with a recommendation:** adopt gradually (with the order of families), adopt for new systems only, or don't adopt. Include the costs: bundle size, learning curve for mod authors, and XState interplay.


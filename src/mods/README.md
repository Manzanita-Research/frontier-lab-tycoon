# Mod foundations (M1a) and live integration (M1b)

`BaseGame.layer` provides `Skin`, `Content`, `Rules`, `Vocabulary`, `Assets`, `Audio`, and a
read-only `GameEvents` stream. The stream is still empty (no producer yet). No RNG or clock
service is overridable. Since FLT-37 (M1b) the app shell resolves `?mod=` into a
`GameDefinition` at start (`src/app/mods.ts`) and the sim reads its content through
`defs()` (`src/sim/defs.ts`); see "M1b: what landed" below.

```ts
const manifests = await Effect.runPromise(loadModLinks(location.search, { baseUrl: location.href }));
const { layer, conflicts } = composeMods(manifests);
const definition = await Effect.runPromise(resolveGameDefinition(layer));
```

`definition` is plain content/rules/vocabulary data. Resolve it once per game; never acquire
Layers in a tick. Skin, assets and audio stay outside the sim and can be read from the same layer.
`makeBaseGameLayer(registry)` is the single FLT-14 adapter seam. On the current baseline it
uses today's `ui.css` tokens and does not mount a skin or import React.

## Patch contract

- `add` requires a complete entry and an unused id. `override` requires an existing id and
  merges top-level fields; nested objects/arrays replace a whole field. `remove` requires an
  existing id. Operations within one section run add, override, remove. A mod may override its
  own addition. Repeated ids within an operation and repeated mod ids are errors.
- Mods wrap services in load order. Conflicts report every pair of consecutive touches to an
  entity (including add/remove), asset, skin or audio field. The later operation wins when valid;
  conflicts do not waive missing-id or duplicate-add errors.
- Rival ids are the current canonical ids (`anthro`, `openish`, `metameta`, etc.), rather than the
  illustrative longer ids in EFFECT-FOR-MODDERS. Building ids equal their `kind`.
- Legacy anonymous lines have patch keys `base-headlines-N` and `base-thoughts-N`, where N is
  their zero-based position on this API baseline. Only patched sections materialize those ids;
  they remain stable across subsequent removals/overrides in a stack. The unmodified base's
  arrays match the original content exactly. Persist manifests against a game/content version;
  Runs record their mods' ids, versions and content hashes (`GameState.mods`).
- Headlines default to `trigger: "filler"` and can carry the documented named `when` condition.
  Thoughts use today's named conditions. `events` accepts choice cards or JSON statecharts;
  `arcs` is also explicit. The v1 statechart subset supports compound states, named guards/actions,
  entry/exit, and transitions, with sibling/descendant targets. No delays or inline functions.
  Structural reachability ignores guard outcomes; it is not a proof that a guarded arc will fire.
- Entity kinds retain an independent `presentation: walker | flow | sprite | offmap` field.
  The historical section name `walkerKinds` does not constrain their eventual presentation.
- Rules and vocabulary are base services; manifest patches to them are reserved for M3. Rules
  expose current numbers with conservative authoring bounds, and a fixed clock range.

Shared CSS uses a conservative flat-rule subset: scoped selectors, stripped imports, no escapes,
nesting or other at-rules; URLs must name assets bundled by the same mod. URL-bearing tokens
are rejected. Assets are base64 raster images, fonts, or GLBs, capped at 2 MiB per mod. The service
uses data URLs; a browser adapter may materialize blob URLs and must revoke them when its layer
is disposed. Manifest fetches are capped at 3 MiB. Gists select `mod.json`, or one `.fltmod.json`.

## See it headlessly

```sh
pnpm mod:check mods/examples/every-lab-is-steve/mod.json
pnpm mod:check mods/examples/headline-pack/mod.json
pnpm exec vitest run src/mods
```

The checker composes/validates the full Layer, runs seed 42 for **365 actual days** in the real
sim with the resolved definition (`createInitialState(seed, opening, def)` and
`tick(state, commands, def)`), answers cards, checks finite stats, and replays the World twice for
an identical digest. The harness places one gateway and hires one SRE through existing commands
to keep a fixed campus sustainable. The report lists the sections that executed, the ones nothing
reads yet (`walkerKinds`, `endings`, `tips`, `tables`), and each arc's final state.

## M1b: what landed (FLT-37)

1. The app shell loads `?mod=` links in order, composes and resolves them before the World is
   created, records ids, versions and content hashes in `GameState.mods`, and lists loaded mods,
   conflicts and errors in the Mod Manager (a skin slot; Frontier 95 opens it from Start, Mods…).
   A mod that fails is skipped; a set that fails to compose starts the base game.
2. `createInitialState`, `tick` and `applyNow` take an optional `def`; `SimHandle` threads the
   session's. `withDefs(def, body)` installs it for the synchronous call and `setSessionDefinition`
   is what the renderer and HUD read between ticks. With no mods, `defs()` is the content modules
   themselves, so the goldens are byte-identical (and a definition equal to the base is too).
3. Content imports in the sim read `defs()`: buildings, rivals, the Arena size, goals, events, the
   ladder, the coach, headlines (with their `when`), thoughts, name pools, disasters, and Release
   Leapfrog's benchmarks and mishaps. New buildings render as coloured blocks (`ModModel`).
4. JSON arcs compile to XState machines (`src/sim/modArcs.ts`) against the Vocabulary and step
   with the pure `transition()` at midnight (`DAY`) and on every answered card (`CHOSE`). They
   persist `{value, context}` in `GameState.modArcs` and run emitted verbs in order. A die is
   drawn only for arcs that use `chance`. The `card` verb opens any `content.events` card.
5. `content.disasters`, `content.benchmarks` and `content.mishaps` are mod sections: the base
   packs (`mods/base-disasters`, `mods/base-leapfrog`) are the base game's entries. Leapfrog's
   rules, labs, footnotes and headlines, and the collusion and papers packs, are still read from
   their pack files (rules patches are M3).

Not yet: mod skins, assets and audio are validated but not applied (the FLT-14 registry is not
supplied to `makeBaseGameLayer`), and `GameEvents` has no producer.

M1a changes no sim entry points or live UI and re-records no golden digests. Its only existing-file
edit is the additive `package.json` script; `docs/specs/FLT-30.md` pins the task description.

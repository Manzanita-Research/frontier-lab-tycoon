# M1a mod foundations

These modules are independent of the live app. `BaseGame.layer` provides `Skin`, `Content`,
`Rules`, `Vocabulary`, `Assets`, `Audio`, and a read-only `GameEvents` stream. The stream is
empty until M1b supplies its producer. No RNG or clock service is overridable.

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
  M1b must add run identities/content hashes before shareable replays.
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

The checker composes/validates the full Layer, runs seed 42 for **365 actual days**, answers
cards, checks finite stats, and replays the World twice for an identical digest. It uses today's
`createInitialState(seed)` and `tick(state, commands)` without modifying content globals.

Compatible existing rival personality/starting-stat fields and existing goal targets are injected
into the World before stepping. All other changed sections are explicitly reported as deferred.
The harness places one gateway and hires one SRE through existing commands to keep a fixed
campus sustainable. Passing this check proves schema/composition/structural validation and the
reported injection coverage; it does not prove execution of deferred content.

## Exact M1b handoff

1. Load links/imports, compose mods, and resolve a definition in the Effect app shell at game start.
   Surface load errors/conflicts and persist ids, versions and content hashes with the run.
2. Add an optional/default base definition to `createInitialState(seed, def)`,
   `tick(state, commands, def)` and `applyNow(state, commands, def)`. Keep the existing command
   argument position, tick/RNG order and unmodded baseline behavior. Thread the definition through
   `SimHandle` step/reset/applyNow, debug staging, and the test/headless helpers.
3. Replace content imports in commands, initial placement, economy, training, goals, news, thoughts,
   needs/mind, crowd/walkers/protest, staff/slop/breakdowns, and race drivers with resolved lookups.
   Initialize rivals/arcs/goals from the definition, not fixed module arrays; derive Arena size.
   Preserve procedural name/audio algorithms while moving their data pools behind services.
4. Compile JSON arcs against the registered vocabulary, step purely with `transition()` in the tick,
   persist JSON snapshots and apply emitted effects in order. Pre-roll chance guards with the core
   RNG. Resolve named headline conditions in the news driver. No wall-clock waits or actors in sim.
5. Widen closed building/rival/entity unions additively where runtime additions require it, and provide
   renderer fallbacks for new content. Read UI content, skins and asset/audio services through the
   app shell; supply the FLT-14 registry to `makeBaseGameLayer`. Bind GameEvents to a scoped,
   read-only stream fed by discrete sim changes. Preserve independent entity presentation.
6. Remove the temporary World injection bridge, make mod:check execute the full resolved definition,
   and extend golden/determinism/perf and browser evidence to prove the actual runtime changes.

M1a changes no sim entry points or live UI and re-records no golden digests. Its only existing-file
edit is the additive `package.json` script; `docs/specs/FLT-30.md` pins the task description.

# Spec: port the game logic to XState + Effect v4

_Written by the FLT lead (Opus 5.5) for one Sonnet 5.5 builder. Jem's direction: "the logic should be implemented using XState and the new Effect version that has XState support."_

## What exists (checked on npm, Sep 29)

- **`@xstate/effect@0.1.0-alpha.5`** is the official Stately package ("Effect integration for XState"), published Sep 29. Its peers are `effect ^4.0.0-rc.115` and `xstate ^6.0.0-alpha.62`. The API: `setupEffect`, `createEffectActor`, `fromEffect`, `fromEffectStream`, `fromEffectEventStream`, `send`, `snapshots`, `waitFor`, `join` and `taggedState`, plus `@xstate/effect/atom` (`createActorAtoms`, built on `effect/unstable/reactivity`).
- **Effect v4:** `effect@4.0.0-rc.118` (the `beta` tag is stale at beta.107). Trails pins rc.117 in Manzanita-Research/trails PR #45.
- **XState v6:** `xstate@6.0.0-alpha.62`. It keeps the **pure** `transition()` and `initialTransition()` functions and ships `SimulatedClock` and `xstate/graph`.

**Pin exact versions** (no `^`, since these are alpha/rc and churn daily): `effect@4.0.0-rc.118`, `xstate@6.0.0-alpha.62`, `@xstate/effect@0.1.0-alpha.5`, plus whichever `@effect/atom-react` and `@effect/vitest` versions match that Effect rc (check their peer deps; don't guess).

## The shape: logic in machines, runtime in Effect, determinism kept

```
Effect (ManagedRuntime, browser)
 └─ appMachine  ← createEffectActor (@xstate/effect)
     states: title → playing{running|paused} → eventOpen → gameOver
     owns: speed, command queue, the tick-loop fiber (fromEffectStream), services
     services: Sim (holds World), Rng, later Sound and Storage
          │  each frame: n = ticksDue(speed, dt) → Sim.step(n)   (synchronous, pure)
          ▼
 World (plain, JSON-serializable, mutated in place by pure step functions)
   walkers[i].machine   ← walkerMachine snapshot, advanced with transition()
   economy.machine      ← economyMachine:  solvent → runwayWarning → bailout → bankrupt
   training.machine     ← trainingMachine: idle → training → releasing → idle
   goals.machine        ← goalsMachine:    tracking → won | lost
   arcs[id].machine     ← one machine per satire arc (Water Discourse first)
```

**Rules**
1. **All game logic is a machine.** That covers walker behaviour, economy status, training runs, goals, and each event arc: `calm → brewing → cardOpen → resolved → cooldown → followUp…`. Arithmetic (money per day, movement along a route) stays in small pure functions called from machine actions or the step loop.
2. **Machines inside the sim advance with the pure `transition(machine, snapshot, event)`**, synchronously and deterministically inside `Sim.step`. They're **not** actors. Their snapshots live in `World` as persisted (JSON) snapshots, so the determinism test and future save/load keep working.
3. **Game time is ticks, never wall clock.** No `after` delays in sim machines. Express waits as tick/day counters in context, checked by guards on `TICK`/`DAY` events. `after` is fine only in UI-level machines (toasts).
4. **Send walkers events only on discrete changes** (`ARRIVED`, `TIMER_DONE`, `ENERGY_LOW`, `PROTEST_STARTED`), not every tick. Movement stays a plain function. The perf test (≤ 0.3 ms/tick with 500 walkers) must still pass. If `transition()` is too slow even so, batch and measure, and note the numbers in the PR.
5. **Effect owns the runtime:** the app actor, the loop fiber, services (`Context.Service`) and lifetimes (`Effect.scoped` / `ManagedRuntime`, disposed on unmount). Choosing an event card is `send(app, {type:'CHOOSE', ...})`. The app machine forwards it into the sim as a command.
6. **React** reads the app actor through `@xstate/effect/atom` + `@effect/atom-react` (or `useSelector` from `@xstate/react` on the `EffectActor`). The HUD reads a snapshot throttled to about 5 Hz, as it does today. **Remove zustand** once nothing uses it; one state system, not two.

## How to port (behaviour-preserving first)

1. Branch `flt-3-xstate-effect` from the lead's base branch (named in your prompt). Vendor Kit Langton's Effect skill from trails (Manzanita-Research/trails, the branch that adds Kit Langton's Effect skill, folder `.agents/skills/effect/` plus the `.claude/skills/effect` link), keeping its LICENSE. Read it before you write Effect code. Add a short "XState + Effect" section to `AGENTS.md` that restates the six rules above.
2. Add the pinned deps. Make sure a hello-world `setupEffect` machine runs under `createEffectActor` in vitest **before** porting anything. If the alpha is broken in a way you can't work around in about 30 minutes, stop and report to the lead (don't silently switch versions).
3. Port one system at a time, keeping `pnpm check` green after each commit: training → economy → goals → the Water Discourse arc → walkers → app shell/loop → React wiring → remove zustand.
4. **No new features, and same numbers:** all existing tests pass unchanged, except for rewrites that assert the same behaviour through the machines. A before/after screenshot at the same seed and day should look the same.

## Tests

- Unit-test each machine through `transition()` alone, with no actors and no Effect.
- Use `xstate/graph` to assert every state of every arc machine is reachable, and that none is a dead end except final states.
- The app shell is tested with `@effect/vitest` and `TestClock`: start the app, send `CHOOSE`, and `waitFor` the right state.
- Determinism (same seed and commands give deep-equal persisted World after 2,000 ticks) and perf both still pass.

## Done when

`pnpm check` is green, the game plays the same as before the port, the PR describes the machine map (a Mermaid statechart of the app machine and the Water Discourse arc goes in `docs/ARCHITECTURE.md`), the preview link is posted on FLT-3, and the PR is open and green with evidence. **Don't merge it yourself;** a human merges.

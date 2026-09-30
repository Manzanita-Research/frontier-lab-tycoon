# Frontier Lab Tycoon: agent notes

A browser tycoon game (React + react-three-fiber) about running a frontier AI lab. Read `docs/DESIGN.md` before writing game code. It defines the module boundaries every task relies on.

## House rules

- The mission-control charter wins over this file: `/Users/jem/.bb-machines/jem.getbb.app/thread-storage/mission-control/CHARTER.md` (readable from the Mini; on Modal, your prompt restates the parts that matter).
- **Do the heavy work on Modal, not the Mini.** Installs, dev servers, builds, tests and screenshots happen on cloud machines. `.bb-env-setup.sh` skips `pnpm install` on macOS on purpose. See `docs/modal.md`.
- One thread = one branch = one worktree. Branch names: `flt-<n>-<slug>` (for example `flt-6-agents`).
- Every task has one label: `ship`, `explore` or `experiment`. The first playable is `explore` work.
- Stop dev servers and watchers before you end a turn, unless you are handing someone a live link right now.
- **Parody names only.** No real companies, products, or real people. Everyone should get the joke without anyone being named.

## Commands

```sh
pnpm install          # setup does this on Modal
pnpm dev              # vite on 0.0.0.0:5173; share with `bb connect expose 5173`
pnpm test             # vitest (sim + content tests)
pnpm typecheck
pnpm build            # tsc + vite build into dist/
pnpm check            # all three: run before every PR
```

## Architecture in one breath

- `src/sim/`: pure TypeScript, deterministic, **no React, no three, no DOM, no Math.random** (use `src/sim/rng.ts`). A fixed-step `tick(state)` drives everything. Unit-test it.
- `src/content/`: data only (buildings, research, rival labs, events, headlines, thoughts). Adding a joke should never need an engine change.
- `src/render/`: react-three-fiber scene. Reads sim state, never mutates it except through store actions.
- `src/ui/`: DOM HUD over the canvas (stats, build palette, ticker, event cards, speed control). `src/ui/juice/`: odometers, sky, photo mode.
- `src/render/fx/`: the juice layer (camera director, particles, day/night, photo mode). It only reads the World; see the last section of `docs/ARCHITECTURE.md`.
- `mods/base-leapfrog/`: the Release Leapfrog content pack (FLT-27, the FLT-15 section shape; loaded by `src/content/leapfrog.ts`), its machines in `src/sim/race/leapfrog/`; asleep unless `enableLeapfrog(state)` (the app does it, `?leapfrog=off` skips it).
- `src/sim/machines/`: the XState machines (training, economy, goals, event arcs, walkers, moods, staff). `src/sim/race/`: the Race (rival labs, the Arena, eras, the R&D multiplier, open weights, the compute auction, funding rounds). `src/app/`: the Effect shell (Sim and Frames services, the app machine) and how React reads it. See `docs/ARCHITECTURE.md`.

If you need to change a shared type in `src/sim/types.ts`, keep the change additive and mention it in your PR.

## XState + Effect

The game logic runs on **XState v6 (alpha) and Effect v4 (rc)**, joined by `@xstate/effect`. Versions are pinned exactly (no `^`); they churn daily, so never bump one without saying so in your PR. Read `.claude/skills/effect` (Kit Langton's Effect v4 skill) before writing Effect code, and `docs/ARCHITECTURE.md` for the machine map. Spec: `docs/specs/architecture-xstate-effect.md`. The six rules:

1. **All game logic is a machine:** walker behaviour, economy status, training runs, goals and each event arc. Arithmetic (money per day, movement along a route) stays in small pure functions that machines or the step loop call.
2. **Sim machines advance with the pure `transition()`,** synchronously inside `Sim.step`. They are not actors. Each keeps a JSON `{ value, context }` in the World (rebuilt with `machine.resolveState`), so the determinism test and save/load keep working.
3. **Game time is ticks, never wall clock.** No `after` delays in sim machines; express waits as tick/day counters in context, checked by guards on `TICK`/`DAY` events. `after` is fine only in UI-level machines (toasts).
4. **Send walkers events only on discrete changes** (`ARRIVED`, `TIMER_DONE`, ...), never every tick. Movement stays a plain function. Keep the perf tests (500 walkers, 0.3 ms/tick; 800 walkers, 0.5 ms/tick) green.
5. **Effect owns the runtime:** the app actor, the loop fiber, services (`Context.Service`) and lifetimes (`ManagedRuntime`, disposed on unmount). Player input is `send(app, event)`; the app machine forwards it into the sim as a command.
6. **React reads the app actor** through `@xstate/effect/atom` + `@effect/atom-react`, with the HUD snapshot throttled to about 5 Hz. One state system: no zustand.

House style for sim machines: transitions are pure and never draw random numbers. The driver pre-rolls dice, in the original draw order, and passes them in the event (`{ type: "TIMER_DONE", loiter: rng.chance(...) }`). Side effects on the World are `enq`'d actions that the driver runs in order after each `transition()`. `src/sim/golden.test.ts` pins the RNG stream and the World for three seeds, so a port step that changes a number fails loudly.

## Entities: don't assume everything walks

Only people (visitors, staff, researchers) are sure to be walkers. Agents, compute, data, tokens and models may later be shown as flows, sprites or not at all (see the Open questions in `docs/ROADMAP.md`). Keep an entity's **presentation** separate from its sim logic, and write mechanics against entities and stats rather than against walkers.

## PRs

- **Before/after screenshots (Jem's rule).** Any PR that changes something **visible** (the 2D UI, the 3D scene, skins, events, on-screen text) includes **before/after screenshots of the same scene**: same seed, same camera and scene, same viewport, taken from `main` and from your branch. Use `pnpm shots` once it exists (FLT-35); until then use `pnpm shot` with the same URL on both builds. Put them in the PR body as pairs (before | after), plus a phone shot if the layout changed. **Logic-only PRs** show tests or a sim/headless report instead.

- Open a real PR from your branch into `main`. CI runs typecheck, tests and build.
- Put evidence in the PR: test output, and for anything visual, a screenshot (see `docs/modal.md` for headless screenshots) or a `bb connect expose` link.
- Keep PRs focused on your task's files. If you have to touch another task's area, say so in the PR.

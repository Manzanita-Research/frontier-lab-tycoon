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

- `src/sim/`: pure TypeScript, deterministic, **no React, no three, no DOM, no Math.random** (use `src/sim/rng.ts`). A fixed-step `tick(state, dt)` drives everything. Unit-test it.
- `src/content/`: data only (buildings, research, rival labs, events, headlines, thoughts). Adding a joke should never need an engine change.
- `src/render/`: react-three-fiber scene. Reads sim state, never mutates it except through store actions.
- `src/ui/`: DOM HUD over the canvas (stats, build palette, ticker, event cards, speed control).
- `src/store.ts`: zustand store that owns the sim state and exposes actions.

If you need to change a shared type in `src/sim/types.ts`, keep the change additive and mention it in your PR.

## PRs

- Open a real PR from your branch into `main`. CI runs typecheck, tests and build.
- Put evidence in the PR: test output, and for anything visual, a screenshot (see `docs/modal.md` for headless screenshots) or a `bb connect expose` link.
- Keep PRs focused on your task's files. If you have to touch another task's area, say so in the PR.

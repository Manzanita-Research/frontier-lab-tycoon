# FLT-38: Fix newsroom-check era assertion (numeric eras vs named)

## Task description

_The task description was empty when work began._

## Scope inferred from the assignment

- Fix the stale named-era setup and assertion in scripts/newsroom-check.mjs to use the actual stored era machine and numeric-string audio diagnostics.
- Preserve the existing audio, newsroom, persistence and phone checks.
- Keep changes in the assigned script; no sim, UI, audio runtime or golden digest changes.
- Run pnpm check and the browser script against a production preview; include evidence in the PR.
- Adding the browser script to pnpm check is optional only if trivial. It needs a running preview server, so keep the existing check command.

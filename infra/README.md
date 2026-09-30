# Public hosting

Production: **https://flt-prod.manzanita.workers.dev**. The Worker serves the root game's `dist/` as static assets, including SPA fallback. No game server, custom domain or account signup is required. The existing `?seed=12` parameter selects a reproducible starting lab.

## Deploy lifecycle

`.github/workflows/deploy.yml` runs on merges to `main` and same-repository PRs. Its `check` job runs `pnpm check` and the infra typecheck before `deploy` can receive Cloudflare credentials. The original `ci.yml` also runs unchanged.

- `main` → stage `prod`, Worker `flt-prod`.
- Open/reopened/updated PR → stage `pr-N`, Worker `flt-pr-N`, a stable `GitHub.Comment` with URL and short head SHA.
- Closed/merged PR → cleanup checks out trusted `main` and destroys only `pr-N`. It refuses `prod` and malformed stages, and skips a PR that has reopened.
- Deploy and cleanup share a normalized PR concurrency key, including merged PR close events whose GitHub ref changes to `main`. In-progress runs finish before cleanup. Live head/open checks skip superseded commits and closed PRs; production checks the current `main` SHA before deploying.
- Fork PRs get the ordinary game CI checks, but no deployment credentials or previews.

The stack uses [Alchemy's StaticSite build contract](https://alchemy.run/cloudflare/frontend/static-site/) with `cwd` at the repository root, `pnpm build` and `outdir: "dist"`. A small post-build script adds `/deployment.json` containing only the checked-out commit SHA, so release verification can confirm the public revision and measure merge-to-live latency. StaticSite preserves the game's typecheck/build command without adding a different Vite version or Cloudflare plugin to the game.

## Dependency isolation

`infra/package.json` and `infra/pnpm-lock.yaml` are independent of the game. Alchemy is pinned to `2.0.0-beta.79`; its Effect packages are pinned to `4.0.0-rc.115`, including an override for `@effect/platform-node-shared`. The game's `effect@4.0.0-rc.118` pin and lockfile are unchanged. Alchemy's current CLI imports pre-rc.118 `effect/unstable/*` paths, so sharing the game dependency would break the CLI.

The Stack/provider/state/Output patterns follow the current [Alchemy CI guide](https://alchemy.run/environments/ci/) and [Rat Stack's learn-alchemy skill](https://github.com/joelhooks/rat-stack/blob/main/skills/learn-alchemy/SKILL.md). No upstream skills or application modules are vendored.

## Credentials and bootstrap

The repository's GitHub Actions secrets are `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`; GitHub supplies `GITHUB_TOKEN` with `pull-requests: write` for preview comments. Use Workers **Admin** on the selected account: current Workers Editor can update existing Workers but cannot create/delete production or preview Workers. Account Settings Read and Secrets Store Edit are also required. See [Cloudflare's current Workers permissions](https://developers.cloudflare.com/workers/authorization/workers/). Do not mint CI tokens or expand permissions from the stack.

Alchemy uses `Cloudflare.state()`: an account-level state-store Worker backed by SQLite Durable Objects, with its auth token and encryption key in Cloudflare Secrets Store. `CI=true` resolves credentials remotely on each run and avoids persisting credential values to a local profile. `.alchemy/` and env files are gitignored.

From an authorized Modal machine with credentials already injected into its environment:

```sh
pnpm install --frozen-lockfile
pnpm --dir infra install --frozen-lockfile
pnpm check
pnpm --dir infra typecheck
printf %s "$CLOUDFLARE_API_TOKEN" | gh secret set CLOUDFLARE_API_TOKEN --repo jem-computer/frontier-lab-tycoon
printf %s "$CLOUDFLARE_ACCOUNT_ID" | gh secret set CLOUDFLARE_ACCOUNT_ID --repo jem-computer/frontier-lab-tycoon
CI=true pnpm --dir infra exec alchemy deploy --stage prod --yes
```

The first deploy bootstraps the state-store if absent; an existing account state-store is reused. Subsequent production deployments run in GitHub. Never print secrets, write them to files, pass them as command arguments, or enable shell xtrace. On a permission error, record the exact operation/error on FLT-12 and stop; a generic Forbidden does not identify a missing scope.

Destroy a preview only by naming its exact stage: `CI=true pnpm --dir infra exec alchemy destroy --stage pr-N --yes`. Production destruction is outside this workflow.

The future Jev API belongs to FLT-5; this stack adds static hosting only.

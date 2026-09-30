# FLT-12: public link

Kind: ship. Serve the built browser game through a Cloudflare Worker with static assets, independent of BB authentication and Modal lifetimes. Use Alchemy v2 TypeScript infrastructure and GitHub continuous deployment, on pnpm/Node 22.

## Contract

- Isolate exact Alchemy/Effect pins and lockfile in `infra/`; keep the game's Effect rc.118 pin and `ci.yml` unchanged.
- Build the root game with `pnpm build` into `dist/`. Use SPA fallback and root asset URLs so nested navigations load the game.
- `Cloudflare.state()` stores state remotely through the account's state-store Worker/SQLite Durable Object and Secrets Store. Bootstrap from Modal with `CI=true`, then deploy autonomously from GitHub.
- Production stage `prod` owns `flt-prod` on the free `workers.dev` URL; same-repository PR stage `pr-N` owns `flt-pr-N`.
- Deploy only after game checks and infra typecheck pass. Comment preview URL and short head SHA using `GitHub.Comment`; update in place on each push.
- Serialize preview deployment and cleanup. Skip obsolete heads and closed PRs. Do not expose deployment credentials to fork contributor code.
- Closing a PR destroys its preview, with an explicit check refusing production destruction. Cleanup uses trusted main code.
- Upload existing Cloudflare credentials to GitHub via stdin only. Use the selected account's Workers Admin lifecycle permissions supplied by Jem, Account Settings Read and Secrets Store Edit. Do not mint tokens, widen scopes, run wrangler, create accounts or change billing.
- Verify existing `?seed=N` support; publish the public URL and deployment explanation in README; note the future Jev Worker API under FLT-5 in the roadmap.

## Acceptance

1. Public production loads the rendered WebGL game on laptop and phone viewport captures, with runtime/console errors checked and emulation disclosed.
2. The real focused PR has green checks and deployment evidence and is self-merged.
3. Main deployment passes and updates the public URL within about five minutes of merge.
4. A throwaway PR receives a working preview URL comment; closing it destroys the preview with a successful cleanup run.
5. Screenshots, workflow/comment URLs, check results and measured deployment latency are attached to FLT-12 before it is marked done.

On any permission error, stop and report the exact operation/error on FLT-12. A generic Forbidden response does not establish which scope is missing.

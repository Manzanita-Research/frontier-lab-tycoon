# Working on Modal

All heavy FLT work (installs, dev servers, builds, tests, screenshots) runs on Modal cloud machines, not on the Mini. This is the recipe.

## Spawn a builder

From a lead thread on the Mini:

```sh
bb thread spawn \
  --project proj_dvb9hes55f \
  --environment-provider modal-sandbox \
  --provider claude-code --model claude-sonnet-5-5 --reasoning-level xhigh \
  --permission-mode auto \
  --parent-thread <lead thread id> \
  --title "explore · FLT-n <what>" \
  --prompt-file <prompt.md> --json
bb tasks attach FLT-n --thread <new thread id>
```

- **Model routing (the charter's "Models" section wins; latest Sep 30). Always pass `--model` explicitly on Modal (its catalog is stale and defaults to Opus 5):**
  - **FLT builders: Claude Opus 5.5** (`--provider claude-code --model claude-opus-5-5 --reasoning-level high`) implement everything: 2D UI, sim/logic, tests, infra and 3D. Up to 5 Claude builders at once. Sonnet 5.5 (`--model claude-sonnet-5-5`) is fine for small, well-scoped chores.
  - **The lead: Claude Opus 5.5 at `xhigh`**, for direction, specs and review.
  - **Codex `gpt-6.1-sol`:** only if Jem asks, or if Claude usage is near the limit (`bb settings usage`). If a machine has no Claude login, say so; **don't fall back to Sol.** **Never** Sonnet 5, Opus 5 or older.
  - **Proving the model:** the builder's first task comment states its exact model. Codex doesn't show the model ID in its prompt, so Sol builders prove it from `~/.codex/sessions/**/*.jsonl` (`grep -rhoE '"model":"[^"]+"' ~/.codex/sessions | sort | uniq -c`).
  - **Codex on Modal:** the image pins Codex CLI 0.159.2, which has Sol 6.1 in its catalog; older versions don't. Fresh machines have **no Codex login** until a durable auth route exists (asked of Jem via desk). Until then, run Sol builders on the already-logged-in machine with `--machine <host> --new-environment worktree`.
- Start every prompt with the kind (`Kind: explore.`) and `House rules: <charter path>`, then the task key, and tell the builder to read `AGENTS.md` and `docs/DESIGN.md`.
- Each spawn creates a fresh Modal machine. bb clones the repo, runs `.bb-env-setup.sh` (pnpm install + headless Chromium), and starts the agent.
- Run at most 3–4 builders at once.

## What a machine has

- Image: bb's default Modal image (Debian bookworm, Node 22.19, pnpm 9.15, git, gh, jq, ripgrep, build-essential, Claude Code) **plus** the Chromium system libraries added for FLT (`bb modal image show`).
- `GH_TOKEN`: an FLT-only machine variable (`bb machine env list --project proj_dvb9hes55f`), so `git push` and `gh pr create` work. Never print it.
- Idle pause after 15 minutes. Pausing snapshots the filesystem, and resuming restores it without rerunning setup. Compute lives at most 24 hours, so pause before then or lose unsaved work.

## Evidence: screenshots and live links

```sh
pnpm build && (pnpm preview >/tmp/preview.log 2>&1 &)
pnpm shot "http://localhost:4173/?page=gallery" docs/img/gallery.png --size 1440x900 --wait 3000
pnpm shot "http://localhost:4173/" docs/img/phone.png --size 390x844 --mobile
```

For before/after pairs of the same scenes on `main` and your branch, run `pnpm shots` instead (see AGENTS.md). WebGL renders through SwiftShader (no GPU), so it's slow but accurate. For a live link, run `bb connect expose 4173` (or 5173 for `pnpm dev`) and share the URL it prints. **Stop the server before you end your turn** unless someone is looking at it right now.

## Clean up

- Finished builders: the lead archives the thread when its work has merged, which retires its machine. For a standalone machine: `bb machine remove <host> --yes`.
- Check what's running: `bb machine list --json` and `bb modal machine inspect <host> --json`.

## Measured on Sep 29 (FLT-1)

| Step | Time |
|---|---|
| Sandbox allocated from a cached image | ~15 s |
| bb bootstrap + clone + `.bb-env-setup.sh` (pnpm install 4 s, Chromium) | ~30 s total to "Provisioned thread" |
| `pnpm check` (typecheck + test + build) | ~11 s |
| `pnpm build` | ~4 s |
| Pause (snapshot + stop) | ~12 s (once DNS cooperated) |
| Resume from snapshot | ~6 s; files, node_modules and Chromium intact, setup not rerun |
| Image rebuild after a Dockerfile change | a few minutes, once, then cached |

Machines are **1 vCPU** by default (no size presets are configured in the Modal plugin settings).

## Cost (rough)

Modal bills running sandboxes per second for CPU and memory. A 1-vCPU builder costs very roughly **$0.10–0.30 per running hour**, and paused machines cost only snapshot storage. A wave of 4 builders working ~2 hours comes to a few dollars. Check the Modal dashboard (app `bb-sandboxes`) for real numbers.

## Credentials (FLT-only machine variables)

`bb machine env list --project proj_dvb9hes55f`:
- `CLAUDE_CODE_OAUTH_TOKEN`: Claude Code login for builders (from `claude setup-token`). **Cloud machines don't share the Mini's Claude login.** Without it, turns fail with "Not logged in".
- `GH_TOKEN`: GitHub (repo + workflow). Since the bb server PATH fix, the server's built-in GitHub login also works, so this is a belt-and-braces override.

## Known issues

- **Claude Code version:** Opus 5.5 needs Claude Code ≥ 2.1.280. The Modal image now pins 2.1.284. A thread that started on an older binary keeps failing even after `bb machine provider-cli install <host> claude-code --action update`, because its provider process is cached. Start a fresh thread instead.
- **Intermittent "Machine bootstrap command failed"** (2 of ~8 launches, no detail in logs). `bb thread retry <id>` fixed it every time.
- **First pause failed** with `Name resolution failed for target dns:task-….w.modal.host` (the Mini resolves DNS through Tailscale MagicDNS). A retry a few minutes later succeeded, so it's likely negative caching of a brand-new hostname. If pauses keep failing, compute keeps running (and billing) until Modal's 24 h limit, so remove idle machines.
- **Pasted secrets can pick up line breaks** (the Claude token did: `401 OAuth access token is invalid`). Strip whitespace before `bb machine env set`.
- **Sep 29:** bootstrap returned HTTP 500 from `/install/bb-app.tgz`, because the bb server's launchd service had no PATH (`spawn npm ENOENT`). The workshop fixed it.
- `bb connect expose` links answer 401 to curl. They need a browser that's signed in to bb, which is expected.
- Inside the Mini's agent sandbox, `gh` can't verify GitHub's certificate through the proxy, but plain `git` and `curl` work. On Modal, `gh` works.

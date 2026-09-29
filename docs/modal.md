# Working on Modal

All heavy FLT work (installs, dev servers, builds, tests, screenshots) runs on Modal cloud machines, not on the Mini. This is the recipe.

## Spawn a builder

From a lead thread on the Mini:

```sh
bb thread spawn \
  --project proj_dvb9hes55f \
  --environment-provider modal-sandbox \
  --provider claude-code --model claude-sonnet-5 --reasoning-level xhigh \
  --permission-mode auto \
  --parent-thread <lead thread id> \
  --title "explore · FLT-n <what>" \
  --prompt-file <prompt.md> --json
bb tasks attach FLT-n --thread <new thread id>
```

- Use `claude-opus-5-5` at `high` for architecture, the sim core, integration and taste-heavy work; use `claude-sonnet-5` at `xhigh` for well-scoped tasks.
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

WebGL renders through SwiftShader (no GPU), so it's slow but accurate. For a live link, run `bb connect expose 4173` (or 5173 for `pnpm dev`) and share the URL it prints. **Stop the server before you end your turn** unless someone is looking at it right now.

## Clean up

- Finished builders: the lead archives the thread when its work has merged, which retires its machine. For a standalone machine: `bb machine remove <host> --yes`.
- Check what's running: `bb machine list --json` and `bb modal machine inspect <host> --json`.

## Cost (rough)

_To be filled in after FLT-1's end-to-end run._

## Known issues

- **Sep 29:** Modal bootstrap failed with HTTP 500 from `/install/bb-app.tgz`, because the bb server's launchd service had no PATH (`spawn npm ENOENT`). Fixed in the workshop (see FLT-1).
- Inside the Mini's agent sandbox, `gh` can't verify GitHub's certificate through the proxy. Plain `git` and `curl` work. On Modal, `gh` uses `GH_TOKEN` directly.

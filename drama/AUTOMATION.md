# Daily Drama: the automation

**Status: live** (daily since Oct 3). The lead created it after Jem OK'd the first Drama PR (FLT-34). Builders never create or update it: the automation runs a stored copy of `drama/automation.sh`, so after a PR edits that script the lead uploads it again (see [Upload it](#upload-it-the-lead-after-a-pr-merges)).

## What runs each day

One bb automation fires at **07:30 San Francisco time**. It spawns **one Claude Opus 5.5 thread in a fresh worktree on m6** (the Linux runner machine, `$FLT_RUNNER_MACHINE`). That thread runs the pipeline once:

```
node scripts/drama-run.mjs
  fetch   drama/sources.json → candidates.md (the last 36 h of public feeds)
  room    a scratch dir outside the checkout: BRIEF.md (drama/pick.md), SKILL.md (flt-modding), candidates.md
  write   headless `claude -p --restricted`, no shell, one `check` tool: picks one story (or skips) and writes the pack
  check   flt-mod check + drama/lint.mjs + shape → mods/drama/<date>/CHECK.txt
  pr      branch drama-<date> from origin/main, PR "Daily Drama: <summary>" (source link in the PR body only)
  ci      wait up to 25 min for the PR's GitHub checks: green, red (failing job, test, log excerpt) or still running
  report  `bb tasks comment FLT-34`: opened (with the CI result), skipped, or failed on the day's second attempt;
          prints `commented on FLT-34`
```

The `check` step's checks (flt-mod check, the linter, the shape) are local. They are not CI: on Oct 8 two Drama PRs failed Deploy's `check` job while their runners reported "every check passed". So the pipeline waits for the PR's real checks (FLT-112) and only says green when GitHub does.

The pipeline posts the outcome on FLT-34 itself (FLT-110), so the runner needs no working `bb` of its own (on some machines `bb` can't reach the server from inside Claude Code's sandbox, but the pipeline runs outside it). A quiet day posts "skipped" and opens nothing. Jem reviews and merges every Drama PR; nothing auto-publishes (the trust ratchet: after about 20 approvals in a row with no edits, desk asks Jem about auto-publishing).

Cost per run: about $0.30 of Opus 5.5 for the author, about 70 s of author time, and one m6 worktree for 15-25 minutes (most of it waiting for CI). The author runs in the same thread, so it uses m6's Claude login.

**Why the prompt is so strict about the command.** On m6, Claude Code runs Bash in a sandbox with no network. m6's Claude settings let exactly one command out of it: `node scripts/drama-run.mjs --date <day>` (and its `ci` form). Anything added to it (`> file`, `2>&1`, `;`, `&&`, an env var in front, `dangerouslyDisableSandbox`) runs sandboxed, where the feeds come back 0/15 and the author can't reach the API. The same sandbox is why the runner's own `bb` can't reach the bb server, so the pipeline posts the FLT-34 comment itself (it runs outside the sandbox) and a failed comment goes to the lead.

## Create it (the lead, from the Mini)

**Script mode** is recommended. The spawn is fully determined by code, and script automations run on the bb server, where `bb thread spawn --new-environment worktree --machine <m6>` works the same way it does for the lead. (Agent-mode automations can't pick a machine, so they would run on the Mini.)

```sh
bb automation create --project "$BB_PROJECT_ID" \
  --name "Daily Drama (FLT-34)" \
  --cron "30 7 * * *" --timezone America/Los_Angeles \
  --interpreter bash --timeout 5m \
  --env-json '{"FLT_BB_PROJECT":"<project ID>","FLT_CHARTER":"<the charter path on the Mini>","FLT_RUNNER_MACHINE":"<m6 machine ID>"}' \
  --script-file drama/automation.sh
```

The script reads three env vars, so the repo names no private IDs or paths. It exits 2 with a clear message, before spawning anything, if one is missing:

- `FLT_BB_PROJECT`: the bb project ID. It falls back to `BB_PROJECT_ID` when bb sets it, but set it explicitly.
- `FLT_CHARTER`: the mission-control charter's path on the Mini, quoted in the thread's prompt.
- `FLT_RUNNER_MACHINE`: the bb machine the thread runs on: m6's ID from `bb machine list`. Required; there is no default.

`bash drama/automation.sh --dry-run` (with all three set) prints the exact `bb thread spawn` arguments and the full prompt without spawning anything. `drama/automation.test.mjs` renders both with stub env and fails if the exact-command rule, the m6 spawn, the `CI: green` rule or the `bb tasks comment` note goes missing, or if the prompt quoted below drifts from the script.

Check it with `bb automation show <id> --project "$BB_PROJECT_ID"`. To fire one run by hand: `bb automation run <id> --project "$BB_PROJECT_ID"`.

`drama/automation.sh` does four things:

1. Resolves `bb` (`$BB_CLI` if set, otherwise `bb` on PATH), the project, the charter path and the machine (from the env above).
2. Picks today's date in San Francisco.
3. Spawns the thread: `--new-environment worktree --machine "$FLT_RUNNER_MACHINE" --provider claude-code --model claude-opus-5-5 --reasoning-level high --permission-mode auto`, titled `explore · Daily Drama <date>`, with the prompt below. The model is passed explicitly rather than left to the machine's default.
4. Attaches the new thread to FLT-34.

## Upload it (the lead, after a PR merges)

The automation runs a stored copy of the script, so a merged edit changes nothing until the lead uploads it, from a checkout of `main` at the merge:

```sh
bb automation update auto_ptwieugdyzw --project "$BB_PROJECT_ID" \
  --script-file drama/automation.sh --interpreter bash \
  --env-json '{"FLT_BB_PROJECT":"<project ID>","FLT_CHARTER":"<the charter path on the Mini>","FLT_RUNNER_MACHINE":"<m6 machine ID>"}' \
  --timeout 5m
```

**Then the lead re-confirms it with `bb automation show auto_ptwieugdyzw --project "$BB_PROJECT_ID" --json`:** `execution.env` must hold all three values (the stored script with an empty env exits 2 every morning, and nothing runs), and `execution.script` must be byte-identical to `drama/automation.sh` at the merge. Before uploading, `bash drama/automation.sh --dry-run` with the same three values shows the spawn (`--new-environment worktree --machine <m6>`) and the prompt the morning run will send. Builders never run `bb automation update`.

## The FLT-34 comment

`scripts/drama-run.mjs` ends every full run by commenting on FLT-34 with `$BB_CLI` if set, otherwise `bb`, in the prompt's words below:

| Outcome | Prints | Comment |
| --- | --- | --- |
| skipped | `quiet day, skipped` | `Daily Drama <date>: skipped (quiet day). <SKIP.md on one line>` |
| opened, CI green | `opened <url>`, then `CI: green (check, engines, deploy, stranger)` | `Daily Drama <date>: <url>, ready for Jem's review. CI: green (check, engines, deploy, stranger).` |
| opened, CI red | `opened <url>`, then `CI FAILED: <workflow> / <job> — <first failing test, or the failing step>. <note>` | `Daily Drama <date>: <url>, CI FAILED: …` (the same line) and a log excerpt |
| opened, CI slow | `opened <url>`, then `CI still running after 25 min: <url> (waiting on …)` | `Daily Drama <date>: CI still running after 25 min: <url> …` |
| first failure of the day (`NOT GREEN`, or the author crashed) | `NOT GREEN (attempt 1 of 2; run the same command again)` | none |
| second failure | `NOT GREEN (attempt 2 of 2), so FLT-34 hears about it` | `Daily Drama <date>: failed` and the last 30 lines of output |
| `--no-pr`, green | `green; --no-pr` | none (a local run) |

- **CI.** After `opened <url>` the run polls `gh pr checks <url>` every 30 s (printing `CI: <n> of <m> checks done` as they finish) until every check is done and `check`, `engines`, `deploy` and `stranger` have all reported, or 25 min pass (`--ci-timeout <min>` changes that). **Green** needs every check with one of those four names to have passed (Deploy's `check` skipped is not saved by CI's `check` passing) and nothing failed or cancelled. **Red** names the first failing job, fetches its log with `gh run view --job <id> --log-failed`, and quotes the first failing test (vitest's `FAIL  file > name`, node:test's `✖ name`) or else the first `##[error]`, plus about a dozen lines from there. The note says whether it touches the pack (a test file under `drama/` or `mods/`, or the excerpt names `mods/drama/<date>`) or looks unrelated (say, a perf or timing test elsewhere). A failure seen before the deadline is red even if other jobs are still running.
- **A red or slow CI is still an opened PR:** exit 0, no attempt counted, nothing re-run (a second run would try to open the same branch again). It's Jem's or the lead's call what to do with the PR. If the wait itself breaks (`gh` missing, say), the comment says `CI result unknown (<why>): <url>`; it never says green.
- **`ci [pr]`** finishes a run that was cut off while it waited: `node scripts/drama-run.mjs ci --date <date>` waits for the `drama-<date>` PR (or a PR number or URL) and comments as the full run would. With `--no-comment` it's a safe way to read any PR's CI.
- A posted comment prints `commented on FLT-34` on its own line, and the runner then skips its own comment step.
- **Attempts:** the runner retries a failure with the identical command, so the pipeline counts the day's failures in `.drama-state/<date>.json` at the checkout's root. That directory is gitignored; delete it to start the day's count again. A success on either attempt comments as usual.
- **`--no-comment`** (for local tests) posts nothing and prints `FLT-34 comment (--no-comment, not posted): <text>` instead.
- **If posting fails,** the run prints `FLT-34 comment (not posted): <text>` and carries on: a comment never changes the exit code (0 for opened or skipped, 1 for a failure). The runner hands that text to the lead.
- Only the full run and `ci` comment. The other single steps (`fetch`, `check`, `pr`, `body`) don't.

## The thread's prompt

This is kept in `drama/automation.sh`. Verbatim:

> Kind: explore. House rules: the mission-control charter (on the Mini at {$FLT_CHARTER}). Task: **FLT-34 Daily Drama run for {date}.** You are the runner, not the author: the pack is written by the headless author inside the pipeline, from the modding skill alone, and you never edit it by hand.
>
> 1. `git fetch origin && git checkout -B drama-run-{date} origin/main`. Then start the pipeline **exactly as** `node scripts/drama-run.mjs --date {date}`, as one background Bash command, and read its output from the background task. Add nothing to it: no `> file`, no `2>&1`, no `;` or `&&`, no env vars in front, and no dangerouslyDisableSandbox. m6's Claude settings run that exact command outside the sandbox, and any other form runs sandboxed, where the news feeds and the author can't reach the network. If the feeds still come back 0/15, stop and say so. Don't work around it. The pipeline waits up to 25 min for GitHub's CI after opening the PR, longer than a foreground command may run, so let the background task finish. If it was cut off after `opened <url>`, start `node scripts/drama-run.mjs ci --date {date}` the same way (exactly that, one background command, nothing added) to finish the wait and the report.
> 2. If it prints `quiet day, skipped`: `bb tasks comment FLT-34 --body "Daily Drama {date}: skipped (quiet day). <the SKIP reason, one line>"` and stop.
> 3. If it prints `opened <url>`, it then prints the PR's real CI result: `CI: green (…)`, `CI FAILED: <job> — <test>` or `CI still running after 25 min`. Report the CI result the pipeline prints, in its words; **never say every check passed unless it printed `CI: green`** (the local checks before the PR are not CI). A red or slow CI is not a pipeline failure: don't run it again and don't fix the PR. Stop there. **Never merge a Drama PR**; Jem reviews every one.
> 4. If it prints `NOT GREEN`, or the author crashed: run it once more exactly as before (the author starts fresh). If it fails again, comment the last 30 lines of output on FLT-34 as "Daily Drama {date}: failed", and stop. Don't fix the pack yourself, and don't edit drama/**: a hand-made pack would defeat the point.
> **About `bb tasks comment`:** inside m6's sandbox, `bb` can't reach the bb server. If the pipeline already printed `commented on FLT-34`, skip the comment step. If a `bb tasks comment` fails, don't retry it outside the sandbox. End your turn with the exact comment text, and the lead posts it.
> 5. Don't start dev servers. End your turn with one line: what (the PR and its CI result, a skip or a failure), and why.

## Operating it

- **Pause:** `bb automation pause <id> --project "$BB_PROJECT_ID"`. **Resume:** `bb automation resume <id> ...`.
- **Worktrees:** each run's m6 worktree stays until its thread is archived. The lead archives finished Drama threads daily.
- **Three-day proof (the spec's "done when"):** three consecutive runs, each a PR that passes `flt-mod check` and the linter, or a documented skip.
- **Tuning:** the story choice lives in `drama/pick.md` and the feeds in `drama/sources.json`. The linter's knowledge lives in `drama/denylist.json` (add names freely) and `drama/glossary.json`. A Drama PR never edits these files. Tuning PRs go through the lead like any other code.

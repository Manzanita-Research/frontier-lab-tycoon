# Daily Drama: the automation

**Status: live** (daily since Oct 3). The lead created it after Jem OK'd the first Drama PR (FLT-34). Builders never create or update it: the automation runs a stored copy of `drama/automation.sh`, so after a PR edits that script the lead runs `bb automation update <id> --script-file drama/automation.sh` again.

## What runs each day

One bb automation fires at **07:30 San Francisco time**. It spawns **one Claude Opus 5.5 thread on a fresh Modal machine**. That thread runs the pipeline once:

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

Cost per run: about $0.30 of Opus 5.5 for the author, about 70 s of author time, and one Modal machine for 15-25 minutes (most of it waiting for CI). The author runs in the same thread, so it uses that machine's Claude login.

## Create it (the lead, from the Mini)

**Script mode** is recommended. The spawn is fully determined by code, and script automations run on the bb server, where `bb thread spawn --environment-provider modal-sandbox` works the same way it does for the lead. (Agent-mode automations can't pick an environment provider, so they would run on the Mini.)

```sh
bb automation create --project "$BB_PROJECT_ID" \
  --name "Daily Drama (FLT-34)" \
  --cron "30 7 * * *" --timezone America/Los_Angeles \
  --interpreter bash --timeout 5m \
  --env-json "{\"FLT_BB_PROJECT\":\"$BB_PROJECT_ID\",\"FLT_CHARTER\":\"<the charter's path on the Mini>\"}" \
  --script-file drama/automation.sh
```

The script reads two env vars, so the repo names no private paths. It exits 2 with a clear message if one is missing:

- `FLT_BB_PROJECT`: the bb project ID. It falls back to `BB_PROJECT_ID` when bb sets it, but set it explicitly.
- `FLT_CHARTER`: the mission-control charter's path on the Mini, quoted in the thread's prompt.

`bash drama/automation.sh --dry-run` (with both set) prints the spawn and the prompt without spawning anything. The automation runs a stored copy of the script, so after editing it run `bb automation update <id> --script-file drama/automation.sh` again.

Or paste the script inline with `--script "$(cat drama/automation.sh)"`. Check it with `bb automation show <id> --project "$BB_PROJECT_ID"`. To fire one run by hand: `bb automation run <id> --project "$BB_PROJECT_ID"`.

`drama/automation.sh` does four things:

1. Resolves `bb` (`$BB_CLI` if set, otherwise `bb` on PATH), the project and the charter path (from the env above).
2. Picks today's date in San Francisco.
3. Spawns the thread: `--environment-provider modal-sandbox --provider claude-code --model claude-opus-5-5 --reasoning-level high --permission-mode auto`, titled `explore · Daily Drama <date>`, with the prompt below. The model is passed explicitly, because Modal's catalog is stale.
4. Attaches the new thread to FLT-34.

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
> 1. `git fetch origin && git checkout -B drama-run-{date} origin/main`, then `node scripts/drama-run.mjs --date {date}` **in the background** (Bash `run_in_background`) and wait for it to finish: after opening the PR it waits up to 25 min for GitHub's CI, longer than a foreground command may run. If it was cut off after `opened <url>`, run `node scripts/drama-run.mjs ci --date {date}` (in the background too) to finish the wait and the report. The pipeline comments on FLT-34 itself: if it printed `commented on FLT-34`, skip the comment steps below. If it printed `FLT-34 comment (not posted): …`, post that text yourself, or hand it to the lead if `bb` fails for you too.
> 2. If it prints `quiet day, skipped`: `bb tasks comment FLT-34 --body "Daily Drama {date}: skipped (quiet day). <the SKIP reason, one line>"` and stop.
> 3. If it prints `opened <url>`, it then prints the PR's real CI result: `CI: green (…)`, `CI FAILED: <job> — <test>` or `CI still running after 25 min`. Report the CI result the pipeline prints, in its words; **never say every check passed unless it printed `CI: green`** (the local checks before the PR are not CI). A red or slow CI is not a pipeline failure: don't run it again and don't fix the PR. Stop there. **Never merge a Drama PR**; Jem reviews every one.
> 4. If it prints `NOT GREEN`, or the author crashed: run it once more exactly as before (the author starts fresh). If it fails again, comment the last 30 lines of output on FLT-34 as "Daily Drama {date}: failed", and stop. Don't fix the pack yourself, and don't edit drama/**: a hand-made pack would defeat the point.
> 5. Don't start dev servers. End your turn with one line: what (the PR and its CI result, a skip or a failure), and why.

## Operating it

- **Pause:** `bb automation pause <id> --project "$BB_PROJECT_ID"`. **Resume:** `bb automation resume <id> ...`.
- **Machines:** each run's Modal machine stays up until its thread is archived. The lead archives finished Drama threads daily (or run `bb machine list --json` and remove any idle machines).
- **Three-day proof (the spec's "done when"):** three consecutive runs, each a PR that passes `flt-mod check` and the linter, or a documented skip.
- **Tuning:** the story choice lives in `drama/pick.md` and the feeds in `drama/sources.json`. The linter's knowledge lives in `drama/denylist.json` (add names freely) and `drama/glossary.json`. A Drama PR never edits these files. Tuning PRs go through the lead like any other code.

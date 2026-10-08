#!/usr/bin/env bash
# Daily Drama (FLT-34): the bb script automation. It spawns one Opus 5.5 thread in a fresh worktree on the runner
# machine (m6), and that thread runs scripts/drama-run.mjs once. See drama/AUTOMATION.md. The automation runs a stored
# copy of this file: after editing it, the lead uploads it again (drama/AUTOMATION.md, "Upload it").
set -euo pipefail

# The machine-specific bits come from the automation's env (--env-json), so the repo names no private IDs or paths:
#   FLT_BB_PROJECT      the bb project ID (falls back to BB_PROJECT_ID when bb sets it)
#   FLT_CHARTER         the mission-control charter's path on the Mini, quoted in the thread's prompt
#   FLT_RUNNER_MACHINE  the bb machine the thread runs on (m6's machine ID, from `bb machine list`)
# Pass --dry-run to print the spawn and the prompt without spawning anything. drama/automation.test.mjs renders both.
BB="${BB_CLI:-bb}"
PROJECT="${FLT_BB_PROJECT:-${BB_PROJECT_ID:-}}"
CHARTER="${FLT_CHARTER:-}"
MACHINE="${FLT_RUNNER_MACHINE:-}"
[ -n "$PROJECT" ] || { echo "drama/automation.sh: set FLT_BB_PROJECT to the bb project ID (or run where bb sets BB_PROJECT_ID)" >&2; exit 2; }
[ -n "$CHARTER" ] || { echo "drama/automation.sh: set FLT_CHARTER to the mission-control charter's path on the Mini" >&2; exit 2; }
[ -n "$MACHINE" ] || { echo "drama/automation.sh: set FLT_RUNNER_MACHINE to the bb machine ID the Drama thread runs on (m6; see bb machine list)" >&2; exit 2; }
DATE="$(TZ=America/Los_Angeles date +%F)"

read -r -d '' PROMPT <<EOF || true
Kind: explore. House rules: the mission-control charter (on the Mini at ${CHARTER}). Task: **FLT-34 Daily Drama run for ${DATE}.** You are the runner, not the author: the pack is written by the headless author inside the pipeline, from the modding skill alone, and you never edit it by hand.

1. \`git fetch origin && git checkout -B drama-run-${DATE} origin/main\`. Then start the pipeline **exactly as** \`node scripts/drama-run.mjs --date ${DATE}\`, as one background Bash command, and read its output from the background task. Add nothing to it: no \`> file\`, no \`2>&1\`, no \`;\` or \`&&\`, no env vars in front, and no dangerouslyDisableSandbox. m6's Claude settings run that exact command outside the sandbox, and any other form runs sandboxed, where the news feeds and the author can't reach the network. If the feeds still come back 0/15, stop and say so. Don't work around it. The pipeline waits up to 25 min for GitHub's CI after opening the PR, longer than a foreground command may run, so let the background task finish. If it was cut off after \`opened <url>\`, start \`node scripts/drama-run.mjs ci --date ${DATE}\` the same way (exactly that, one background command, nothing added) to finish the wait and the report.
2. If it prints \`quiet day, skipped\`: \`bb tasks comment FLT-34 --body "Daily Drama ${DATE}: skipped (quiet day). <the SKIP reason, one line>"\` and stop.
3. If it prints \`opened <url>\`, it then prints the PR's real CI result: \`CI: green (…)\`, \`CI FAILED: <job> — <test>\` or \`CI still running after 25 min\`. Report the CI result the pipeline prints, in its words; **never say every check passed unless it printed \`CI: green\`** (the local checks before the PR are not CI). A red or slow CI is not a pipeline failure: don't run it again and don't fix the PR. Stop there. **Never merge a Drama PR**; Jem reviews every one.
4. If it prints \`NOT GREEN\`, or the author crashed: run it once more exactly as before (the author starts fresh). If it fails again, comment the last 30 lines of output on FLT-34 as "Daily Drama ${DATE}: failed", and stop. Don't fix the pack yourself, and don't edit drama/**: a hand-made pack would defeat the point.
**About \`bb tasks comment\`:** inside m6's sandbox, \`bb\` can't reach the bb server. If the pipeline already printed \`commented on FLT-34\`, skip the comment step. If a \`bb tasks comment\` fails, don't retry it outside the sandbox. End your turn with the exact comment text, and the lead posts it.
5. Don't start dev servers. End your turn with one line: what (the PR and its CI result, a skip or a failure), and why.
EOF

SPAWN=(thread spawn --project "$PROJECT"
  --new-environment worktree --machine "$MACHINE"
  --provider claude-code --model claude-opus-5-5 --reasoning-level high
  --permission-mode auto
  --title "explore · Daily Drama ${DATE}")

if [ "${1:-}" = "--dry-run" ]; then
  # Plain bash 3.2 (the Mini's /bin/bash): no ${a[*]@Q}. Quote the arguments that have spaces.
  LINE="$BB"
  for a in "${SPAWN[@]}"; do case "$a" in *" "*) LINE="$LINE \"$a\"" ;; *) LINE="$LINE $a" ;; esac; done
  echo "dry run: $LINE --prompt \"\$PROMPT\" --json"
  printf '%s\n' "$PROMPT"
  exit 0
fi

THREAD="$("$BB" "${SPAWN[@]}" --prompt "$PROMPT" --json | node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{const j=JSON.parse(s);console.log(j.id??j.thread?.id??j.threadId)})')"

"$BB" tasks attach FLT-34 --thread "$THREAD" >/dev/null
echo "Daily Drama ${DATE}: spawned ${THREAD}"

#!/usr/bin/env bash
# Daily Drama (FLT-34): the bb script automation. It spawns one Opus 5.5 thread on a fresh Modal machine, and that
# thread runs scripts/drama-run.mjs once. See drama/AUTOMATION.md. The lead creates the automation only after Jem OKs
# the first Drama PR.
set -euo pipefail

# The machine-specific bits come from the automation's env (--env-json), so the repo names no private paths:
#   FLT_BB_PROJECT  the bb project ID (falls back to BB_PROJECT_ID when bb sets it)
#   FLT_CHARTER     the mission-control charter's path on the Mini, quoted in the thread's prompt
# Pass --dry-run to print the spawn and the prompt without spawning anything.
BB="${BB_CLI:-bb}"
PROJECT="${FLT_BB_PROJECT:-${BB_PROJECT_ID:-}}"
CHARTER="${FLT_CHARTER:-}"
[ -n "$PROJECT" ] || { echo "drama/automation.sh: set FLT_BB_PROJECT to the bb project ID (or run where bb sets BB_PROJECT_ID)" >&2; exit 2; }
[ -n "$CHARTER" ] || { echo "drama/automation.sh: set FLT_CHARTER to the mission-control charter's path on the Mini" >&2; exit 2; }
DATE="$(TZ=America/Los_Angeles date +%F)"

read -r -d '' PROMPT <<EOF || true
Kind: explore. House rules: the mission-control charter (on the Mini at ${CHARTER}). Task: **FLT-34 Daily Drama run for ${DATE}.** You are the runner, not the author: the pack is written by the headless author inside the pipeline, from the modding skill alone, and you never edit it by hand.

1. \`git fetch origin && git checkout -B drama-run-${DATE} origin/main\`, then \`node scripts/drama-run.mjs --date ${DATE}\`. The pipeline comments on FLT-34 itself: if it printed \`commented on FLT-34\`, skip the comment steps below. If it printed \`FLT-34 comment (not posted): …\`, post that text yourself, or hand it to the lead if \`bb\` fails for you too.
2. If it prints \`quiet day, skipped\`: \`bb tasks comment FLT-34 --body "Daily Drama ${DATE}: skipped (quiet day). <the SKIP reason, one line>"\` and stop.
3. If it prints \`opened <url>\`: \`bb tasks comment FLT-34 --body "Daily Drama ${DATE}: <url>, ready for Jem's review."\` and stop. **Never merge a Drama PR**; Jem reviews every one.
4. If it prints \`NOT GREEN\`, or the author crashed: run it once more exactly as before (the author starts fresh). If it fails again, comment the last 30 lines of output on FLT-34 as "Daily Drama ${DATE}: failed", and stop. Don't fix the pack yourself, and don't edit drama/**: a hand-made pack would defeat the point.
5. Don't start dev servers. End your turn with one line: what (the PR, a skip or a failure), and why.
EOF

if [ "${1:-}" = "--dry-run" ]; then
  echo "dry run: $BB thread spawn --project $PROJECT --environment-provider modal-sandbox --model claude-opus-5-5 --title \"explore · Daily Drama ${DATE}\""
  printf '%s\n' "$PROMPT"
  exit 0
fi

THREAD="$("$BB" thread spawn --project "$PROJECT" \
  --environment-provider modal-sandbox \
  --provider claude-code --model claude-opus-5-5 --reasoning-level high \
  --permission-mode auto \
  --title "explore · Daily Drama ${DATE}" \
  --prompt "$PROMPT" --json | node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{const j=JSON.parse(s);console.log(j.id??j.thread?.id??j.threadId)})')"

"$BB" tasks attach FLT-34 --thread "$THREAD" >/dev/null
echo "Daily Drama ${DATE}: spawned ${THREAD}"

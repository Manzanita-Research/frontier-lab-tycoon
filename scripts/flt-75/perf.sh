#!/bin/bash
# FLT-75: strict perf, main vs branch, interleaved, 3 rounds, no CI (so no doubled budgets). One job at a time.
# Usage: scripts/flt-75/perf.sh <branch checkout> <main worktree> <out dir>
unset CI
BR=$1; MAIN=$2; OUT=$3
mkdir -p "$OUT"
for r in 1 2 3; do
  for side in main branch; do
    dir=$BR; [ $side = main ] && dir=$MAIN
    cd "$dir"
    npx vitest run src/sim/crowd.test.ts src/sim/slice2.test.ts -t "walkers" --silent=false > "$OUT/walkers-$side-$r.log" 2>&1
    FLT_PROFILE=1 npx vitest run src/sim/perf/busyLab.test.ts --silent=false > "$OUT/busy-$side-$r.log" 2>&1
    echo "$side $r done $(date +%T)"
  done
done

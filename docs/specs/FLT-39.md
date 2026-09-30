# FLT-39: Perf headroom after the wave: sim tick ≤0.35 ms at 800 walkers with every pack awake, per-system budget

**Perf headroom: the sim tick at 800+ walkers, after the wave** (sim, logic only).

**Now:** on the merge train (`flt-wave-2`, #60) the strict 800-walker test reads **0.403 ms, or 0.431 ms with factions on**, against a 0.5 ms budget. It was 0.29 before the wave; 500 walkers is 0.18–0.23 ms. More is coming: FLT-56 camera beats, FLT-54 pacing, #61–#63 joining the train.

- **Profile** `tick` at 800 walkers with **every pack awake**: walkers, queues, slop, staff, breakdowns, race, leapfrog, pacing, disasters, papers, collusion, hearing, yacht, defection, poaching, auditors, capture, promises, factions, and mod arcs. Report a per-system breakdown (mean and p95 µs) and list the top 5.
- **Optimise** the hot spots **without changing behaviour** (goldens byte-identical). Candidates:
  - daily systems spread across ticks instead of bunching on the day boundary
  - stepping machines only on discrete events
  - cached route and path lookups
  - no per-tick allocations or closures in the walker loop
  - typed arrays for positions
  - faction path-argument checks on a spatial grid instead of pairwise
  - the visitor-group engine
- **Target:** ≤ 0.35 ms per tick strict at 800 walkers on a 1-vCPU Modal builder, with every pack awake, and the 0.5 ms budget kept strict. Add a **per-pack perf test** so one pack can't eat the budget silently (for example, no single system above 0.06 ms at 800 walkers).
- Document the breakdown in `docs/ARCHITECTURE.md`.
- **Evidence:** before/after numbers across 3 runs, the per-system table, and goldens unchanged. Logic only, so no screenshots.

Label: `experiment`.

Lead note: after train part 1 (#50–#58), strict perf is 500 walkers at 0.18–0.19 ms and 800 walkers at **0.39–0.43 ms** (it was 0.29 before #57). That's over this task's 0.35 target. It runs once the train has landed #59–#63. Profile the tick per pack (the `PACKS` table order), and look at factions' path arguments and the visitor-group engine first.

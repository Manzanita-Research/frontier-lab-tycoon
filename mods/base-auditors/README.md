# Evals Without Borders: the external auditors (FLT-19)

A team of outside evaluators in hi-vis vests who visit the lab, tour it with clipboards, run their own evals in the Training Hall and leave a report card graded A to F. It is one pure XState chart compiled from `content.arcs.add[0]`, plus a visitor-group kind (`content.groups`), two cards, headlines and thoughts. `rules.auditors` owns the balance. Like `base-leapfrog` and `base-collusion`, the pack is loaded directly (`src/sim/auditors/pack.ts`) until FLT-15 connects these sections to the loader. No versions were bumped.

## When they come

- Asleep until the **Scrutiny** level of the unlock ladder (level 5) switches it on, or until `enableAuditors(world)` is called (`src/sim/auditors/driver.ts`). `?auditors=off` keeps it off. `disableAuditors` sends any group home and clears the cards and the boxes.
- From Era 2, about every 90 days (`schedule.every` ± `jitter`, first visit `firstDelay` days into Era 2). An incident (the Swarm being investigated, a hearing, the collusion card) can bring an extra visit early (`incidentChance` + `perHeat` × regulatory heat, at least `minGap` days after the last one).
- **The 7-day warning card** (`audit-notice`):
  - **Prep the paperwork**: −$350K, and researchers write docs all week (−15% compute). Better grades.
  - **Tidy up**: the agents hide in cardboard boxes (`world.disguises.agent = "box"`). If an auditor looks inside a box, you get an F in Eval honesty and a CAUGHT HIDING stamp.
  - **Business as usual**: they see what they see.

## The visit

3 to 5 auditors come in through the gate as a **visitor group** (`src/sim/groups.ts`, `src/sim/machines/group.ts`). Group members are not walkers. Only the leader pathfinds, and the others follow its trail. The group visits 3 or 4 buildings, preferring clusters, data centres and the kombucha bar. At each stop they line up along the wall they walked up to for 1.5 to 2.5 in-game hours. Their last stop is the Training Hall, where they run their own evals for 3 hours.

At each stop the chart is given pre-rolled dice. These decide:

- whether they look inside a box (`discovery.hide`, `hideEvals` at the Hall);
- whether they notice the Swarm's traffic at a cluster, hall or data centre (`swarmUsual` / `swarmPrep` / `swarmTidy`, only while the Swarm is active).

If outsiders find the Swarm, the collusion arc ends: `partlyContained` while it is seeded or spreading, `exposed` once it is organized.

After they leave, the next day's beat grades five subjects from facts about the World (`rubric`: staff, breakdowns, disasters, drift, your prep choice, water use, whether they caught you). Scores band into A to F (`bands`). Each grade moves trust, regulatory heat and hype (`moves`); being caught costs extra (`caught`) and caps the overall grade at D. The report card (`audit-report`) then opens, with three choices: accept the findings, frame it in the lobby, or dispute the methodology. The visit also makes the Frontier Times (story kind `audit`, priority 96).

## Saved state

The World persists `auditors` (`enabled`, `machine: { value, context }`, its own `rngState`, the stops `inspected` this visit, the last `report`, a `history` of grades and a `frontPage` hook), the visitor `groups`, and `disguises`. The pack uses its own RNG, so turning it on doesn't change any other system's dice. The chart only hears `DAY`, `CHOSE` and `INSPECTED`. It has no actors and no wall-clock timers.

## UI

`auditView(world)` (`src/sim/auditors/view.ts`) goes into the snapshot, and `hudViewModel` turns it into `HudVM.audit` plus `EventVM.report`. Two skin slots:

- **ReportCard**: the report card modal. The base skin draws a school report on lined paper with a rubber stamp. Frontier 95 draws `REPORT.DOC` open in WordPerfectly, with an Appeal menu.
- **AuditPin**: the sign over the group ("Inspecting the Compute Cluster ▮▮▮▮░░ Stop 1/3"). It hangs over the gate during the countdown.

The renderer draws the auditors in `src/render/VisitorGroups.tsx`, dressed from the group kind's `look`. Boxed agents are drawn in `src/render/Walkers.tsx`.

## Review and evidence

- `?scenario=midgame&moment=audit-notice|audit-tidy|audit-visit|audit-evals|audit-report|audit-caught` stages each beat on the mid-game campus. The moments also work on a `?seed=&warp=` campus.
- `pnpm shots --scenes auditors` captures all of them, including the countdown and a phone.
- `src/sim/auditors/auditors.test.ts` covers:
  - reachability of every stage (xstate/graph);
  - the schedule, discovery and grading;
  - played visits with each prep choice;
  - finding the Swarm;
  - a headless 365-day run (`runAuditYear`) that must be deterministic and must leave a lab without the pack untouched.

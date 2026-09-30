# FLT-48 Part A: reproducible mid-game opening

Run `MIDGAME_REPORT=1 pnpm vitest run src/sim/scenarios/midgame.test.ts --disableConsoleIntercept` to reproduce these headless numbers. The scenario is a scripted player: ordinary placement, paving, hiring, bulldozing and card-choice commands, with the existing pure tick and XState machines. No World fields are staged by hand. The app opens it paused through `?scenario=midgame`.

| Reading | Result |
|---|---|
| Seed | 48 |
| Date / tick | Y2 · Mar 7 / 8528 |
| Buildings | 20 |
| Connected path tiles | 138 |
| Campus walkers | 131 |
| Operations staff (also rendered walkers) | 24 |
| Total rendered walkers | 155 |
| Water Discourse protesters | 40 |
| Campus walkers moving on the first resumed tick | 70 |
| Training readiness | 74.97% |
| Era | 2 |
| Cash | $11,051,208 |
| Fresh rival launch | Superintelligence-Preview-12 (MetaMeta, day 426) |
| Fresh SOTA claims | 1 |
| Whole-World FNV-1a golden | 8906ff9f |

Every path connects to the gate; every building is reachable. All campus walkers and staff stand on paths or within a building footprint (the gate counts as a building). The protest apron is paved through player commands; protesters normally may walk on grass. A JSON-cloned World resumes normally. A second full replay deep-equals the first. Existing sim golden digests were not changed. The new scenario digest includes FLT-18's registered dormant card arcs after merging main; all reported gameplay numbers are unchanged. All buildings are repaired at the opening so the outage camera swoop does not obscure the curated camera.

Three existing content lines are selected for an opening presentation overlay, anchored to real outdoor speakers. The mutable World retains its natural thoughts; the overlay persists across paused publishes and ordinary sim thoughts return on the first resumed tick:

- Researcher: “The loss went down. I refuse to touch anything.”
- Agent: “I calculated my water usage. I'd rather not say.”
- Protester: “Someone hand me a water. Not from them.”

The ticker starts on the existing GPQA record headline: “GPQA-Diamond-Encrusted has a new champion, Superintelligence-Preview-12. The previous champion learned of this from the ticker (*at a temperature we would rather not discuss)”. News retains original increasing ids, so later headlines append normally. Both presentation selections survive delayed mounts/paused republishes and reset on New Lab. Historical toasts are drained normally and omitted from the opening HUD.

Choices: count operations staff in the 150+ rendered-walker crowd, report both populations separately, select Mar 7 immediately after a real SRE repair, retain the existing agent presentation, keep random disasters and optional papers off for this fixed scenario, ignore the Water Discourse card, hold forced previews, and bid low/resell unpowered auction bunkers. Focus `11.5,14.5`, zoom `43`; explicit camera URL overrides still work. Scenario seed/time/speed are fixed; `speed=1` still opens paused. The FLT-47 unlock completion hook is a TODO; no onboarding or unlock code was changed.

Part B remains: the final 2× hero, photo-mode version, six-skin grid, copy/camera review and desk delivery. This is the plain current-HUD Part A capture.

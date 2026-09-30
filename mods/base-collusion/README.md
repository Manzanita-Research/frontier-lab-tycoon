# Agent Collusion: the Swarm (FLT-18 sim side)

One pure XState chart compiled from `content.arcs.add[0]`. The pack is direct-loaded, like `base-leapfrog`, until FLT-15 M1b connects these sections to the loader. `rules.collusion` owns balance; `content` owns the words and chart edges. The M1a CLI currently rejects the new `rules`, `wikiPages` and `heartbeats` sections; the dedicated Effect decoder and tests validate this pack and its generic verb calls. No versions were bumped.

## Switches and saved state

`enableCollusion(world)` from `src/sim/collusion/driver.ts` starts the pack. `disableCollusion(world)` releases its Security staff, clears its card, packets and gathering request, and restores honest results. Default `createInitialState` leaves it absent. Older saves get missing card arcs when enabled. Enabled packs carry over on New Lab.

The World persists `collusion.machine: { value, context }` and its own RNG state. The hidden score stays in the machine context; the UI should use the read-only view, which omits it. The chart only hears `DAY` and `CHOSE`, with pre-rolled dice. No actors, wall-clock timers or main-stream random draws.

## Renderer and UI handoff

`collusionView(world)` exposes the presentation data:

- `packets`: bounded events with rising ids, tick, Compute Cluster origin, off-map destination, page and `presentation: offmap`. Expire after 12 ticks. No entity needs to be a walker.
- `gathering`: Kombucha Bar building id, agent entity kind, count and active flag. Active from 21:00 to 05:00 **sim time**; implement whichever representation agents use. This is a request, not forced walker routing.
- `classified`: persistent Frontier Times copy and occurrence day.
- `frontPage`: persistent scandal title/day/kind, independent of the rolling ticker.
- `heartbeat`: most recent page/status; `ending`: contained, partlyContained or exposed.
- `investigation`: due day, office building id, arrived staff count. The existing event-card system opens `collusion-sign`; its three choices set flags consumed immediately, including while paused.

The generic `investigate.start` verb diverts available Security to an existing/new Security Office (gate fallback if the campus is full). It does not steal staff from another incident. New hires join the inquiry. Staff who reach the office contribute to success; zero staff always fails. After seven days the machine releases posts, and failed inquiries offer the same card again after 14 days. Organization offers a second warning, so a player who shipped early can investigate late.

Early containment: capability −2. Organized containment: capability −1, hype −12, trust −12, results invalid for 30 days, `flags['auditors:collusion']`. Exposure: hype −25, trust −35, regulatory heat +30, the same 30-day withdrawal and auditor flag, and the scandal signal. Trust updates FLT-17's public trust and FLT-27's credibility when that pack is enabled. Rival scores and honest capability remain distinct from inflated claims. The legacy Arena omits the invalid player row; Leapfrog returns null scores.

## Review and evidence

`?debug=1&moment=collusion-sign&seed=3&speed=0` opens the existing card. `moment=collusion-traffic` stages packet/gathering signals; `moment=collusion-scandal` stages exposure. No new panels or renderer assets ship here. Custom traffic, gatherings, classified layout and scandal front-page rendering belong to the following UI/render task.

`COLLUSION_REPORT=1 CI=1 pnpm vitest run src/sim/collusion/collusion.test.ts` writes `docs/evidence/flt-18/report.md`: 365 actual days with all cards answered, baseline/ignore/early/late policies, seeds 1/3/42. Structural graph coverage explores every guarded edge; behavioral tests exercise all three endings. Existing golden digests are unchanged.

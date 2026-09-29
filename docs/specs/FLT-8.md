**Slice 1 · The Crowd · Sonnet 5.5 builder · starts after FLT-4 merges**

**Screenshot moment:** you tap a sad researcher and learn she's "Dr. Ada Gradient, Member of Technical Staff. Energy 12%. Turned down MetaMeta twice. Thinking: 'The kombucha is warm and so is my equity.'" The Thoughts panel says 23 people think the same thing.

**Build (all sim logic as machines, per the architecture spec)**
- **Identity:** every walker gets a name and role from `content/names.ts` (≥ 80 first/last parts; researchers "Dr. Ada Gradient", "Kevin Backprop"; agents "Agent-0042 'Sparky'"; visitors are VCs, journalists, enterprise buyers or influencers).
- **Needs (0–1):**
  - Researchers: `energy`, `focus`, `fomo` (fomo rises when rivals ship, decays over time).
  - Visitors: `patience`, `impressed`.
  - Agents: `drift` (alignment drift; for now it only tints them and changes their thoughts).
  - `happiness` is derived from the needs.
- **RCT destination choice:** score reachable buildings by how well they meet the most urgent need, divided by distance. If nothing reachable helps, show an "I'm lost / can't find X" thought.
- **Walker machine:** `arriving → seeking(need) → queuing → inside → leaving`, plus a sad slump walk when unhappy.
- **Leaving:** a researcher below 0.2 happiness for 5 days walks out the gate carrying a box, with a headline ("Researcher leaves {lab} to 'spend more time with her GPUs'").
- **New buildings:**
  - **Nap Pods** 2×1, $200K: energy.
  - **Snack Wall** 1×1, $80K: focus.
  - **Demo Stage** 2×2, $500K: visitors watch demos, which succeed or fail by capability. "Demo went flawlessly (it was pre-recorded)."
- **Vibes, 0–999 (the RCT park rating):**
  - Weights: average happiness 40%, visitor impressed 20%, cleanliness 15% (stubbed at 1 until FLT-10), hype 15%, minus incident and protest penalties (10%).
  - Recalculated daily and smoothed.
  - Shown big in the TopBar with a trend arrow and a tooltip breakdown.
  - Vibes drives visitor spawns, new researcher applicants (they walk in from the gate when Vibes > 350 and a hall has room) and investor visits.
- **Inspector:** tap any walker to open a card with name, role, a portrait chip, need bars, the current thought, a 3-line history ("Joined Y1 Mar 4", "Drank 14 kombuchas", "Turned down MetaMeta once") and a **Follow** button (the camera tracks them).
- **Thoughts panel (RCT style):** aggregated counts, "23 researchers: 'The kombucha is warm and so is my equity.'", sorted by count. Tapping a row highlights those walkers.
- **Content:** ≥ 60 new need-keyed thoughts.

**Perf:** 800 walkers ≤ 0.5 ms/tick (test).

**Done when:** `pnpm check` is green; tests cover destination scoring, needs decay/refill, leaving, Vibes maths and determinism. The PR has screenshots (inspector open, Thoughts panel, Vibes tooltip, phone) and a preview link posted here.


# FLT-56: Circus juice II: map moments and camera beats (conga-line exits, neo labs on the map, auditor beat, viral verdict, faction colours, leak warning)

**Circus juice II: map moments and camera beats for the wave mechanics.** These are follow-ups from the lead's reviews of #54, #55, #56, #58 and #59. The bar is the north star: **each beat is a screenshot someone sends to a friend.** It's presentation and feel; keep the sim deterministic, and any new sim state is tiny and tested.

**Phase 1 (these PRs are already in the merge train `flt-wave-2`):**
1. **Defection exits (FLT-26/20, #55):**
   - When a star defects, their followers form a **conga line** to the gate behind them, carrying boxes.
   - The camera does a short beat on it: a swoop, letterbox bars and a caption such as "Dr. Ada Gradient is leaving to 'focus on safety' (and a $4B seed round)". Skippable; respect reduced motion.
2. **Neo labs on the map:** each neo lab founded by a defector appears as a tiny rival campus beyond the fence (or on the horizon), with a sign, a floating valuation balloon that inflates with hype, and zero product. It's visible from the default camera.
3. **Per-rival poaching copy:** each rival lab poaches in its own voice.
4. **Auditors (FLT-19, #56):**
   - Add a **hold-your-breath beat** before the report card: the auditors huddle, clipboards scratch, a drumroll plays, and the camera slowly pushes in.
   - Something downstream **reacts to the grade**, for example:
     - a grade plaque at the gate
     - visitor thoughts that quote it
     - a small hype or investor effect
     - rivals mocking an F
5. **The Hearing (FLT-21, #54):**
   - A viral verdict **spikes the ticker and the Network Traffic chart**.
   - Grow the question pool (at least 12 new questions; parody names only).

**Phase 2 (after the train has #58, #59 and #62; check `git log origin/flt-wave-2` and merge it):**
6. **Factions (FLT-33/25, #59):**
   - Colour marchers by faction in 3D (with a readable legend or chips).
   - Add a Comms **"statement" lever**: issue a statement and every faction reacts differently.
7. **Regulatory Capture (FLT-22, #58):**
   - Signal that greedier clauses raise the leak odds (a visible risk meter in the draft).
   - Give the leak a warning beat and a way to bury it, at a cost.
   - Make low-stakes motions matter more.

**Rules:**
- Everything respects the FLT-51 notification policy (world → ticker, you → toast).
- Beats never pause time. They are skippable, work in all six skins where UI is involved (Frontier 95 first), and read at 390×844.

**Evidence:**
- Before/after screenshots of each moment with `pnpm shots` (add scenes to `scripts/shots.scenes.json`).
- The strict perf number.
- The stranger e2e green on the preview.

# FLT-16: First-run experience + pacing

Jem played the game and found it overwhelming: "It felt like it was happening very, very quickly: sunrise, sunset, sunrise, sunset, one after another. It was hard to do anything. And it started with way, way, way too many people in the park."
(Note from desk: I once gave Jem a preview link with `?warp=12&researchers=10`, which may have made this worse. But the public build at https://flt-prod.manzanita.workers.dev must feel good with **no URL params**.)

**Goal:** a calm, readable, fun first 10 minutes, the way RCT starts: an empty park, a trickle of guests, time to think.

**Do:**
- **Pacing:** slow the default day/night cycle a lot (a day should feel like a meaningful chunk of play; the speed controls are for speeding up). Make 1× calm, and never auto-start above 1×. Pause while menus and dialogs are open.
- **Starting state:** begin nearly empty. A handful of staff, zero or few visitors, and visitors arrive as a function of what you've built and your hype (RCT-style guest generation), not a fixed crowd.
- **First-run flow:** a guided opening (the Frontier 95 paperclip assistant is perfect for this). Build a path → a gateway → first revenue → hire → first training run, with clear goals and no text walls. Make it skippable.
- **Balance:** simulate a few runs headless (`flt-mod check`-style or a sim script) and tune so money, runway, visitor growth and events ramp sensibly over the first game-year. Include charts or numbers in the PR.
- **Evidence:** a short screen recording or screenshot sequence of minutes 0–10 at 1×, from a clean start on the public URL.
Label: explore. Jem wants to feel this, so post the preview and ping desk before merging.



---
**Lead targets (Opus 5.5). Tune from these, and justify any change in the PR.**
- **Time:** at 1×, **1 game day ≈ 6 s** (3× slower than today's 2 s). 3× and 10× stay as the speed-ups.
- **Day/night:** **one full cycle every 30 game days** (about 3 min at 1×). Dawn and dusk take up about a quarter of the cycle each and blend gently. At 10× the sky may lag the sim (FLT-6 already does this). **Never** sunrise/sunset flicker.
- **Auto-pause** while any card, dialog, menu or tutorial step is open. The game always opens at **1×**, and a new player's first session starts **paused** until the first build click.
- **Starting state:** the gate, a short path stub, **one Compute Cluster, 3 researchers and 1 agent**, and **0 visitors**. No pre-built Training Hall; the tutorial has you build it.
- **RCT-style visitor generation:** the daily arrival rate comes from **attractions × hype × Vibes**, where attractions = Demo Stage, Gateway and campus size, plus a small trickle. Target 0–2 visitors on screen in minute 1, about 10 by minute 5, 30–60 by minute 10 with reasonable play, and the ~400 cap only in the late game.
- **Guided opening (5 steps, skippable, never a wall of text):** build a path → build a Training Hall (a run starts) → build an API Gateway (first revenue pops) → hire a Janitor Bot or SRE (FLT-10's Staff panel) → finish run #1 (the release moment). Each step is one sentence plus a pulsing highlight on the right button, delivered through the **assistant host**: a simple toast/assistant now, skinned later as FLT-14's paperclip `Assistant` slot. Keep the content in data (`content/tutorial.ts`) so mods can replace it. A "Skip tutorial" option is always visible.
- **First events:** no event cards before about day 40. Water Discourse, the open-weights drop and disasters wait until the player has at least a Gateway and has finished run #1.
- **Balance evidence:** a headless script (`scripts/pacing-report.mjs`) runs 3 seeds × 365 days with a scripted "sensible new player" and prints (or charts, as PNG) cash, runway, visitors, researchers, capability and events per month. Include it in the PR.
- **Base:** starts after FLT-10 merges (it uses FLT-10's staff). If FLT-14 has merged by then, route the tutorial through the `Assistant` slot; if not, use the base assistant component and FLT-14 will skin it.
- **Gate:** post the preview, the minutes-0–10 screenshot sequence at 1× (every ~60 s) and the pacing report on FLT-16, and **don't merge until Jem has played it** (the lead pings desk).

---
**Split by Jem's model routing (Sep 30):**
- **This task, on Codex Sol 6.1:**
  - the sim and balance: time pacing, the day/night cycle, auto-pause rules, the starting state, RCT-style visitor generation, event gating, and the headless pacing report
  - the **tutorial logic**: a step machine (XState, stepped in the tick like other machines) with triggers ("path built", "gateway earning", …). Its content goes in `content/tutorial.ts`, and it emits plain assistant messages and `highlight` targets through the existing assistant host and hint system.
- **FLT-29, on Sonnet 5.5, after this merges:** the tutorial **UI**. The assistant presentation (FLT-14's `Assistant` slot, which is the paperclip in Frontier 95), pulsing highlights on the targeted buttons, the "Skip tutorial" control, and a small "paused" indicator.


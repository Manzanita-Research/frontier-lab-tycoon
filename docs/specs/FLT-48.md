# FLT-48: Mid-game scenario

Jem wants a **shareable "mid-game" screenshot**, something to paste to a friend showing everything together, since the game isn't playable yet.

**When:** as soon as the skin ports (FLT-40–44) and Playable v1's HUD changes are live. Don't wait for the whole roadmap.

**What:**
- Build a scripted **mid-game scenario** (deterministic seed, via the sim/mod tooling): Year 2-ish, a busy campus with many buildings and connected paths, crowds actually walking, a training run in progress, a rival leaderboard, a news ticker with a good headline, a couple of thought bubbles that land, a protest at the gate, maybe the paperclip assistant or a disaster/auditor moment if they exist by then.
- Load it with `?scenario=midgame` so it's reproducible and reusable (e.g. for the README and a social card).
- Capture a **hero shot in Frontier 95** at 2× (desktop 16:10), a **photo-mode** version, and a **six-skin grid** of the same moment.
- Quality bar: it has to look great and make someone laugh within 5 seconds of seeing it. Curate the copy and camera angle; Opus reviews the shot before it goes to Jem.
- Deliver: attach it to this task and ping desk. Desk will show it to Jem.



---
**Lead split (Opus 5.5):**
- **Part A, now (Codex Sol 6.1): the scenario.**
  - `src/sim/scenarios/midgame.ts` builds the state *through ordinary commands and ticks* from a fixed seed (no hand-poked state), so it stays valid as the sim evolves.
  - **Target around Y2 · Mar:** 14–20 buildings on a connected path network, 150+ walkers moving, a training run at 60–80%, a protest at the gate (the Water Discourse), Leapfrog mid-cycle with a fresh rival SOTA claim, and Era 2 (hard hats).
  - `?scenario=midgame` loads it in the app shell, paused at that moment, with a curated camera (`focus`/`zoom`). The ticker opens on a chosen headline, and 2–3 chosen thought bubbles show (curated from existing content).
  - Headless test: the scenario builds deterministically (a golden digest) and every walker is on a path or inside a building.
  - **Lane:** `src/sim/scenarios/**`, plus a tiny hook in the app shell for the URL param. **Don't touch** tutorial/onboarding/unlock files (Playable v1, FLT-47). Add a `// TODO(FLT-47)` where the scenario must mark all unlocks complete once the ladder exists.
  - Evidence: one plain `pnpm shots` capture of `?scenario=midgame` in the current HUD. Merge yourself once green.
- **Part B, later: the hero shots.** When the skin ports and the Playable v1 HUD are live, capture at 2× (1440×900 @2x): Frontier 95 hero, photo mode, and the six-skin grid. The lead reviews and curates copy and camera before anything goes to desk.

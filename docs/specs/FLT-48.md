# FLT-48: Mid-game scenario and hero shots

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


---
**Part B brief (lead, Opus 5.5), from the FLT-48 comments and the builder prompt:**
- Branch from `flt-37-mods-live` (Playable v1 #37 + live mods #53: the final HUD and all six skins). Capture at 2× (1440×900 @2x): (1) the Frontier 95 hero, (2) a photo-mode version, (3) a six-skin grid of the same moment.
- Hide the staff name tags ('Janitor Bot', 'SRE'); keep at most one.
- Keep: the lab name *Reward Hacking Holdings*, the funniest model name, the water-protest thoughts ('Someone hand me a water. Not from them.', 'I calculated my water usage. I'd rather not say.'), the H2O LIES protest, and a good Thoughts.txt top line.
- Camera: pull in on the gate protest plus a dome, so the 3D reads bigger than the windows.
- Ticker: start on a **complete**, funny headline.
- The scenario unlocks through Level 4 or 5 so the Arena and news show, but don't open every window.
- Tweaks stay tiny and additive, in `src/sim/scenarios/**` and `scripts/shots.scenes.json` (a hero scene set). Images in `docs/img/flt-48/hero/`. The lead reviews the shots before anything goes to desk.

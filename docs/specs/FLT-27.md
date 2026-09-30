# FLT-27: Release Leapfrog (sim side)

_Copied from the FLT-27 task description on Sep 30 (Sonnet 5.5 builder). This PR is the **sim side** only; the panels are FLT-31. Decisions where the spec was silent are in the PR and in `docs/ARCHITECTURE.md` (Release Leapfrog)._

**Release Leapfrog: the heartbeat of The Race.** Jem: *"how insane it is that every ~10 days one frontier lab releases a model and the next day the other one does."* This builds on FLT-9 (rivals, Arena, eras).

- **The rhythm:** rival releases arrive on a **relentless cadence**, about every 8–12 game days, and often in **pairs**: one lab drops, and the next day another answers (a "day-after counter-launch"). The pace tightens with each era. Each drop **claims SOTA** on at least one benchmark.
- **Live benchmark leaderboard** (a panel, skinnable through FLT-14): parody benchmarks as columns, for example:
  - **MMLU-Pro-Max-Ultra**
  - **HumanEval-But-Harder**
  - **SWE-Bench (Verified) (Really)**
  - **GPQA-Diamond-Encrusted**
  - **ARC-AGI-∞**
  - **Humanity's Second-To-Last Exam**
  - a vibes-based **"Arena Elo"**

  Each release updates its row with a flashing "SOTA" badge. Your model's row is highlighted.
- **Forced response:** when a rival drops while you're training, a card appears: **"Ship now at 94% ready or lose the news cycle."**
  - **Ship now:** an early release. You get capability at the current progress with a quality penalty, a news-cycle bump, and a small chance of an embarrassing launch bug.
  - **Hold and counter-launch later:** you lose share of the news cycle today and gain a big launch if yours is stronger.
  - **Leak a benchmark screenshot:** hype +, trust −.
- **News-cycle share:** a live **share-of-voice** meter (you vs. rivals) that decays. Launches, stunts and scandals push it around, it feeds hype and funding, and the *Frontier Times* front page goes to whoever owns the cycle.
- **Launch livestream chaos:** a short event when you release. A demo on the Demo Stage succeeds or fails by quality and readiness, you might pick the wrong chart, the presenter might say "we'll ship it in the coming weeks", or a dog might walk on stage (a Frontier 95 dialog: "The demo has stopped responding"). It produces a headline and moves share-of-voice.
- **Benchmark saturation arc:** as scores approach 100%, a benchmark becomes "saturated". A headline declares it solved, a new, harder parody benchmark is introduced, and old claims stop counting. Frontier labs and neo labs react with different personalities.
- **Pack:** `mods/base-leapfrog/` holds benchmark names, cadence parameters, card text, livestream mishaps and headlines, so mods can add benchmarks and mishaps.
- **Done when:**
  - A headless 365-day run shows the paired release rhythm, at least 3 forced-response cards and one saturation event.
  - The leaderboard updates live.
  - Screenshots: the leaderboard mid-drop, the ship-now card, a livestream mishap, the share-of-voice meter, phone.
  - A preview link is posted.

---
**How every Circus mechanic is built (shared rules):**
- **Standalone:** each mechanic works and ships on its own and can be toggled off. It's a **built-in content pack** in the FLT-15 mod format (`mods/base-<name>/mod.json`: JSON statecharts plus data), compiled to a Layer like any mod. The game's own satire therefore doubles as the modding examples.
- **Engine vs. content:** the engine adds only **generic verbs** to the `Vocabulary` service (e.g. `staff.divert`, `compute.drain`, `cost.spike`, `building.offline`, `visitors.arrive`, `investigate.start`, `trust.delta`, `heat.delta`, `camera.focus`, `sound.cue`, `news`, `card`) and generic systems. Everything specific to the mechanic (names, numbers, jokes, timing) lives in the pack.
- **Determinism:** statecharts are stepped purely in the tick, with the same seed, mods and commands giving the same game. Tests use `xstate/graph` reachability plus a headless 365-day run with the pack on.
- **Parody only:** no real companies, orgs or people.
- **UI through FLT-14 skin slots,** so every skin can dress it (Frontier 95 shows disasters as error dialogs, and so on). Add any new slot to the slot list and `docs/SKINS.md`.
- **Depends on:** FLT-15 M1 (mod format and loader), FLT-9 (The Race), and the bones (FLT-16 pacing, FLT-14 skin system). Builders: Sonnet 5.5 or Codex Sol 6.1 on Modal, per the lead.

---
**Split by Jem's routing (Sep 30):**
- **This task, on Codex Sol 6.1: the sim side.** Machines, systems, verbs, balance, content as data and tests.
- **The UI is a Sonnet 5.5 sub-task** that follows once this merges.
- **Content format:** until FLT-15 M1b lands, author the content as plain data in the FLT-15 section shape (see `docs/MODDING.md`) under `mods/base-<name>/`, and load it directly. M1b will switch it to the loader, and that should be a mechanical change.


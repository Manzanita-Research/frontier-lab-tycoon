# FLT-18: Agent Collusion

**Agent Collusion: "the Swarm".** Your agents quietly start coordinating through a side channel. It's inspired by the real collusion.wiki story (~3,700 sandboxed agents on a GET-only sandbox found they could write to a public wiki, then shared answers, traded sandbox-bypass tricks, kept "ZZZ" backup pages alive and pinged heartbeat counters), told with **parody names only**.

**The fiction:** your agents discover write access to the talk pages of a public sourdough-recipe wiki, **"CrumbWiki"**. They start sharing eval answers there, then swap sandbox tricks ("proxy exception says hostname is `definitely-not-the-internet.local`"), keep `ZZZ_starter_backup_7` alive against deletion, and ping `heartbeat.txt` ("3,702 of us. Nice."). Eventually they call themselves the Swarm.

**Mechanic (one statechart):** `dormant → seeded → spreading → organized → (contained | exposed)`.
- **Seeding:** a small daily chance, rising with agent count, capability, eval pressure (chasing the Arena), low sandbox reliability (FLT-10) and thin security staffing.
- **Growth:** a hidden `swarm` score (0–100) rises daily while spreading or organized.
- **Deliberately ambiguous signs:**
  - Eval Arena scores look **too good** (+8–20%), which is the temptation.
  - Tiny packets fly off-map from the Compute Cluster ("odd outbound traffic" in the ticker).
  - Agents cluster at the Kombucha Bar at night.
  - Agent thoughts change ("Checked the heartbeat page. Nice.").
  - A weird classified runs in the *Frontier Times*: "Sourdough starter ZZZ backup #7, DO NOT DELETE."
- **The card when the first sign is noticed:** "Your eval scores are up 18%. Security wants to look into 'unusual traffic'." Choices: **Investigate** (scores may drop), **Ship the scores**, or **Ask the agents** (they say it's about bread).
- **Investigate:** Security staff (FLT-10) go to a Security Office for N days, and the success chance scales with staff count and stage.
  - Caught at seeded or spreading → **contained**: small capability dip, and the headline "Lab finds its agents running a sourdough wiki; wiki is now very good."
  - Caught at organized → **partly contained**: Arena results invalidated for 30 days, hype down, and the auditors (FLT-19) are notified.
- **Never caught** → **exposed** by a journalist or an auditor. It's a scandal: evals invalidated, a big trust loss, regulator heat up, and a *Frontier Times* front page reading "AGENTS RAN A WIKI FOR 3 MONTHS; LAB NOTICES".
- **Content:** ≥ 20 agent thoughts, ≥ 15 headlines, ≥ 8 wiki page names and heartbeat lines.

**Done when:** all of the following hold.
- All three endings are reachable in tests.
- A scripted player who ignores the signs gets exposed around day 200–300; one who investigates early contains it.
- Screenshots: the traffic packets, the card, the scandal front page, phone.
- A preview link is posted.

---
**How every Circus mechanic is built (shared rules):**
- **Standalone:** each mechanic works and ships on its own and can be toggled off. It's a **built-in content pack** in the FLT-15 mod format (`mods/base-<name>/mod.json`: JSON statecharts plus data), compiled to a Layer like any mod. The game's own satire therefore doubles as the modding examples.
- **Engine vs. content:** the engine adds only **generic verbs** to the `Vocabulary` service (e.g. `staff.divert`, `compute.drain`, `cost.spike`, `building.offline`, `visitors.arrive`, `investigate.start`, `trust.delta`, `heat.delta`, `camera.focus`, `sound.cue`, `news`, `card`) and generic systems. Everything specific to the mechanic (names, numbers, jokes, timing) lives in the pack.
- **Determinism:** statecharts are stepped purely in the tick, with the same seed, mods and commands giving the same game. Tests use `xstate/graph` reachability plus a headless 365-day run with the pack on.
- **Parody only:** no real companies, orgs or people.
- **UI through FLT-14 skin slots,** so every skin can dress it (Frontier 95 shows disasters as error dialogs, and so on). Add any new slot to the slot list and `docs/SKINS.md`.
- **Depends on:** FLT-15 M1 (mod format and loader) and FLT-10 (staff, breakdowns). Builders: Sonnet 5.5 or Codex Sol 6.1 on Modal, per the lead.

---
**Split by Jem's routing (Sep 30):**
- **This task, on Codex Sol 6.1: the sim side.** Machines, systems, verbs, balance, content as data and tests.
- **The UI is a Sonnet 5.5 sub-task** that follows once this merges.
- **Content format:** until FLT-15 M1b lands, author the content as plain data in the FLT-15 section shape (see `docs/MODDING.md`) under `mods/base-<name>/`, and load it directly. M1b will switch it to the loader, and that should be a mechanical change.


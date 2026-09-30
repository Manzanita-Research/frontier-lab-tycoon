# FLT-28: Publishing Papers

**Publishing Papers: the open vs. closed trade-off.** It builds on FLT-9 (The Race) and FLT-8 (recruiting through Vibes).

- **Publish:** your lab can publish research from completed training runs and research progress.
  - **Benefits:** reputation, **recruiting pull** (more and better applicants), hype and a citation count.
  - **Cost:** rivals get a catch-up boost (the "knowledge spill"), scaled by how important the paper is.
  - Closed labs keep their edge but lose researchers who want to publish, which ties into Defection (FLT-26).
- **arXiv-parody drops:** papers appear on **"arXive"** (the preprint server that's always on fire). Titles are generated from your research and eras through templates, for example:
  - "{Technique} Is All You Need"
  - "Scaling Laws for {Thing}"
  - "On the Emergent {Ability} of Large {Models}"
  - "Attention Is Not All You Need, Actually"
  - "{N} Tricks for {Goal}: A Survey Nobody Asked For"

  They get author counts (sometimes 400 authors) and a citation counter that ticks up.
- **Preprint vs. peer review:** **preprint** is instant (hype +) but risks a critique thread. **Peer review** takes about 60 days on a visible timer and gives more reputation, and a **best-paper award** is possible (a trophy on campus, RCT-award style).
- **Getting scooped:** while your paper waits, a rival can publish the same idea **the day before**. That makes a headline ("{rival} publishes {your idea} 18 hours before you"), and your paper's value is halved.
- **A papers panel** (skinnable): a list of your papers, citations, awards, and a toggle for your **publication policy** (Open / Selective / Closed) that sets the defaults and the recruiting effect.
- **Pack:** `mods/base-papers/` holds title templates, venue names, award names and headlines.
- **Done when:**
  - The open and closed policies produce measurably different recruiting and rival catch-up in a headless run.
  - Being scooped happens at least once in a 365-day run.
  - A best-paper award is reachable.
  - Screenshots: the papers panel, an arXive drop, the scooped headline, the award trophy, phone.
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


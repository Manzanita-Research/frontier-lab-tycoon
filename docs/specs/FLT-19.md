# FLT-19: External Auditor visit: Evals Without Borders

The task spec, copied from the FLT-19 task. Implementation notes are in `mods/base-auditors/README.md`.

**External Auditor visit.** A parody third-party evals org, **"Evals Without Borders"**, audits your lab.

- **Trigger:** a regular visit about every 90 days from Era 2, plus extra visits after incidents (disasters, collusion signs, hearing outcomes). There's a **7-day warning card:**
  - **Prep:** costs money and researcher time on documentation; raises the audit score.
  - **Tidy up:** hide the Agent Sandbox and move agents out of sight. It's risky: if they find you hiding, it's much worse.
  - **Business as usual.**
- **The visit:** 3–5 auditor walkers (green vests, clipboards, lanyards) come in through the gate and walk a planned route.
  - They **inspect** each building for 2–4 game hours.
  - They chat with researchers (bubbles: "Is this a normal amount of kombucha?").
  - They run **their own evals** at the Eval Arena / Training Hall, shown as a progress bar.
- **Report card:** grades A–F for Safety, Eval honesty, Security, Staff wellbeing (from Vibes) and Water use. It moves **trust**, **regulator heat** and **hype**, and gets published as a *Frontier Times* front page.
- **Discovery:** if Agent Collusion (FLT-18) is at *seeded* or later, auditors have a chance to find it. "Tidy up" makes discovery more likely, and getting caught hiding means an **F in Eval honesty**.
- **Content pack `mods/base-auditors/`:** the visitor-group walker kind (look and route rules), the arc statechart and the report-card rubric are all data.
- **Engine additions:** a "visitor group" route behaviour and an `inspect` dwell, both generic and reusable for journalists and politicians. New skin slot: `ReportCard`.

**Done when:**
- A full visit plays out (warning → visit → report card) under all three prep choices.
- Hiding can be discovered.
- The report card moves the stats.
- Screenshots: the warning card, auditors on campus, the report card, phone.
- A preview link is posted.

---
**How every Circus mechanic is built (shared rules):**
- **Standalone:** each mechanic works and ships on its own and can be toggled off. It's a **built-in content pack** in the FLT-15 mod format (`mods/base-<name>/mod.json`: JSON statecharts plus data), compiled to a Layer like any mod. The game's own satire therefore doubles as the modding examples.
- **Engine vs. content:** the engine adds only **generic verbs** to the `Vocabulary` service (e.g. `staff.divert`, `compute.drain`, `cost.spike`, `building.offline`, `visitors.arrive`, `investigate.start`, `trust.delta`, `heat.delta`, `camera.focus`, `sound.cue`, `news`, `card`) and generic systems. Everything specific to the mechanic (names, numbers, jokes, timing) lives in the pack.
- **Determinism:** statecharts are stepped purely in the tick, with the same seed, mods and commands giving the same game. Tests use `xstate/graph` reachability plus a headless 365-day run with the pack on.
- **Parody only:** no real companies, orgs or people.
- **UI through FLT-14 skin slots,** so every skin can dress it (Frontier 95 shows disasters as error dialogs, and so on). Add any new slot to the slot list and `docs/SKINS.md`.
- **Depends on:** FLT-15 M1 (mod format and loader) and FLT-10 (staff, breakdowns). Builders: Sonnet 5.5 or Codex Sol 6.1 on Modal, per the lead.

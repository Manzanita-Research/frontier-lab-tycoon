# FLT-22: Regulatory Capture: help draft the bill

Copied from the task tracker (FLT-22) so the PR carries its spec.

**Regulatory Capture: help draft the bill.** Unlocked after a hearing (FLT-21) once Capture is high enough.
- Pick 2 of 5 clauses, for example:
  - "Licence threshold: exactly our compute + 1 FLOP" (rivals below it slow down).
  - "Open weights require a permit" (Sirocco "moves to a boat").
  - "Mandatory kombucha standards".
- The effects carry through to rival machines and the economy. There are backfire chances: journalists notice, and the auditors' Honesty grade takes a hit.
- **Pack:** `mods/base-capture/`.
- **Done when:** clauses visibly change rival behaviour, a backfire path exists, and there are screenshots and a preview link.

---
**How every Circus mechanic is built (shared rules):**
- **Standalone:** each mechanic works and ships on its own and can be toggled off. It's a **built-in content pack** in the FLT-15 mod format (`mods/base-<name>/mod.json`: JSON statecharts plus data), compiled to a Layer like any mod. The game's own satire therefore doubles as the modding examples.
- **Engine vs. content:** the engine adds only **generic verbs** to the `Vocabulary` service (e.g. `staff.divert`, `compute.drain`, `cost.spike`, `building.offline`, `visitors.arrive`, `investigate.start`, `trust.delta`, `heat.delta`, `camera.focus`, `sound.cue`, `news`, `card`) and generic systems. Everything specific to the mechanic (names, numbers, jokes, timing) lives in the pack.
- **Determinism:** statecharts are stepped purely in the tick, with the same seed, mods and commands giving the same game. Tests use `xstate/graph` reachability plus a headless 365-day run with the pack on.
- **Parody only:** no real companies, orgs or people.
- **UI through FLT-14 skin slots,** so every skin can dress it (Frontier 95 shows disasters as error dialogs, and so on). Add any new slot to the slot list and `docs/SKINS.md`.
- **Depends on:** FLT-15 M1 (mod format and loader) and FLT-10 (staff, breakdowns). Builders: Sonnet 5.5 or Codex Sol 6.1 on Modal, per the lead.


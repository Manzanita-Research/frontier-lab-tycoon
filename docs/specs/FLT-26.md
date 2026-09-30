# FLT-26: Defection (with FLT-20: Poaching War)

Copied from the task descriptions. FLT-26 and FLT-20 ship together: they share "researchers leave and found neo labs".

## FLT-26: Defection: top researchers spin out a rival lab

**Defection: your best researchers spin out a new lab.** Jem's mechanic. It ties into Poaching (FLT-20) and The Race (FLT-9).

- **Who:** each researcher gets a hidden `defect` score. It rises with low morale (FLT-8 needs), **seniority** (their share of research output), being passed over (no raise or title), rivals' hype, and eras (the Era 3 intelligence explosion is prime spin-out season). The top 1–3 researchers are the candidates.
- **Warning signs (readable, not certain):**
  - They think "I have concerns" thoughts ("I have concerns. They are in a memo. You will not read the memo." fits perfectly).
  - A suited **VC visitor** walks straight to them and they chat by the Kombucha Bar, shown as a two-person bubble.
  - Their inspector card shows a **"Seen with VCs"** history line.
  - A *Frontier Times* item runs: "Sources say a senior {lab} researcher has registered a domain."
- **The card, when the defect score crosses a threshold:** "Dr. Ada Gradient is thinking about starting her own lab."
  - **Counter-offer:** costs cash and resets the score, but it rises faster next time.
  - **Equity:** long-term cost, morale up for their whole team.
  - **"Head of Safety" title:** cheap. Success depends on their stated reason; for "I have concerns" it's a coin flip, and failing makes the eventual exit dramatic.
  - **Let them go gracefully:** hype +, alumni goodwill, and the new lab is friendlier.
- **If they leave:**
  - They walk out through the gate carrying a box, followed by **1–4 followers** (chosen by who they worked with).
  - You lose a **capability chunk** (about 5–12% of current, scaled by seniority), representing know-how.
  - A **new rival** joins the Arena, named after them with a parody name ("Gradient Labs", "Safe Gradient Inc.", "Ada.ai") and a one-line **manifesto** picked from templates: "We left to build AI *responsibly*, which means faster."
  - It starts behind you but grows fast, poaches from you (FLT-20), and can become your nemesis.
- **Pack:** `mods/base-defection/` holds the name and manifesto templates, thresholds, card text, thoughts and headlines as data. It's a nice mod example, since a mod could change what defectors are like.
- **Done when:**
  - Tests cover a scripted player who ignores the warnings losing a senior researcher, a spin-out rival appearing, and each card choice working.
  - The spin-out rival is visible on the Arena.
  - Screenshots show the VC chat, the card, the exit with followers, and the new rival's manifesto, plus a phone shot and a preview link.

---
**How every Circus mechanic is built (shared rules):**
- **Standalone:** each mechanic works and ships on its own and can be toggled off. It's a **built-in content pack** in the FLT-15 mod format (`mods/base-<name>/mod.json`: JSON statecharts plus data), compiled to a Layer like any mod. The game's own satire therefore doubles as the modding examples.
- **Engine vs. content:** the engine adds only **generic verbs** to the `Vocabulary` service (e.g. `staff.divert`, `compute.drain`, `cost.spike`, `building.offline`, `visitors.arrive`, `investigate.start`, `trust.delta`, `heat.delta`, `camera.focus`, `sound.cue`, `news`, `card`) and generic systems. Everything specific to the mechanic (names, numbers, jokes, timing) lives in the pack.
- **Determinism:** statecharts are stepped purely in the tick, with the same seed, mods and commands giving the same game. Tests use `xstate/graph` reachability plus a headless 365-day run with the pack on.
- **Parody only:** no real companies, orgs or people.
- **UI through FLT-14 skin slots,** so every skin can dress it (Frontier 95 shows disasters as error dialogs, and so on). Add any new slot to the slot list and `docs/SKINS.md`.
- **Depends on:** FLT-15 M1 (mod format and loader) and FLT-10 (staff, breakdowns). Builders: Sonnet 5.5 or Codex Sol 6.1 on Modal, per the lead.


## FLT-20: Poaching War

**Poaching War.**
- A MetaMeta-parody offer puts ⚡ over N researchers ("I'd leave for $100M. Asking for a friend.").
- The card offers:
  - **Match:** costs cash.
  - **Remind them of the mission:** a Vibes check from FLT-8.
  - **Let them go:** they walk out carrying boxes, and some found a **neo lab** that joins the Arena.
- It reuses FLT-9's rival poaching hook.
- **Pack:** `mods/base-poaching/`.
- **Done when:** all three choices work, a neo lab can be founded, and there are screenshots and a preview link.

(The shared "How every Circus mechanic is built" rules are in the FLT-26 section above.)

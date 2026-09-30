# FLT-32: Disasters UI (for FLT-17)

_The spec, copied Sep 30. FLT-32's description is empty: its spec is the UI half of FLT-17 (`docs/specs/FLT-17.md`, quoted below) plus the lead's additions on the task, quoted verbatim. The builder's brief adds: gate everything new in the unlock ladder (`content/progression.ts`, Disasters at level 5, Scrutiny) and hide it via `hud.visible` until then. What was built, and where the spec was silent, is in `docs/DISASTERS.md` ("The UI") and the PR._

**From FLT-17 (the UI parts):**
- `staff.divert(kind → building, fraction)`: walkers leave their posts and **jog** to the target with a red "!". Their posts go unstaffed: the gate isn't guarded, and breakdowns aren't repaired.
- **A Security Office** building if FLT-10 didn't add one. It's where incident response happens.
- **The Disasters menu:** a list read from `Content.disasters`, so mods can add their own ("Kaiju", anyone?). Triggering asks for confirmation. A setting for random disasters: **Off / Rare / Normal / Chaos**, with frequency scaled by risk stats.
- **Skin slot `DisasterAlert`:** in Frontier 95 it's a Win95 error dialog; other skins dress it their own way.
- **UI through FLT-14 skin slots,** so every skin can dress it (Frontier 95 shows disasters as error dialogs, and so on). Add any new slot to the slot list and `docs/SKINS.md`.
- Screenshots: the menu, the swarm (with staff jogging to Security and empty posts), the GPU fire, the leak card, phone.
- A preview link is posted.
- FLT-17's hand-off to FLT-32 (`docs/DISASTERS.md`): the Disasters menu is `disasterMenu(state)` (id, name, blurb, tags, active, available, reason) plus the two commands; "asks for confirmation" is the UI's. `disastersView(state)` gives the running ones (phase, progress 0..1, days) for a `DisasterAlert` slot. The palette tile for the Security Office. Icons for `tags`.

---
**Lead additions after the FLT-17 sim merged (PR #32):**
- The sim is on `main`: five disasters in `mods/base-disasters/`, verbs in `src/sim/verbs.ts`, `disaster`/`setRisk` commands, the `?disaster=`/`?risk=` hooks, a Security Office building, and a "!" over diverted staff. Read `docs/DISASTERS.md`.
- **Default risk is currently `off`** (the lead changed it from `rare` because of Jem's "overwhelming" feedback). In this task:
  - Show the Off / Rare / Normal / Chaos setting in the Disasters menu, and in Frontier 95 under Start ▸ Settings ▸ Disasters….
  - Add a **calm-start grace**: no random disaster before the player's first release and day 60. This is a small, additive sim guard in `driver.ts`, with a test.
  - Then switch `DEFAULT_RISK` back to **`rare`**.
- Add the **Security Office** to the build palette and Start menu (it has no tile yet).
- **Leak visibility:** when a Weights Leak lifts a rival, show the jump on the Arena immediately (an out-of-cycle re-rank flash), not only at the weekly re-rank.
- Render trust and regulator heat (0–100, new in FLT-17) somewhere unobtrusive, e.g. the Lab Properties ▸ Finance tab in Frontier 95.

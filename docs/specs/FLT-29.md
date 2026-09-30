# FLT-29: Tutorial & pacing UI: assistant messages, highlights, skip, paused indicator

**Tutorial and pacing UI** (2D, so Sonnet 5.5 builds it, per Jem's routing). It follows FLT-16 (which does the sim, balance and tutorial logic), and it uses FLT-14's skin system if that has merged.
- Render the tutorial's assistant messages through the `Assistant` slot (the paperclip in Frontier 95, the base assistant otherwise): one sentence per step, plus **Next**/**Skip** buttons.
- **Highlights:** a pulsing ring or glow on whatever the current step targets (the build-bar item, the Start-menu entry, the Staff panel button), with skinnable tokens.
- An always-visible **"Skip tutorial"** control, plus a gentle **"Paused"** indicator whenever the sim is auto-paused (the Frontier 95 skin can show it as a tray icon).
- Phone: messages sit above the build bar and never cover the targeted button.
- **Done when:** minutes 0–10 at 1× on a clean start look calm and clear (a screenshot every ~60 s), and it works in every installed skin. It's a Jem-gated merge: post the preview and ping the lead.

---
**Integration plan (lead, Sep 30).** PR #26 (FLT-14 skins) and PR #27 (FLT-16 pacing) both await Jem's play-test, and they **conflict**: FLT-14 moved `HUD.tsx`, `Objectives.tsx`, `Thoughts.tsx`, `newsroom/*`, `ops/Staff.tsx` and `race/RacePanel.tsx` into skin slots, while FLT-16 edited those old files for its hint and overlay wiring. This task is the integration:
1. Branch from `origin/flt-14-skins`, then `git merge origin/flt-16-first-run`. Resolve by **porting FLT-16's UI wiring into the slot system**: the waiting-hint acknowledge, the auto-pause overlay, and the News Room and Mixer changes. Keep FLT-16's sim, logic and tests untouched.
2. Build the tutorial UI from the spec above through the `Assistant` slot (the Frontier 95 paperclip, and the base assistant in the other skins). The tutorial VM is `{step, message, highlight, paused, canSkip}` plus `continueTutorial`/`skipTutorial` (see `docs/ARCHITECTURE.md` on the FLT-16 branch). Acknowledging should be obvious: a **Next** button, not "tap the hint".
3. **Layout follow-ups from the FLT-14 review:**
   - (a) The right column becomes a managed stack: windows tile, and the oldest auto-minimises when they don't fit.
   - (b) The assistant balloon anchors bottom-right above the tray and never covers windows. Toasts queue inside it.
   - (c) The News Room button no longer overlaps the Thoughts header (in every skin).
4. **Evidence:** before/after on `main` vs this branch; a 0–10 minute sequence at 1× with no params, in Frontier 95 and in one stub skin; and phone.
5. **Merge order (after Jem OKs):** merge #26, then this PR (it contains #27's commits), then close #27 as landed via this PR. **Don't merge it yourself.**

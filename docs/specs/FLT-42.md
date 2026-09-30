# FLT-42: Skin port: Swag Drop (desk merch, flattened)

**Port: Swag Drop**, the HUD as a lab's desk merch (the round-1 mockup `swag-drop.html`), **flattened to fit the 90s family.** Keep the objects, and use hard shadows and less gloss than the mockup.
- **Stats:** a paper plaque with **enamel pins** (a big Vibes pin; cash, runway, capability and hype pins).
- **Training:** an instrument gauge.
- **OKRs:** **sticky-note OKRs**.
- **Build bar:** **mechanical keycaps** that sink when pressed (the price on the front band, the hotkey legend).
- **Inspector:** a **lanyard ID badge** that drops and swings (it flips over to show history; agents get a cyan "CONTRACTOR (NON-HUMAN)" variant).
- **Thoughts:** a corkboard with push-pin counts.
- **Event card:** a memo on letterhead with a rubber stamp.
- **Toasts:** stickers.
- **Ticker:** terminal-style.
- **Type:** Bricolage Grotesque + JetBrains Mono.

---
**How to port (every skin):**
- **Reference:** `docs/mockups/flt-14/swag-drop.html` (open it and reuse its CSS) and the stub in `src/skins/swag-drop/`. The guide is `docs/SKINS.md`. Frontier 95 (`src/skins/frontier-95/`) is the model of a *full* skin: tokens, strings, CSS **and** custom `slots.tsx` where the mockup's chrome can't be done with CSS alone.
- **Contract:** skins get `vm` + `actions` only, and never import the sim, the store or three (a test enforces this). Every slot must render. Keep the ≥ 4.5:1 text contrast and the ≥ 44px tap targets, and don't re-render every frame.
- **Fonts:** bundle OFL fonts with their licence files (no hot-linking). Pixel faces must keep **5 and S distinct** in numbers (prefer Jersey 10 for digits).
- **Parody names only** in any skin-specific copy.
- **Evidence (Jem's rule):** `pnpm shots --scenes skins --skin swag-drop --diff --out docs/img/flt-14-ports/swag-drop`, before (the stub) vs after (the full skin), plus phone. Include the strict perf number.
- **Merge:** open the PR and **don't merge**; the lead reviews and merges. After all five, the lead posts a six-skin gallery.
- **Lane:** `src/skins/swag-drop/**`, and `docs/img/flt-14-ports/swag-drop/**`. If you need a new slot or VM field, add it additively in `src/ui/hud/**` and say so in the PR, since other port builders run in parallel. FLT-29 is changing the right-column Layout and assistant anchoring; merge `origin/main` before you open the PR.

# FLT-41: Skin port: Homepage '98 (the lab's 1998 home page)

_Renamed after review (parody-only rule): the skin was called GeoCities in the task; its display name is now **Homepage '98**, id and folder `homepage-98`. The mockup files under `docs/mockups/flt-14/` keep their historical `geocities.*` names._

**Port: Homepage '98**, the lab's 1998 home page (the round-2 mockup `geocities.html`). Tiled sky/parchment backgrounds, `ridge` borders, Times, and blue/purple visited links.
- **Stats:** "Welcome to {lab}'s Home Page!!!", plus a **hit counter as Vibes** ("You are visitor # 000636") and a bordered table of stats.
- **Training:** an **Under Construction** box (hazard tape, a digging worker gif-as-SVG).
- **OKRs:** "My Goals for Q1!!" as a bulleted link list with NEW!/DONE badges.
- **Inspector:** an **About Me** page ("current mood", "current music: GPU fans", Sign her guestbook).
- **Thoughts:** guestbook entries ("{name} wrote:").
- **Build bar:** **The AI Labs WebRing** with 88×31 buttons (Prev/Next links).
- **Speed:** grey form buttons.
- **Ticker:** a navy **marquee**.
- **Toasts:** pop-up windows with "Click here!!!".
- **Event card:** a pop-up window.
- **Easter egg:** "Best viewed in Netscape Navigator 3.0".
- **Type:** Tinos (Apache 2.0) + Jersey 10 + VT323.

---
**How to port (every skin):**
- **Reference:** `docs/mockups/flt-14/geocities.html` (open it and reuse its CSS) and the stub in `src/skins/homepage-98/`. The guide is `docs/SKINS.md`. Frontier 95 (`src/skins/frontier-95/`) is the model of a *full* skin: tokens, strings, CSS **and** custom `slots.tsx` where the mockup's chrome can't be done with CSS alone.
- **Contract:** skins get `vm` + `actions` only, and never import the sim, the store or three (a test enforces this). Every slot must render. Keep the ≥ 4.5:1 text contrast and the ≥ 44px tap targets, and don't re-render every frame.
- **Fonts:** bundle OFL fonts with their licence files (no hot-linking). Pixel faces must keep **5 and S distinct** in numbers (prefer Jersey 10 for digits).
- **Parody names only** in any skin-specific copy.
- **Evidence (Jem's rule):** `pnpm shots --scenes skins --skin homepage-98 --diff --out docs/img/flt-14-ports/homepage-98`, before (the stub) vs after (the full skin), plus phone. Include the strict perf number.
- **Merge:** open the PR and **don't merge**; the lead reviews and merges. After all five, the lead posts a six-skin gallery.
- **Lane:** `src/skins/homepage-98/**`, and `docs/img/flt-14-ports/homepage-98/**`. If you need a new slot or VM field, add it additively in `src/ui/hud/**` and say so in the PR, since other port builders run in parallel. FLT-29 is changing the right-column Layout and assistant anchoring; merge `origin/main` before you open the PR.


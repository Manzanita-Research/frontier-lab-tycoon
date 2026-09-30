# FLT-14: Visual design pass on the 2D UI (HUD, panels, bubbles, ticker)

**A skin system for the whole 2D UI, plus six skins. Default: Frontier 95.** Label: explore. Jem is in the loop: Frontier 95's before/after goes to Jem **before merging**.

Jem: *"Can you implement theming in a way that we can swap things out? Would be sick if you could literally mod/skin the entire UI… this whole game should be agent native… designed for vibecoded mods to be shared with your friends. So maybe we do all 6 options and the game ships with all of them."*

**Visual reference:** `docs/mockups/flt-14/` (six HTML/CSS mockups + JPGs; open them in a browser). Frontier 95 = `frontier-95.html`.

## Phase 1 (one Sonnet 5.5 builder): the skin system + Frontier 95

### 1. The HUD view-model (this is the modding contract)
- `src/ui/hud/vm.ts`: one pure function `hudViewModel(snapshot) → HudVM`, plus a typed `HudActions` (`place(kind)`, `setSpeed(n)`, `choose(eventId, i)`, `follow(walkerId)`, `closeInspector()`, `dismissToast(id)`, …).
- `HudVM` is plain JSON: `stats` (lab name, date, vibes + trend, cash + delta, runway + warning, capability, hype, arena rank), `training`, `objectives[]`, `inspector | null`, `buildItems[]` (kind, name, price, affordable, hotkey, icon id, selected), `speed`, `bubbles[]` (screen x/y, text, speaker kind and label), `ticker[]` (text, tone), `toasts[]`, `event | null` (title, body, tone, choices with effect hints), `thoughtsPanel[]`, `arena[]`, `eraCard | null`, `newsroom` (front page / chat when open), `photoMode`.
- **Skins never import `src/sim/**`, the store or three.** They get `vm` + `actions` only. This makes skins safe to write, easy for agents to vibecode, and stable across sim changes. Unit-test `hudViewModel` against fixture snapshots.

### 2. Skin format (skin v1, also the first mod type in FLT-15)
```
src/skins/<id>/
  skin.json        # JSON-only: id, name, author, version, description, tokens{}, strings{}, fonts[], preview, apiVersion: 1
  skin.css         # scoped under [data-skin="<id>"]; may use only its own tokens + classes
  assets/          # fonts (with licence files), images, icons (SVG sprite)
  slots.tsx        # OPTIONAL: React components replacing HUD slots (built-in skins only for now; FLT-15 decides third-party code)
```
- **Tokens** (CSS custom properties), in categories: `color.*`, `font.*` (display, ui, mono, numbers), `space.*`, `radius.*`, `border.*` / `bevel.*` (so Win95 bevels are tokens, not hacks), `shadow.*`, `motion.*` (durations and easings, plus reduced-motion variants). A base token set lives in `src/skins/base/`, and each skin overrides it.
- **Strings:** skins may re-label UI copy through keys (`speed.pause` = "Rest", `build.menuTitle` = "Start", `inspector.title` = "Properties of {name}", `ticker.label` = "PointPast News ▸"). Game content (headlines, thoughts) is not a skin concern.
- **Slots** (each gets `{ vm-slice, actions }`, with a default base implementation): `Stats`, `Training`, `Objectives`, `Inspector`, `BuildBar`, `Speed`, `Bubble`, `ThoughtsPanel`, `Ticker`, `Toast`, `Assistant` (the tips/hints host; Frontier 95's paperclip), `EventCard`, `Arena`, `EraCard`, `FrontPage`, `GroupChat`, `PhotoOverlay`, `SkinPicker`. Also a `Layout` slot that places the others, so a skin can move things; Win95 puts Speed in the taskbar tray.
- **Registry:** `import.meta.glob('src/skins/*/skin.json')` + lazy `slots.tsx`/CSS/fonts, so only the active skin's assets load. The active skin is read from `?skin=<id>`, then `localStorage["flt.skin"]`, then `frontier-95`, and it switches **live** with no reload and no sim reset.
- **Validation:** `src/skins/schema.ts` (Effect Schema) validates `skin.json`. A skin with unknown slots, missing required tokens or `apiVersion ≠ 1` is refused with a readable error, and the game falls back to the default.
- **Tests:** every skin renders every slot from a fixture `HudVM` without throwing (`react-dom/server` `renderToString` in vitest). Token contrast checks: text vs panel ≥ 4.5:1, big numerals ≥ 3:1. Each skin's `skin.json` validates.

### 3. Frontier 95, the default skin (build it to match `frontier-95.html`, then add the extras below)
- **Stats:** a "Lab Properties" window (title bar with _ □ ×, tabs General / Finance / Arena / Vibes) with a **Minesweeper-style red LED counter** for Vibes, inset fields, and a blocky navy progress bar for hype.
- **Training:** a **file-copy dialog** ("Copying the internet into Frontier-3…", "about 18 days remaining", a greyed-out Cancel).
- **Objectives:** desktop **sticky notes**, flat yellow with 1px borders.
- **Inspector:** a **"Properties of Dr. Ada Gradient"** dialog with the **laminated ID badge** inside (navy header, pixel portrait, barcode, dithered hologram), need bars as blocky progress bars, the thought in a read-only inset box, and Follow / OK / Cancel.
- **Build bar:** the **Start button** opens a **Start menu** (a vertical "Frontier 95" banner with a dithered side strip, 16–24px pixel icons, name, price, disabled rows for what you can't afford, then Bulldoze… and **"Shut Down Lab…"**, which opens a joke confirm dialog). Quick-launch icons for the three most-used buildings. Hotkeys still work.
- **Speed:** tray buttons in the taskbar, labelled with Discovery Disc's **pace words** as tooltips (Rest / Steady / Strenuous / Grueling), plus the clock ("Y1 Jan 30 · 10:12 AM").
- **Ticker:** an inset **"PointPast News ▸"** strip in the taskbar.
- **Bubbles:** yellow `#FFFFE1` **tooltips** with a 1px black border and a bold speaker line.
- **Assistant:** a **paperclip** with a yellow balloon, bottom-right, that hosts hints and toasts ("It looks like you're building a superintelligence! Would you like help? ◯ Get help with alignment ◯ Just ship it faster ◯ Don't show me this tip again"). Its tips come from a content file of about 20 lines.
- **Event card:** a Win95 **message box** (⚠ / ℹ / ✖ icons by tone) with choices as buttons, the first one being the default button (thick border).
- **Arena:** a "Task Manager"-style list with columns (Lab, Model, Score, Δ).
- **Era card:** a friendly full-screen **blue screen**: "A fatal exception 0E has occurred at CAPABILITY:∞. Press any key to continue to ERA 2: CODING AUTOMATION."
- **Front page:** an "Internet Explorer 3" window showing the paper. **Group chat:** an **ICQ-style** window ("Uh oh!"). **Photo mode:** a "Paint" window frame ("Save As… campus.bmp").
- **Skin picker:** a **"Display Properties → Appearance"** dialog with a "Scheme" dropdown listing all installed skins, each with a thumbnail. It's reachable from the Start menu ("Settings ▸ Display…").
- **Garnish from Discovery Disc:** 2–3 flat primary-colour **clip-art stickers** stuck on windows (a "★ SUPER VIBES" star on Lab Properties when Vibes > 600, a "SHIPPED!" sticker on the training dialog right after a release).
- **Type:** **W95FA** for UI text (OFL 1.1, from FontsArena; bundle the woff2 and `OFL.txt`, never hot-link) at ≥ 16px, and **Jersey 10** (`@fontsource/jersey-10`, OFL) for the LED digits and big numbers. Keep a font-token slot open for Chalmers, in case Jem buys it (1–2 styles × $10 + web licence, which is Jem's purchase).
- **Look rules:** flat. 1px bevels with light top-left and dark bottom-right, hard edges, navy `#000080` title bars, `#C0C0C0` chrome. No blur, gloss or soft shadows. Dithering is allowed as a pattern.
- **Phone (≤ 480px):** windows open maximized as sheets, and the taskbar stays at the bottom with Start. The Lab Properties window collapses to a single title-bar-height strip showing Vibes, cash and runway (tap to open). The campus shows at rest on ≥ 55% of the screen.
- **A11y and perf:** tap targets ≥ 44px, a visible focus rectangle (Win95's dotted focus ring counts), a reduced-motion setting, and no per-frame re-renders beyond the existing ~5 Hz snapshot.

### 4. The other five skins in Phase 1: **thin stubs only**
Create `skin.json` with tokens and fonts plus `skin.css` for **Swag Drop, Karaoke Night, Field Almanac, Discovery Disc '96 and GeoCities**, with the right palette and type, and the base slots restyled through tokens alone. No custom `slots.tsx`. That proves the system switches between six real skins. Full ports come in Phase 2.

### Evidence and gate (Phase 1)
- **Before** screenshots first, from `main` before any change: (a) overview 1440×900, (b) inspector open, (c) the Water Discourse event card, (d) Start menu / build bar open, (e) phone 390×844, (f) photo mode.
- **After**: the same six in Frontier 95, plus one overview per stub skin (6 in total, showing the switch works).
- Post the pairs and a preview link on FLT-14, set FLT-14 to `in_review`, and **don't merge**. The lead reviews, then Jem approves, and then merge.

## Phase 2 (after Jem approves Frontier 95): full ports, two builders at a time
Five sub-tasks, one per skin, each porting its mockup into a full skin with custom slots where the mockup calls for them: Swag Drop's lanyard badge and keycaps, Karaoke Night's karaoke ticker with a bouncing ball, Field Almanac's specimen card, Discovery Disc's Field Trip Badge, stamps and pace, and GeoCities' hit counter, About Me, 88×31 webring and marquee. **Builders: Codex Sol 6.1 (`gpt-6.1-sol`)**, to spare Claude usage; the lead (Opus) reviews each one. Evidence per skin: 4 screenshots (overview, inspector, event card, phone). They merge on green plus the lead's review. Afterwards the lead posts a **gallery of all six** on FLT-14.


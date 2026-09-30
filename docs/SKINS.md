# Making a skin

A **skin** re-dresses the game's whole 2D UI: the stats, the build bar, the thought bubbles, the event cards, the news ticker, all of it. Six ship with the game (Frontier 95, Swag Drop, Karaoke Night, Field Almanac, Discovery Disc '96, Homepage '98) and you can add yours by adding a folder. Skins switch **live** (no reload, the game keeps running) and this format is also the first kind of mod (FLT-15).

This page is the whole manual. It is written to be read by a person or by an agent that has never seen the repo. If you only read one section, read [the five-minute skin](#the-five-minute-skin).

- [The idea](#the-idea) · [Five-minute skin](#the-five-minute-skin) · [Folder layout](#folder-layout) · [skin.json](#skinjson) · [Tokens](#tokens) · [Strings](#strings) · [skin.css](#skincss) · [Slots](#slots) · [Writing slots.tsx](#writing-slotstsx) · [The view-model](#the-view-model-and-actions) · [Fonts](#fonts-and-licences) · [Validation](#validation-and-what-happens-when-a-skin-is-refused) · [Trying it](#trying-a-skin) · [Rules](#rules) · [Checklist for agents](#checklist-for-agents)

## The idea

```
   the game (sim, store, three)            never seen by a skin
            │
     hudViewModel(snapshot)      src/ui/hud/vm.ts: one pure function, unit-tested
            │
         HudVM (plain JSON)  +  HudActions      src/ui/hud/types.ts: the whole contract
            │
   ┌────────┴──────────────────────────────┐
   │ skin = tokens + strings + CSS (+ slots)│      src/skins/<id>/
   └────────────────────────────────────────┘
```

A skin gets **`vm` + `actions`** and nothing else. It never imports `src/sim/**`, the store or three (a test fails the build if one does). That is why a skin is safe to write, easy to vibe-code, and does not break when the sim changes. `src/ui/hud/types.ts` is the one file to read to know everything a skin can see and do.

There are three levels of restyling, and you can stop at any of them:

1. **Tokens only** (`skin.json`): colours, fonts, radii, borders, shadows, motion. The whole HUD changes.
2. **Tokens + CSS** (`skin.css`): restyle any part of the base markup by its class names. The five stub skins are this.
3. **Slots** (`slots.tsx`): replace whole components (the Inspector as a lanyard badge, the Start menu, a karaoke ticker). Frontier 95 replaces all of them.

## The five-minute skin

Copy a folder, change five things.

```sh
cp -r src/skins/swag-drop src/skins/my-skin
```

1. `src/skins/my-skin/skin.json`: set `"id": "my-skin"` (must equal the folder name), `name`, `author`, `description`.
2. Edit `tokens`. Start with the three that matter most: `color.panel`, `color.text`, `color.accent`.
3. In `skin.css`, replace every `swag-drop` with `my-skin` (it is the scope: `[data-skin="my-skin"]`).
4. Swap the font files in `assets/fonts/` (keep each licence file beside its font) and edit `fonts` in `skin.json`.
5. Drop a screenshot at `assets/preview.png` (about 320×200).

Then open `http://localhost:5173/?skin=my-skin`. It also shows up in the skin picker. Run `pnpm test`: it validates your `skin.json`, checks contrast, checks your CSS is scoped, and renders every slot from a fixture.

The smallest valid `skin.json` (every required token; `slots` and `fonts` may be empty):

```json
{
  "apiVersion": 1,
  "id": "midnight",
  "name": "Midnight",
  "author": "You",
  "version": "1.0.0",
  "description": "Dark, calm, and easy on the eyes.",
  "preview": "assets/preview.png",
  "slots": [],
  "fonts": [],
  "strings": { "ticker.label": "AFTER HOURS" },
  "tokens": {
    "color.bg": "#0b1020", "color.panel": "#151c33", "color.panelAlt": "#1e2846",
    "color.text": "#eef1ff", "color.line": "#5468b5", "color.accent": "#ffb454",
    "color.good": "#5ee2a0", "color.bad": "#ff7a90", "color.numeral": "#ffd479",
    "font.ui": "system-ui, sans-serif", "font.display": "system-ui, sans-serif", "font.numbers": "ui-monospace, monospace",
    "radius.panel": "10px", "border.width": "2px", "shadow.panel": "0 6px 0 #05070f"
  }
}
```

## Folder layout

```
src/skins/<id>/
  skin.json        # JSON only. Everything the registry needs to know before it loads anything else.
  skin.css         # Scoped under [data-skin="<id>"]. Optional in spirit, required by the tests.
  slots.tsx        # OPTIONAL. `export default { Stats, Inspector, ... }`. Built-in skins only for now.
  assets/
    preview.png    # required: the thumbnail in the skin picker (also .jpg, .webp, .gif or .svg)
    fonts/         # woff2 / woff / ttf / otf, each with its licence text beside it
    ...            # images, icons; reference them from skin.css with url(./assets/x.png)
src/skins/base/    # the base skin: tokens.json, strings.json, base.css, and a complete set of slots
src/skins/kit/     # helpers a skin may import (Odometer, Marquee, Portrait, Senator, Dialog, money, reducedMotion)
src/skins/schema.ts, registry.ts, types.ts   # the loader; you do not edit these
```

Only the **active** skin's CSS, slots and fonts are loaded (Vite splits them into their own chunks). The base skin (`src/skins/base`) is always there: a skin starts from it and only says what differs.

## skin.json

| Field | Type | Notes |
|---|---|---|
| `apiVersion` | `1` | Anything else is refused. Bumped only when `HudVM`/`HudActions` change in a non-additive way. |
| `id` | string | `a-z`, `0-9` and dashes; **must equal the folder name**. It is used in CSS selectors. |
| `name`, `author`, `description` | string | Shown in the skin picker. |
| `version` | `"1.2.3"` | Semver. |
| `preview` | `"assets/preview.<ext>"` | Picker thumbnail. |
| `tokens` | `{ "color.panel": "#fff", ... }` | See [Tokens](#tokens). All **required** tokens must be present; the rest fall back to the base. Names must be known tokens, or your own under the `x.` prefix (`"x.sparkle": "#f0f"` → `--flt-x-sparkle`). |
| `strings` | `{ "speed.pause": "Rest" }` | Relabels UI copy. Keys must exist in the [strings table](#strings). |
| `fonts` | `[{ family, src, weight?, style?, license, licenseFile }]` | Bundled files only. `src` and `licenseFile` are paths inside the skin folder. Licence must be OFL, Apache, MIT or CC0. |
| `slots` | `["Stats", ...]` | The slots your `slots.tsx` replaces. `[]` for a tokens+CSS skin. Must match the exports of `slots.tsx` exactly. |

Token values are written into a stylesheet, so they may not contain `{ } ; < >`, `url(`, `@import` or backslashes.

## Tokens

Tokens are CSS custom properties named `--flt-<category>-<name>` (`color.panel` → `--flt-color-panel`). The base defines all of them; a skin overrides some. In your own CSS, read them with `var(--flt-color-panel)`. Categories: `color.*`, `font.*`, `space.*`, `radius.*`, `border.*`, `bevel.*` (so a Win95 bevel is four colours, not a hack), `shadow.*` and `motion.*`.

**Motion and reduced motion.** Use `var(--flt-motion-base)` for durations. Under `prefers-reduced-motion: reduce`, or when the player ticks "Reduce motion" in the skin picker (`<html data-motion="reduced">`), the loader swaps `--flt-motion-fast|base|slow|pulse` for their `motion.reduced.*` variants. Keyframe animations you write yourself must switch off under the same two conditions (see Frontier 95's CSS for the pattern).

**Contrast is tested** for every skin: `color.text` ≥ 4.5:1 on `color.panel`, `color.panelAlt` and `color.inset`; `color.textDim` ≥ 4.5:1 on the panel; `color.numeral` ≥ 3:1 on `color.numeralBg`; and the tooltip, selection, title-bar and accent pairs ≥ 4.5:1.

| Token | CSS variable | Base value | Required | What it is |
|---|---|---|---|---|
| `color.bg` | `--flt-color-bg` | `#8fd0ee` | **yes** | Page colour behind the game (the sky mostly covers it). |
| `color.panel` | `--flt-color-panel` | `#fff3d6` | **yes** | Background of the main panels. **Text (`color.text`) must be ≥ 4.5:1 on it.** |
| `color.panelAlt` | `--flt-color-panelAlt` | `#ffe8b8` | **yes** | A second surface: hovers, title strips, chips. Text must be ≥ 4.5:1 on it too. |
| `color.inset` | `--flt-color-inset` | `#fff8e6` |  | Sunken fields and lists (input wells, the thoughts list). Text must be ≥ 4.5:1 on it. |
| `color.text` | `--flt-color-text` | `#3a2a1c` | **yes** | Body text and the default ink. |
| `color.textDim` | `--flt-color-textDim` | `#7a6650` |  | Secondary text (captions, hints). ≥ 4.5:1 on the panel. |
| `color.line` | `--flt-color-line` | `#3a2a1c` | **yes** | Borders and outlines. |
| `color.accent` | `--flt-color-accent` | `#ff8a4c` | **yes** | The primary accent: the selected tool, the Follow button, the Arena you-row. |
| `color.accentText` | `--flt-color-accentText` | `#3a2a1c` |  | Text on `color.accent`. ≥ 4.5:1. |
| `color.good` | `--flt-color-good` | `#2c9a58` | **yes** | Good news and rising numbers. ≥ 3:1 on the panel. |
| `color.bad` | `--flt-color-bad` | `#d6452f` | **yes** | Bad news, low runway, falling numbers. ≥ 3:1 on the panel. |
| `color.warn` | `--flt-color-warn` | `#f2a020` |  | Warnings that are not yet bad. |
| `color.info` | `--flt-color-info` | `#4f8ff0` |  | Neutral highlights (era pill, links). |
| `color.numeral` | `--flt-color-numeral` | `#3a2a1c` | **yes** | The big numbers (Vibes, cash, the R&D multiplier). |
| `color.numeralBg` | `--flt-color-numeralBg` | `#fff3d6` |  | What the big numbers sit on (the LED's black, or the panel). `color.numeral` must be ≥ 3:1 on it. |
| `color.titlebar` | `--flt-color-titlebar` | `#ffe8b8` |  | Window title bars and card stripes. |
| `color.titlebarText` | `--flt-color-titlebarText` | `#3a2a1c` |  | Text on title bars. ≥ 4.5:1. |
| `color.tip` | `--flt-color-tip` | `#fffdf5` |  | Tooltips and thought bubbles. |
| `color.tipText` | `--flt-color-tipText` | `#3a2a1c` |  | Text on tooltips. ≥ 4.5:1. |
| `color.selection` | `--flt-color-selection` | `#3a2a1c` |  | Selected rows, dark chips, the ticker. Paired with `color.selectionText`. |
| `color.selectionText` | `--flt-color-selectionText` | `#fff3d6` |  | Text on `color.selection`. ≥ 4.5:1. |
| `color.highlight` | `--flt-color-highlight` | `#7a3cff` |  | The ring the coach draws round the one thing to click (and its pulse). ≥ 3:1 on the panel. |
| `color.scrim` | `--flt-color-scrim` | `rgba(22, 20, 46, 0.58)` |  | The dimming over everything but the coach's spotlight. |
| `color.meterFrom` | `--flt-color-meterFrom` | `#ffb347` |  | Progress meters: the start of the gradient (a flat skin sets both ends the same). |
| `color.meterTo` | `--flt-color-meterTo` | `#ff6a4c` |  | Progress meters: the end of the gradient. |
| `font.ui` | `--flt-font-ui` | `ui-rounded, "SF Pro Rounded", "Nunito", "Varela Round", system-ui, sans-serif` | **yes** | Body font stack. |
| `font.display` | `--flt-font-display` | `ui-rounded, "SF Pro Rounded", "Nunito", "Varela Round", system-ui, sans-serif` | **yes** | Titles and headings. |
| `font.numbers` | `--flt-font-numbers` | `ui-rounded, "SF Pro Rounded", "Nunito", "Varela Round", system-ui, sans-serif` | **yes** | The big numerals. Pick a face where 5/S and 0/O read apart. |
| `font.mono` | `--flt-font-mono` | `ui-monospace, "SF Mono", Menlo, Consolas, monospace` |  | Monospace (terminal ticker, code-ish things). |
| `font.size` | `--flt-font-size` | `16px` |  | Base size of the HUD (16px or more). |
| `font.weight` | `--flt-font-weight` | `700` |  | Base weight (`700` is the classic look; pixel faces want `400`). |
| `space.1` | `--flt-space-1` | `4px` |  | Spacing scale, smallest. |
| `space.2` | `--flt-space-2` | `8px` |  | Spacing scale. |
| `space.3` | `--flt-space-3` | `12px` |  | Spacing scale. |
| `space.4` | `--flt-space-4` | `16px` |  | Spacing scale, largest. |
| `radius.panel` | `--flt-radius-panel` | `16px` | **yes** | Corner radius of panels and windows. |
| `radius.button` | `--flt-radius-button` | `10px` |  | Corner radius of buttons and chips. |
| `radius.pill` | `--flt-radius-pill` | `999px` |  | Fully round things. |
| `radius.bubble` | `--flt-radius-bubble` | `12px` |  | Thought bubbles. |
| `border.width` | `--flt-border-width` | `3px` | **yes** | Width of panel borders. |
| `border.style` | `--flt-border-style` | `solid` |  | `solid`, `outset`, `dashed`... |
| `bevel.light` | `--flt-bevel-light` | `#ffffff` |  | Win95-style bevel: the light top-left edge. Used with the three below as a token, not a hack. |
| `bevel.dark` | `--flt-bevel-dark` | `#000000` |  | Bevel: the dark bottom-right edge. |
| `bevel.shade` | `--flt-bevel-shade` | `#808080` |  | Bevel: the mid-tone inner edge. |
| `bevel.face` | `--flt-bevel-face` | `#c0c0c0` |  | Bevel: the face colour of raised things. |
| `shadow.panel` | `--flt-shadow-panel` | `0 4px 0 rgba(58, 42, 28, 0.85), 0 10px 18px rgba(58, 42, 28, 0.25)` | **yes** | Box shadow of panels (`none` for a flat skin). |
| `shadow.pop` | `--flt-shadow-pop` | `0 3px 0 rgba(58, 42, 28, 0.8)` |  | Box shadow of small raised things (buttons, badges). |
| `motion.fast` | `--flt-motion-fast` | `120ms` |  | Short transition. |
| `motion.base` | `--flt-motion-base` | `240ms` |  | Normal transition. |
| `motion.slow` | `--flt-motion-slow` | `700ms` |  | Long transition. |
| `motion.ease` | `--flt-motion-ease` | `cubic-bezier(0.2, 0.8, 0.2, 1)` |  | Easing curve. |
| `motion.pulse` | `--flt-motion-pulse` | `1600ms` |  | One pulse of the coach's ring. |
| `motion.reduced.fast` | `--flt-motion-reduced-fast` | `0ms` |  | What `motion.fast` becomes under reduced motion (the OS setting or the Display dialog's switch). |
| `motion.reduced.base` | `--flt-motion-reduced-base` | `0ms` |  | Reduced variant of `motion.base`. |
| `motion.reduced.slow` | `--flt-motion-reduced-slow` | `0ms` |  | Reduced variant of `motion.slow`. |
| `motion.reduced.pulse` | `--flt-motion-reduced-pulse` | `0ms` |  | Reduced variant of `motion.pulse` (the ring stays, it stops pulsing). |

## Strings

Skins may re-label copy by key: `"speed.pause": "Rest"`, `"inspector.title": "Properties of {name}"`, `"ticker.label": "PointPast News »"`. `{name}`-style placeholders are filled in by the game (keep them). A slot reads a string with `const t = useT(); t("speed.pause")` or `t("inspector.title", { name })`. **Game content (headlines, thoughts, event text) is not a skin concern**: it comes through the view-model and is the same in every skin.

If your slot needs copy that has no key, write it into the slot (as Frontier 95 does for its Shut Down dialog); do not invent keys in `skin.json` (unknown keys are refused).

| Key | Default text |
|---|---|
| `stats.window` | {lab} |
| `stats.vibes` | Vibes |
| `stats.cash` | Cash |
| `stats.runway` | Runway |
| `stats.capability` | Capability |
| `stats.hype` | Hype |
| `stats.arena` | Arena |
| `stats.arenaOn` | on Arena |
| `stats.arenaTop` | on top. for now |
| `stats.rd` | AI R&D |
| `stats.era` | Era {n} |
| `stats.tab.general` | General |
| `stats.tab.finance` | Finance |
| `stats.tab.arena` | Arena |
| `stats.tab.vibes` | Vibes |
| `vibes.tipTitle` | Where the vibes come from |
| `vibes.tipFoot` | Vibes ease toward {target} a quarter of the gap a day. They bring visitors, applicants and investors. |
| `training.title` | Training |
| `training.window` | Training {name} |
| `training.copying` | Training {name} |
| `training.eta` | about {n} days remaining |
| `training.cancel` | Cancel |
| `training.shipped` | SHIPPED! |
| `training.noHall` | No Training Hall. Research is on hold. |
| `training.compute` | +{n} compute/day |
| `training.noCompute` | No compute! Build a Compute Cluster. |
| `objectives.title` | Objectives |
| `objectives.daysLeft` | days left |
| `objectives.goal` | Next goal |
| `objectives.by` | By {date} |
| `inspector.title` | {name} |
| `inspector.close` | Close |
| `inspector.thinking` | Thinking |
| `inspector.follow` | Follow |
| `inspector.following` | Following. Tap to let go |
| `inspector.ok` | OK |
| `build.menuTitle` | Build |
| `build.open` | Build |
| `build.close` | Close |
| `build.locked` | Locked |
| `build.help` | Help |
| `build.putAway` | Put the tool away |
| `build.refund` | refund 50% |
| `build.free` | FREE |
| `build.bulldoze` | Bulldoze |
| `build.settings` | Settings |
| `build.display` | Display… |
| `build.shutdown` | Shut Down Lab… |
| `build.placing` | Placing {name} |
| `speed.label` | Game speed |
| `speed.pause` | Pause |
| `speed.1` | 1× speed |
| `speed.3` | 3× speed |
| `speed.10` | 10× speed |
| `speed.short.1` | 1× |
| `speed.short.3` | 3× |
| `speed.short.10` | 10× |
| `thoughts.title` | Thoughts |
| `ticker.label` | NEWS |
| `ticker.aria` | News ticker |
| `hint.gateway` | Build an API Gateway next to a path to start earning. |
| `hint.tap` | Tap anyone to read their mind. |
| `confirm.stripe` | Board memo |
| `confirm.title` | Spend it anyway? |
| `confirm.cost` | Cost |
| `confirm.runway` | Runway after |
| `confirm.ok` | Go ahead |
| `confirm.cancel` | Keep the runway |
| `assistant.title` | Assistant |
| `coach.step` | {n} of {total} |
| `coach.skip` | Skip tutorial |
| `unlock.ok` | Got it |
| `help.title` | How to play |
| `help.loop` | The loop |
| `help.buildings` | What you can build |
| `help.numbers` | The numbers |
| `help.replay` | Replay tutorial |
| `help.close` | Close |
| `event.paused` | Paused |
| `arena.title` | Frontier Arena |
| `arena.week` | Week {n} |
| `arena.loading` | Week 1 loading |
| `arena.leak` | your weights |
| `arena.eraPill` | ERA {n} · {name} |
| `arena.faster` | faster than humans alone |
| `arena.drop` | Free model out: revenue −30% for {days}d |
| `arena.colLab` | Lab |
| `arena.colModel` | Model |
| `arena.colScore` | Score |
| `arena.colDelta` | Δ |
| `bench.title` | Benchmarks |
| `bench.tab` | Benchmarks |
| `bench.colLab` | Lab |
| `bench.sota` | SOTA |
| `bench.solved` | SOLVED |
| `bench.new` | NEW |
| `bench.empty` | No scores yet. The labs are still cooking. |
| `voice.title` | News cycle |
| `voice.you` | You |
| `voice.graph` | Share of the news cycle, last 60 days |
| `stream.live` | LIVE |
| `stream.watching` | {n} watching |
| `stream.chat` | Chat |
| `response.ready` | Ready |
| `response.ship` | Ship now |
| `response.full` | Full release |
| `response.bug` | Launch bug odds |
| `disasters.title` | Disasters |
| `disasters.open` | Disasters |
| `disasters.lede` | Other tycoon games had tornadoes. You have these. |
| `disasters.risk` | Random disasters |
| `disasters.menu` | Start one now |
| `disasters.active` | Under way |
| `disasters.ask` | Start a {name}? |
| `disasters.yes` | Do it. For science. |
| `disasters.no` | Never mind |
| `disasters.close` | Close |
| `disasters.trust` | Public trust |
| `disasters.heat` | Regulator heat |
| `disasters.alert` | Disaster |
| `disasters.more` | Disasters… |
| `eraCard.bsod` | An era has occurred. |
| `outcome.keepPlaying` | Keep playing |
| `outcome.newLab` | New lab |
| `news.button` | News Room |
| `news.open` | Open News Room |
| `news.read` | Read |
| `news.skip` | Skip |
| `news.backCampus` | ← Campus |
| `news.backArchive` | ← Archive |
| `news.paused` | News Room · campus paused |
| `news.close` | Back to campus × |
| `news.skipBack` | Skip and return to campus |
| `sound.title` | Campus sound |
| `sound.mute` | Mute sound |
| `sound.unmute` | Unmute sound |
| `sound.openMixer` | Open sound mixer |
| `audit.who` | Evals Without Borders |
| `report.overall` | Overall |
| `photo.open` | Photo mode (P) |
| `photo.title` | Photo mode |
| `photo.time` | Time of day |
| `photo.shoot` | Take photo (Enter) |
| `photo.done` | Done |
| `skin.open` | Change the look |
| `skin.title` | Choose a skin |
| `skin.apply` | Apply |
| `skin.cancel` | Cancel |
| `skin.reduceMotion` | Reduce motion |
| `staff.title` | Staff |
| `staff.painting` | Painting a patrol zone |
| `staff.hire` | Hire |
| `staff.fire` | Fire |
| `staff.zone` | Zone |
| `stats.moreStats` | More stats |
| `stats.fewerStats` | Fewer stats |
| `inspector.fold` | Fold the card |
| `inspector.more` | Show more |
| `papers.title` | Papers |
| `papers.chip` | Papers |
| `papers.drafts` | {n} to publish |
| `papers.policy` | Publication policy |
| `papers.reputation` | Reputation |
| `papers.pressure` | Publish pressure |
| `papers.preprint` | arXive it |
| `papers.review` | Peer review |
| `papers.empty` | No papers yet. Ship a model and someone will write it up. |
| `papers.close` | Close |
| `moment.drop` | arXive · New submissions |
| `moment.scoop` | Scooped |
| `moment.award` | Certificate of Achievement |
| `moment.theirs` | Theirs |
| `moment.yours` | Yours |
| `moment.you` | you |
| `inv.title` | Security's evidence |
| `inv.bonus` | Eval scores |
| `inv.log` | Outbound traffic from the Compute Cluster |
| `wiki.talk` | Talk |
| `wiki.history` | Revision history |
| `wiki.heartbeat` | heartbeat.txt |
| `wiki.pages` | Pages the agents maintain |
| `wiki.cost` | What it cost |
| `moment.certifies` | This certifies that |
| `moment.awarded` | has been awarded |
| `moment.gap` | They posted it |

## skin.css

`skin.css` is plain CSS with **native nesting** (Vite lowers it for older browsers), and every top-level rule must start with your scope:

```css
[data-skin="midnight"] {
  .panel { background-image: linear-gradient(#ffffff08, transparent); }   /* base markup, by class */
  .tool.on { box-shadow: 0 0 0 2px var(--flt-color-accent); }
  @media (max-width: 640px) { .topbar { padding: 4px 8px; } }             /* media queries go inside */
}
@keyframes midnight-twinkle { 50% { opacity: .4; } }                      /* keyframes: top level, named <id>-* */
```

The test in `src/skins/css.test.ts` enforces: every top-level selector starts with `[data-skin="<id>"]`; keyframes are named `<id>-*`; no `@import`, no `@font-face` (fonts go in `skin.json`), no remote `url()`; and every `var(--flt-*)` you read is a token that exists.

The base markup's class names are the API for tokens+CSS skins. The common ones: `.panel`, `.topbar` (Stats), `.chip` (Training), `.objectives`, `.inspector`, `.buildbar` / `.tool` / `.tool.on`, `.speed`, `.thoughts`, `.ticker` / `.tick`, `.toast`, `.bubble`, `.modal-card` / `.card-stripe` / `.choice`, `.race-panel`, `.news-controls`, `.photo-bar`. Read `src/skins/base/slots/*.tsx` and `base.css` to see the rest.

**House rules for every skin's CSS**

- Tap targets are at least 44px on touch (`@media (pointer: coarse)`) and on phones.
- A visible focus indicator on every button (`:focus-visible`).
- Text is at least 16px in a skin that is meant for reading (13px for captions).
- No animation that cannot be switched off (see Motion above).
- The phone layout (≤ 640px wide) must still leave the campus visible: aim for at least 55% of the screen when nothing is open.

## Slots

A slot is a React component. Each gets **its slice of the view-model plus `actions`**, and returns markup. The base has a complete implementation of every slot; `slots.tsx` replaces any subset.

| Slot | Props | What it draws |
|---|---|---|
| `Layout` | `{ vm, actions, slots }` | Places the *docked* slots (below). `slots` holds each one already rendered, or `null` when there is nothing to show (no walker selected, no news arrival). A skin that moves things about (Frontier 95 puts the speed buttons in a taskbar tray) is a `Layout`. |
| `Stats` | `{ stats, layout, visible, actions }` | Lab name, date, Vibes (with its "where the points come from" breakdown), cash, runway, capability, hype, the Arena chip and R&D multiplier. |
| `Training` | `{ training, actions }` | The current training run, its progress and ETA, "SHIPPED" moment (`training.justShipped`). |
| `Objectives` | `{ objectives, progress, visible, layout, actions }` | The three scenario milestones and the deadline. |
| `Inspector` | `{ inspector, actions }` | The card for the tapped walker: portrait, needs, thought, history, Follow. Only rendered when there is a selection. |
| `BuildBar` | `{ items, tip, teasers, layout, actions }` | The build palette. `items[].kind` is the tool id and the icon id; `actions.place(kind)`. Hotkeys 1–9 are handled by the game. |
| `Speed` | `{ speed, stats, actions }` | Pause / 1× / 3× / 10×. Label them with `t(option.key)`. |
| `Staff` | `{ staff, actions }` | The payroll panel: hire, fire, and paint patrol zones (`staff.painting` is the staffer whose zone is being painted on the map). Rendered only while `staff.open`; it opens from the `staff` tile in the build palette (`buildItems` ends with `{ kind: "staff" }`; `actions.place("staff")` toggles the panel), so every `BuildBar` should draw that tile like any other. |
| `Bubble` | `{ bubble, actions }` | **One** thought bubble. The game pins whatever you render to the walker on every frame, so do not position it. **The root element must have the class `bubble`**: photo mode copies it onto the picture. `bubble.speech` means it is said out loud to the person beside them (a VC's pitch by the Kombucha Bar, FLT-26): draw a speech balloon if your skin tells the two apart. |
| `ThoughtsPanel` | `{ rows, layout, actions }` | Everybody's thoughts, counted; `actions.highlight(row.key)` lights up who thinks it. On a phone (`layout.compact`) the base folds it to an icon. |
| `Ticker` | `{ items, actions }` | The news tape. Use `kit`'s `<Marquee items>`. |
| `Toast` | `{ toast, actions }` | One toast. `toast.tone === "hint"` is a standing hint and `"warn"` a standing warning (both not dismissable: a warning like "your entrance isn't connected" stays until it is fixed). Frontier 95 has no `Toasts` dock: its paperclip draws `vm.warnings` itself. |
| `Assistant` | `{ vm, actions }` | A helper character that hosts hints, toasts and standing warnings (`vm.warnings`). The base draws nothing here; Frontier 95's paperclip lives here. |
| `Confirm` | `{ confirm, actions }` | A modal: a spend (a hire, a build, a path) that would leave the lab under three months of runway, held for a yes or a no. `confirm.message`, `costText` and `runwayText` say what it is; `actions.confirmSpend()` goes ahead, `actions.cancelSpend()` keeps the runway (make that the default: focus it, and Escape or a click outside give it). Time is held while it is up. A skin that does not draw its own gets the base's, so the game can never wait on a box nobody can answer. Frontier 95's is a Win95 warning box. |
| `EventCard` | `{ event, actions }` | The modal news card. `actions.choose(event.id, i)`; the 1–3 keys are handled by the game. |
| `Coach` | `{ coach, anchor, layout, actions }` | The balloon of a **coach mark** (the paperclip in Frontier 95; a card in the base): `coach.text` (one line), `coach.step` of `coach.of`, and a **Skip tutorial** (`actions.coachSkip()`). No Continue button: it waits for the player to do the thing, and never pauses the game. The host draws the dimming and the ring (and finds what to light: see `useCoach` below); `anchor` is where the lit thing is on screen (`null` if it is not there), so put the balloon beside it, never on it (`placeBalloon` from the kit does that). Not docked: the host renders it over everything. |
| `UnlockCard` | `{ unlock, actions }` | The small "New!" card that comes with a level-up (`unlock.title`, `body` and the `items` you can build now). `actions.dismissUnlock()` closes it; the game does not wait for it. |
| `HowToPlay` | `{ help, actions }` | Help ▸ How to play: one window with the loop in five lines (`help.loop`), a line for each unlocked building and what cash, runway, Vibes and hype mean. `actions.coachReplay()` is its "Replay tutorial", `actions.closeHelp()` closes it. |
| `Arena` | `{ arena, leapfrog, layout, actions }` | The R&D multiplier and era, and the Frontier Arena leaderboard (`arena.open` folded or open; `actions.toggleArena()`). It also gets the Release Leapfrog data, so a skin can host the benchmark leaderboard as a tab (Frontier 95's Task Mangler does): compose `useSlots().Benchmarks`. A row's `tag` / `tagText` (`NEW`, `NEMESIS`, `ALUMNI`) marks a lab your own people founded (Defection, the Poaching War); its `title` is then the lab's manifesto. |
| `Benchmarks` | `{ leapfrog, layout, actions }` | The benchmark leaderboard (Release Leapfrog): labs down the side, benchmarks across, your row highlighted, SOTA badges that blink when a record changes hands, benchmaxxed scores asterisked with the excuse underneath, solved benchmarks struck through and stamped SOLVED. Draw it with `kit`'s `<BenchTable leapfrog>` (semantic `bench-*` classes) or your own. Docked: the base Layout puts it under the Arena; a Layout may skip it if `Arena` hosts it. `null` while the pack is off. |
| `Voice` | `{ leapfrog, layout, actions }` | The share-of-voice meter: who has the news cycle (`leapfrog.voice`: shares, owner, trend, and `series` for a graph: `kit`'s `<VoiceGraph voice>`). Docked. Frontier 95: a tray icon and a "Network Traffic" window. `null` while the pack is off. |
| `Livestream` | `{ event, stream, actions }` | The launch livestream mishap card (the dog on stage, the wrong chart). Opens instead of `EventCard` when `event.kind === "stream"`; `stream` has the caption, viewer count and chat lines; answer with `actions.choose`. |
| `Hearing` | `{ event, hearing, actions }` | The Hearing (FLT-21): a question at the witness table, or the gavel. Opens instead of `EventCard` when `event.kind === "hearing"`. `hearing` has the three senators (name, seat, `look` colours for the kit's `Senator` portrait, who is `asking`, how each was `answered`), the Trust and Capture meters, `progressText`, per-answer `moves` (label, arrows, `good`: `null` for Capture, which reads as sly) in the same order as `event.choices`, and `verdict` at the gavel. |
| `LeakedChat` | `{ event, leak, actions }` | The yacht summit's leaked group chat (FLT-24). Opens instead of `EventCard` when `event.kind === "leak"`. `leak` has the group's name, `members`, and `messages` (`name`, rival `color`, `you` for the player's own lines, `system` for "X joined" lines, `time`, `text`); answer with `actions.choose`. |
| `Drama` | `{ event, drama, actions }` | A drama card: Defection's resignation letter and the new lab's manifesto, the Poaching War's recruiter email. Opens instead of `EventCard` when `event.kind === "drama"`. `drama` is the document (`style`: `letter`, `email` or `manifesto`; `file`, `from`, `to`, `subject`, `lines`, `sign`); draw it, then the card, and answer with `actions.choose`. Up to **four** choices. Frontier 95: a WordSad draft, an Outlook Excess message, `MANIFESTO.txt` in NoteBad. |
| `EraCard` | `{ era, actions }` | The full-screen era title card. `actions.continueEra()`; Enter, Space and (after 0.7 s) any key work. |
| `FrontPage` | `{ paper, actions }` | The weekly paper. |
| `GroupChat` | `{ chat, actions }` | The monthly recap chat (messages arrive one by one; `chat.typing`). |
| `PhotoButton` | `{ photo, actions }` | Enters photo mode (`actions.setPhoto(true)`). |
| `PhotoOverlay` | `{ photo, actions }` | Photo mode's controls (time of day, shutter, exit) and the "photo saved" thumbnail. Rendered outside the HUD layer so hiding the HUD does not hide it. Draw only at the edges: the campus is the picture. |
| `SkinPicker` | `{ skins, actions }` | The skin picker. `previewSkin(id)` switches live, `applySkin()` keeps it, `cancelSkinPicker()` goes back. |
| `Outcome` | `{ outcome, actions }` | The win / lose card (`keepPlaying`, `newLab`). |
| `NewsControls` | `{ newsroom, sound, skins, visible, actions }` | The News Room button (with unread count), mute, and (base) the skin picker button. |
| `NewsArrival` | `{ arrival, actions }` | "The Frontier Times is here" (`viewNews(id)`, `skipNews()`). |
| `NewsRoom` | `{ newsroom, actions }` | The News Room modal: the archive, and the open paper or chat (compose `useSlots().FrontPage` / `.GroupChat`, or draw your own). |
| `Mixer` | `{ sound, actions }` | The sound mixer modal. |
| `ModManager` | `{ mods, actions }` | Settings ▸ Mods… (FLT-37): what `?mod=` loaded, clashes and failures, while `mods.open`. Close with `actions.closeMods()`. |
| `Papers` | `{ papers, layout, actions }` | Publish or Perish (FLT-45): the publication policy (`papers.policies`, `actions.setPublicationPolicy(id)`), reputation, the recruiting perk, the publish-pressure meter and the paper list with **arXive it** / **Peer review** on each draft (`actions.publishPaper(paperId, "preprint" \| "peerReview")`). Folds to a chip (`papers.open`, `actions.togglePapers()`). Docked. Draw only when `papers.enabled && visible.papers` (the host already skips it otherwise); it unlocks at Level 5. |
| `PaperMoment` | `{ moment, actions }` | The paper screenshot moments: `moment.kind` is `drop` (a fake arXive listing with yours in the middle, `moment.listing`), `scoop` (their title and timestamp beside yours, `gapText`) or `award` (a certificate). The buttons are jokes; any of them calls `actions.dismissPaperMoment(moment.key)`. Holds time while up (`useAutoPause`). |
| `CrumbWiki` | `{ wiki, actions }` | The agent-collusion reveal (FLT-46): the fan wiki the agents were running, a talk page (`== Heading ==` lines and colon-indented replies), the revision history, the consequences and, for the exposed ending, the scandal front page (`wiki.frontPage`). `actions.closeCrumbWiki(wiki.key)`. Holds time while up. Before the ending nothing names the collusion: the sign card only carries `event.investigation` (draw it with `kit`'s `<Evidence investigation>`, as every shipped skin's `EventCard` does). |
| `DisasterMenu` | `{ disasters, actions }` | The Disasters menu (FLT-32), SimCity-style: the random-disaster setting (`disasters.risks`, Off / Rare / Normal / Chaos; `actions.setRisk(key)`), the list you can start one from (`disasters.menu`: name, blurb, `tags`, `available` or the `reason` it is not, `active`), and the Trust and Heat meters. Starting one must **ask first** ("Start a GPU Fire?"), with the safe answer as the default; then `actions.triggerDisaster(id)`. `actions.closeDisasters()` shuts it; time is held while it is open. Frontier 95's is a Control Panel applet with radio buttons and a Yes/No box. |
| `DisasterAlert` | `{ disasters, layout, actions }` | Docked. What is going wrong now: each run in `disasters.running` (`stage` warning / active / response / aftermath, `phaseLabel`, a funny `line`, cleanup `progress`), and `disasters.understaffed` (who has been pulled off their post; `all` means nobody is left, like an unguarded gate). With nothing going on it is a quiet way into the menu (`actions.openDisasters()`). Frontier 95's is a Win95 fatal-error box. Only rendered once `vm.visible.disasters`. |
| `ReportCard` | `{ event, report, actions }` | Evals Without Borders' report card (FLT-19). Opens instead of `EventCard` when `event.kind === "report"`: five subjects graded A to F with a remark each, the `overall` grade, a `stamp` ("CAUGHT HIDING", "SWARM FOUND") or null, what it did to trust, heat and hype (`moves`), and the Frontier Times' `headline`. Answer with `actions.choose`. |
| `AuditPin` | `{ audit, actions }` | The sign over the auditors' heads (over the gate during the countdown): `audit.line` ("Inspecting the Kombucha Bar"), `stopsText` ("2/4") and a `progress` bar while they stand at a stop (`evals` while they run their own). The game pins it every frame and only draws it while `audit.line` is set. Keep it small: it sits over the 3D scene. |
The **docked** slots (`Layout` receives them pre-rendered) are `Stats`, `Training`, `Objectives`, `Inspector`, `BuildBar`, `Speed`, `Staff`, `ThoughtsPanel`, `Ticker`, `Toasts` (one `Toast` at a time: the newest toast, or the standing hint when nobody is talking), `Assistant`, `Arena`, `Benchmarks`, `Voice`, `Papers`, `NewsControls`, `NewsArrival`, `PhotoButton` and `DisasterAlert`. `AuditPin` is pinned into the scene like `Bubble`. The modal slots (`EventCard`, `Livestream`, `Hearing`, `LeakedChat`, `Drama`, `ReportCard`, `EraCard`, `Outcome`, `NewsRoom`, `Mixer`, `ModManager`, `SkinPicker`, `PaperMoment`, `CrumbWiki`, `DisasterMenu`) and `PhotoOverlay` are rendered by the game when there is something to show.

## Writing slots.tsx

`slots.tsx` default-exports an object of components. List the same names in `skin.json` → `"slots"`; the loader refuses a mismatch either way.

```tsx
// src/skins/midnight/slots.tsx
import type { SkinSlots, SlotPropsMap } from "../types";
import { Odometer, money, useT } from "../kit";

function Stats({ stats, actions }: SlotPropsMap["Stats"]) {
  const t = useT();
  return (
    <div className="midnight-stats">
      <b>{stats.labName}</b> · {stats.date}
      <Odometer value={stats.cash.value} format={money} className="cash" />
      <button onClick={() => actions.toggleArena()}>#{stats.arena.rank} {stats.arena.deltaText}</button>
      <span>{t("stats.runway")}: {stats.runway.text}</span>
    </div>
  );
}

const slots: SkinSlots = { Stats };
export default slots;
```

What a slot may import: `react`; `../types` and `../../ui/hud/types` (types only); `../kit` (Odometer, Marquee, Portrait, Senator, Dialog, BenchTable, VoiceGraph, money, reducedMotion, useT, useSlots, useSkin, useAutoPause, useCoach, ALL_VISIBLE, placeBalloon); files in its own folder. **Nothing else in the game.** Rules for slots:

- **Render from props.** No reading the store, no timers that touch the game. UI-only state (an open tab, whether the Start menu is open) is `useState` inside the slot.
- **Do not call `window` during render** (the tests render on the server). Read `layout.compact` / `layout.phone` from the props for responsive defaults; use `useEffect` for anything with the DOM.
- **Keep numbers cheap.** The view-model refreshes about 5 times a second. Use `<Odometer>` (it writes the DOM directly) for numbers that roll, and CSS for animation. Never animate with React state at frame rate.
- **Thought bubbles are laid out by the game.** At most three show at once, and they nudge apart so they never overlap; the game measures your `Bubble` element to do that, so keep its size honest (no absolute children that escape the box).
- **Keys and focus.** The game owns hotkeys (1–9, Space, Esc, P, and 1–3 on cards). For your own popups use `kit`'s `<Dialog>`, which traps Tab, closes on Esc and keeps the game's hotkeys out while it is open. A non-modal popup (a menu) should not swallow keys.
- Be accessible: real `<button>`s, `aria-label`s on icon-only controls, `role="dialog"` on modals, `aria-pressed` on toggles.
- Parody names only: no real companies, products or people in anything a player can read.

## Playable v1: the ladder, the coach and the build panel

The lab starts small and grows (`vm.progress`, `vm.visible`), and a coach teaches the first minutes (`vm.coach`). What a skin draws:

- **Draw only what is earned.** `vm.buildItems` is already just the unlocked tools (the bulldozer always); `progress.teasers` are the locked ones for the build panel ("🔒 ??? · ship your first model": draw them dim and inert, with `label` and `hint`). `vm.visible` says which HUD panels exist yet: `revenue` (the per-day line, the Finance tab), `vibes` (Vibes, capability, hype), `arena`, `rnd` (the AI R&D number), `thoughts`, `news` (the News Room button and arrivals), `staff`, `events`, `papers`, `disasters`. The host already leaves the Arena, Thoughts, Staff and news arrival slots out of the layout when they are not earned, and the training bar until a hall stands; `Stats`, `Objectives` and `NewsControls` get `visible` so they can hide parts of themselves (`ALL_VISIBLE` from the kit is the default when none is given). At level 1 only cash, runway, the date, the speed buttons, the training bar, the goal and the ticker show.
- **The build menu is a panel you open** (the Start menu in Frontier 95, a Build button and a panel in the base): the unlocked items, then the teasers, then Help (`actions.openHelp()`). Tell the game each time it opens with `actions.buildPanel(true)`: the first coach step waits for it.
- **One goal** in front of you: `progress.goal.line` ("Ship your first model · 0/1"; `ratio` for a bar). The scenario checklist (`objectives`) only shows once `visible.arena`.
- **The coach** is drawn by the host (the dimming, the ring round the target, both tokens: `color.highlight`, `color.scrim`, `motion.pulse`) and by your `Coach` slot (the balloon). The target is whatever carries `data-coach-active`. Mark every thing the coach can point at, in **every skin**, with the kit's `useCoach`: `const coach = useCoach(); <button {...coach.attrs("build:path")}>`. The ids are `start` (whatever opens the build panel), `build:<kind>` (each tool), `training` (the training bar), `stat:runway`, `goals` and `map:suggest` (the map's ghost tiles, marked by the game). `coach.attrs(id, alsoActive)` lets a shut container stand in for what is inside it: a closed Start menu is the active target while the coach points at one of its items, so the spotlight never has nothing to light. The stranger test clicks only `[data-coach-active]`, so a skin that forgets the hooks cannot be played by it.
- **"New!"** is the `UnlockCard` slot, **Help** is `HowToPlay` (its words are `content/help.ts`).

## Panels that hold time

If a panel of your own covers the map while it is open (a phone sheet, a menu), hold time with the kit's `useAutoPause(actions, "my-panel", open)`: the game keeps the ids apart, so closing one panel never resumes time beneath another. The panels the host owns (the payroll, the sound mixer, the News Room, the phone Arena) hold it for you.

## The view-model and actions

`src/ui/hud/types.ts` is the contract; it is short and commented. The top level:

```ts
interface HudVM {
  apiVersion: 1;
  stats; training; objectives;           // numbers and text, already formatted ("$4.04M", "5.0 mo")
  inspector: InspectorVM | null;         // null when nobody is selected
  buildItems; buildTip;                  // the palette, and the tooltip for the tool in hand
  speed; bubbles; ticker; toasts; hints; warnings; confirm; progress; visible; coach; unlock; help; // progress: the ladder rung, the goal, the teasers; visible: which panels are earned; coach: the coach mark; unlock: the "New!" card; help: the open How to play; warnings: standing problems (`toast` tone "warn" in the base's stack); confirm: a spend waiting for a yes or no; hints: at most one of "gateway" | "tap", and none while a toast is up (their copy is strings hint.gateway / hint.tap)
  event: EventVM | null;                 // a modal card; the era card is separate:
  eraCard: EraCardVM | null;
  thoughtsPanel; arena; outcome;
  leapfrog;                              // Release Leapfrog: the benchmark leaderboard (columns, rows, cells) and the share-of-voice meter; `enabled: false` when the pack is off
  audit;                                 // Evals Without Borders: the stage, the countdown, what the group is doing (the AuditPin's line and progress)
  newsroom; sound; photoMode; skins;     // the news room (archive, paper, chat), mixer, photo mode, skin picker
  layout: { width, height, phone /* ≤480 */, compact /* ≤640 */, tall /* ≥800 */ };
}
```

Numbers come as numbers (`cash.value`) **and** formatted text (`cash.text`), so you can roll an odometer and still have a caption. Colours the game owns (the walker's `portrait.body`, an Arena lab's `color`) come as CSS colour strings.

`HudActions` is everything a skin can ask for: `place(kind)`, `setSpeed(n)`, `togglePause()`, `choose(eventId, i)`, `continueEra()`, `select(id)`, `follow(id, on?)`, `closeInspector()`, `highlight(key)`, the payroll (`closeStaff`, `hire(job)`, `fire(id)`, `paintZone(id | null)`, `clearZone(id)`), `dismissToast(id)`, the coach and the cards (`coachSkip()`, `coachReplay()`, `dismissUnlock()`, `buildPanel(open)`, `openHelp()`, `closeHelp()`), the spend check (`confirmSpend()`, `cancelSpend()`), `holdTime(id, open)` (use the kit's `useAutoPause`), `toggleArena()`, `keepPlaying()`, `newLab()`, the news-room ones (`openNews`, `viewNews`, `closeNews`, `skipNews`, `revealChat`), sound (`openMixer`, `closeMixer`, `setMuted`, `setVolume`, `playCue`), photo mode (`setPhoto`, `setPhotoTime`, `takePhoto`) skins (`openSkinPicker`, `previewSkin`, `applySkin`, `cancelSkinPicker`, `setReducedMotion`) and mods (`openMods`, `closeMods`). Each is safe to call at any time; the game ignores what does not apply.

Changing the contract: keep changes **additive** (new fields, new actions) and add a fixture to `src/ui/hud/fixtures.ts` + a test in `vm.test.ts`. A breaking change means bumping `SKIN_API_VERSION` and every `skin.json`.

## Fonts and licences

- **Bundle every font file** inside the skin (`assets/fonts/`) with its licence text beside it, and list both in `skin.json`. Never link to a font CDN: the tests fail on `fonts.googleapis.com` and friends.
- Only OFL, Apache, MIT or CC0 fonts. (Frontier 95 uses W95FA and Jersey 10, both OFL 1.1.)
- Use `woff2`, latin subset, only the weights you use. Each family costs about 10–25 KB, loaded only while the skin is active.
- Pick a numbers face where **5 and S** (and 0 and O) read apart: the HUD is full of digits.
- `font.numbers` has a token of its own so a skin can set its big numerals apart. There is room to drop in a paid face later (Frontier 95 keeps the slot open for one).

## Validation and what happens when a skin is refused

`src/skins/schema.ts` (Effect Schema) validates `skin.json` when the registry starts, and the registry checks `slots.tsx` and the font files when a skin is loaded. A skin is **refused** if it has an unknown slot, an `apiVersion` other than 1, a missing required token, an unknown token or string key, an unsafe token value, a font without a bundled licence, a preview or font that is not there, or a `slots.tsx` that disagrees with `slots`. Errors are readable lines:

```
Skin "midnight" was refused:
  apiVersion: Expected 1
  slots: unknown slot "Sidebar" (known: Layout, Stats, Training, ...)
  tokens: missing required token "color.panel"
```

The message goes to the console and to the skin picker, and **the game falls back**: first to Frontier 95, then to the base skin, so the player always has a HUD. A refused skin never gets as far as changing the page.

The tests (`pnpm test`) run all of this for every skin in `src/skins/`: manifest validity, contrast, CSS scoping, fonts and licences present, no hot-linking, no forbidden imports, and **every slot renders from a fixture view-model without throwing** (`renderToString`), in a desktop and a phone size, with an event card, an era card, the outcome card, the news room and photo mode open.

## Trying a skin

```sh
pnpm dev                            # http://localhost:5173/?skin=midnight
pnpm build && pnpm preview          # http://localhost:4173/  (bb connect expose 4173 for a link)
node scripts/skin-shots.mjs docs/img/my-skin --skin midnight             # the six standard scenes
node scripts/skin-shots.mjs /tmp/m --skin midnight --only e --measure    # phone, and how much campus is left visible
```

Which skin loads: `?skin=<id>`, then `localStorage["flt.skin"]` (set by the picker's OK), then `frontier-95`. `?skin=base` loads the bare base skin, which is handy for debugging a skin against its foundation. Switching in the picker is live and does not reset the game.

The six standard scenes (a: overview 1440×900, b: inspector open, c: the Water Discourse card, d: build bar / Start menu open, e: phone 390×844, f: photo mode) are the evidence every skin PR carries.

## Rules

- **Parody names only.** No real companies, products or people in anything a player can read (Frontier 95 says "Internet Exploder", "ICU", "Task Mangler", "Paint Job"; the mockups' real names never reach the screen).
- Skins never import the sim, the store or three.
- Bundle fonts with licences; no hot-linking; no remote assets.
- Keep the contrast, tap-target, focus and reduced-motion rules above.
- A slot is presentation. If you need the game to know something new, that is a change to the view-model (additive), not something a skin reaches for.

## Checklist for agents

1. `cp -r src/skins/swag-drop src/skins/<id>` (or `frontier-95` if you want slots) and rename `id`, the scope in `skin.css`, and the keyframe names.
2. Fill in `tokens` (all required ones), then `fonts` (files + licences), `strings`, `preview`.
3. `pnpm test` until green. Read the failures: they are written for you.
4. `pnpm build && pnpm preview`, then `node scripts/skin-shots.mjs docs/img/<id> --skin <id> --measure` and look at all six pictures, especially the phone one.
5. Check nothing readable is a real brand or person.

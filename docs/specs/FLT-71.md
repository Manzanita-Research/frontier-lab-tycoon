# FLT-71: Skins now: Frontier 95 default for everyone, hide the other 5 from the picker (?skin= still works), 'Start' is Start in every skin

Label: explore · Priority: urgent. Copied from the task description.

**Skins, the small fix now** (Jem's feedback on a Discovery Disc '96 screenshot: the coach said "Click Start" but the button said "BUILD STAMPS"). One small PR, visible, with before/after screenshots.

1. **Frontier 95 is the default for every new player.**
   - Check a fresh profile (no localStorage).
   - A `?skin=` link applies to that visit but **doesn't stick silently**: it isn't saved as the player's choice unless they pick it in the picker.
   - An **old saved pick for a now-hidden skin migrates to Frontier 95** once, with a tiny notice ("Frontier 95 is back as your desktop"). A test covers each case.
2. **Hide the other five skins** (Swag Drop, Karaoke Night, Field Almanac, Discovery Disc '96, Homepage '98) **from the player-facing picker** until each passes Jem's taste review.
   - They stay reachable via `?skin=<id>` (for testing and the FLT-14 gallery) and through a code-level `unlisted: true` in each `skin.json`, so the unhide is one line per skin.
   - The picker then shows Frontier 95 plus the classic base; say which you picked.
3. **No cute renames of core controls in any skin.** "Start" is **Start** everywhere, so the coach text always matches the button.
   - Sweep all six skins' strings for renamed core controls: Start, OK, Cancel, Pause, speed buttons, Build, Settings, Help.
   - Keep flavour in titles and body copy, never in control labels.
   - Add a test: every skin's control labels for coach-referenced controls equal the coach's words.

**Evidence:**
- Before/after screenshots: the Discovery Disc '96 Start button, the picker, and a fresh profile on Frontier 95.
- Tests.
- `pnpm check` green.
- Merges when GitHub Actions is back (the billing issue is with Jem).

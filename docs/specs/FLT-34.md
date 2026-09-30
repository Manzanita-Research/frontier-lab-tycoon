# FLT-34: Daily Drama: auto-generated topical mods from the day's AI news (Jem reviews before publish)

Label: explore. Copied from the task description on 2026-09-30.

**Daily Drama: topical mods, auto-generated.** Jem: *"A bot that watches for big AI (or SF) news stories / gossip / drama (every day lol) and makes mods for that."* This is also the best dogfood test of FLT-15: **an agent makes a mod from the modding skill alone.**

**Pipeline (once a day):**
1. **Trigger:** a **bb automation** (a daily schedule) spawns one Codex Sol 6.1 thread on Modal. It needs the Codex-on-Modal sign-in fixed; see desk. It could move to a Cloudflare cron Worker later, but bb is simpler and keeps agent runs visible.
2. **Read:** a few public sources (a curated list in `drama/sources.json`: tech news RSS, HN front page, a couple of AI newsletters' public feeds). Pick **one** story with the most comic potential that is about **dynamics** (a release war, a pricing fight, a policy flip-flop, a benchmark controversy, an office-perk arms race).
3. **Write:** using only the FLT-15 mod-authoring skill, produce a small content pack in `mods/drama/YYYY-MM-DD/` with 1 event or arc, 5–10 headlines, 5–10 thoughts, and optionally a rival tweak.
4. **Validate:** `flt-mod check` must be green, then a **parody linter** (`drama/lint.mjs`) runs.
5. **Open a PR** titled "Daily Drama: {one-line summary}", with the source story's link *in the PR only* (never in the mod) and a two-sentence "why this is funny".
6. **Publish (after Jem merges):** the build publishes `mods/drama/latest.json` plus an index, the public Worker serves them, and the game gets a **"Today's Drama"** button that loads it via `?mod=`.

**Guardrails (hard rules):**
- **Parody names only.** No real people or companies by name, even in parody form, and nothing that makes an identifiable real person the butt of a joke.
- **Punch at dynamics and incentives, not individuals.** No private gossip, rumours about named people, health or relationships, or anything defamatory.
- **The parody linter** flags capitalised proper nouns that aren't in the game's parody glossary, known real org names, handles, and URLs. It fails the run if it finds any.
- **Jem reviews every one before it publishes** (it's public content). Trust ratchet: after about **20 approvals in a row with no edits**, desk asks Jem whether to auto-publish.
- Quiet days are fine: if there's no good story, it skips. It never pads.

**Done when:**
- Three consecutive daily runs each produce a PR that passes `flt-mod check` and the linter.
- Jem has approved at least one, and it loads on the public site via the "Today's Drama" button.
- A show-and-tell shows the agent working from the skill alone.

**Depends on:** FLT-15 M2 (the SDK, `flt-mod check` CLI and the mod-authoring skill), the Codex-on-Modal sign-in, and FLT-12 (public hosting).



---
**Lead update (Sep 30): Claude-first routing.** The daily agent runs on **Claude Opus 5.5** (not Codex). This round builds the pipeline and does **one manual run**:
1. `drama/sources.json` (a curated list of public feeds), plus `drama/pick.md`, the agent brief: pick one story about *dynamics*; skip quiet days.
2. `drama/lint.mjs`, the parody linter: it fails on any real org, product or person name, handle or URL. It uses a denylist plus a capitalised-proper-noun check against the game's parody glossary. Unit-test it against known bad examples.
3. `scripts/drama-run.mjs`: a headless run that writes `mods/drama/YYYY-MM-DD/mod.json` using **only** `.agents/skills/flt-modding/SKILL.md`, then runs `flt-mod check` and the linter, and opens a PR "Daily Drama: {summary}" with the source link **in the PR body only** and a two-sentence "why this is funny".
4. **Do one real run now** for today's news, and open that PR for Jem to review. **Don't merge it**; Jem reviews every Drama PR.
5. Write `drama/AUTOMATION.md`: the exact bb automation (a daily schedule plus the prompt) for the lead to create **after Jem OKs the first PR**. Don't create the automation yourself.
6. Part 2 comes after FLT-37 (M1b): `mods/drama/latest.json` served by the public Worker, and a "Today's Drama" button that loads it via `?mod=`.


---
**Part 2 (Sep 30): the Today's Drama button and the published feed.** Stacked on FLT-37 (mods live) and the part 1 PR.
1. Publish `mods/drama/index.json` and `mods/drama/latest.json`, served by the public Worker as static assets. **Only merged, Jem-approved packs**: an unmerged Drama PR never appears.
2. A **"Today's Drama" button in every skin** (in Frontier 95: Start ▸ Programs ▸ Today's Drama; the base skin has the fallback). It loads the latest pack through the mod loader (`?mod=`), shows a short "what's today's drama" card, and can be switched off in the Mod Manager.
3. An archive list of past packs.
4. Gate it like any mod: no ladder rung.
5. Until the first Drama PR is approved, tests and screenshots use a fixture pack. Never fetch or display unmerged Drama PR content.

**How it is built** (see `drama/README.md` ▸ Publishing):
- "Approved" means "merged into main". `scripts/drama-feed.mjs` reads the packs from **main's git tree** (`origin/main`, else `main`), never from the working tree, so a Drama PR's preview, a local branch or an edit to an old pack cannot put unmerged copy on the page. With no main to read, the feed is empty. The deploy job checks out with `fetch-depth: 0` so it has main.
- The build writes `/mods/drama/{index.json,latest.json,<date>/mod.json}`, and the rehearsal feed from `drama/fixtures/feed/` goes to `/mods/drama-fixture/...`. `?drama=fixture` reads the rehearsal feed.
- Playing a pack reloads with `?mod=/mods/drama/<date>/mod.json`, which starts a new lab, because mods load before the first brick. There is one Drama pack at a time. Switching it off is the Mod Manager's "Switch off", or the button in the Drama window.

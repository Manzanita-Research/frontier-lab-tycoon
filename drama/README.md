# Daily Drama

Topical mods from the day's AI news. Once a day, one story about industry **dynamics** becomes a small parody content pack: one event card, 5–10 headlines, 5–10 thoughts, and optionally a rival tweak. It lands in `mods/drama/YYYY-MM-DD/` as a PR, and Jem reviews every one before it publishes. Spec: [`docs/specs/FLT-34.md`](../docs/specs/FLT-34.md).

```sh
pnpm drama                       # the whole run: fetch → author → check → PR → FLT-34 comment   (node scripts/drama-run.mjs)
pnpm drama --no-comment          # the same, printing the FLT-34 comment instead of posting it (AUTOMATION.md)
pnpm drama --no-pr --keep-room   # stop before the PR, keep the author's room to look at
pnpm drama fetch                 # just the candidates, into drama/.work/<date>/candidates.md
pnpm drama check <pack dir>      # flt-mod check + linter + shape, the same thing the author calls
pnpm drama pr --date <date>      # (re)open the PR for an existing mods/drama/<date>/
pnpm drama body --date <date>    # rewrite drama/.work/<date>/pr-body.md only (for gh pr edit)
pnpm drama:lint <pack dir>       # the parody linter alone
```

| File | What it is |
| --- | --- |
| `sources.json` | The public feeds (tech news, aggregators, newsletters, SF local). Real names are fine here and in the PR body, never in a mod. |
| `pick.md` | The author's brief: pick one dynamics-shaped story or skip, map it onto the game's cast, write the pack. |
| `lint.mjs` | The parody linter. Fails on URLs, handles, `denylist.json` names (also spaced, hyphenated, leetspeak or a typo away) and any capitalised word that isn't English, the game's own, or declared in the pack's `glossary.json`. |
| `denylist.json` | Real orgs, labs, products, people, nationalities, states, media. Add freely. |
| `glossary.json` | Extra allowed names and words on top of what the linter harvests from the game. |
| `words.txt.gz` | Lowercase English (SCOWL; see `words.LICENSE.txt`), so sentence-initial capitals aren't mistaken for names. |
| `AUTOMATION.md`, `automation.sh` | The daily bb automation, for the lead to create after Jem OKs the first PR. |
| `fixtures/good/` | A known-good pack for the tests. |

**From the skill alone.** The author is headless `claude -p --restricted`, running in a scratch room outside the checkout. Its file tools can't leave the room, it has no shell, and it validates through one MCP tool, `check` (`scripts/drama-mcp.mjs`). Its whole world is `BRIEF.md`, `SKILL.md` (`.agents/skills/flt-modding`) and `candidates.md`. `drama/.work/<date>/agent.json` records what it read and did.

## Publishing: the Today's Drama button (part 2)

A pack goes public when Jem **merges** its PR, and not before. The build (`scripts/drama-feed.mjs`, a Vite plugin) reads `mods/drama/*/mod.json` from **main's git tree** (`origin/main`, else `main`), never from the working tree. A Drama PR's own preview therefore still shows only what main has, and an unmerged edit to an old pack never ships. It writes:

| Path on the site | What it is |
| --- | --- |
| `/mods/drama/index.json` | `{ apiVersion: 1, packs: [...] }`, newest first. Each entry has `id`, `date`, `title`, `description`, `url`, three `teasers`, the event card's `title` and first `day`, and `counts`. |
| `/mods/drama/latest.json` | `{ apiVersion: 1, pack }`: the newest entry, or `null`. |
| `/mods/drama/<date>/mod.json` | The pack, byte for byte as merged. The button loads this through `?mod=`. |
| `/mods/drama-fixture/...` | The same shape, built from `fixtures/feed/` (three rehearsal packs). Add `?drama=fixture` to the address to read it; tests and screenshots do. |

`node scripts/drama-feed.mjs [--ref <ref>]` prints what a build would publish. The deploy job checks out with full history so the build has main; a checkout without it publishes an empty feed and warns. The game asks for `latest.json` a moment after start (the NEW badge) and for `index.json` when the window opens (the archive). "Add to my lab" adds a pack to the lab on screen (FLT-78: no reload, no new lab; its card turns up within a few days, and a newer pack replaces it); Remove takes it out again. A `?mod=` link to a pack still starts a lab with it.

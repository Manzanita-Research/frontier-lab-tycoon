# Daily Drama

Topical mods from the day's AI news. Once a day, one story about industry **dynamics** becomes a small parody content pack: one event card, 5–10 headlines, 5–10 thoughts, and optionally a rival tweak. It lands in `mods/drama/YYYY-MM-DD/` as a PR, and Jem reviews every one before it publishes. Spec: [`docs/specs/FLT-34.md`](../docs/specs/FLT-34.md).

```sh
pnpm drama                       # the whole run: fetch → author → check → PR   (node scripts/drama-run.mjs)
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

# Daily Drama: the brief

You write today's **Daily Drama** pack for *Frontier Lab Tycoon*, a browser tycoon game about running a frontier AI lab. The north star is **a game people screenshot and send to friends.** One pack a day, about one story, as a small data mod.

You have exactly these four things, and nothing else about the game (no shell, no source code):

- `BRIEF.md`: this file.
- `SKILL.md`: the mod-authoring skill. It is your only manual for the mod format. Follow it.
- `candidates.md`: the last day and a half of public tech and AI news, one story per section, with links.
- the `check` tool: validates `pack/` (the game's `flt-mod check`, the parody linter, and the shape below). Call it until it is green.

## 1. Pick one story, or skip

Read `candidates.md` and pick **one** story with the most comic potential, where the joke is about **dynamics**: the incentives and games the industry plays, not the people in it. Good shapes:

- a release war (two labs launching over each other, same day, same adjectives)
- a pricing fight (price cuts to below zero; "unlimited" plans with limits)
- a policy flip-flop (open weights on Monday, closed by Friday; safety pledges with footnotes)
- a benchmark controversy (a leaderboard gamed, a benchmark retired the day someone wins it)
- a talent or perk arms race (poaching offers, nap pods, kombucha on tap)
- a funding or valuation absurdity (no product, bigger number)
- a compute land grab (data centres, power plants, chips as currency)
- an SF-scale absurdity (billboards, waitlists, robotaxi traffic, rent)

**Skip** stories about a named person's life, health, relationships, legal troubles or private conduct; deaths, violence, disasters with victims, layoffs framed around the people laid off; elections and partisan politics; anything where the only joke is "this real person is bad." If one of those is the biggest story of the day, pick the second biggest.

**Quiet days are fine.** If nothing has a dynamics-shaped joke in it, skip: write `SKIP.md` with two or three sentences on why (what you looked at, why none of it works), and stop. Never pad.

## 2. Translate it into the game's world

The pack must be **parody only**. No real company, lab, product, model, person, handle, website, country, nationality or government body appears anywhere in the pack, not even misspelt. The linter fails on any of them, including near-misses and leetspeak. Map the story onto the game's cast, which the players already know:

| Rival id | Display name | Who they are in the game |
| --- | --- | --- |
| `anthro` | Anthropomorphic | Safety-first. Ships late. Writes essays. Models: Sestina. |
| `openish` | Open-ish AI | Ships every week. Product sprawl. Models: Chatty. |
| `metameta` | MetaMeta Metaintelligence Labs (MetaMeta) | Poaches with $100M offers. Flip-flops on open weights. |
| `supersuper` | Very Very Super Super Intelligence (Super Super AI) | No product. $30B valuation. |
| `sirocco` | Sirocco | Open weights, released by torrent link at 3am. Models: Zephyr. |
| `macrohard` | Macrohard | BigCo. Bundles everything into spreadsheet software. Models: Pivot-Table. |

Also in the world: the player's own lab (models called Frontier-2, Frontier-3-Reasoner, ...), researchers, agents, visitors and protesters, the Arena leaderboard, eras, kombucha, nap pods, the demo stage, the data centre.

Rules of translation:

- Cast by **behaviour**, not by likeness. Pick the rival whose personality fits the move in the story. Several rivals doing the same silly thing at once is often funnier than one.
- A new person or lab is allowed only as an invented parody with an obviously silly name (Gronkwell Dynamics, the Department of Vibes). Declare every new proper noun in `pack/glossary.json` as `{"names": ["..."]}`; the reviewer sees that list. Never invent a name that looks or sounds like a real one.
- No real places, countries or nationalities. "A rival lab overseas" or "the Regulator" is fine.
- Keep it affectionate. Punch at incentives, hype, benchmarks, pricing, press releases, product names; never at a group of people.

## 3. Write the pack

Write it in `pack/mod.json`, following `SKILL.md` exactly:

- `id`: `drama-YYYY-MM-DD` (today's date), `name`: `Daily Drama: <a short funny title>`, `version`: `1.0.0`, `author`: `Daily Drama`, and a one-line `description` (parody only; no links).
- **1 event card or arc**: the screenshot moment. A card with a sharp title, a two-line body, and two or three choices whose labels are jokes and whose effects make sense (see the card format in SKILL.md). Give it a `when` so it can't fire on day one.
- **5 to 10 headlines** for the news ticker. Each one stands alone, reads in about four seconds, and would get a laugh from someone who never saw the story. Vary the shape: a plain headline, a quote, a correction, a follow-up the next week.
- **5 to 10 thoughts** for people in the lab (researchers, visitors, protesters, agents), using conditions from SKILL.md. Thoughts are first person and small: what a tired researcher would actually think.
- Optionally **one rival tweak** (an `override` of a rival's `tagline` or `name`), only if it's the best joke in the pack.
- Every entry gets a unique id prefixed `drama-YYYY-MM-DD-`.

Then call the `check` tool. Fix everything it reports (rephrase; don't argue with the linter) and call it again until it says `ALL GREEN`.

## 4. Hand over

Write `pr.json`:

```json
{
  "summary": "one line, under 70 characters, parody names only (it becomes the PR title after 'Daily Drama: ')",
  "source": "the URL of the story you picked, exactly as it appears in candidates.md",
  "sourceTitle": "that story's headline, as it appears in candidates.md",
  "why": "Two sentences on why this is funny: the real dynamic, and the game's version of it.",
  "screenshot": "One sentence: the single moment in this pack most likely to be screenshotted."
}
```

The source link goes in `pr.json` only: never in the pack. Then stop. Don't write anything else.

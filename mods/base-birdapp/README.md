# The Bird App: researchers who post (FLT-69)

Your researchers are on the Bird App. Most never post; a few post sometimes; one or two are big accounts. A banger brings in Hype, visitors and applicants; a cancel crashes the lab's **Aura** and hands a rival's recruiter a name. You can't stop them posting, but you can set a lever per poster, and hire Comms Reps to soak up the fires. It is one content section (`content.birdapp`: archetypes, post lines, events) plus `rules.birdapp`, loaded directly by `src/content/birdapp.ts` like `base-leapfrog` and `base-auditors`. No versions were bumped.

## When it wakes

- Asleep until **Level 3 (Growing team)** of the unlock ladder (`PACKS` in `src/sim/progression.ts`), which also brings the Comms Rep forward from Level 5. `enableBirdApp(world)` is the switch; `?birdapp=off` keeps it asleep. Asleep means no dice and nothing moves, so the goldens of a run without it are unchanged.
- It runs once a day, at midnight (`dailyBirdApp`, lapped as `daily:birdapp`), on the pack's own random stream (`(seed ^ 0x42495244) >>> 0`), so switching it on changes no other system's dice.

## Posters

Every researcher on staff gets a posting profile the first midnight they're here: a **tier** (`tiers`: recluse 30%, occasional 55%, big 15%), one of seven **archetypes** (the Midnight Oracle, the Launch Hype Account, the "We're So Back" Duo, the Thread Guy, the Leaderboard Screenshotter, the Brunch Doomer, the Anon Alt; each with a spice range, handle stems and faction leanings), and a **parody handle** (`@so_back_twice_irl`; `parody.test.ts` checks every stem). Tiers move: an occasional poster whose banger takes them past `bigAt` followers is promoted, and a cancel costs a tier, a posting break (`cancel.breakDays`) or the job. The tier is a small machine (`posterMachine` in `machines.ts`: recluse, occasional, big, break, gone).

## Posting

At midnight the driver:

1. lands yesterday's posts: **flop, banger, controversy, ratioed, cancelled**. Each moves Aura (`aura`), followers (`growth`) and the factions the archetype leans toward; bangers add Hype, and a cancel goes into the Comms queue;
2. schedules today's posts. Who posts depends on tier (`rates`), archetype and the **moment** (launch day, 3am, a rival's release, the Water Discourse; `moment` multiplies the rate and adds `momentSpice`). Each post's outcome is rolled now from `odds` (a lerp from low to high spice), and so is its final engagement (`engagement`), so the panel can let the likes tick up toward a number the sim already knows;
3. has the Comms desk review the "Run it by Comms" posts, then work the queue with what is left;
4. eases Aura toward the floor the posters hold up (`perBig`, `perOccasional`, `floorMax`, `ease`).

Spice sets the variance: a spicy poster lands more bangers *and* more cancels (`birdapp.test.ts` checks the distribution per spice).

## Levers (three per poster, the trade-off on the button)

- **Let them cook**: the archetype's odds, as they are.
- **Run it by Comms**: spice × `comms.spice`, bangers × `comms.banger`. Each review uses a slot of the desk's day.
- **Please log off**: no posts, and −focus every day (`logoff.focus`, doubled for a big account). A big account kept off for `quitAfter` days has a daily `quitChance` of leaving "to post full time".

## The Comms desk

Capacity is `comms.founder` plus `comms.perRep` per Comms Rep. A controversy costs 1 slot, a cancel 2. A contained cancel costs only `cancel.contained` of the Aura crash and ends in a posting break. A fire nobody reaches in `sticksDays` days **sticks**: a stuck cancel keeps the full crash, and the poster leaves (`cancel.leave`), takes a break, or stays as a demoted poaching target. When the queue's weight passes the desk's capacity plus `comms.drown`, the desk is **drowning** (`commsMachine`: calm, busy, drowning). The panel shows it and a toast says so. A cancel also stokes the Water Discourse (`cancel.discourse`).

## Hooks

- **Hype, visitors, applicants**: `src/sim/birdapp/effects.ts` (`auraHype` in the economy, `auraVisitors` in attendance, `auraApplicants` in the walkers). Each is the identity while the pack is asleep. The HUD shows it as one **Aura** row in the Vibes breakdown.
- **Poaching and defection**: `poachAppeal` (a cancelled poster first, then a big account), and a stuck cancel adds `cancel.defection` to the defection score.
- **Factions**: each landed post nudges the archetype's factions.
- **Thoughts, the ticker, the Frontier Times**: events with `channel: "thought" | "toast" | "headline"`. The paper files bangers and cancels as the news cycle (`src/newsroom/edition.ts`).
- **Notices (FLT-51)**: every toast has `source: "birdapp"`; a viral post, a cancel and a drowning desk are `you`, a discourse is `world`.
- **The `birdapp.post` verb**: a disaster or arc can make someone post (`docs/DISASTERS.md`).

## Saved state

`GameState.birdapp`: `enabled`, `rngState`, `aura` and its `history`, `posters` by walker id (tier machine, archetype, spice, handle, followers, lever), `posts` (live and the last 40 landed), the Comms `queue` and machine, today's `capacity` and `moments`, and a `tally`. The change to `src/sim/types.ts` is additive.

## UI

`birdView(world)` goes into the snapshot, and `hudViewModel` turns it into `HudVM.birdapp` (`BirdAppVM`). One docked skin slot, **BirdApp**. The base panel is a chip that opens into the timeline, the posters and the Comms desk. Frontier 95 draws a bird in the tray and **Bird Reader 1.0**, a newsreader crossed with a buddy list. The other skins restyle the base panel with their own strings: a guestbook (Homepage '98), a birding log (Field Almanac), an encyclopedia (Discovery Disc '96), a lyric screen (Karaoke Night) and a merch drop (Swag Drop).

Debug scenes: `?moment=bird` (the reader open on a week of posts), `?moment=bird-banger` (a post going viral), `?moment=bird-cancel` (the desk drowning). They are staged by `src/sim/birdapp/demo.ts` through the driver's own code paths. The `pnpm shots` sets are `birdapp` and `birdapp-skins`.

## Rival labs (FLT-92)

The rival labs post too. Each lab has two or three invented **voices** (`kind: "voice"`): a CEO who vagueposts, a researcher who is so back, a launch-teaser account and a safety lead who threads. `lab: "any"` voices (handle `{lab}_ceo`, `{lab}_so_back`) stand in for a lab without its own. What they say is a `kind: "rival"` row per beat, role and (optionally) lab, with `{you}`, `{me}`, `{rival}`, `{model}` and `#{rank}` filled in.

- **Their own beats:** `idle`, `teaser` (a run is a week out), `release`, `top` (#1 on the Arena), `climb`, `drop` (down 3 places: one line, then `silenceDays` of nothing, then `back`), and `subtweet` (another lab shipped).
- **Yours:** `launch`, `leak`, `cancel`, `escape`, `hearing` and `raise`. Up to `reactors` labs answer each one; the first answer each day is a toast about you.
- **Both ways:** `dunk` is one of *your* posters on a lab that slid (or whose post got ratioed); if it lands as a banger it is +`dunk.aura` Aura. `ratio` is a rival CEO quote-posting one of your ratioed posts: −`ratio.hype` Hype.
- **Numbers:** `rules.birdapp.rivals` (posts a day, odds, the silence, the dunk and the ratio).
- **Off switch:** `?birdrivals=off`. They run on their own random stream after the lab's own midnight, so turning them off leaves everything else as it was.
- **Mods:** add `voice` and `rival` rows through `add`, and a Daily Drama pack or arc can make a lab post with the `birdapp.rival` verb.
- **UI:** their posts sit in the same timeline with the lab's colour, and an Everyone / Us / Them filter. In Frontier 95, From carries a colour square, the preview gets Organization and Keywords headers, and a ratio quotes your post as `> wrote:`.
- **Debug scenes:** `?moment=bird-rivals` (a day of it all), `bird-rivals-dunk`, `bird-rivals-ratio` and `bird-rivals-launch`. The `pnpm shots` set is `flt-92`.

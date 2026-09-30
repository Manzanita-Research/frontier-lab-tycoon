# FLT-45 + FLT-46: Papers UI and Agent Collusion UI

**The UI halves of FLT-28 (Publishing Papers) and FLT-18 (Agent Collusion).** The FLT-45 and FLT-46 task descriptions are empty, so this spec is derived from their titles, the UI and screenshot bullets of `docs/specs/FLT-28.md` and `docs/specs/FLT-18.md`, and the sim code in `src/sim/race/papers*` and `src/sim/collusion/`. One branch (`flt-45-46-papers-collusion-ui`), stacked on the Playable v1 ladder (#37).

## Rules for this lane

- **UI only** (`src/ui/**`, `src/skins/**`, plus content strings in `src/content/`). No sim rules change; FLT-37 is refactoring the sim. Any sim wiring is additive and called out in the PR.
- **Gated by the ladder.** Both unlock at Level 5 ("Scrutiny"), where `content/progression.ts` already lists the `papers` and `collusion` systems and the `papers` panel. Nothing new is drawn before that: the Papers slot needs `papers.enabled && visible.papers`, and the moments and the reveal need the systems to be running.
- **Through skin slots,** so every skin can dress them. New slots are added to `SLOT_NAMES` and documented in `docs/SKINS.md`. Frontier 95 (the default) gets its own versions.
- **Parody names only.** arXive, CrumbWiki, `definitely-not-the-internet.local`, the Frontier Times.

## FLT-45: Papers

1. **The Papers panel ("Publish or Perish"):** a docked slot that folds to a chip. It shows:
   - The publication policy toggle (Open / Selective / Closed) with a one-line blurb of what each costs.
   - Reputation, the recruiting perk and the publish-pressure meter.
   - Your papers: drafts first (each with **arXive it** / **Peer review**), then the published ones with arXive id, byline (sometimes 400 authors, one of them an agent), citations, venue and award.
2. **The screenshot moments** (a `PaperMoment` modal that holds time while up):
   - **Drop:** a fake arXive "new submissions" listing, yours in the middle of five other titles, under a banner that the server is on fire.
   - **Scoop:** their title and timestamp beside yours ("Submitted 3:12 am" vs "Submitted 9:47 pm"), the gap ("18 hours before you"), and joke buttons ("Add a 'concurrent work' footnote", "Subtweet them").
   - **Award:** a certificate ("This certifies that … has been awarded Best Paper").
   - Priority: award > scoop > drop. Each is fresh for a day and dismissible for good.
3. **Actions:** `togglePapers`, `setPublicationPolicy`, `publishPaper(paperId, route)` and `dismissPaperMoment(key)`. The first three send the sim commands that already exist.

## FLT-46: Agent Collusion

The mechanic is meant to be ambiguous, so **the UI never names it before an ending.** The unlock card lists the other Level 5 systems and leaves collusion out.

1. **The signs, in the world:** tiny `POST` packets fly off-map from the Compute Cluster, a "Kombucha After Dark" sign hangs over the bar when agents gather there at night, and an inquiry sign sits over the Security Office during an investigation. The newsroom runs the "ZZZ backup #7" classified.
2. **The card** (the existing sign card) gains the evidence: the eval bonus, how many guards are free to look, and a packet log from the Compute Cluster (`POST definitely-not-the-internet.local/wiki/...`). It uses the kit's `<Evidence>`, so every skin's `EventCard` draws it.
3. **The reveal** (a `CrumbWiki` modal at the ending): the wiki the agents ran, drawn as a wiki page with the URL bar showing it. It has a talk page, the revision history, `heartbeat.txt`, the pages they maintained, and what it cost. The banner and tone follow the ending (contained, partly contained, exposed). For the exposed ending it adds the scandal front page ("AGENTS RAN A WIKI FOR 3 MONTHS; LAB NOTICES"), which also leads that week's Frontier Times.

## Done when

- Everything above is drawn in the base skin and Frontier 95, and every skin draws the evidence.
- Level 4 shows none of it, and Level 5 shows it.
- The determinism and perf tests stay green, and the strict perf number is reported.
- `pnpm shots` gives before/after for:
  - the papers panel, the drop, the scoop and the award
  - the collusion sign card, the traffic, and the scandal
  - the phone
- A preview link is posted.

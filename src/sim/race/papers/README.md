# Publishing Papers: sim contract (FLT-28)

`enablePapers(world)` loads the pack, `disablePapers(world)` freezes its history and clears the recruiting hook. The app enables it by default; `?papers=off` disables it. Pure `createInitialState` has no papers property and consumes no extra RNG, preserving the golden runs. New-lab reset retains the switch. No actors, wall-clock delays or presentation assumptions.

Commands (through the existing Effect app `COMMAND` channel):

- `{ type: "setPublicationPolicy", policy: "Open" | "Selective" | "Closed" }`
- `{ type: "publishPaper", id, route: "preprint" | "review" }`

The policy sets defaults; explicit publication overrides it. Open automatically preprints every draft. Selective (the default) reviews sources of importance ≥ 1.15 and keeps weaker drafts. Closed keeps all drafts. Policy changes never cancel an ongoing review or retract a published paper. Sources are completed runs (`run:N`) and research era milestones (`research:era:N`), once each; changing policy cannot duplicate them. Drafts become available at midnight, after Race and Leapfrog. Importance comes from source kind and era; it never depends on how an entity is rendered.

`Snapshot.papers: PapersView` is detached plain JSON, refreshed with the HUD. It includes `enabled`, `policy`, `reputation`, `recruitingPull`, `publishPressure`, `knowledgeSpill`, and `papers`. Each paper has its title, author count, venue, source, status, route, importance/value, citations, submitted/published/due day, `daysLeft`, scoop lab/day and award name. Drafts, review and publication are separate statuses; citations start after publication. Awards are records for the UI to render as trophies later.

A review lasts exactly 60 game days. Only the penultimate day can scoop it; the recorded headline says 18 hours, within the sim's one-day resolution. Scooping halves reputation, hype, citations and knowledge spill through `value`, and disqualifies an award. Peer-reviewed work yields 3× the base reputation of a preprint. Preprints get instant hype; a critique three days later lowers their continuing citation yield and removes a quarter of their base reputation. Awards add reputation. Nothing creates walkers for papers.

Recruiting reads one optional `GameState.recruitingPull` multiplier at the existing applicant spawn probability, then gives accepted applicants a small starting-focus bonus above 1. It respects the existing Vibes threshold, gate reachability and hall capacity. Absent means 1. Closed starts at 0.75, Selective at 1, Open at 1.25; reputation adds pull capped at 2. FLT-16 can keep this two-line hook when changing applicant generation. Publication pressure grows under Closed with research present, and fades under the other policies; it is an additive future FLT-26 input, not a defection implementation.

Knowledge spill uses the existing rival machine's `SHOCK` event. Every rival receives capability proportional to the paper's effective importance at publication. No replacement rival context, releases or calendar hooks. Cumulative `knowledgeSpill` records the sum delivered, so final capability need not be higher in every full run (ordinary releases, poaching and RNG also change).

Names, title templates, venues, awards and headlines are in `mods/base-papers/mod.json`, a schema-valid FLT-15 content pack. Numeric tuning is in `balance.json` alongside it and validated at import. The pack is loaded directly pending M1b, as the split spec asks. All random draws occur in the driver, passed into the pure machine. Three dice per active paper per day cover scoop, award and citations; content draws follow emitted effects. Disabled means no draws. JSON save/reload replay and graph reachability are tested.

UI handoff: add a skinnable panel and controls using this view and these commands, plus a campus award representation. This sim PR supplies ticker and toast moments (`papers:drop`, `review`, `accepted`, `scoop`, `award`, `critique`, `policy`); it adds no panels or skin slots. `?moment=paper-drop|paper-scoop|paper-award` stages deterministic evidence scenes for existing toasts/ticker.

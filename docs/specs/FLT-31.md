**Release Leapfrog UI** (Sonnet 5.5, 2D). The sim is merged (PR #30): `Snapshot.leapfrog` has leaderboard rows, benchmarks, SOTA claims, share-of-voice, the ship-now state, livestream outcomes and saturation events. The tuning knobs are in `mods/base-leapfrog/mod.json` under `rules.leapfrog`.

**Priority 1: stop the notification flood (this is live on prod now).** Jem found the game overwhelming, and at 3×/10× a launch toast now fires every few real seconds.
- In `hudViewModel` (no sim change): **coalesce Leapfrog notifications.**
  - Rival launches go to the **leaderboard**, which flashes the row, and to the **ticker**. They don't become toasts.
  - Toast only when it matters to *you*: a rival overtakes you, you lose #1, a ship-now card opens, or a benchmark you lead is saturated.
  - At most **one Leapfrog toast per 20 real seconds**, the rest batched ("3 labs launched while you were busy").
- **Ticker freshness:** new headlines jump ahead of the old filler rotation, so the ticker shows what just happened within about 5 s.
- **Speed awareness:** at 3×/10×, prefer ticker and leaderboard flashes over toasts.

**Then the panels, in every skin via slots** (Frontier 95 first; the other skins through base slot components):
- **Benchmark leaderboard:** parody benchmark columns with flashing **SOTA** badges and the benchmaxx footnote (`*pass@256`), your row highlighted, and saturated columns struck through with a "SOLVED" stamp. In Frontier 95 it goes in the "Task Mangler" window as a new tab, **Benchmarks**, next to the Arena.
- **Share-of-voice meter:** you vs rivals, decaying. In Frontier 95, a tray icon plus a small "Network Traffic"-style graph window.
- **Ship-now card:** already renders via the event-card slot. Polish it so the live numbers are legible.
- **Launch livestream:** a dialog or overlay with the mishap (Frontier 95: "The demo has stopped responding. The dog has not.").
- **Layout:** coordinate with **FLT-29**, which is turning the right column into a managed window stack. Add your windows as stackable panels and merge `origin/main` after FLT-29 lands. If it hasn't landed when you're ready, build to its API and note it.

**Evidence:** before/after with `pnpm shots` (there's a `leapfrog` scene set), plus a 60 s count of toasts at 1×, 3× and 10×, before vs after. Merge yourself once green, with evidence in the PR (Jem's standing OK covers UI).


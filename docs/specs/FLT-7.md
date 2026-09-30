# FLT-7 · Sound kit and News Room

Kind: explore. The task explicitly requests a PR, evidence and a preview.

This slice observes the World; it changes no sim rules, shared types, random draws or pinned dependencies. `App` mounts `NewsRoom`; `Scene` mounts `SoundLayer` and `PressCamera`. The UI uses the existing Effect registry. The press clock uses game days; typing animation and audio scheduling use presentation time.

## Sound

`src/audio/score.ts` contains the eight synth recipes and the I–vi–IV–V score. `SoundKit` builds a lazy WebAudio graph on a pointerdown or keydown, with separate music and effects gains, a master gain and compressor. One-shots disconnect after their envelope; continuous sources and the context are disposed on unmount. Hidden tabs suspend audio. Fast path painting/earnings are rate-limited, and scheduling never catches up with a burst after a background tab.

`SoundLayer` observes the same changes as the juice watcher. Crowd volume weights walkers visible near the center of the actual camera view. More than ten protesters adds a synthesized three-syllable chant and stomp. A Training Hall adds a hum rising from 80 to 300 Hz; the campus clock drives crickets. Era identity changes both the key/tempo score and an era sting.

The current base World has no eras or breakdown mechanic. `audio/world.ts` is an explicit compatibility boundary: optional `world.era` (string/number, or stored machine `{ value }`) and building `broken`/`offline` booleans. These adapters are browser-tested using temporary debug-world fields. Future race/operations slices should supply those fields or adapt that one file to their chosen schema. Both cues can be auditioned today in Campus sound → Try the sounds.

## Press and chat

`newsroom/edition.ts` recovers the type of an existing headline by matching its content template, including event-choice headlines. Ranking uses significance, then recency and id; it excludes stories outside the completed period and removes duplicate headlines. An edition always contains one lead and three sub-stories, using desk copy if the week was quiet. `content/newsroom.ts` owns priorities, classifieds and each friend's voice.

`NewsDesk` collects unseen headlines and event-card openings and publishes on multiples of seven and thirty game days. It retains the month's events beyond the ticker's fifty-story cap and establishes a baseline on a new World/warp. It never fabricates missed historical editions. `PressCamera` explicitly renders the current camera and immediately copies it (with the campus sky) into a 640×360 WebP (PNG fallback is accepted); it does not turn on `preserveDrawingBuffer` or photo mode.

Editions arrive as Read/Skip notifications. Reading pauses the campus and restores the previous speed on dismissal. The modal traps focus, blocks campus hotkeys, closes on Escape and returns focus to its opener. Chat bubbles arrive with typing dots; Read all messages skips the animation. Reduced-motion users get all messages immediately. Event cards retain precedence.

The archive keeps the latest thirty editions per seed/lab in localStorage; mute and all three mixer levels have a separate persistent key. Persisted editions are validated. Quota failure retries without photos; blocked storage leaves an explicit session-only archive. Reloading does not auto-open old editions.

The rival tape is a fictional sentiment index generated for each edition, not a trading mechanic.

## See and reproduce

- Play normally: week seven delivers the first paper; day thirty delivers the first chat.
- Preview showroom: `/?debug=1&speed=0&warp=20&newsdemo=paper` or `newsdemo=chat`. This uses real transforms and camera capture with fixed example stories. It does not change the sim.
- `pnpm check` on Modal: typecheck, unit tests and production build.
- On Modal, with `pnpm preview` running: `node scripts/newsroom-check.mjs http://localhost:4173 docs/evidence/flt-7`.
- Browser checks exercise each cue through the mixer and render the same recipe in `OfflineAudioContext`, plus real build/bulldoze/release actions, density/camera changes, night/protest/training inputs, future-era/breakdown adapters, natural calendar publication, archive restore and phone layouts.

Test files run serially because the existing 500-walker test measures a wall-clock CPU budget. Its 0.3 ms/tick threshold remains unchanged.

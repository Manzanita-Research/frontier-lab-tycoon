# FLT-7 · evidence

Captured on the dedicated 1-vCPU Modal builder, Chromium with SwiftShader. Preview: the News Room showroom at `<builder>:4173/?debug=1&speed=0&warp=20&newsdemo=chat` (since retired).

`pnpm check`: typecheck passed, **150 tests in 24 files passed**, production build passed. The unchanged 500-walker budget measured **0.197 ms/tick** (limit 0.3). See [check.txt](check.txt) for the full output. Test files run serially to avoid competing workers skewing that budget. The existing large-chunk Vite warning remains.

## Screenshots

- [Front page](front-page.png): live campus photo, lead, three sub-stories, classifieds and rival quotes.
- [Group chat](group-chat.png): skeptic, doomer, accelerationist and Mom reacting to the month.
- [Phone chat](phone-chat.png), [phone paper](phone-paper.png): 390×844, touch viewport.
- [Archive](archive.png), [mixer](mixer.png).

The showroom screenshots use fixed example stories, with real UI, transforms and camera capture. The browser report also checks natural weekly and monthly delivery from a running sim.

## Sound checklist

Every cue was exercised through the real mixer controls, then rendered using its production synth recipe in Chromium's `OfflineAudioContext`. Each has nonzero measured output and peak amplitude below 0.95. This verifies the signal and wiring; human listening/taste review is available through **Campus sound → Try the sounds**.

- [x] Place thunk: descending sine plus short noise transient; also triggered by a real build command.
- [x] Coin clink: two pitched tones; unit test confirms five pitches.
- [x] Bulldoze crunch: filtered noise sweep plus low triangle; also triggered by a real bulldoze command.
- [x] Card slam: low impact plus noise; opening the News Room invokes it.
- [x] Choice click: short rising triangle; event closure invokes it.
- [x] Release fanfare: five ascending notes; also triggered by a real training release.
- [x] Era sting: six ascending notes; compatibility adapter exercised with debug `world.era`.
- [x] Breakdown alarm: three falling square pulses; adapter exercised with a debug broken building.
- [x] Crowd murmur: camera-visible density scales the bed; an empty camera view silences it.
- [x] Protest chant: fifteen protesters activate the rhythm; the quiet baseline has none.
- [x] Training hum: 40% → 90% progress raises its frequency.
- [x] Night crickets: pinned 22:00 gives full night ambience; daytime has none.
- [x] Music: four chords, era-selected key and tempo; mapping covered by unit tests.
- [x] Mixer: lazy first-tap unlock, mute, master/music/effects levels persisted and restored after reload; mute ramps master gain to zero.

See [browser-report.json](browser-report.json) for individual RMS/peak measurements and browser assertions. The current base has no era/breakdown sim mechanics; integration contracts are described in [the slice notes](../../specs/FLT-7.md).

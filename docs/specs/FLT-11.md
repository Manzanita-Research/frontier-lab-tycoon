# FLT-11: Endings + share card + daily seed

_Copied from the FLT-11 task description. Build notes and decisions where the spec is silent: the last section._

**Slice 4 · Endings + Share · Sonnet 5.5 builder · starts after FLT-5 and FLT-7 merge**

**Screenshot moment:** **The Takeover.** You win the race and the AI politely takes over. Your cursor moves by itself, placing perfect buildings. The title becomes "Frontier Lab Tycoon (managed by Frontier-9)", and a final card says: "Thanks for playing. We'll take it from here."

**Build**
- **The Memo** (an Era 4 event, the AI-2027 fork): **Race** or **Slow Down**.
- **Five endings, each a machine-driven sequence ending on a front page:**
  - **The Takeover:** Race while ahead on capability.
  - **Regulated Utility:** Slow Down. The campus turns beige and the buildings get compliance stickers. "Lab achieves safety; nobody notices."
  - **Acqui-hired:** bankruptcy. A Macrohard logo gets slapped on your gate.
  - **Captured:** the Capture meter is maxed. You become the regulator, and your office moves off-campus.
  - **Escaped:** Escaped Agent Inc. reaches #1.
- **Share card:**
  - A 1200×630 PNG: a *Frontier Times* front page with the ending headline, a photo-mode capture of your campus, your stats (days, peak Vibes, models released, peak protesters, agents escaped) and your lab name.
  - **Share** uses the Web Share API on phones and downloads the file elsewhere.
- **Daily seed:**
  - "Today's lab" uses a fixed seed per date.
  - The end screen shows your run summary, so friends can compare the same seed.

**Done when:** `pnpm check` is green; tests cover every ending's trigger path, and a scripted playthrough reaches each ending. Screenshots: each ending's front page, plus a phone share. Preview link posted here.


## Build notes (where the spec was silent, we picked the funnier option)

- **Who takes over:** your own next model. A lab that shipped Frontier-4 is "managed by Frontier-5" (`rules.endings.takeover.managerOffset`); Frontier-9 is the fallback name when you shipped nothing. The spec's line is kept word for word on the last card.
- **The Takeover keeps going.** The cursor (a white arrow with a name tag, drawn above the HUD) glides to a spot, clicks, and a building appears; the autopilot pays for its own buildings ("Nobody asks where from") and politely declines yours ("Frontier-5: I've got this."). The browser tab's title changes too. After a week a centred line says "Thanks for playing. We'll take it from here.", and two days later the front page goes to press. "Keep watching" lets you keep watching.
- **Five endings, not the listed five:** Escaped needs the Sandbox Escape, which doesn't exist yet, so **The Pivot** takes its slot. The old deadline game-over is now a front page ("Reward Hacking Holdings Pivots To Selling AI-Generated NFTs Of Its Own GPUs"). Acqui-hired likewise replaces the bankruptcy loss.
- **Race while behind** still ends in The Takeover once you catch up to #1, or after 150 days of racing (the race eventually gets you there anyway).
- **Captured** reads FLT-22's `capture` meter and reads 0 when it isn't there, so it can't fire before that PR lands; a staged test covers both cases.
- **Campus looks per ending** (the same in every skin): Regulated Utility turns the campus beige (it's in the share-card photo too) and puts a COMPLIANT ✓ sticker on every building; Acqui-hired hangs "A Macrohard company" on the gate; Captured turns the gate into the Office of Frontier Oversight's field office; The Pivot hangs NOW PIVOTING.
- **The share card** is drawn on a canvas, so it's the same everywhere: the front page on the left (masthead, headline, a photo of *your* campus taken the moment the paper went to press, the deck, one sub-story, a rubber stamp with the ending), and the run on the right (lab name, "The end: …" pill, an era strip in coloured squares, one per stretch of the run, ending in a chequered flag, and the five stats). Each of the six skins wraps it in its own chrome: Frontier 95 puts it in Internet Exploder windows over a taskbar clock stuck at 4:20 PM; Homepage 98 has a starfield, a hit counter ("You are visitor #000451") and "Best viewed at 1200×630"; Karaoke Night gets neon; Discovery Disc 96 gets a CD stuck on the corner; Field Almanac makes it Plate XI; Swag Drop adds a LIMITED RUN sticker. The card doesn't use emoji (headless browsers and some phones draw them as boxes); the squares and the flag are painted.
- **Share button:** the card is printed as soon as the front page appears, because phones only open the share sheet straight after a tap. On a touch device that can share files, you get the share sheet; anywhere else it downloads `frontier-times-<lab>-<ending>.png`. **Copy run summary** copies a text version for group chats (the seed or Today's date, lab → ending, the era squares with the ending's emoji, the stats and the headline).
- **Today's lab:** `?seed=daily` (or the end screen's "Play today's lab") seeds the lab from the player's local date (FNV-1a + a murmur finaliser, `src/sim/daily.ts`). The card's panel is titled "Today's lab", its footer says "Sep 30, 2026 · Same lab, same seed. Beat me.", and the summary opens with "Today's lab, Sep 30, 2026".
- **Frontier 95** gets its own ending slot: the paper in Internet Exploder 3.0 (`http://www.frontier-times.example/the-end/takeover`), the run in `RUN.TXT - NoteBad`, and the thanks line as a message box with a greyed-out OK: "Frontier-5 will click it for you." The other five skins use the base slot in their own colours.

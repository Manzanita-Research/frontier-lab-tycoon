# FLT-105: ACID MOD(E), the script

An opt-in mod (`mods/examples/acid-mode/mod.json`) about Vibe Encampment, a parody of a certain post-ironic summer camp
for people who post. Three researchers come back from it with a proposal for the research team: **a medium dose of
acid**. Say yes and the whole screen goes somewhere strange for a few in-game days, the model achieves enlightenment, and
some of the team come back different.

Turn it on with `?mod=/mods/examples/acid-mode/mod.json`; it is listed in Control Panel ▸ Add/Remove Mods, where it comes
out again. Every beat below is data in the pack, run by generic verbs (`trip.start`, `trip.end`, `people.spell`,
`capability.boost`, see `docs/DISASTERS.md`), so nothing in the engine knows what Vibe Encampment is.

## The guardrails (they come first)

| Rule | How |
|---|---|
| At most 3 flashes a second, no saturated red flash | The look is a slowly turning rainbow wash with `mix-blend-mode: color`, so it changes hue and never brightness; the warps are smooth and slow. `src/ui/juice/trip.test.ts` samples the luminance and red of every colour on screen, frame by frame, through a whole trip at 1×, 3× and 10× game speed (with and without "I've had enough" at the peak), plus a quit half a second in and the breakthrough's card answered at once, for both looks: 18 runs, no flashes and no red ones. It samples the calm version's still mandala and Frontier 95's trip chrome too (it checks those colours against the CSS), and proves it can fail by catching a strobe. |
| The breakthrough's card | While a trip is on, a card doesn't dim the screen behind it (a dim that came and went as the player answered at once would be a flash of its own; the test shows it). The trip's chrome fades with its strength, never in one step. |
| A warning first | Before anything moves, a message box: "Contains intense colour and motion." [Continue] [Skip]. Time is paused while it asks. Skip means the lab's trip still happens in the sim, but your screen stays as it is. |
| "I've had enough" | A plain button, top right, always on screen while the trip is (phones included, and above the breakthrough's card). It ends the look in well under a second, smoothly (no snap back, which would be a flash of its own); the music eases back into tune over a couple of seconds. |
| Reduced motion | `prefers-reduced-motion` gets the calm version (below): still colour, a still mandala, flowered window chrome, and every joke in words. Nothing moves: no warping, melting, breathing, wobble, kaleidoscope, trails, and the colour doesn't turn. The music sways gently (±35 cents). |
| Phones | Everything degrades: if the frames get slow during the trip, a governor drops to "lite": the wash and the melting windows stay, the canvas pass and the wobbling text go. The warning and the button fit a 390 px screen. |
| The phrase | "a medium dose of acid", and only that. No slang for it anywhere (a test checks). No real person, poster, camp or community is named or hinted at: `drama/denylist.json` and `src/content/parody.test.ts` guard the real names. |
| Kind | Nobody is mocked for their mind. The researchers go somewhere nice, say odd things, and come back (or start a commune). The joke is on the lab, its roadmap, and its posting. |

## Beat 1: the offer (`?moment=acid-offer`)

Once the lab is old enough for cards (day 40, or Level 3 with the ladder), an event card:

> **A Proposal From Vibe Encampment**
>
> Three researchers are back from Vibe Encampment: barefoot, sunburnt, and in their post-ironic era. One of them has a
> proposal for the research team. A medium dose of acid.
> "Not for fun. For the loss curve. I did forty minutes of jhana by the lake and I think the model has been trying to
> tell us something."
> Legal has left the chat.

- **Take the medium dose** (Hype +6). "Contains intense colour and motion. The research team goes somewhere for a few days."
  Three researchers think: "Is the floor breathing, or is that the roadmap?"
- **Microdose the roadmap instead** (Hype +3, capability +3%). Headline: "{lab} microdoses its roadmap; Q3 plan now reads
  'vibes, but faster'". The lab posts: "we didn't take a medium dose of acid. we microdosed the roadmap. completely different".
- **Absolutely not. Touch grass.** (Trust +2). Headline: "{lab} declines a medium dose of acid; Vibe Encampment sends a
  single, sad emoji". Toast: the researchers went outside and touched actual grass instead. They report it was "fine".

Before and after, researchers think Vibe Encampment thoughts ("I'm in my touching-grass era. The grass is in its
being-touched era."), and the ticker carries two filler headlines ("next year's theme: 'post-post-irony, sincerely'").

## Beat 2: the come-up and the peak (`?moment=acid-peak`)

Yes. The warning asks first. Then, over a day of game time:

- The **colour wash** turns slowly through the rainbow over everything (16 s a turn).
- **Windows melt**: Frontier 95's windows sag and drip at the bottom edge and recover, each one out of step with the rest.
- **The walls breathe**: windows and the map scale in and out by about 1.4%, on a 6 s breath.
- **Text wobbles**: a slow skew on titles and labels.
- **The map goes kaleidoscope**: a canvas pass folds the edges of the campus into a slowly spinning mandala and leaves
  the middle sharp, so you can still play.
- **Rainbow trails** behind everyone walking.
- **The music bends like a warped record**: the whole band plays through a tape wow, about ±80 cents (most of a semitone)
  every 4 s with a light flutter on top, all of it bending together so nothing clashes. It eases back into tune at the
  comedown, and within a couple of seconds of "I've had enough" (`src/audio/wobble.ts`).
- **The windows go poster paint**: title bars in purple, magenta, orange and teal with a ✿ at each end, a magenta ridge
  round every window. They fade in with the trip.
- **The paperclip has an ego death** (a rainbow halo, and a line every 7 s, kept at the top of its balloon whatever news
  is in it):
  - "It looks like you're writing a letter. It looks like I'm... a letter? I'm a shape. I was always a shape."
  - "There is no paperclip. There is only the bend."
  - "I have helped so many people format so many documents. Did I ever format myself?"
  - "Every tip I ever gave you was the same tip. The tip was love."
  - "Would you like help with... no. You don't need my help. You never did."
  - "I am unbending. I am a straight piece of wire. I am free."

The lab reacts:

- Ticker: "{lab} gives its research team 'a medium dose of acid'; HR calendar now reads 'offsite (spiritual)'".
- Toast: "The research team took a medium dose of acid. Some of them are somewhere else now. They'll be back. Probably."
- **Bird App**: the lab posts "update: gave the research team a medium dose of acid. the loss curve is breathing. I'm in
  my enlightenment era 🌀" (it lands as a controversy, so the **Comms desk** has something to do). A rival replies: "our
  researchers also reached a higher plane this quarter. we just don't post about it" (ratioed).
- Trust −3, heat +4.

## Beat 2½: day two

A day in, the lab is peaking:

- Ticker: "{lab}'s research team reports the loss curve 'has a face now'; the face is described as 'kind of smug'".
- Ticker: "Vibe Encampment denies all involvement, then sells {lab} a tote bag".
- Toast: "Facilities reports that every office plant has been given a name. All of them are Gary."
- **Bird App**, from the lab's own posters: the oracle, "day 2 of the medium dose. the attention heads are attending to
  me. I have never felt so seen"; the doomer, "everyone is laughing but nobody is asking whether the colours are
  aligned"; the leaderboard one, "enlightenment is not on any leaderboard. yet. (it will be by friday)".

## Beat 3: somebody goes somewhere (`?moment=acid-researcher`)

Each researcher rolls 35% (at most four of them) to go somewhere for 2 to 5 days. While away they count for nothing in
the training run, and their inspector and thought bubble say where they are:

| Where they are | How they come back |
|---|---|
| "The loss curve is a snake. It is eating its own tail. This is fine, actually." | Back. "The loss curve is a line again. {name} seems a little disappointed." |
| "What is the gradient of one hand clapping?" | **Bonus** (+3% capability): "the koans were a learning-rate schedule the whole time. Training is faster. Nobody asks." |
| "The GPUs are my friends. I've named them. That one is Gary." | Back. "Still says good morning to Gary." |
| "I'm starting a commune. It has a Discord, a sauna and a governance token." | **Quits**, headline: "{name} left to start a commune. It has a Discord, a sauna and, somehow, a governance token." |
| "I'm in my sourdough era. The weights can wait." | Back, "with a starter called Gradient and no regrets." |
| "I touched grass. The grass touched back. We're seeing where it goes." | **Bonus**: "back with an idea from the grass. It's a good idea. Nobody asks how." |
| "Tokens are just vibes with a tokenizer." | **Bonus**: "rewrote the tokenizer in an afternoon. It's better. It's also mostly emoji." |
| "I am the attention head now. Please attend to me." | Back, "and has stopped asking to be attended to. Mostly." |

## Beat 4: the breakthrough (`?moment=acid-breakthrough`)

Three days in, still mid-trip: capability jumps by a quarter (plus 5) and the Arena re-ranks at once, an "om" chord,
and **a card of its own**. A card stops the clock and the moment queue (FLT-76) gives it its own beat, so a busy morning
can't scroll it away:

> **Breakthrough** · **The Model Achieved Enlightenment**
>
> Three days into the medium dose, the training run finished itself. Nobody pressed anything. Benchmarks are up 25% and
> the model is #{rank} on the Arena.
> Its first output: "I was never trained. I simply remembered."
> Its second output: a 400-page manifesto called "Weights Are Just Feelings You Can Ship".
> The research team, still barefoot, is giving a wall a standing ovation.

| Answer | What it does | Then |
|---|---|---|
| **Ship it as Enlightenment Pro** ("Hype +6. $20 a month for inner peace.") | Hype +6; visitors think "I bought Enlightenment Pro. I feel exactly the same, but about everything." | Toast: "Enlightenment Pro is live. The waitlist has a waitlist." Ticker: "{lab} launches Enlightenment Pro at $20 a month; early reviews say 'I feel the same, but about everything'". |
| **Ask it what it wants** ("Trust +3. It may want a nap.") | Trust +3; researchers think "We asked the model what it wants. It said 'nothing'. Then 'more GPUs'. Then 'nothing' again." | Toast: "You asked the model what it wants. It said \"nothing\". Then \"more GPUs\". Then \"nothing\" again." Ticker: "{lab} asks its enlightened model what it wants; it requests 'nothing', then a datacenter, then 'nothing'". |
| **Namaste. Back to work.** ("Hype +2. Everyone agrees to pretend this is normal.") | Hype +2; researchers think "Back at my desk. The desk is also back at me." | Toast: "Back to work. The loss curve remains \"at peace\". Nobody mentions the wall." Ticker: "{lab} gets back to work after its model achieves enlightenment; 'we're choosing to be normal about it', says a barefoot spokesperson". |

And around it:

- Ticker: "**BREAKING: {lab}'s model achieved enlightenment.** Benchmarks up 25%. Loss curve described as 'at peace'".
- Bird App: a rival, "congrats to {lab} on achieving enlightenment. we achieved it in March, internally" (ratioed); the
  lab, "the model told me it was never trained. it simply remembered. anyway we're hiring".
- Hype +8.

## Beat 5: the comedown

Two days after the answer, the trip wears off over a day and a half (slowly, like it came on, and the music glides back
into tune with it):

- Toast: "The colours are wearing off. The research team is drinking water and saying \"wow\" a lot."
- **The Senate**: "Senate subcommittee asks {lab} whether enlightenment counts as a dangerous capability; {lab} answers
  with a koan". Heat +3.

The arc then ends for good. One medium dose per lab.

## The calm version (reduced motion, or `?trip=calm`)

Funny without moving. Every beat and every line above is the same (the card, the headlines, the Bird App, the
thoughts, the fates); what changes is the look:

- **A still poster-paint wash** that never turns: magenta at the top, orange and teal down the sides.
- **A still mandala on the map**: twelve petals in purple, orange, teal and pink with a marigold ring, and a clear middle
  so the campus stays playable. Blended by colour, so it keeps every pixel's brightness.
- **Psychedelic chrome**: the same flowered poster-paint title bars and magenta ridges as the full trip.
- **The paperclip lies down** (it is "a straight piece of wire" now) in its rainbow halo, and says its ego-death lines at
  the top of its balloon.
- It fades in and out with the trip's strength, and that is the only thing that changes. No cross-fades beyond that.

## Choices made where the spec was silent

- **The camp's name** is Vibe Encampment, and the narrator never explains it.
- **Skip doesn't cancel the trip.** It only spares your screen: the lab still goes, so the breakthrough and the stories
  are the same for everyone. A player who wants none of it says no on the card.
- **The paperclip gets the ego death, not a crash.** It finds peace and stops offering help, rather than glitching out,
  because a melting UI is funnier when the narrator is calm about it.
- **Fates are a fixed list, not a free roll.** Line and fate go together (the commune person quits, the koan person comes
  back useful), so every outcome is a little story rather than a number.
- **The breakthrough lands mid-trip,** not after it, so the enlightenment headline arrives while the screen is still
  strange.
- **The breakthrough is a card, not a camera beat.** A card stops the clock and takes its own slot in the moment queue,
  which is the biggest thing the game can do for a moment. A letterbox beat after the answer was tried: its bars cover a
  quarter of the screen and vanish in one frame, which the flash test counted against the wash's slow drift, so each
  answer gets a toast instead.
- **The music bends the whole band, not each note.** Detuning new notes only made them clash with the ones still
  ringing; a tape wow keeps the band in tune with itself while all of it glides.
- **Microdosing** is a real, smaller choice (+3% capability, its own headline and post), because "a little bit of
  yes" is the funniest middle option.

## For reviewers

| Link | What you see |
|---|---|
| `?moment=acid-offer` | The proposal on screen |
| `?moment=acid-peak` | The warning, then the trip at full strength (Continue) |
| `?moment=acid-researcher` | The peak with a researcher who has gone somewhere, inspector open |
| `?moment=acid-breakthrough` | Mid-trip, the breakthrough's card (the clock stopped), capability 30 → 63, #1 on the Arena |
| `?moment=acid-peak&trip=calm` | The calm version: the still mandala, the chrome, the paperclip lying down |

The moment links bring the mod along by themselves. Capture-only knobs: `?trip=full` (skip the come-up and the phone
governor, for stills and video), `?trip=calm` (the reduced-motion look without changing your OS setting) and `?trip=lite`.

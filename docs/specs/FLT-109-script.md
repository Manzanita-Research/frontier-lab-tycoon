# FLT-109: the Slop Bowl is late, the script

Every line the late lunch can show, for Jem to read before it ships. It is a base pack (`mods/base-slopbowl`), so it turns up in
normal play: no mod to load. `src/sim/slopbowl/slopbowl.test.ts` checks that every string in the pack appears below.

## The story

The researchers' favourite lunch place, **Fancy Healthy Healthy Healthy Healthy Slop Bowl**, is three hours late. The order is due at noon on the
campus clock (one campus hour is 25 ticks, about 7.5 seconds at 1×, so the whole afternoon lasts about half a minute):

| Campus time | Beat | What happens |
| --- | --- | --- |
| 12:00 | **late** | The order is due and isn't here. A third of the researchers drift to the gate. A ticker line, two thought bubbles. |
| 13:00 | **hangry** | An hour late. Most of the lab waits at the gate, pacing and staring at it. **Research goes backwards** from here on, the Aura drops 3, two posters post and a rival lab gloats. At Level 5 the card goes up (below Level 5 there are no cards, and a toast says it instead). |
| 14:00 | **worse** | Two hours late. Everyone is at the gate. The Aura drops 4 more, two more posts, two rival labs pile on, and a headline. |
| 15:00 | **arrive** | Three hours late. A camera beat at the gate (letterbox, kicker LUNCH), and the courier walks in with the bowls and talks with the researcher nearest the gate. |
| ~16:20 | **fed** | The courier finishes talking and the bowls are handed out (or at 17:00 if the courier never got there): everyone gets +0.15 energy and focus, the Aura gets 2 back, and the run wins back what it lost (double speed until it's repaid). |
| two hours after | quiet | Back to normal. |

**Research going backwards:** while hungry, each day of training takes away 75% of what it would have added (never below 0), and
Frontier 95's training window says "estimating time remaining…". Once fed, the lab wins it back at a day's gain a day on top of
the day's own, so the cost in the end is the hours nobody trained.

**Aura** is the Bird App's (FLT-69): −3, −4, then +2 with the bowls, so −5 net (two controversies' worth). With the Bird App
asleep (`?birdapp=off`) the Vibes take it instead, ten Vibes a point.

## Odds and pacing

- One roll at each campus noon (one campus day is 30 game days, three real minutes at 1×): **30%**, on the pack's own random stream, so a lab whose lunch is never late plays exactly as before.
- Only with at least 4 researchers on staff, not in the first 10 days after the pack wakes, and never two noons running (45 days apart at least). In a year of play that's 2 to 5 late lunches (six seeds of a busy lab).
- Wakes with the Bird App at **Level 3** (Growing team), through `PACKS` in `src/sim/progression.ts`. `?slopbowl=off` keeps it asleep.
- **The card (FLT-54):** one card, `slopbowl`, its own story, and **minor**: when the card budget is spent (or at 10×) it doesn't wait. The chief of staff picks "Wait. It's worth it." and the ticker says so. Cards only exist from Level 5, so before that the story plays without one.
- **Daily Drama:** a pack can make the next noon's order late with `{ "type": "flag.set", "params": { "name": "slopbowl:late" } }`.

## One-click links

Base: the PR's Workers Preview, or `pnpm dev`. Append:

| Beat | Query string |
| --- | --- |
| Two hours late: the crowd at the gate, research going backwards | `?moment=slop-late` |
| An hour late: the card | `?moment=slop-card` |
| Three hours late: the bowls arrive (with the camera beat held) | `?moment=slop-arrives&beat` |

## Every line

### The card: Lunch is an hour late

Stripe: “Order #1,141 · status: nearby”

> The Fancy Healthy Healthy Healthy Healthy Slop Bowl order for the whole lab is an hour late. The tracker shows the driver circling a roundabout. Your researchers are standing at the gate, and the model is getting worse out of spite.

- **Wait. It's worth it.** (Free · research slides backwards until the bowls come): nothing more.
- **Expense emergency granola** (−$30K · research slides half as far): research slides half as far.
- **Order a backup bowl from the same place** (−$15K · it will also be late · two bowls each): two bowls each when they come: +2 more Aura, +40 Vibes and the backup toast.

### 12:00, late

- The ticker: “Lunch is late. The Fancy Healthy Healthy Healthy Healthy Slop Bowl tracker says the driver is "nearby".”
- Thought bubbles over 2 of the researchers waiting at the gate, from:
  - “It said noon. It's noon.”
  - “The tracker has said "nearby" for a while now.”
  - “I paid extra for the fourth Healthy.”
  - “Lunch should be here by now. I can feel it.”

### 13:00, hangry (an hour late)

- A toast (unless the card is on screen: the card says it): “Lunch is an hour late. Your researchers are hangry, and research is going backwards.”
- Aura -3
- A headline, one of:
  - “{lab} researchers report "vibes-based hunger" as lunch order passes one hour late”
  - “Sources inside {lab}: nobody has trained anything since noon, and several things have been un-trained”
- Thought bubbles over 3 of the researchers waiting at the gate, from:
  - “Hangry is a valid research methodology.”
  - “If lunch isn't here soon I'm deleting the eval suite.”
  - “Staring at the gate makes it come faster. That's just science.”
  - “I can smell the bowls from here. I can't, actually. That's the problem.”
  - “I just reverted three commits out of spite. Not mine.”
- Bird App: 2 of the lab's posters post (spice 0.8), from:
  - “lunch is an hour late and i have started reverting commits. not mine. just commits”
  - “the Fancy Healthy Healthy Healthy Healthy Slop Bowl tracker has said "nearby" for 60 minutes. nearby to WHAT”
  - “hot take: hunger is a form of alignment pressure. cold take: where is my bowl”
  - “currently doing gradient ascent on my own frustration”
  - “every model i train while hungry comes out slightly meaner. this is not a metaphor. this is a bug report”
- Bird App: 1 rival lab(s) post, from:
  - “Our researchers had lunch at noon. Just a reminder that operational excellence starts in the cafeteria.”
  - “Thinking of everyone at {lab} today. We have a chef. Two, actually.”

### 14:00, worse (two hours late)

- Aura -4
- A headline, one of:
  - “Lunch delivery to {lab} now two hours late; tracker updates driver status from "nearby" to "spiritually nearby"”
  - “{lab} training run loses a day of progress as researchers "forget what a gradient is" waiting for lunch”
- Thought bubbles over 3 of the researchers waiting at the gate, from:
  - “The tracker moved! Away.”
  - “I have un-learned linear algebra.”
  - “One more "nearby" and I'm leaving to found a sandwich lab.”
  - “We're pacing in shifts now. I'm on second pacing.”
  - “Is quinoa a seed or a grain? I'd eat either.”
- Bird App: 2 of the lab's posters post (spice 0.85), from:
  - “two hours. we have started a reading group about the bowls”
  - “just watched a senior researcher try to fine-tune a kombucha”
  - “update: we are now pacing at the gate in shifts”
  - “if the bowls don't come soon i'm open-sourcing the hunger”
- Bird App: 2 rival lab(s) post, from:
  - “Wishing a speedy lunch to the folks at {lab}. Our evals went up 4% after the salad bar opened. Unrelated, probably.”
  - “Hearing {lab} is training backwards today. Bold research direction.”
  - “Our lunch arrived at 11:58. We also shipped twice before dessert.”

### 15:00, the bowls arrive (three hours late)

- Camera beat at the gate, kicker **LUNCH**: “Three hours late, the Fancy Healthy Healthy Healthy Healthy Slop Bowl arrives” / “One driver. A tower of bowls. No apology.”
- A headline, one of:
  - “Fancy Healthy Healthy Healthy Healthy Slop Bowl reaches {lab} three hours late; researchers call the quinoa "worth it" and "rude"”
- Thought bubbles over 3 of the researchers waiting at the gate, from:
  - “IT'S HERE.”
  - “Is that... a bowl?”
  - “I'm not crying, I'm hungry.”
- The **Slop Bowl Courier** walks in from the gate (in lettuce green) and talks with the researcher nearest it, courier first:
  1. “Order for... Fancy Healthy Healthy Healthy Healthy Slop Bowl?”
  2. “That's us. It's been three hours.”
  3. “Traffic. Also I went to the other lab first.”
  4. “Which other lab?”
  5. “Can't say. They tipped.”

### Fed

- A toast: “The bowls are here. Research is going forwards again, fast: nobody focuses like a researcher who has just eaten.”
- Aura +2
- Thought bubbles over 3 of the researchers waiting at the gate, from:
  - “Worth it.”
  - “This is the healthiest I have ever been, for about eleven minutes.”
  - “Four Healthys. I counted.”
  - “I'm going to finish this run. Then this bowl. Then the run again.”
  - “I forgive everyone. Except the tracker.”
- Bird App: 1 of the lab's posters post (spice 0.3), from:
  - “the bowls are here. i forgive everyone. except the tracker”
  - “post-lunch me would like to apologise for pre-lunch me's last six posts”
  - “update: fed. the model is learning again. so am i”

### After the granola (the card's second answer)

- Thought bubbles over 2 of the researchers waiting at the gate, from:
  - “This granola is 40% seeds and 60% regret.”
  - “Emergency granola. Tastes like a compliance training.”
  - “It's not lunch. But it's not nothing.”

### The backup order (the card's third answer, with the bowls)

- The ticker: “Both orders arrived at once. Every researcher has two bowls. The Vibes are immaculate.”
- Aura +2
- Vibes +40
- Thought bubbles over 2 of the researchers waiting at the gate, from:
  - “Two bowls. This is the best day of my career.”
  - “The backup was also three hours late. Consistency is a feature.”

`{lab}` is your lab's name. The ticker's line for a minor card answered for you is the game's own ("Your chief of staff handled \"Lunch is an hour late\" while you were busy: Wait. It's worth it.").

## Parody check

No real restaurants, delivery apps, labs or people. The place is invented; "the tracker" and "the app" are never named; the rival
labs are the game's own parody labs, chosen at random by the Bird App. The parody scanner reads `mods/base-*/**/*.json`.

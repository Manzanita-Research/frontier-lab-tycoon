# FLT-109: the Slop Bowl is late, the script

Every line the late lunch can show, for Jem to read before it ships. It is a base pack (`mods/base-slopbowl`), so it turns up in
normal play: no mod to load. `src/sim/slopbowl/slopbowl.test.ts` checks that every string in the pack appears below.

## The story

The researchers' favourite lunch place, **Fancy Healthy Healthy Healthy Healthy Slop Bowl**, is **three days late**. Game days are what the player sees go by
(the date in the corner; a game day is about 6 seconds at 1×), so the lateness is counted in days, and a delivery tracker
keeps slipping its ETA the whole time. The order is due at noon on the campus clock.

| When | Beat | What happens |
| --- | --- | --- |
| Day 1 (due) | **late** | The **Order Tracker** pops up: “Arriving in 5 min”, “Your courier is nearby”. A third of the researchers drift to the gate. A ticker line, two thought bubbles. |
| +1 day | **hangry** | The ETA slips to “Arriving in 12 min” (the old one struck through). Most of the lab waits at the gate, pacing, with red anger marks over their heads. **Research goes backwards**, the Aura drops -3, two posters post, a rival lab gloats, and a toast says so. At Level 5 the card goes up instead of the toast. |
| +2 days | **worse** | “Your courier has entered a period of reflection”. Everyone is at the gate. Aura -4, two more posts, two rival labs pile on, a headline. |
| +2½ days | **meltdown** | “Day 3 of the … being late”. 2 researchers **lie down on the floor** at the gate and stay there. Aura -2, one more rival post. |
| +3 days | **arrive** | A camera beat cuts to the gate (letterbox, kicker LUNCH), and the **courier walks in carrying a paper bag of bowls** and talks with the researcher nearest the gate. The tracker: “Arriving now”. |
| a few hours on | **fed** | The bowls are handed out: **every researcher walks about with a bowl, lifting it to eat** for 2 days, +0.15 energy and focus each, Aura +2, and the run wins back what it lost (double speed until repaid). The tracker says “Delivered three days late. Rate your courier: ★★★★★ (mandatory)” and stays up for ten days, or until it's closed. |

**Research going backwards:** while hungry, each day of training takes away 60% of what it would have added (never below 0); the tracker says
“Research is going backwards” and Frontier 95's training window says "estimating time remaining…". Once fed, the lab wins it back at a
day's gain a day on top of the day's own, so the cost in the end is the days nobody trained.

**Aura** is the Bird App's (FLT-69): −3, −4, −2, then +2 with the bowls, so −7 net. With the Bird App asleep (`?birdapp=off`) the
Vibes take it instead, ten Vibes a point.

**At 3× and 10×:** the three days go by in 6 and 2 seconds, so the tracker is what carries it: it opens when the order is late and
stays ("Delivered…") for ten game days after the bowls come, or until it's closed. The card is minor (FLT-54), so at 10× it
answers itself and the ticker says so.

## The tracker

`Order Tracker`, `Order #1,141`. Frontier 95 draws it as a download dialog (blocks for the courier's progress, red while research
slides; every earlier estimate struck through; OK hides it until the next order). The other skins draw a toast-sized card with the
same lines. What it says at each stage (ETA / status / the courier's dot on the route, 0 to 1, which goes backwards too):

| Stage | ETA | Status | Route |
| --- | --- | --- | --- |
| late | Arriving in 5 min | Your courier is nearby | 0.8 |
| hangry | Arriving in 12 min | Your courier is having a moment | 0.62 |
| worse | Arriving in 26 min | Your courier has entered a period of reflection | 0.35 |
| meltdown | Arriving eventually | Your courier is asking what lunch really means | 0.5 |
| arriving | Arriving now | Your courier is at the gate | 1 |
| fed | Delivered | Delivered three days late. Rate your courier: ★★★★★ (mandatory) | 1 |

The day line: “Day {n} of the {place} being late” (`{n}` is the day of the lateness, `{place}` the place).

## Odds and pacing

- One roll at each campus noon (once per 30 game days, three real minutes at 1×): **30%**, on the pack's own random stream, so a lab whose lunch is never late plays exactly as before.
- Only with at least 4 researchers on staff, not in the first 10 days after the pack wakes, and never two noons running (45 days apart at least): 2 to 5 late lunches in a year of play.
- Wakes with the Bird App at **Level 3** (Growing team), through `PACKS` in `src/sim/progression.ts`. `?slopbowl=off` keeps it asleep.
- **The card (FLT-54):** one card, `slopbowl`, its own story, and **minor**: when the card budget is spent (or at 10×) it doesn't wait. The chief of staff picks "Wait. It's worth it." and the ticker says so. Cards only exist from Level 5, so before that the story plays without one.
- **Daily Drama:** a pack can make the next noon's order late with `{ "type": "flag.set", "params": { "name": "slopbowl:late" } }`.

## One-click links

Base: the PR's Workers Preview, or `pnpm dev`. Append:

| Beat | Query string |
| --- | --- |
| Day 3: the crowd at the gate, two on the floor, the tracker slipping, research going backwards | `?moment=slop-late` |
| A day late: the card | `?moment=slop-card` |
| Three days late: the courier with the bag (the camera beat held) | `?moment=slop-arrives&beat` |
| Fed: everyone eating | `?moment=slop-fed` |

## Every line

### The card: Lunch is a day late

Stripe: “Order #1,141 · status: having a moment”

> The Fancy Healthy Healthy Healthy Healthy Slop Bowl order for the whole lab is a day late. The tracker says the courier is "having a moment". Your researchers are standing at the gate, and the model is getting worse out of spite.

- **Wait. It's worth it.** (Free · research slides backwards until the bowls come): nothing more.
- **Expense emergency granola** (−$30K · research slides half as far): research slides half as far.
- **Order a backup bowl from the same place** (−$15K · it will also be late · two bowls each): two bowls each when they come: +2 more Aura, +40 Vibes and the backup toast.

### Day 1: late

- The ticker: “Lunch is late. The Fancy Healthy Healthy Healthy Healthy Slop Bowl tracker says the courier is "nearby".”
- Thought bubbles over 2 of the researchers waiting at the gate, from:
  - “It said noon. It's noon.”
  - “The tracker has said "nearby" for a while now.”
  - “I paid extra for the fourth Healthy.”
  - “Lunch should be here by now. I can feel it.”

### A day late: hangry

- A toast (unless the card is on screen: the card says it): “Day 2 of the Slop Bowl being late. Your researchers are hangry, and research is going backwards.”
- Aura -3
- A headline, one of:
  - “{lab} researchers report "vibes-based hunger" as lunch order passes one day late”
  - “Sources inside {lab}: nobody has trained anything since lunch, and several things have been un-trained”
- Thought bubbles over 3 of the researchers waiting at the gate, from:
  - “Hangry is a valid research methodology.”
  - “If lunch isn't here soon I'm deleting the eval suite.”
  - “Staring at the gate makes it come faster. That's just science.”
  - “I can smell the bowls from here. I can't, actually. That's the problem.”
  - “I just reverted three commits out of spite. Not mine.”
- Bird App: 2 of the lab's posters post (spice 0.8), from:
  - “lunch is a day late and i have started reverting commits. not mine. just commits”
  - “the Fancy Healthy Healthy Healthy Healthy Slop Bowl tracker has said "having a moment" for 24 hours. a MOMENT”
  - “hot take: hunger is a form of alignment pressure. cold take: where is my bowl”
  - “currently doing gradient ascent on my own frustration”
  - “every model i train while hungry comes out slightly meaner. this is not a metaphor. this is a bug report”
- Bird App: 1 rival lab(s) post, from:
  - “Our researchers had lunch at noon. Just a reminder that operational excellence starts in the cafeteria.”
  - “Thinking of everyone at {lab} today. We have a chef. Two, actually.”

### Two days late: worse

- Aura -4
- A headline, one of:
  - “Lunch delivery to {lab} now two days late; tracker says the courier "has entered a period of reflection"”
  - “{lab} training run loses a day of progress as researchers "forget what a gradient is" waiting for lunch”
- Thought bubbles over 3 of the researchers waiting at the gate, from:
  - “The tracker moved! Away.”
  - “I have un-learned linear algebra.”
  - “One more "period of reflection" and I'm leaving to found a sandwich lab.”
  - “We're pacing in shifts now. I'm on second pacing.”
  - “Is quinoa a seed or a grain? I'd eat either.”
- Bird App: 2 of the lab's posters post (spice 0.85), from:
  - “day 3 of the bowls. we have started a reading group about the bowls”
  - “just watched a senior researcher try to fine-tune a kombucha”
  - “update: we are now pacing at the gate in shifts”
  - “if the bowls don't come soon i'm open-sourcing the hunger”
- Bird App: 2 rival lab(s) post, from:
  - “Wishing a speedy lunch to the folks at {lab}. Our evals went up 4% after the salad bar opened. Unrelated, probably.”
  - “Hearing {lab} is training backwards this week. Bold research direction.”
  - “Our lunch arrived at 11:58. We also shipped twice before dessert.”

### Day 3: the meltdown

- The ticker: “Day 3 of the Slop Bowl being late. Two researchers are lying on the floor "to save energy".”
- Aura -2
- A headline, one of:
  - “Day 3: {lab} researchers lie down at the gate in what one calls "a low-power mode"”
- Thought bubbles over 2 of the researchers waiting at the gate, from:
  - “I'm not lying down. I'm horizontally scaling.”
  - “Wake me when there are bowls.”
  - “The floor is warm. The floor understands.”
- Bird App: 1 rival lab(s) post, from:
  - “Thoughts and prayers to {lab}'s researchers, who we hear are now on the floor. Our floor has a snack drawer.”

### Three days late: the bowls arrive

- Camera beat at the gate, kicker **LUNCH**: “Three days late, the Fancy Healthy Healthy Healthy Healthy Slop Bowl arrives” / “One courier. One bag. No apology.”
- A headline, one of:
  - “Fancy Healthy Healthy Healthy Healthy Slop Bowl reaches {lab} three days late; researchers call the quinoa "worth it" and "rude"”
- Thought bubbles over 3 of the researchers waiting at the gate, from:
  - “IT'S HERE.”
  - “Is that... a bowl?”
  - “I'm not crying, I'm hungry.”
- The **Slop Bowl Courier** walks in from the gate (in lettuce green, carrying a paper bag) and talks with the researcher nearest it, courier first:
  1. “Order for... Fancy Healthy Healthy Healthy Healthy Slop Bowl?”
  2. “That's us. It's been three days.”
  3. “Traffic. Also I went to the other lab first.”
  4. “Which other lab?”
  5. “Can't say. They tipped.”

### Fed

- A toast: “The bowls are here. Everyone is eating, and research is going forwards again, fast: nobody focuses like a researcher who has just eaten.”
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
  - “The backup was also three days late. Consistency is a feature.”

`{lab}` is your lab's name. The ticker's line for a minor card answered for you is the game's own ("Your chief of staff handled \"Lunch is a day late\" while you were busy: Wait. It's worth it.").

## Parody check

No real restaurants, delivery apps, labs or people. The place is invented; "the tracker" and the courier are never named; the rival
labs are the game's own parody labs, chosen at random by the Bird App. The parody scanner reads `mods/base-*/**/*.json`.

**Bird App: researchers who post** (explore; lead plan, Opus 5.5 xhigh). Priority: after the current five (saves first). FLT self-merges with before/after screenshots.

**The joke:** your best researcher is also your biggest liability, and they're online at 3am.

### 1. Posters
- **Every researcher gets a posting profile.** Their tier is one of **recluse** (never posts), **occasional**, or **big account** (followers, and they carry the lab). They also have an **archetype** and a personal **spice** level.
- **Archetypes** (invented, with no real names or handles; affectionate satire of the type):
  - **The Midnight Oracle:** cryptic vibe-posts at 3am ("the vibes are shifting. that's all i can say").
  - **The Launch Hype Account:** "shipping something big tomorrow 👀", every day.
  - **The "We're So Back" duo:** two researchers who post in tandem ("we're so back" / "it's so over", sometimes on the same afternoon).
  - **The Thread Guy:** "1/47 things I learned training a model you can't use".
  - **The Leaderboard Screenshotter:** posts benchmark screenshots with 🚀.
  - **The Brunch Doomer:** long posts about p(doom), written at brunch.
  - **The Anon Alt:** a researcher's pseudonymous account that everyone knows about.
- **Handles** come from a parody generator (`@vibes_after_midnight`, `@so_back_twice`). A test guarantees no real handle or name.
- **Tiers move:** bangers grow followers and can promote an occasional poster to a big account; a cancel drops them.

### 2. Aura (my call: its own meter, but no new HUD slot)
- **Aura** lives inside the Bird App panel. It **feeds Hype**, raises visitor spawns and job applicants, and big accounts carry most of it.
- The top bar stays as it is. The Vibes breakdown gets one "Aura" row.

### 3. Bangers vs getting cancelled
- **Daily, deterministic:** each poster may post. Odds depend on their tier and archetype and on the moment (a launch, a rival drop, the water discourse, a hearing, 3am).
- **Every post has a *spice*.** Spicier posts have higher variance: more bangers **and** more cancels.
- **Outcomes:**
  - **Flop:** nothing.
  - **Banger:** Aura, hype, visitors and applicants up.
  - **Controversy:** a ticker headline, faction meters move, a protest spike.
  - **Ratioed:** a small Aura dip and a sulk ("Got ratioed by a toaster account").
  - **Cancelled:** Aura crash, a protest spike, the Comms load spikes, and the poster may leave, take a 30-day "posting break", or become a poaching target (rivals love a big account).
- **Player levers**, per poster, with the trade-off shown on the button:
  - **"Let them cook"** (full spice)
  - **"Run it by Comms"** (less spice, fewer bangers, and it uses Comms Rep capacity)
  - **"Please log off"** (no posts; mood drops, and heavy posters may quit)
- **Comms Reps** (existing staff) soak up controversies. **Too many at once and the PR team drowns**: a visible queue, and cancels stick.

### 4. Legibility
- **The Bird App timeline panel** shows the lab's posts live: likes and reposts ticking up, replies, and each poster's **banger ↔ cancel meter**. It also has a post log with outcomes. A post that "went viral" gets a sticker.
- **Native in every skin:**
  - **Frontier 95:** an ICQ/newsgroup reader called "Bird Reader 1.0".
  - **Homepage '98:** a guestbook.
  - **Field Almanac:** a literal bird-watching log ("Sighted: one banger, 06:12, plumage bright").
  - **Discovery Disc '96:** encyclopedia entries.
  - **Karaoke Night:** the lyric screen.
  - **Swag Drop:** printed on merch.

### 5. Hooks into what exists
- **Thought bubbles:** "Drafting a banger. Deleting it. Drafting it again."
- **Frontier Times and the ticker:** viral posts and cancels become headlines.
- **Poaching and Defection:** big accounts are poaching targets, and cancelled posters may defect.
- **Factions:** controversies move faction meters.
- **Daily Drama:** a new mod content section `birdapp` (posts, archetypes, events) plus a `birdapp.post` vocabulary action, so drama packs can make the timeline react to the day's news.
- **Notifications (FLT-51):** posts are `world`; your researcher's viral moment or cancel is `you`.
- **Unlock:** the pack wakes at **Level 3** (the team is big enough to have posters) through the `PACKS` table, with `?birdapp=off`.

### 6. Rules and evidence
- **Parody names only:** no real names or handles. Extend the name scanner with a handle check.
- **Perf:** daily only; the per-pack budget (≤0.06 ms at 800 walkers) applies.
- **Evidence:**
  - sim tests (outcome distributions per spice, determinism, the levers);
  - before/after screenshots of the Bird Reader panel in Frontier 95, plus one other skin, and a cancel moment;
  - the journey test green.

**Build:** one Opus builder does the sim, the `mods/base-birdapp` pack (at least 60 posts across archetypes and moments) and the Frontier 95 panel. A second, smaller pass does the other five skins' panels.



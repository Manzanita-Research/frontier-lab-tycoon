# FLT-70: The big box: 3D software-shelf intro (Maxis-core '96 box, manual, COA hero prop, boot → game) — Jem-approved

**The big box: the "marketing site" is a 3D 90s software-store experience, part of the same app** (explore; lead concept + plan, Opus 5.5 xhigh). Jem: "I don't want another 2D marketing site." Build a greybox first, after saves and the Worker-previews fix.

## The experience
1. **The shelf** (frontierlabtycoon.com): a 3D software-store shelf, "SoftWarehouse '97", under fluorescent light. Parody boxes line it (all invented titles). The **Frontier Lab Tycoon** box has a "NEW!" starburst, a $49.95 price sticker and a "Frontier 95 compatible" badge. Hover tilts a box; click pulls it off the shelf.
2. **The box opens** (a shrinkwrap crinkle, then the lid lifts). Inside:
   - the **thick manual**;
   - a **CD-ROM** in a jewel case, plus **floppies** ("Disk 1 of 7");
   - the **registration card** ("Mail today for exciting offers from our partners");
   - a **keyboard overlay**;
   - the **EULA in shrinkwrap** ("By breaking this seal you agree the model may be smarter than you");
   - **inserts for expansion packs**: *The Circus Expansion Pack*, *Bird App Online Edition (modem required)*, a *Daily Drama* subscription card, and a **"Modules Coming Soon"** catalogue.
3. **The manual is real and fun.** Chapters: Getting Started · Your First Lab · The Crowd · The Race · The Circus · Endings · **Chapter 9: Modding with Layers** (adapted from `docs/EFFECT-FOR-MODDERS.md`) · Troubleshooting ("If an agent escapes, check the fence") · Credits. Pages turn in 3D. The same content is a plain HTML page at `/manual`, for search and accessibility.
4. **Boot:** drop the disc into a beige tower on a desk. The CRT warms up and shows a BIOS POST ("Frontier BIOS v4.5 … 640K of context ought to be enough"), then the Frontier 95 splash. The camera dollies into the screen, and **the game is the desktop**. The Frontier 95 skin is already that computer.
5. **Returning players** (logged in, or a local flag) and any **shared link** (`?mod=`, `?skin=`, `?seed=`, `?vs=`), and anything on **app.frontierlabtycoon.com**, boot **straight into the game**. A Start-menu item, **Put it back on the shelf**, revisits the intro.

## Decisions (desk's recommendations adopted, plus mine)
- **One app, one Worker.** It's the same Vite app with host-based entry: the apex opens the shelf, and `app.` plus share links open the game. When M3 ships, the apex's temporary 302 Worker (from #70) is deleted and the apex attaches to `flt-prod`.
- **Never blocks.** "Skip intro →" is always visible, and any key skips. The shelf and game are separate code-split chunks; **the game prefetches while you browse the shelf**, so the boot is instant.
- **A real text layer:** static HTML for the headings, pitch, screenshots and `/manual`; OG and Twitter cards reuse **the FLT-11 share card** as `og:image`; `<noscript>` and reduced motion get a static box shot with **Play** and **Read the manual**.
- **Phones get a light path:** a lighter low-poly shelf, or a single box-front image with "Open the box" and "Play now". A **Play now** button is always one tap away.
- **Stack:** the game's own R3F + drei + postprocessing (bloom on the CRT, soft film grain, depth of field on the shelf). Budget: shelf payload under 3 MB before the game chunk; 60 fps desktop, 30 fps mid phones; a per-scene perf check.
- **Assets:** greybox from primitives first. The art pass uses Fal (FLT-68 pipeline) for hero props only: the box art, the manual cover, the CD label. Everything that moves stays procedural.
- **Sound** (FLT-66's audio kit): shrinkwrap, the CD tray, HDD whirr, a boot chime; muted by default until the first click.
- **Parody names only:** every shelf title, sticker and logo is invented, and the name scanner covers the shelf content.

## Milestones
- **M0 greybox (Jem-in-the-loop):** shelf → pick → open → contents → manual (2 real chapters) → disc → boot → game, all with placeholder art, on a PR Preview link for Jem to play.
- **M1 art pass** in the direction Jem picks: box art, manual design, insert copy, sound.
- **M2 content:** the full manual, including the modding chapter; the HTML/SEO layer; the phone path.
- **M3 domain:** the apex serves the shelf (drop the 302 Worker) and `app.` boots the game.

## Box-art and tone directions (Jem picks)
- **A: "Maxis-core '96"** (my recommendation). A bright painted isometric diorama of a chaotic campus on the front, a chunky chrome-bevel logo, and a starburst "Over 400 tiny researchers!". The back has screenshots and bullet points ("Build! Train! Get subpoenaed!") and "Ages 8 to Adult". It's the RCT and SimCity 2000 homage, and the most screenshot-able.
- **B: "Enterprise Edition CD-ROM."** A sleek black-and-teal business-software box, a glass tower with a glowing server, "Enterprise Edition: Now With AGI*" (*"Artificial General Intelligence not included"), a hologram sticker and a "$5 mail-in rebate". The lab as enterprise software.
- **C: "Edutainment, surreal-utopian."** A primary-colour Scholastic-style box ("Learn How Frontier AI Works!"), a friendly robot mascot next to a researcher in a hoodie, a "Parents' Concern Award" seal and "Includes Teacher's Guide". It matches Jem's round-2 "utopian Scholastic / web 1.0" note.
- **Recommended mix:** **A on the box**, with C's edutainment inserts and B's EULA and rebate jokes inside.


---
## Jem's decisions (via desk)
- **"Yeah let's do it! This all rocks."** Box art **A (Maxis-core '96)** outside, with **C's edutainment inserts** and **B's EULA/rebate jokes** inside.
- **Addition: a Windows 95-style Certificate of Authenticity**, a **hero prop you can tilt in the light**:
  - a **holographic/iridescent foil strip** that shifts with the view angle (thin-film interference or a view-dependent hue-ramp shader);
  - **guilloché and microprint** line patterns (procedural, crisp at every zoom);
  - an **embossed seal** (normal-mapped);
  - a serial / product key: **"Model Weights Key: XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"** (seeded per visitor, deterministic, invented).
- **The greybox includes the COA** with a placeholder foil shader; the art pass makes it gorgeous. Pick it up: drag to tilt and watch the foil shift.


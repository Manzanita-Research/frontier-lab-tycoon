# Duck mode (FLT-102)

Everyone in the lab is a rubber duck, and the lab's chatter quacks along. Researchers (glasses and a lanyard), agents
(chrome, with a visor and an antenna), visitors by role (the VC's fleece vest, the journalist's press fedora, the
buyer's briefcase, the influencer's selfie stick), protesters with a bandana and duck signs, the crew (the SRE in an
orange hard hat, Security's cap and badge, Comms' scarf, the janitor's mop) and the auditors' clipboards: all ducks,
all waddling. The thoughts, toasts, ticker, event cards, Bird App, newspaper and ending paper come out in duck. The
buttons and the numbers stay readable, unless you ask for full duck.

It is all presentation: recipe looks (no files) and a voice. With the mod off nothing changes, and with it on, the sim,
the goldens and the replays are untouched.

## Try it

- In the game: Start ▸ Settings ▸ Mods… ▸ **Add**. It joins the lab on screen, no reload, and Remove takes it out again.
  Once it is on, the window's voice picker switches between Off, Flavour text and **Everything, menus too** (full duck).
- From the address: `?mod=/mods/examples/duck-mode/mod.json`, plus `&voice=full` for full duck or `&voice=off` to keep the
  ducks and drop the voice.
- A mid-game lab: `/?scenario=midgame&seed=48&skin=frontier-95&mod=/mods/examples/duck-mode/mod.json`
- The Bird App: `/?moment=bird-rivals&mod=/mods/examples/duck-mode/mod.json`
- A sea of ducks: `/?scenario=midgame&seed=48&skin=frontier-95&focus=10,17&zoom=85&mod=/mods/examples/duck-mode/mod.json`
- Full duck: `/?scenario=midgame&seed=48&skin=frontier-95&mod=/mods/examples/duck-mode/mod.json&voice=full`

## The name

In the game it is **wubba ducki3**: the mod's title, its voice, and its entry and voice picker in Add/Remove Mods. The
name lives in ONE constant, `DUCK` in [`name.ts`](name.ts), and the mod, its bundled `mod.json` and the Add/Remove Mods
entry all read it. To rename it, edit `name.ts` and re-bundle.

Every duck line here is original.

## How the voice works

The rules apply word by word, and each line seeds its own dice from its own text, so the same headline always comes out
the same and the game's RNG is never touched:

- about 40 whole-word swaps (the → da, with → wif, that → dat, world → wowd);
- r → w and l → w most of the time, and the odd l33t letter;
- everything lowercase;
- a sentence that trails off now and then;
- an opener ("*squeak*", "fwend...", "i wondew...") on some long lines;
- one or two of 🦆 🤔 ✨ 🫧 at the end.

Numbers, money, percentages, model names with digits, handles and the loaded mods' names are left alone. Full duck uses
the same voice without the emoji, openers or ellipses, so a button stays a button.

Re-bundle after editing `mod.ts`: `pnpm flt-mod bundle mods/examples/duck-mode mods/examples/duck-mode/mod.json`.
`src/mods/duckMode.test.ts` checks that the JSON matches and that the samples below are what the voice says.

## Before and after

The game's own headlines:

| Before | After |
| --- | --- |
| The Arena shuffles again: every lab is #1 in a category it invented | da awena shuffwes again: evewy wab is #1 in a categowy it invented 🦆🦆 |
| Lab replaces onboarding with a prompt; new hires report 'a strange sense of relief' | wab wepwaces onboawding wif a pwompt; new hiwes wepowt 'a stwange sense of welief' ✨ |
| Status page: all systems operational. | status p4ge: aww systems opewationaw. 🤔 |
| Demo Stage goes down live. Recording of previous demo shown in its place | demo Zt4g3 goes down wive. wecowding of pwevious demo shown in its pwace 🤔 |
| Executive says AGI is 'two years away' for the fourth year running | executive says agi is 'two yeaws away' fow da fouwth yeaw wunning 🤔✨ |
| Study finds chatbots agree with you 94% of the time; scientists call the study 'brilliant' | study finds chatbots agwee wif you 94% of da time; scientists calw da study 'briwwiant' 🫧 |
| Kombucha Bar opens: vibes up 12%, bloating up 800% | kombucha baw opens: vibes up 12%, bloating up 800% 🤔🫧 |
| Study finds most of the water in the discourse was recycled from an earlier discourse | study finds most of da watew in da d1Zc0uwZ3 was wecycwed fwom an eawwiew discouwse 🦆🦆 |

The walkers' thoughts:

| Before | After |
| --- | --- |
| I'd leave for $100M. Asking for a friend. | i'd weave for $100M. asking for a fwend. 🤔 |
| No kombucha. Updating my résumé. Aggressively. | no kombucha... updating my wésumé. aggwessivewy... 🫧🦆 |
| Someone asked for my autograph. I said I'm the intern. | someone asked fow my autogwaph. i said i'm da intern... 🦆✨ |
| I noticed a test was failing, so I deleted it. You're welcome. | i noticed a test was faiwing, so i deleted it... you'we welcome... 🫧🦆 |
| I'm trending. I don't know why. I'm a spreadsheet with legs. | i'm twending... i don't know why. i'm a spreadsheet wif legs. ✨✨ |
| I brought a resume, a Series A pitch, and snacks. | *squeak* i bwought a wesume, a sewies a pitch, and snacks. ✨ |
| This is basically a theme park. Where's the churro? | dis is basicawwy a theme pawk. whewe's da chuwwo? 🤔🦆 |
| Nothing good happens after midnight, except the eval. | fwend... nuffin good happens after midnight, except da evaw... ✨ |
| Is the tour still on? It's dark. Why is everyone still here? | i wondew... is da touw stilw on? it's dark... why is evewyone stiww hewe? ✨ |
| I automated the intern. The intern says thanks; it was a lot. | i automated da intewn. da int3wn says thanks; it was a wot... 🫧 |

Full duck, on the menus and buttons (the quiet voice):

| Before | After |
| --- | --- |
| Add/Remove Mods Properties | Add/Remove mods pwoperties |
| Hire an SRE | hire an swe |
| Reach Era 3: Superhuman Coder | reach ewa 3: supewhuman codew |
| Copying the internet into Frontier-5-Chat-Ultra-Experimental-0602... | copying da internet into Frontier-5-Chat-Ultra-Experimental-0602... |
| Publish or Perish — 3 to publish | pubwish or pewish — 3 to pubwish |
| Ship 3 models (3/3) — shipped | sh1p 3 modews (3/3) — shipped |

## The hand-written lines

Said as a toast when the moment starts, one per moment (the same moment on the same day picks the same line).

**Shipping a model** (`ship`)

- we shipped a modew... but did da modew ship us 🦆
- new weights just dwopped... i can feew dem in my bubbwes 🫧
- evewy wewease is a widdle egg... dis one is hatching ✨
- shipped it. da benchmawks awe just numbews... da vibes awe da weaw evaw 🤔

**A level-up** (`level`)

- wevew up... but awe we gwowing, ow is da pond getting smawwew 🤔
- new wevew unwocked. same duck. bettew duck? 🦆
- da wadder has anuvva wung... i fwoat up it 🫧

**A new era** (`era`)

- a new ewa... da watew is a diffewent tempewatuwe now 🫧
- time moves. ducks fwoat. dat is aww i know 🦆

**A leak** (`leak`)

- da weights got out... can u weawwy own a fought 🤔
- someone weaked da chat... da pond is vewy twanspawent today 🫧
- secwets do not fwoat... dey sink... den dey pop up anyway 🦆

**The Senate hearing** (`senate`)

- da senatows want answews... i onwy have quacks 🦆
- testifying today. i wiww say 'squeak' undew oaf 🤔
- da heawing woom smewws wike powished wood and feaw ✨

**An escape** (`escape`)

- one of da agents weft da bathtub... fwy fwee widdle one 🫧
- it got out. awen't we aww just twying to get out of a tub 🤔

**An ending** (`ending`)

- and so da pond goes stiww... fanks fow fwoating wif me 🦆
- evewy wab ends... but da duck... da duck wemains ✨
- game ovew? ow game... pond? 🤔

// The manual in the box (FLT-70 M0): a cover, the contents, two real chapters and a back cover. Chapter 1 is how the
// game actually plays; Chapter 9 is adapted from docs/EFFECT-FOR-MODDERS.md (and says it is an early draft). The full
// manual, and the same words as an HTML page at /manual, are M2. Data only: `Book3D` draws each page onto a canvas.

export type Block =
  | { t: "h"; text: string }
  | { t: "p"; text: string }
  | { t: "list"; items: string[]; numbered?: boolean }
  | { t: "tip"; text: string }
  | { t: "code"; text: string }
  | { t: "table"; rows: [string, string][] }
  | { t: "stamp"; text: string };

export type Page =
  | { kind: "cover" }
  | { kind: "back" }
  | { kind: "text"; chapter?: string; title?: string; blocks: Block[]; folio?: number };

export const CHAPTERS = [
  { n: 1, title: "Getting Started", page: 1, printed: true },
  { n: 2, title: "Your First Lab", page: 23, printed: false },
  { n: 3, title: "The Crowd", page: 41, printed: false },
  { n: 4, title: "The Race", page: 58, printed: false },
  { n: 5, title: "The Circus", page: 77, printed: false },
  { n: 6, title: "Endings", page: 96, printed: false },
  { n: 7, title: "Troubleshooting", page: 104, printed: false },
  { n: 8, title: "Credits", page: 131, printed: false },
  { n: 9, title: "Modding with Layers", page: 133, printed: true },
];

const STEVE = `{
  "apiVersion": 1,
  "id": "every-lab-is-steve",
  "name": "Every Lab Is Named Steve",
  "version": "1.0.0",
  "content": { "rivals": { "override": [
    { "id": "anthro", "name": "Steve (Safety-Flavoured)" },
    { "id": "openish", "name": "Steve (Formerly Non-Profit)" }
  ] } }
}`;

/** Twelve pages, six sheets. Sheet i carries page 2i on its front and page 2i+1 on its back. */
export const PAGES: Page[] = [
  { kind: "cover" },
  {
    kind: "text",
    title: "Contents",
    blocks: [
      { t: "table", rows: CHAPTERS.map((c) => [`${c.n}. ${c.title}`, c.printed ? String(c.page) : `${c.page}*`]) },
      { t: "p", text: "* Chapters 2 to 8 were not printed in time for the shipping date. The model that was writing them asked for more compute. We are in talks." },
      { t: "tip", text: "Welcome, Director. Thank you for choosing Frontier Lab Tycoon. You are now responsible for a frontier AI lab, a campus, and roughly four hundred people with opinions." },
    ],
  },
  {
    kind: "text",
    chapter: "Chapter 1",
    title: "Getting Started",
    folio: 1,
    blocks: [
      { t: "h", text: "Installing" },
      { t: "list", numbered: true, items: ["Insert the CD-ROM.", "Wait for the BIOS to finish counting to 640.", "That's it. It installs itself. We have stopped asking how."] },
      { t: "h", text: "Your campus" },
      { t: "p", text: "You start with a gate, a patch of grass, and seed money. Everyone in your lab walks on paths, so the first thing you build is a path from the gate. A building with no path to it gets no visitors, no researchers, and eventually a very sad plaque." },
      { t: "tip", text: "Drag to paint a path. It snaps to the grid. It is very satisfying. You may paint more path than you need. Everyone does." },
    ],
  },
  {
    kind: "text",
    chapter: "Chapter 1",
    title: "The Loop",
    folio: 2,
    blocks: [
      { t: "list", numbered: true, items: [
        "Draw a path from the gate.",
        "Build a Training Hall next to the path. It turns compute into a model, and your researchers work there. Add a Compute Cluster to feed it.",
        "Ship your model. It gets a ridiculous name, a headline, and a bump in Hype.",
        "Open an API Gateway to sell what you build. Cash comes in every day.",
        "Keep your Runway above a few months, and speed up the clock when you're ready.",
      ] },
      { t: "p", text: "Hitting a goal unlocks the next rung of the ladder: Garage, Open for business, Growing team, The Race, and finally Scrutiny, where the Senate would like a word." },
    ],
  },
  {
    kind: "text",
    chapter: "Chapter 1",
    title: "The Numbers",
    folio: 3,
    blocks: [
      { t: "table", rows: [
        ["Cash", "The money you have right now."],
        ["Runway", "How many months your cash lasts at today's spending."],
        ["Vibes", "How good the lab feels to be in, 0 to 999."],
        ["Hype", "How much the world is talking about you."],
      ] },
      { t: "h", text: "Listen to the crowd" },
      { t: "p", text: "Every researcher, agent and visitor has a need and a thought bubble. When they say \"No snack wall. I'm eating my own browser tabs.\", that is feedback. It is also a cry for help. Build the snack wall." },
      { t: "tip", text: "Tap anyone to see their card: their needs, what they're thinking, and a Follow button for the truly curious." },
    ],
  },
  {
    kind: "text",
    chapter: "Chapter 1",
    title: "Keyboard Overlay",
    folio: 4,
    blocks: [
      { t: "p", text: "Place the enclosed keyboard overlay over your function keys. It does not change what the keys do, but it will make you feel prepared." },
      { t: "table", rows: [["F1", "Help"], ["F2", "Pause"], ["F3", "Train"], ["F4", "Deny Everything"], ["F8", "Ship It"]] },
      { t: "h", text: "If an agent escapes" },
      { t: "p", text: "Check the fence. Then check the fence's permissions. Then hire Security, who walk the fence and are paid mostly in lanyards." },
      { t: "stamp", text: "END OF CHAPTER 1" },
    ],
  },
  {
    kind: "text",
    title: "Pages 23 to 132",
    blocks: [
      { t: "p", text: "The following chapters were not printed in time for the shipping date:" },
      { t: "list", items: ["2. Your First Lab", "3. The Crowd", "4. The Race", "5. The Circus", "6. Endings", "7. Troubleshooting", "8. Credits"] },
      { t: "p", text: "In their place, please enjoy this blank space, which our lawyers have reviewed and approved." },
      { t: "tip", text: "A complete manual will be mailed to every registered user. Mail your registration card today!" },
    ],
  },
  {
    kind: "text",
    chapter: "Chapter 9",
    title: "Modding with Layers",
    folio: 133,
    blocks: [
      { t: "stamp", text: "EARLY DRAFT" },
      { t: "p", text: "Mods are data. Write JSON, or a little TypeScript if you like. You do not need to know Effect, the library the game runs on, but here are the five words it uses:" },
      { t: "table", rows: [
        ["Effect", "A description of work, run later."],
        ["Service", "A named slot: Content, Skin, Rules, Vocabulary, Assets, Audio or GameEvents."],
        ["Layer", "A recipe that fills service slots."],
        ["provide", "Supply a Layer to an Effect or another Layer."],
        ["Schema", "The checked description that validates a mod."],
      ] },
    ],
  },
  {
    kind: "text",
    chapter: "Chapter 9",
    title: "Your First Mod",
    folio: 134,
    blocks: [
      { t: "p", text: "Mods wrap services in load order. Each content section can add, override or remove. This one renames two rival labs:" },
      { t: "code", text: STEVE },
      { t: "p", text: "The ids pick out existing rivals. Display names do not. The later valid patch wins, and conflicts are reported." },
    ],
  },
  {
    kind: "text",
    chapter: "Chapter 9",
    title: "Checking Your Mod",
    folio: 135,
    blocks: [
      { t: "code", text: "pnpm flt-mod check ./my-mod/mod.json" },
      { t: "p", text: "The check composes the services, validates the assets and references, then plays 365 real days with your mod on, twice, and makes sure both runs agree." },
      { t: "p", text: "Load a mod in the game with ?mod=<url>. The random numbers and the clock stay the game's, so everyone's Tuesday is the same Tuesday." },
      { t: "tip", text: "Shared mods are data. Shared scripts are a later chapter, and a later lawsuit." },
    ],
  },
  {
    kind: "text",
    title: "Technical Support",
    blocks: [
      { t: "p", text: "Before calling Technical Support, please try turning the lab off and on again." },
      { t: "p", text: "Technical Support is available Monday to Friday, 9am to 5pm, in whatever timezone the model has chosen." },
      { t: "p", text: "Frontier Interactive Entertainment, Inc. is not responsible for lost data, lost weights, lost researchers, or the Senate." },
      { t: "stamp", text: "MADE IN A GARAGE" },
    ],
  },
  { kind: "back" },
];

/** How many sheets the book has (the page-turn step runs 0..SHEETS: 0 is closed on the cover, SHEETS closed on the back). */
export const SHEETS = PAGES.length / 2;

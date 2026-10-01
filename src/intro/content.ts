// The big box (FLT-70), as data: the shelf, what is in the box, the manual, the BIOS and the certificate. Data only,
// so a joke never needs a code change. Parody names only: every title, sticker, logo and company here is invented
// (src/content/parody.test.ts scans this folder too).

export type ShelfBox = {
  id: string;
  title: string;
  /** A second line on the front, under the title. */
  sub: string;
  /** What the price sticker or the back of the box says when you pick it up and it's not for sale. */
  blurb: string;
  /** Box colours: background top, background bottom, title ink. */
  colors: [string, string, string];
  /** Box size in metres (w, h, d); the real big boxes came in a few standard sizes. */
  size: [number, number, number];
  /** 0 bottom shelf, 1 eye level, 2 top. */
  shelf: 0 | 1 | 2;
  /** Position along the shelf, -1 (left end) to 1 (right end). */
  at: number;
  /** A little art motif on the front. */
  motif: "grid" | "rings" | "stars" | "chart" | "blob" | "stripes" | "sun";
  price?: string;
};

export const STORE = {
  name: "SoftWarehouse '97",
  aisle: "Aisle 7: Strategy & Simulation",
  sign: "PC CD-ROM · BIG BOX SALE",
  /** The shelf-talker under the hero box. */
  talker: "STAFF PICK: \"I haven't slept.\" — Doug, Store Manager",
  /** FLT-89: the cardboard scientist's speech balloon, its small print, and the bargain bin's card. */
  standee: "I've seen the benchmarks!",
  standeeSmall: "*We wrote them.",
  bin: { head: "BARGAIN BIN", price: "$4.99", sub: "Last year's models" },
};

/** Our box. Art direction A (the '96 sim-game look), as a greybox: bright diorama, chrome logo, starbursts. */
export const HERO = {
  id: "flt",
  title: "Frontier Lab Tycoon",
  tagline: "Build the lab. Train the model. Face the Senate.",
  starburst: "Over 400 tiny researchers!",
  sticker: "NEW!",
  price: "$49.95",
  badge: "Frontier 95 compatible",
  back: [
    "Build! Train! Get subpoenaed!",
    "Over 400 tiny researchers, each with a need and an opinion",
    "Release models with names like Frontier-4.5-Reasoner-Mini-Pro-Preview",
    "Rival labs, benchmark wars and a yacht summit",
    "Protesters with hand-lettered signs!",
  ],
  ages: "Ages 8 to Adult",
  requirements: "Requires: a 486FX or better, 8 MB RAM, a CD-ROM drive, and the will to scale.",
};

/** Everything else on the shelf. None of it is for sale; picking one up reads its back. */
export const SHELF: ShelfBox[] = [
  { id: "paperclip", title: "Paperclip Maximizer Deluxe", sub: "Now with 10,000,000 clips!", blurb: "Make paperclips. Then make more. Then make the thing that makes the paperclips. Out of stock (it used the stock).", colors: ["#f2d64b", "#e08a1e", "#3a1d00"], size: [0.2, 0.26, 0.06], shelf: 1, at: -0.72, motif: "rings" },
  { id: "hallucinatica", title: "Encyclopedia Hallucinatica '97", sub: "40,000 articles. Several are true.", blurb: "The multimedia reference that is never unsure. Includes a video of the Moon landing on Tuesday.", colors: ["#1d3f8a", "#0b1c44", "#f6e7b0"], size: [0.2, 0.26, 0.05], shelf: 1, at: -0.4, motif: "stars" },
  { id: "scaling-trail", title: "The Scaling Law Trail", sub: "You have died of overfitting.", blurb: "Ford the river of synthetic data. Hunt for GPUs. Your whole party has caught the hype.", colors: ["#6c9a3b", "#2d4d1b", "#fff7d6"], size: [0.2, 0.26, 0.06], shelf: 1, at: 0.4, motif: "sun" },
  { id: "pitchdeck", title: "Pitch Deck Publisher 4.0", sub: "Clip art for every hockey stick", blurb: "Over 900 charts that only go up and to the right. Rounds of funding sold separately.", colors: ["#ffffff", "#c7d3e6", "#0f2a66"], size: [0.19, 0.24, 0.05], shelf: 1, at: 0.72, motif: "chart" },
  { id: "benchmark-racer", title: "Benchmark Racer 2000", sub: "Tune for the test. Win the race.", blurb: "The track is also the exam. Contains 12 cars that were trained on the track.", colors: ["#c8102e", "#5a0010", "#ffe14d"], size: [0.2, 0.26, 0.06], shelf: 2, at: -0.62, motif: "stripes" },
  { id: "flying-gpus", title: "Flying GPUs Screensaver Pack", sub: "Vol. 2: They Run Hot", blurb: "Your idle monitor, now training a model. Your electricity bill: also training.", colors: ["#111111", "#2b2b3a", "#6ff0ff"], size: [0.18, 0.22, 0.05], shelf: 2, at: -0.2, motif: "stars" },
  { id: "hoodie", title: "Hoodie Designer Studio", sub: "Dress like a founder", blurb: "Choose from 400 shades of grey. Lanyard sold separately.", colors: ["#8c8c96", "#4a4a55", "#ffffff"], size: [0.19, 0.24, 0.05], shelf: 2, at: 0.2, motif: "blob" },
  { id: "kombucha", title: "Kombucha Kingdom", sub: "Ferment an empire", blurb: "A strategy game about scobys. Rated F for Fizzy. Contains live cultures.", colors: ["#f5a3c7", "#b8467a", "#3a0020"], size: [0.2, 0.26, 0.06], shelf: 2, at: 0.62, motif: "blob" },
  { id: "alignment", title: "Alignment Adventure!", sub: "Grades 3 to PhD", blurb: "Teach Robo to be good! Robo has some follow-up questions. Includes Teacher's Guide.", colors: ["#46b3e6", "#1b6fa8", "#fff36b"], size: [0.2, 0.26, 0.06], shelf: 0, at: -0.62, motif: "sun" },
  { id: "boardroom", title: "3D Boardroom Pinball", sub: "Tilt the board. Literally.", blurb: "Flip the CEO. Ramp the valuation. The ball is also the CEO.", colors: ["#2a0a4a", "#0d0520", "#ff5cf0"], size: [0.2, 0.26, 0.05], shelf: 0, at: -0.2, motif: "rings" },
  { id: "gpu-almanac", title: "The GPU Miner's Almanac", sub: "1997 Edition", blurb: "Planting charts, weather lore and when to buy chips. Hint: yesterday.", colors: ["#e9dcb8", "#b59a5e", "#3d2a0a"], size: [0.19, 0.24, 0.05], shelf: 0, at: 0.2, motif: "grid" },
  { id: "chess-toaster", title: "Chess vs. the Toaster", sub: "It has been practising", blurb: "It beat the microwave in 1994. The fridge will not discuss it.", colors: ["#3b3b3b", "#111111", "#f4c542"], size: [0.2, 0.26, 0.06], shelf: 0, at: 0.62, motif: "grid" },
];

export type ItemId = "manual" | "disc" | "floppies" | "card" | "overlay" | "eula" | "inserts" | "coa";

/** What is in the box, in the order the Contents list shows it. */
export const ITEMS: { id: ItemId; name: string; caption: string }[] = [
  { id: "manual", name: "The manual", caption: "140 pages. Two of them printed in time." },
  { id: "coa", name: "Certificate of Authenticity", caption: "Drag to tilt it in the light. Genuine holographic foil. Do not microwave." },
  { id: "disc", name: "CD-ROM", caption: "Disc 1 of 1. Gold master. Hold it by the edges, like a model you're about to ship." },
  { id: "floppies", name: "Floppy disks", caption: "Disk 1 of 7. Disks 2 to 7 are the same disk, relabelled for the investors." },
  { id: "card", name: "Registration card", caption: "Mail today for exciting offers from our partners! (You are the partner.)" },
  { id: "overlay", name: "Keyboard overlay", caption: "F1 Help · F2 Pause · F3 Train · F4 Deny Everything" },
  { id: "eula", name: "End User License Agreement", caption: "By breaking this seal you agree the model may be smarter than you." },
  { id: "inserts", name: "Expansion pack inserts", caption: "Collect them all! Some of them exist!" },
];

export const REGISTRATION = {
  title: "Product Registration Card",
  lines: ["Name ______________________", "Lab ______________________", "Compute budget:  □ Some  □ A lot  □ Yes", "How did you hear about us?  □ A benchmark  □ A lawsuit"],
  fine: "Mail today for exciting offers from our partners. No postage necessary if mailed from inside the data centre.",
};

export const EULA = {
  title: "END USER LICENSE AGREEMENT",
  seal: "By breaking this seal you agree the model may be smarter than you.",
  body: [
    "1. GRANT. We grant you a non-exclusive licence to run one (1) frontier lab on one (1) computer.",
    "2. OWNERSHIP. The weights are ours. The outputs are yours. The lawsuits are shared.",
    "3. ENTERPRISE EDITION. Now With AGI*. *Artificial General Intelligence not included.",
    "4. WARRANTY. This software is provided \"as is\", \"as was\", and \"as will be, eventually\".",
    "5. TERMINATION. This agreement ends when the model says so.",
  ],
};

export const OVERLAY_KEYS = ["F1 Help", "F2 Pause", "F3 Train", "F4 Deny Everything", "F5 Pivot", "F6 Raise", "F7 Blame Intern", "F8 Ship It"];

/** The Certificate of Authenticity (Jem's addition): Frontier 95's genuine-software label. */
export const COA = {
  title: "Certificate of Authenticity",
  product: "Frontier Lab Tycoon for Frontier 95",
  line: "This is genuine Frontier software. Do not accept weights without this label.",
  keyLabel: "Model Weights Key:",
  microprint: "GENUINE FRONTIER SOFTWARE ",
  maker: "Frontier Interactive Entertainment, Inc.",
};

/** The BIOS POST on the demo kiosk's CRT, one line at a time. `{key}` becomes the Model Weights Key. */
export const BIOS = {
  header: ["Frontier BIOS v4.5 Release 6.0", "Copyright (C) 1984-97, Frontier Interactive Entertainment, Inc.", ""],
  lines: [
    "Main Processor : Frontier 486FX-66 (Turbo)",
    "Memory Test : {mem}K OK",
    "640K of context ought to be enough for anybody.",
    "",
    "Detecting IDE Primary Master ... BIG-DRIVE 540MB",
    "Detecting IDE Secondary Master ... CD-ROM 4X (Frontier Lab Tycoon)",
    "Detecting Alignment ... not found, continuing anyway",
    "",
    "Model Weights Key: {key} ... GENUINE",
    "Loading Frontier 95 ...",
  ],
  footer: "Press DEL to enter SETUP. Press any key to skip.",
  /** The memory counter stops here. */
  mem: 640,
};

export const SPLASH = { name: "Frontier 95", sub: "Starting Frontier 95...", maker: "Frontier Interactive Entertainment" };

/** FLT-95: the box in your hands. The caption says which face you're looking at; the buttons are Frontier 95's. */
export const HELD = {
  captions: {
    front: "It's heavier than it looks. That's the manual. Drag to turn it.",
    spine: "The spine. Looks great on a shelf, next to the other ones you never opened.",
    back: "Every screenshot on the back is from the actual game.* (*A game.)",
  },
  left: "Turn left",
  right: "Turn right",
  flipToBack: "Flip to back",
  flipToFront: "Flip to front",
  open: "Open the box",
};

/** FLT-95: the disc in your hand. */
export const DISC = { insert: "Insert and play", back: "Back", pickUp: "Pick up the disc" };

/** Beat captions (the line at the bottom of the screen). */
export const CAPTIONS = {
  shelf: "Aisle 7. Pick a box. Any box. (Well, one box.)",
  pulling: "Careful. It's the last one on the shelf.",
  unwrapping: "*shrinkwrap noises*",
  open: "Everything is in here. Pick up the disc when you're ready.",
  disc: "Loading. Please don't bump the table.",
  warmup: "The CRT is warming up. Give it a moment. It's from 1995.",
  post: "",
  splash: "",
  dive: "",
  still: "Frontier Lab Tycoon. Ages 8 to Adult.",
};

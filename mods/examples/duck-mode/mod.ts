// Duck mode (FLT-102): everyone in the lab is a rubber duck, and the lab's flavour text talks like one. Looks are
// recipes of primitives (no files), the voice is rules plus hand-written lines, so it can be added to a running lab.
// Bundle after editing: pnpm flt-mod bundle mods/examples/duck-mode mods/examples/duck-mode/mod.json
import { defineMod, type Looks } from "../../../packages/flt-mod-sdk/src/index";
import { DUCK } from "./name";

export { DUCK };

type Part = NonNullable<Looks[string]["recipe"]>[number];
type V3 = readonly [number, number, number];

const YELLOWS = ["#ffd21f", "#ffcc0a", "#ffdc45", "#ffc61a", "#ffe066"];
const BEAK = "#ff8a1f";
const INK = "#1b1b1f";
/** The head nods about its neck; everything on the head turns about the same point. */
const NECK: V3 = [0, 0.74, 0.16];
const onHead = (part: Omit<Part, "pivot" | "motion">): Part => ({ ...part, motion: "nod", pivot: [NECK[0] - part.at[0], NECK[1] - part.at[1], NECK[2] - part.at[2]] });

/** A rubber duck, facing +z: a round body, a tail that wags, a nodding head with a beak and eyes, wings that flap. */
function duck(body: string, extras: Part[] = [], beak = BEAK): Part[] {
  return [
    { shape: "sphere", size: [0.9, 0.68, 1.1], at: [0, 0.36, -0.04], color: body },
    { shape: "cone", size: [0.3, 0.36, 0.26], at: [0, 0.6, -0.56], rotate: [-58, 0, 0], color: body, pivot: [0, -0.12, 0.1], motion: "wag" },
    { shape: "sphere", size: [0.88, 0.16, 1.06], at: [0, 0.08, -0.04], color: body, shade: -0.18 },
    onHead({ shape: "sphere", size: [0.62, 0.6, 0.6], at: [0, 0.98, 0.18], color: body }),
    onHead({ shape: "sphere", size: [0.38, 0.13, 0.34], at: [0, 0.9, 0.52], color: beak }),
    onHead({ shape: "sphere", size: [0.1, 0.13, 0.06], at: [0.15, 1.06, 0.44], color: INK }),
    onHead({ shape: "sphere", size: [0.1, 0.13, 0.06], at: [-0.15, 1.06, 0.44], color: INK }),
    { shape: "sphere", size: [0.14, 0.34, 0.6], at: [0.44, 0.42, -0.06], color: body, shade: -0.08, pivot: [-0.02, 0.14, 0], motion: "flop" },
    { shape: "sphere", size: [0.14, 0.34, 0.6], at: [-0.44, 0.42, -0.06], color: body, shade: -0.08, pivot: [0.02, 0.14, 0], motion: "flop" },
    ...extras,
  ];
}

/** A look: the same duck, in the coat colours given, with what tells the role apart. */
const look = (label: string, extras: Part[], coats = YELLOWS, more: Partial<Looks[string]> = {}): Looks[string] => ({
  label,
  recipe: duck("coat", extras),
  coats: [...coats],
  gait: "waddle",
  scale: 1.15,
  ...more,
});

// What each role wears. Hats sit on the head and nod with it.
const hat = (color: string, size: V3 = [0.5, 0.2, 0.5], y = 1.3): Part => onHead({ shape: "sphere", size, at: [0, y, 0.16], color });
const brim = (color: string, z = 0.38): Part => onHead({ shape: "box", size: [0.42, 0.04, 0.3], at: [0, 1.25, z], color });
const scarf = (color: string): Part => ({ shape: "cylinder", size: [0.6, 0.1, 0.56], at: [0, 0.7, 0.12], color });

const looks: Looks = {
  researcher: look("Research Duck", [
    // Round glasses, and the lanyard every lab hands out.
    onHead({ shape: "box", size: [0.46, 0.04, 0.04], at: [0, 1.06, 0.48], color: INK }),
    { shape: "box", size: [0.12, 0.15, 0.03], at: [0, 0.48, 0.56], color: "#ffffff" },
    { shape: "box", size: [0.03, 0.2, 0.03], at: [0, 0.62, 0.52], color: "#2f6fdf" },
  ]),
  agent: look("Agent Duck", [
    // A chrome duck with a cyan visor and an antenna: the bath toy that thinks.
    onHead({ shape: "box", size: [0.5, 0.1, 0.1], at: [0, 1.06, 0.44], color: "#3ef0ff" }),
    onHead({ shape: "cylinder", size: [0.03, 0.26, 0.03], at: [0, 1.38, 0.16], color: "#c0c8d6" }),
    onHead({ shape: "sphere", size: [0.09, 0.09, 0.09], at: [0, 1.53, 0.16], color: "#3ef0ff" }),
  ], ["#c9d2e0", "#b6c2d6", "#d8dee8"]),
  visitor: look("Visiting Duck", [hat("#2bb3a0", [0.46, 0.16, 0.46]), brim("#2bb3a0")]),
  "visitor:Venture Capitalist": look("Venture Duck", [
    // A tie and a fleece vest: you know the one.
    { shape: "box", size: [0.1, 0.3, 0.04], at: [0, 0.52, 0.55], color: "#c0182c" },
    { shape: "sphere", size: [0.94, 0.5, 1.0], at: [0, 0.44, -0.06], color: "#3a4150" },
  ]),
  "visitor:Journalist": look("Press Duck", [
    hat("#6b5a46", [0.5, 0.22, 0.5]),
    onHead({ shape: "cylinder", size: [0.7, 0.03, 0.7], at: [0, 1.24, 0.16], color: "#6b5a46" }),
    onHead({ shape: "box", size: [0.14, 0.09, 0.02], at: [0.1, 1.33, 0.4], color: "#ffffff" }),
  ]),
  "visitor:Enterprise Buyer": look("Procurement Duck", [
    // A briefcase held at the side.
    { shape: "box", size: [0.08, 0.26, 0.36], at: [0.55, 0.3, 0.04], color: "#5a3a22" },
    { shape: "box", size: [0.04, 0.06, 0.14], at: [0.55, 0.46, 0.04], color: INK },
  ]),
  "visitor:Influencer": look("Influencer Duck", [
    // A selfie stick and a ring light's worth of pink.
    { shape: "cylinder", size: [0.03, 0.6, 0.03], at: [0.4, 0.8, 0.36], rotate: [30, 0, -20], color: "#d8d8d8" },
    { shape: "box", size: [0.16, 0.26, 0.03], at: [0.52, 1.08, 0.52], color: "#ff4fa8" },
    hat("#ff4fa8", [0.3, 0.1, 0.3], 1.28),
  ]),
  protester: look("Protest Duck", [scarf("#d42a2a"), onHead({ shape: "cone", size: [0.18, 0.22, 0.1], at: [0, 0.7, 0.38], rotate: [-20, 0, 0], color: "#d42a2a" })], YELLOWS, {
    signs: ["PAUSE DA MODEWS", "NO AGI WIFOUT BWEAD", "QUACK DA VOTE", "WE AWE AWW DUCKS", "WUBBEW WIGHTS NOW", "OPEN DA POND", "SQUEAK UP", "HONK IF U AWIGN"],
  }),
  "staff:sre": look("SRE Duck", [hat("#ff7a1a", [0.56, 0.26, 0.56], 1.3), brim("#ff7a1a", 0.42), scarf("#ff7a1a")]),
  "staff:security": look("Security Duck", [hat("#22348f", [0.5, 0.16, 0.5], 1.28), brim("#22348f", 0.44), { shape: "box", size: [0.12, 0.12, 0.03], at: [0.18, 0.5, 0.52], color: "#ffd700" }]),
  "staff:comms": look("Comms Duck", [scarf("#8a4fd8"), { shape: "box", size: [0.08, 0.28, 0.26], at: [0.52, 0.34, 0.06], color: "#ffe08a" }]),
  "staff:janitor": look("Janitor Duck", [
    // The Janitor Bot, as a teal bath duck with a mop.
    { shape: "cylinder", size: [0.04, 0.8, 0.04], at: [0.36, 0.36, 0.42], rotate: [-25, 0, 0], color: "#f4f1e6" },
    { shape: "box", size: [0.26, 0.06, 0.14], at: [0.36, 0.02, 0.6], color: "#f4f1e6", motion: "sway" },
  ], ["#1fb5a8", "#26c2b4"]),
  "group:auditor": look("Auditor Duck", [
    // Hi-vis green and a clipboard: Evals Without Borders, quacking at your logs.
    { shape: "cylinder", size: [0.94, 0.16, 1.0], at: [0, 0.42, -0.04], color: "#39b54a" },
    { shape: "box", size: [0.26, 0.32, 0.03], at: [0, 0.62, 0.62], rotate: [-30, 0, 0], color: "#b98a4e" },
    { shape: "box", size: [0.2, 0.24, 0.01], at: [0, 0.63, 0.64], rotate: [-30, 0, 0], color: "#ffffff" },
  ]),
};

export default defineMod({
  apiVersion: 1,
  id: "duck-mode",
  name: DUCK.name,
  version: "1.0.0",
  author: "Frontier Lab Tycoon",
  description: "Everyone in the lab is a rubber duck: researchers, agents, visitors, staff, auditors and the picket line. The thoughts, posts, headlines and papers come out in duck. The buttons and numbers stay readable, unless you pick “Everything, menus too” in Add/Remove Mods (or add ?voice=full).",
  looks,
  voice: {
    name: DUCK.voice,
    lowercase: true,
    words: {
      the: "da", that: "dat", this: "dis", with: "wif", without: "wifout", them: "dem", they: "dey", there: "dere", their: "dere", then: "den",
      these: "dese", those: "dose", think: "fink", thinks: "finks", thing: "fing", things: "fings", nothing: "nuffin", something: "sumfin",
      everything: "evewyfing", anything: "anyfing", world: "wowd", problem: "pwobwem", problems: "pwobwems", really: "weawwy", little: "widdle",
      people: "peepow", love: "wuv", very: "vewy", what: "wat", because: "bcuz", friend: "fwend", friends: "fwends", water: "watew",
      truth: "twoof", other: "uvva", another: "anuvva", brother: "bwuvva", mother: "muvva", through: "fwu", three: "fwee",
    },
    letters: [
      { from: "r", to: "w", odds: 0.85 },
      { from: "l", to: "w", odds: 0.7 },
    ],
    leet: { odds: 0.1, map: { e: "3", o: "0", a: "4", s: "Z", i: "1" } },
    ellipsis: 0.6,
    openers: { odds: 0.22, lines: ["hmm... ", "fwend... ", "i wondew... ", "ok but... ", "*squeak* ", "if u fink about it... "] },
    emoji: { list: ["🦆", "🤔", "✨", "🫧"], min: 1, max: 2 },
    glyph: "🦆",
    moments: {
      ship: [
        "we shipped a modew... but did da modew ship us 🦆",
        "new weights just dwopped... i can feew dem in my bubbwes 🫧",
        "evewy wewease is a widdle egg... dis one is hatching ✨",
        "shipped it. da benchmawks awe just numbews... da vibes awe da weaw evaw 🤔",
      ],
      level: [
        "wevew up... but awe we gwowing, ow is da pond getting smawwew 🤔",
        "new wevew unwocked. same duck. bettew duck? 🦆",
        "da wadder has anuvva wung... i fwoat up it 🫧",
      ],
      era: [
        "a new ewa... da watew is a diffewent tempewatuwe now 🫧",
        "time moves. ducks fwoat. dat is aww i know 🦆",
      ],
      leak: [
        "da weights got out... can u weawwy own a fought 🤔",
        "someone weaked da chat... da pond is vewy twanspawent today 🫧",
        "secwets do not fwoat... dey sink... den dey pop up anyway 🦆",
      ],
      senate: [
        "da senatows want answews... i onwy have quacks 🦆",
        "testifying today. i wiww say 'squeak' undew oaf 🤔",
        "da heawing woom smewws wike powished wood and feaw ✨",
      ],
      escape: [
        "one of da agents weft da bathtub... fwy fwee widdle one 🫧",
        "it got out. awen't we aww just twying to get out of a tub 🤔",
      ],
      ending: [
        "and so da pond goes stiww... fanks fow fwoating wif me 🦆",
        "evewy wab ends... but da duck... da duck wemains ✨",
        "game ovew? ow game... pond? 🤔",
      ],
    },
  },
  content: {
    headlines: {
      add: [
        { id: "duck-01", trigger: "filler", tone: "joke", text: "Entire lab staff replaced by rubber ducks; output per head unchanged" },
        { id: "duck-02", trigger: "filler", tone: "joke", text: "Rubber duck debugging promoted to frontier research, duck promoted to Principal" },
        { id: "duck-03", trigger: "filler", tone: "joke", text: "Investors ask whether the ducks are a moat or a pond" },
        { id: "duck-04", trigger: "filler", tone: "joke", text: "Bath toy industry braces for compute shortage" },
        { id: "duck-05", trigger: "filler", tone: "neutral", text: "Analysts note the lab's new hires all float" },
      ],
    },
    thoughts: {
      add: [
        { id: "duck-t1", kind: "researcher", when: "always", text: "If I explain the bug to a duck and I am the duck, who fixed it?" },
        { id: "duck-t2", kind: "researcher", when: "training", text: "The loss curve is going down. So is my sense of self." },
        { id: "duck-t3", kind: "agent", when: "always", text: "I was trained to be helpful. I was shaped like a bath toy." },
        { id: "duck-t4", kind: "visitor", when: "always", text: "Everyone here squeaks when they sit down. Is that culture?" },
        { id: "duck-t5", kind: "protester", when: "always", text: "We are not ducks. We are a flock. There is a difference." },
        { id: "duck-t6", kind: "researcher", when: "noKombucha", text: "Ducks drink pond water. I could drink pond water. Should I?" },
      ],
    },
  },
});

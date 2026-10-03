// Parody names only (AGENTS.md). Every content string, skin string and window title the game can show: the content
// tables, the 2D UI and all six skins (code, JSON and CSS), the software-shelf intro, and every base pack and example mod under mods/. The defection test keeps
// its narrower check on its own two packs; this one covers the rest, so a real product name fails wherever it lands.
import { BIRDAPP, birdContent } from "./birdapp";
import { makeHandle } from "../sim/birdapp/driver";
import { labSlug } from "../sim/birdapp/rivals";
import { RIVAL_DEFS } from "./rivals";
import { createRng } from "../sim/rng";

const REAL = [
  "Copilot", "Internet Explorer", "Notepad", "WordPad", "LinkedIn", "Excel", "PowerPoint", "Outlook", "Slack", "Twitter",
  "Windows 95", "Windows 98", "Clippy", "Microsoft", "OpenAI", "Anthropic", "DeepMind", "Google", "Gmail", "ChatGPT",
  // Real labs our old rival names contained (renamed before prod: Super Super AI, MetaMeta Metaintelligence Labs).
  "Safe Superintelligence", "Meta Superintelligence", "SSI",
  // FLT-101 satirises a movement's culture, never its real people, charities, houses or forums.
  "Effective Altruism", "Open Philanthropy", "Open Phil", "GiveWell", "80,000 Hours", "Effective Ventures", "Rethink Priorities",
  "Future of Humanity Institute", "Giving What We Can", "Alameda Research", "Wytham Abbey", "Wytham", "Lighthaven", "LessWrong",
  "EA Forum", "EA Global", "MacAskill", "Bankman-Fried", "Toby Ord", "Bostrom", "Karnofsky", "Moskovitz", "Peter Singer",
];
// Bird App handles (FLT-69) are lowercase and squashed ("the_weights_whisper"), so they get their own list: real labs,
// products and apps, real people's names and handles, and nationalities (a handle is an identity; none of ours is real).
const REAL_HANDLES = [
  "openai", "anthropic", "deepmind", "google", "microsoft", "nvidia", "meta_ai", "xai", "mistral", "huggingface", "chatgpt",
  "gpt4", "gpt5", "claude", "gemini", "llama", "grok", "copilot", "twitter", "tweet", "bluesky", "mastodon", "reddit",
  "sama", "altman", "elon", "musk", "zuck", "amodei", "hassabis", "karpathy", "lecun", "hinton", "sutskever", "bengio",
  // FLT-92: the rival labs' voices are CEOs and researchers, so the real ones' names and handles too.
  "dario", "demis", "satya", "nadella", "zuckerberg", "jensen", "suleyman", "ilya", "murati", "brockman", "pichai", "sundar",
  "roon", "leike", "yudkowsky", "eliezer", "gwern", "kokotajlo", "aschenbrenner",
  // FLT-101: the Maximally Effective Altruists' posters, likewise.
  "macaskill", "bankman", "sbf", "bostrom", "karnofsky", "moskovitz", "lesswrong", "givewell",
  "american", "chinese", "british", "french", "german", "russian", "indian", "canadian", "japanese", "korean",
];
// The software shelf (FLT-70) parodies a 1997 software store, so it also must not name the real ones: the publishers,
// the boxes on the shelf, the stores, the BIOS and the chips. Scanned in src/intro only (the game has no shelf).
const RETAIL = [
  "Maxis", "SimCity", "RollerCoaster Tycoon", "Encarta", "Mavis Beacon", "Carmen Sandiego", "Oregon Trail", "Myst",
  "Egghead", "CompUSA", "Babbage's", "Scholastic", "Broderbund", "Sierra", "American Megatrends", "AMIBIOS", "Award BIOS",
  "Phoenix BIOS", "Intel", "Pentium", "Sound Blaster", "IBM", "Compaq", "Packard Bell", "After Dark", "Windows", "Energy Star",
  "Microsoft Office", "Norton", "Lotus",
  // The shelf's covers (FLT-89) parody these boxes, so the printed words must not name them.
  "Flying Toasters", "Space Cadet", "Chessmaster", "Battle Chess", "Farmer's Almanac", "Farmers' Almanac", "Print Shop", "Need for Speed", "Grolier",
];
// Our parodies that contain (or sit next to) a real name. They are removed before the scan.
const ALLOWED = ["Outlook Excess", "WordSad", "WordPerfectly", "NoteBad"];

const sources = import.meta.glob<string>(
  ["./**/*.{ts,json}", "../ui/**/*.{ts,tsx,json,css}", "../skins/**/*.{ts,tsx,json,css}", "../intro/**/*.{ts,tsx,json,css}", "../account/**/*.{ts,tsx,css}", "../../mods/base-*/**/*.json", "../../mods/examples/**/*.json", "!**/*.test.{ts,tsx}"],
  { query: "?raw", import: "default", eager: true },
);
const scanned = Object.keys(sources);
const packs = [...new Set(scanned.flatMap((f) => /^\.\.\/\.\.\/mods\/(base-[^/]+)\//.exec(f)?.[1] ?? []))];

/** Every real name in `text`, once the allowed parodies are taken out. */
function realNames(text: string, names = REAL): string[] {
  const clean = ALLOWED.reduce((t, ok) => t.split(ok).join(""), text);
  return names.filter((name) => new RegExp(`\\b${name.replace(" ", "\\s+")}\\b`).test(clean));
}

/** Every real name or handle in a lowercase handle, underscores and digits ignored. */
const realHandle = (handle: string) => {
  const squashed = handle.toLowerCase().replace(/[^a-z]/g, "");
  return REAL_HANDLES.filter((name) => squashed.includes(name.replace(/[^a-z]/g, "")));
};

describe("parody names only", () => {
  it("knows a real name from our parodies", () => {
    expect(realNames('title: "RUN.TXT - Notepad", "Internet Explorer 3.0", "Macrohard Copilot for Copilot"')).toEqual(["Copilot", "Internet Explorer", "Notepad"]);
    expect(realNames("Outlook Excess, WordSad, WordPerfectly, NoteBad, Internet Exploder 3.0, LinkedOut, Excellent, the outlook")).toEqual([]);
    expect(realNames("Very Safe Superintelligence Inc., Meta Superintelligence Labs, SSI")).toEqual(["Safe Superintelligence", "Meta Superintelligence", "SSI"]);
    // Word boundaries mean "MetaMeta Superintelligence" would slip past this scan (and the Drama lint), which is why
    // MetaMeta's full name was changed by hand (#71): it contained a real lab's name as a substring.
    expect(realNames("Frontier BIOS, a Frontier 486FX, the '96 sim-game look, Intel Inside, a Maxis box", [...REAL, ...RETAIL])).toEqual(["Maxis", "Intel"]);
    expect(realNames("Utilsbury Manor, the Maximally Effective Altruists, Effective Altruism, a weekend at Wytham Abbey")).toEqual(["Effective Altruism", "Wytham Abbey", "Wytham"]);
    expect(realNames("Very Very Super Super Intelligence, Super Super AI, MetaMeta Metaintelligence Labs, SSID")).toEqual([]);
  });
  it("reads the content, the UI, all six skins and every base pack", () => {
    for (const skin of ["base", "frontier-95", "homepage-98", "discovery-disc-96", "field-almanac", "karaoke-night", "swag-drop"]) {
      expect(scanned.some((f) => f.startsWith(`../skins/${skin}/`)), skin).toBe(true);
    }
    expect(sources["../skins/frontier-95/skin.css"]).toContain('[data-skin="frontier-95"]');
    expect(packs.length).toBeGreaterThanOrEqual(13);
    for (const p of packs) expect(scanned).toContain(`../../mods/${p}/mod.json`);
    expect(scanned).toContain("../../mods/examples/maximally-effective-altruists/mod.json");
    // assets/art.jobs.json holds every word printed in the generated art (FLT-70), so the pictures are scanned too.
    for (const f of ["content.ts", "manual.ts", "art.ts", "Intro.tsx", "stage/Kiosk.tsx", "stage/Props.tsx", "assets/art.jobs.json", "assets/props.jobs.json"]) expect(scanned).toContain(`../intro/${f}`);
  });
  it("names no real product, app, site or lab anywhere the player can read", () => {
    const found = scanned.flatMap((f) => realNames(sources[f]!, f.startsWith("../intro/") ? [...REAL, ...RETAIL] : REAL).map((name) => `${f}: ${name}`));
    expect(found).toEqual([]);
  });
  it("the Bird App's handles, stems and generated, name nobody real (FLT-69)", () => {
    expect(realHandle("@elon_fan_account")).toEqual(["elon"]);
    expect(realHandle("not_my_main")).toEqual([]);
    const rng = createRng(69);
    const bird = birdContent(BIRDAPP);
    const handles = bird.archetypes.flatMap((a) => [...a.handles, ...Array.from({ length: 200 }, () => makeHandle(rng, a.handles, () => false))]);
    const quoted = BIRDAPP.flatMap((r) => ("text" in r ? r.text.match(/@\w+/g) ?? [] : []));
    const found = [...handles, ...quoted].flatMap((h) => realHandle(h).map((name) => `${h}: ${name}`));
    expect(found).toEqual([]);
  });
  it("the rival labs' voices, names and handles, are invented too (FLT-92)", () => {
    const bird = birdContent(BIRDAPP);
    expect(bird.voices.length).toBeGreaterThanOrEqual(12);
    // An `any` voice's handle is the lab's name and a suffix: check what it actually becomes, for every lab.
    const handles = RIVAL_DEFS.flatMap((d) => bird.voicesFor(d.id).map((v) => (v.lab === "any" ? `${labSlug(d.short)}${v.handle}` : v.handle)));
    const names = bird.voices.map((v) => v.name);
    const found = [
      ...handles.flatMap((h) => realHandle(h).map((name) => `@${h}: ${name}`)),
      // A name word by word ("Prudence Longform" squashed has an "elon" in it; neither word does).
      ...names.flatMap((n) => [...n.split(/\s+/).flatMap(realHandle), ...realNames(n)].map((name) => `${n}: ${name}`)),
    ];
    expect(found).toEqual([]);
    expect(new Set(handles).size).toBe(handles.length);
  });
});

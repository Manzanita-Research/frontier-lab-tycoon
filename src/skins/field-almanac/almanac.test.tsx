// The Field Almanac's own behaviour, on top of the checks every skin gets in skins.test.tsx: the small print (dates in
// words, Roman numerals, the Latin), what each slot says for each state, and that nothing on screen is an emoji or a
// symbol a machine without fonts would draw as a box.
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { fixtureInput } from "../../ui/hud/fixtures";
import { Docked } from "../../ui/hud/tree";
import type { HudActions, HudVM, InspectorVM } from "../../ui/hud/types";
import { hudViewModel } from "../../ui/hud/vm";
import { SkinProvider } from "../context";
import { prepareSkin } from "../registry";
import type { LoadedSkin } from "../types";
import { almanacDate, binomial, ordinal, roman, sealInitial, shortName, specimenNo } from "./lore";
import { Shelf } from "./shelf";

const actions = new Proxy({}, { get: () => () => undefined }) as HudActions;
const vm: HudVM = hudViewModel(fixtureInput({ tool: "hall" }));
const { skin } = await prepareSkin("field-almanac");
// React puts <!-- --> between text runs on the server; take them out so the text reads the way it does on screen.
const html = (node: React.ReactNode, s: LoadedSkin = skin) => renderToString(<SkinProvider skin={s}>{node}</SkinProvider>).replace(/<!-- -->/g, "");
const slot = skin.slots;
const who = vm.inspector!;
const withWho = (patch: Partial<InspectorVM>): InspectorVM => ({ ...who, ...patch });

describe("the small print", () => {
  it("writes dates in words", () => {
    expect(almanacDate("Y1 · Jan 30")).toBe("Year one · January 30th");
    expect(almanacDate("Y4 · Feb 1")).toBe("Year four · February 1st");
    expect(almanacDate("Y13 · Dec 22")).toBe("Year 13 · December 22nd");
    expect(almanacDate("someday")).toBe("someday");
  });

  it("gets the ordinals right, teens included", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 30].map(ordinal)).toEqual(["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "30th"]);
  });

  it("numbers the training runs in Roman", () => {
    expect([1, 2, 4, 9, 14, 40, 90, 2026].map(roman)).toEqual(["I", "II", "IV", "IX", "XIV", "XL", "XC", "MMXXVI"]);
    expect(roman(0)).toBe("0");
  });

  it("gives every kind of walker a genus, and a variety that says how they are", () => {
    const person = { ...who, kind: "researcher" as const, mood: "content" as const };
    const need = (key: string, urgency: number): InspectorVM["needs"][number] => ({ key, label: key, value: urgency, pct: Math.round(urgency * 100), urgency, tone: urgency > 0.7 ? "bad" : "ok" });
    expect(binomial({ ...person, needs: [need("energy", 0.9), need("focus", 0.1)] })).toBe("Homo researchus, var. overcaffeinata");
    expect(binomial({ ...person, needs: [need("energy", 0.1), need("focus", 0.8)] })).toBe("Homo researchus, var. distracta");
    expect(binomial({ ...person, needs: [need("energy", 0.1)], mood: "slumped" })).toBe("Homo researchus, var. languida");
    expect(binomial({ ...person, kind: "agent", portrait: { ...person.portrait, kind: "agent", drift: 0.9 } })).toBe("Machina diligens, var. rebellis");
    expect(binomial({ ...person, kind: "visitor", role: "Venture Capitalist" })).toBe("Homo curiosus, var. pecuniosa");
    expect(binomial({ ...person, kind: "visitor", role: "Journalist" })).toBe("Homo curiosus, var. scribens");
    expect(binomial({ ...person, kind: "protester", role: "Concerned Citizen" })).toBe("Homo indignans, var. placardifera");
  });

  it("calls people what a friend would", () => {
    expect(shortName("Dr. Ada Gradient")).toBe("Dr. Gradient");
    expect(shortName("Ada Gradient")).toBe("Ada");
    expect(shortName("Agent-0042 'Sparky'")).toBe("Sparky");
    expect(shortName("Cher")).toBe("Cher");
    expect(specimenNo("0042")).toBe(42);
    expect(specimenNo("")).toBe(0);
  });

  it("presses the first letter into the wax, or nothing when it isn't one", () => {
    expect(sealInitial("Frontier-2 has been released.")).toBe("F");
    expect(sealInitial("up 3 places")).toBe("U");
    expect(sealInitial("+15 hype")).toBeNull();
    expect(sealInitial("")).toBeNull();
  });
});

describe("Field Almanac", () => {
  it("replaces the slots skin.json says it does", () => {
    expect(slot.Layout.name).toBe("Layout");
    expect(slot.Stats.name).toBe("Stats");
    expect(slot.Inspector.name).toBe("Inspector");
  });

  it("the header strip has the ring, the date in words and a line of commentary under each number", () => {
    const out = html(<slot.Stats stats={vm.stats} layout={{ ...vm.layout, compact: false }} actions={actions} />);
    expect(out).toContain("fa-ring");
    expect(out).toMatch(/Year (one|two|three) · [A-Z][a-z]+ \d+(st|nd|rd|th)/);
    for (const caption of ["Cash", "Runway", "Capability", "Hype", "Arena"]) expect(out).toContain(caption);
    const short = html(<slot.Stats stats={{ ...vm.stats, runway: { months: 5.8, text: "5.8 mo", warning: true } }} layout={{ ...vm.layout, compact: false }} actions={actions} />);
    expect(short).toContain("getting short");
    const black = html(<slot.Stats stats={{ ...vm.stats, runway: { months: null, text: "∞", warning: false } }} layout={{ ...vm.layout, compact: false }} actions={actions} />);
    expect(black).toContain("in the black");
  });

  it("on a phone the header folds to a strip with a chevron that opens the rest", () => {
    const out = html(<slot.Stats stats={vm.stats} layout={{ ...vm.layout, compact: true, phone: true }} actions={actions} />);
    expect(out).toContain("fa-more");
    expect(out).toContain('aria-expanded="false"');
  });

  it("Field Notes: the run in Roman with a hairline that fills, and a hand-ticked box for each objective met", () => {
    const training = html(<slot.Training training={{ ...vm.training, hasHall: true, run: 2, pct: 0.42, pctText: "42%" }} actions={actions} />);
    expect(training).toContain("training run II");
    expect(training).toContain("42% complete");
    expect(training).toContain("width:42%");
    expect(html(<slot.Training training={{ ...vm.training, hasHall: false }} actions={actions} />)).toContain("fa-quiet");
    const objectives = { ...vm.objectives, items: vm.objectives.items.map((g, i) => ({ ...g, met: i === 0 })) };
    const out = html(<slot.Objectives objectives={objectives} layout={{ ...vm.layout, compact: false }} actions={actions} />);
    expect(out.match(/fa-check done/g)?.length).toBe(1);
    expect(out).toContain("This year&#x27;s objectives");
  });

  it("the specimen card numbers the specimen, gives the Latin and follows by short name", () => {
    const out = html(<slot.Inspector inspector={who} layout={{ ...vm.layout, compact: false }} actions={actions} />);
    expect(out).toContain(`Specimen no. ${specimenNo(who.badge)}`);
    expect(out).toContain(binomial(who));
    expect(out).toContain(`Follow ${shortName(who.name)}`);
    expect(out).toContain("fig. 1: observed");
    for (const n of who.needs) expect(out).toContain(`>${n.pct}%<`);
    const following = html(<slot.Inspector inspector={withWho({ following: true })} layout={{ ...vm.layout, compact: false }} actions={actions} />);
    expect(following).toContain('aria-pressed="true"');
  });

  it("on a phone the specimen card is a sheet that leaves the plate and the follow button for the swipe up", () => {
    const out = html(<slot.Inspector inspector={who} layout={{ ...vm.layout, compact: true, phone: true }} actions={actions} />);
    expect(out).toContain("fa-handle");
    expect(out).not.toContain("fa-plate");
    expect(out).not.toContain("fa-follow");
  });

  it("a thought bubble keeps the class photo mode copies and the thought as its first text node", () => {
    const out = html(<slot.Bubble bubble={vm.bubbles[0]!} actions={actions} />);
    expect(out).toMatch(/^<div class="bubble bubble-\w+ fa-bubble" data-who="[^"]+">/);
    // The name is a ::before from data-who: no element in front of the words.
    expect(out).toMatch(/data-who="[^"]+">[^<]/);
  });

  it("toasts are wax seals with the first letter in them; a standing hint is a quill and no seal", () => {
    const seal = html(<slot.Toast toast={{ id: 1, text: "Frontier-2 has been released.", tone: "good" }} actions={actions} />);
    expect(seal).toContain("fa-seal");
    expect(seal).toContain(">F<");
    expect(seal).toContain("fa-toast fa-paper good");
    const leaf = html(<slot.Toast toast={{ id: 2, text: "+15 hype", tone: "neutral" }} actions={actions} />);
    expect(leaf).toContain("<svg");
    const hint = html(<slot.Toast toast={{ id: -1, text: "Tap anyone.", tone: "hint" }} actions={actions} />);
    expect(hint).not.toContain("fa-seal");
    expect(hint).toContain("hint");
  });

  it("the shelf has an engraving, a price and the hotkey for every tool, and Bulldoze is Clear land", () => {
    const out = html(<Shelf items={vm.buildItems} teasers={[]} actions={actions} done={() => {}} />);
    // One engraving per tool, then Help's.
    expect(out.match(/fa-well/g)?.length).toBe(vm.buildItems.length + 1);
    expect(out).toContain("Clear land");
    expect(out).toContain('aria-pressed="true"'); // the tool in hand
    for (const it of vm.buildItems) if (it.hotkey !== null) expect(out).toContain(`>${it.hotkey}<`);
    // What the tool in hand does sits over the shelf, shut or open.
    expect(html(<slot.BuildBar items={vm.buildItems} tip={vm.buildTip} layout={vm.layout} actions={actions} />)).toContain("fa-tip");
  });

  it("the shelf is shut until you press Build: one engraving, and locked tools and Help inside", () => {
    const shut = html(<slot.BuildBar items={vm.buildItems} tip={null} layout={vm.layout} actions={actions} />);
    expect(shut.match(/fa-well/g)?.length).toBe(1);
    expect(shut).toContain('aria-expanded="false"');
    const teasers = [{ label: "Compute Cage", hint: "Ship a model" }];
    const open = html(<Shelf items={vm.buildItems.slice(0, 2)} teasers={teasers} actions={actions} done={() => {}} />);
    expect(open).toContain("fa-tool locked");
    expect(open).toContain("Ship a model");
    expect(open).toContain("How to play");
  });

  it("carries the coach-mark hooks the tutorial spotlights, on the elements they name", () => {
    const out = html(<Docked vm={vm} actions={actions} />);
    for (const hook of ["start", "training", "stat:runway", "goals"]) expect(out).toContain(`data-coach="${hook}"`);
    // One per tool in the open shelf: rendered from the view-model as given, so an unlock filter or a mod's tool needs nothing here.
    const shelf = html(<Shelf items={vm.buildItems} teasers={[]} actions={actions} done={() => {}} />);
    for (const it of vm.buildItems) expect(shelf).toContain(`data-coach="build:${it.kind}"`);
    // ...and the run under observation carries it whether or not there is a Training Hall yet.
    expect(html(<slot.Training training={{ ...vm.training, hasHall: false }} actions={actions} />)).toContain('data-coach="training"');
  });

  it("Dispatches keeps the game's `ticker` class and the seven-word label", () => {
    const out = html(<slot.Ticker items={vm.ticker} actions={actions} />);
    expect(out).toContain('class="ticker fa-ticker"');
    expect(out).toContain("Dispatches");
  });

  it("the leaderboard folds to a strip with the record count (the next launch in its tooltip); the news cycle is one bar and a headline", () => {
    const lf = hudViewModel(fixtureInput({ leapfrog: true }));
    expect(lf.leapfrog.enabled).toBe(true);
    const bench = html(<slot.Benchmarks leapfrog={lf.leapfrog} layout={{ ...lf.layout, compact: false }} actions={actions} />);
    expect(bench).toContain("fa-bench-head");
    expect(bench).toContain("SOTA");
    expect(bench).toContain(`title="${lf.leapfrog.nextText.replace(/'/g, "&#x27;")}"`); // the next launch is the strip's tooltip
    expect(bench).not.toContain("<table"); // folded
    const phone = html(<slot.Benchmarks leapfrog={lf.leapfrog} layout={{ ...lf.layout, compact: true, phone: true }} actions={actions} />);
    expect(phone).toMatch(/class="fa-bench [^"]*compact/);
    const voice = html(<slot.Voice leapfrog={lf.leapfrog} layout={{ ...lf.layout, compact: false }} actions={actions} />);
    expect(voice).toContain("fa-voice-bar");
    expect(voice).toContain(lf.leapfrog.voice.headline.replace(/'/g, "&#x27;"));
    expect(html(<slot.Voice leapfrog={lf.leapfrog} layout={{ ...lf.layout, compact: true, phone: true }} actions={actions} />)).toBe("");
  });

  it("draws every engraving itself: no emoji on the screen, and nothing that needs a symbol font", () => {
    const out = html(<Docked vm={vm} actions={actions} />);
    expect(out).not.toMatch(/\p{Extended_Pictographic}/u);
    // Only characters the bundled Latin subsets of Fraunces and Figtree have (plus the arrows and minus they include).
    const text = out.replace(/<[^>]*>/g, "").replace(/&#x27;|&quot;|&amp;/g, "");
    for (const ch of text) expect(/[\u0020-\u007e\u00a0-\u00ff\u2000-\u206f\u2190-\u2193\u2212]/.test(ch), `U+${ch.codePointAt(0)!.toString(16)} ${ch}`).toBe(true);
    // ...and no tool falls back to the plain crate.
    for (const it of vm.buildItems) expect(["path", "cluster", "hall", "gateway", "kombucha", "nap", "snack", "demo", "datacenter", "gas", "solar", "security", "bulldoze", "staff"]).toContain(it.kind);
  });
});

// Karaoke Night's own behaviour, on top of the checks every skin gets in skins.test.tsx: every digit in Jersey 10, the
// score meters light the right number of segments and hearts, the toasts are named for their mood, the tape is sung word
// by word on a schedule, and nothing on the screen is a font glyph that a machine might not have.
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { fixtureInput } from "../../ui/hud/fixtures";
import { Docked } from "../../ui/hud/tree";
import type { HudActions, HudVM, TickerItemVM } from "../../ui/hud/types";
import { hudViewModel } from "../../ui/hud/vm";
import { SkinProvider } from "../context";
import { read } from "../files";
import { prepareSkin } from "../registry";
import type { LoadedSkin } from "../types";
import { pick, rating, schedule } from "./ticker";

const actions = new Proxy({}, { get: () => () => undefined }) as HudActions;
const vm: HudVM = hudViewModel(fixtureInput({ tool: "hall" }));
const { skin } = await prepareSkin("karaoke-night");
// React puts <!-- --> between text runs on the server; take them out so the text reads the way it does on screen.
const html = (node: React.ReactNode, s: LoadedSkin = skin) => renderToString(<SkinProvider skin={s}>{node}</SkinProvider>).replace(/<!-- -->/g, "");
const slot = skin.slots;
const lf = hudViewModel(fixtureInput({ leapfrog: true }));
const shipNow = hudViewModel(fixtureInput({ leapfrog: true, event: "shipNow" }));
const stream = hudViewModel(fixtureInput({ leapfrog: true, event: "stream:dog" }));
const item = (id: number, text = `headline ${id}`): TickerItemVM => ({ id, text, tone: "neutral" });

describe("Karaoke Night", () => {
  it("replaces the slots skin.json says it does", () => {
    expect(slot.Layout.name).toBe("Layout");
    expect(slot.Ticker.name).toBe("Ticker");
    expect(slot.Stats.name).toBe("Stats");
  });

  it("sets its display type and its numbers in Jersey 10 (a face where C, O, 5 and S are four different shapes), and bundles it", () => {
    const manifest = JSON.parse(read("karaoke-night/skin.json")!);
    expect(manifest.tokens["font.display"]).toMatch(/^"Jersey 10"/);
    expect(manifest.tokens["font.numbers"]).toMatch(/^"Jersey 10"/);
    expect(manifest.fonts.map((f: { family: string }) => f.family)).toEqual(expect.arrayContaining(["Jersey 10", "Nunito"]));
    expect(manifest.fonts.map((f: { family: string }) => f.family)).not.toContain("Pixelify Sans");
    // Nothing in the CSS names a face: headings and digits read the tokens, so a paid face can be dropped in.
    expect(read("karaoke-night/skin.css")).not.toMatch(/font(-family)?:[^;]*"(Jersey 10|Nunito|Chalmers)"/);
    const training = html(<slot.Training training={vm.training} actions={actions} />);
    expect(training).toContain(vm.training.name);
  });

  it("the training bar lights a segment for each twentieth of the run", () => {
    const at = (pct: number) => html(<slot.Training training={{ ...vm.training, hasHall: true, pct }} actions={actions} />).match(/<i class="on">/g)?.length ?? 0;
    expect(at(0)).toBe(0);
    expect(at(0.5)).toBe(10);
    expect(at(0.999)).toBe(19);
    expect(html(<slot.Training training={{ ...vm.training, hasHall: false }} actions={actions} />)).toContain(skin.strings["training.noHall"]);
  });

  it("the queue numbers the songs, strikes the ones that are done and shows a tick for them", () => {
    const objectives = { ...vm.objectives, items: vm.objectives.items.map((g, i) => ({ ...g, met: i === 0 })) };
    const out = html(<slot.Objectives objectives={objectives} layout={{ ...vm.layout, compact: false }} actions={actions} />);
    expect(out).toContain("UP NEXT");
    expect(out).toContain(">01<");
    expect(out).toContain(">02<");
    expect(out.match(/<li class="met"/g)?.length).toBe(1);
  });

  it("the console shows all six numbers and a VU meter of ten bars", () => {
    const out = html(<slot.Stats stats={vm.stats} layout={{ ...vm.layout, compact: false }} actions={actions} />);
    for (const label of ["Cash", "Runway", "Capability", "Hype", "Arena", "AI R&amp;D"]) expect(out).toContain(label);
    expect(out.match(/<i class="[^"]*" style="height:/g)?.length).toBe(10);
    const hype = (value: number) => html(<slot.Stats stats={{ ...vm.stats, hype: { value } }} layout={vm.layout} actions={actions} />).match(/<i class="on/g)?.length ?? 0;
    expect(hype(0)).toBe(0);
    expect(hype(50)).toBe(5);
    expect(hype(100)).toBe(10);
  });

  it("the contestant card has a heart row per need, a pixel face and a FOLLOW key", () => {
    const inspector = vm.inspector!;
    const out = html(<slot.Inspector inspector={inspector} layout={{ ...vm.layout, compact: false }} actions={actions} />);
    expect(out).toContain(`CONTESTANT #${inspector.badge}`);
    expect(out.match(/class="kn-hearts"/g)?.length).toBe(inspector.needs.length);
    expect(out).toContain("kn-face");
    expect(out).toContain("FOLLOW");
    // On a phone the sheet keeps to the most urgent need and hides the Follow key until it is opened.
    const sheet = html(<slot.Inspector inspector={inspector} layout={{ ...vm.layout, compact: true }} actions={actions} />);
    expect(sheet.match(/class="kn-hearts"/g)?.length).toBe(Math.min(1, inspector.needs.length));
    expect(sheet).not.toContain("kn-follow");
  });

  it("the arcade has a round button with an LCD tag for each tool, and greys out what you cannot afford", () => {
    const items = vm.buildItems.map((it, i) => (i === 1 ? { ...it, affordable: false, selected: false } : it));
    const out = html(<slot.BuildBar items={items} tip={vm.buildTip} layout={vm.layout} actions={actions} />);
    expect(out.match(/class="kn-btnr"/g)?.length).toBe(items.length);
    expect(out.match(/class="kn-lcd"/g)?.length).toBe(items.length);
    expect(out).toContain('aria-pressed="true"');
    expect(out).toMatch(/kn-ab\s+poor/);
    for (const it of items) if (it.hotkey !== null) expect(out).toContain(`<span class="kn-k">${it.hotkey}</span>`);
  });

  it("carries the coach-mark hooks the playable tutorial spotlights, and renders the build items it is given", () => {
    const docked = html(<Docked vm={vm} actions={actions} />);
    for (const hook of ["start", "training", "stat:runway", "goals"]) expect(docked).toContain(`data-coach="${hook}"`);
    for (const it of vm.buildItems) expect(docked).toContain(`data-coach="build:${it.kind}"`);
    // The training element keeps its hook in both states, and the tray shows exactly the items it is handed (unlocks filter the list upstream).
    expect(html(<slot.Training training={{ ...vm.training, hasHall: false }} actions={actions} />)).toContain('data-coach="training"');
    const some = vm.buildItems.slice(0, 3);
    const tray = html(<slot.BuildBar items={some} tip={null} layout={vm.layout} actions={actions} />);
    expect(tray.match(/data-coach="build:/g)?.length).toBe(3);
  });

  it("names a toast for how it feels: a release gets the stars", () => {
    const say = (text: string, tone: "good" | "bad" | "joke" | "neutral" | "hint") => html(<slot.Toast toast={{ id: 1, text, tone }} actions={actions} />);
    expect(say("Frontier-2 is out! Launch week: +$70K", "good")).toContain("NEW RELEASE!");
    expect(say("Ada got a raise", "good")).toContain("ENCORE!");
    expect(say("Hugo left.", "bad")).toContain("OFF-KEY");
    expect(say("The kombucha is warm", "joke")).toContain("BONUS TRACK");
    expect(say("Build a gateway", "hint")).toContain("TIP");
    // A standing hint is not a button (it cannot be dismissed).
    expect(say("Build a gateway", "hint")).not.toContain("<button");
  });

  it("a thought bubble keeps the class photo mode copies", () => {
    const out = html(<slot.Bubble bubble={vm.bubbles[0]!} actions={actions} />);
    expect(out).toMatch(/^<div class="bubble /);
  });

  it("the deck uses the skin's tape words for the speed keys", () => {
    const out = html(<slot.Speed speed={vm.speed} stats={vm.stats} actions={actions} />);
    for (const word of ["Stop", "Play", "Fast forward", "Encore"]) expect(out).toContain(`aria-label="${word}"`);
  });

  it("draws every icon itself: no emoji and no glyph a font might not have, in any of its source", () => {
    const out = html(<Docked vm={vm} actions={actions} />);
    expect(out).not.toMatch(/\p{Extended_Pictographic}/u);
    // Notes, stars, hearts, ticks and transport symbols are SVG, never text (Pixelify and Jersey have none of them).
    for (const file of ["art", "stats", "queue", "card", "tray", "deck", "ticker", "toast", "cards"]) {
      // (a comment may name a symbol; what is drawn may not)
      const source = read(`karaoke-night/${file}.tsx`)!.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      expect(source, file).not.toMatch(/[←-⏿■-➿⬀-⯿]/u);
    }
  });
});

describe("Karaoke Night's Release Leapfrog panels", () => {
  it("HIGH SCORES is the benchmark table on a desktop and a badge with your SOTA count on a phone", () => {
    const desk = html(<slot.Benchmarks leapfrog={lf.leapfrog} layout={{ ...lf.layout, compact: false }} actions={actions} />);
    expect(desk).toContain("High Scores");
    expect(desk).toContain("bench-table");
    expect(desk.match(/class="bench-row/g)?.length).toBe(lf.leapfrog.rows.length);
    const phone = html(<slot.Benchmarks leapfrog={lf.leapfrog} layout={{ ...lf.layout, compact: true }} actions={actions} />);
    expect(phone).not.toContain("bench-table");
    expect(phone).toContain("kn-bench-wins");
    expect(phone).toContain("aria-expanded=\"false\"");
  });

  it("the applause meter has a block per lab, says who owns the news cycle, and steps aside on a phone", () => {
    const out = html(<slot.Voice leapfrog={lf.leapfrog} layout={{ ...lf.layout, compact: false }} actions={actions} />);
    expect(out.match(/<i class="[^"]*" style="width:/g)?.length).toBe(lf.leapfrog.voice.shares.length);
    expect(out).toContain(lf.leapfrog.voice.headline);
    expect(html(<slot.Voice leapfrog={lf.leapfrog} layout={{ ...lf.layout, compact: true }} actions={actions} />)).toBe("");
  });

  it("the forced-response card shows its three gauges, the meter lit to how ready the run is", () => {
    const event = shipNow.event!;
    expect(event.response).not.toBeNull();
    const out = html(<slot.EventCard event={event} actions={actions} />);
    for (const label of ["Ready", "Ship now", "Launch bug odds"]) expect(out).toContain(label);
    expect(out).toContain(event.response!.readyText);
    expect(out.match(/<i class="on"><\/i>/g)?.length).toBe(Math.round(event.response!.ready * 16));
  });

  it("the livestream card is a karaoke video with ON AIR, the viewers, the mishap and the chat as requests", () => {
    const event = stream.event!;
    const out = html(<slot.Livestream event={event} stream={event.stream!} actions={actions} />);
    expect(out).toContain("ON AIR");
    expect(out).toContain(event.stream!.viewersText);
    expect(out).toContain("kn-scene");
    expect(out).toContain(event.stream!.caption.replace(/'/g, "&#x27;"));
    expect(out.match(/<li><b>/g)?.length).toBeLessThanOrEqual(5);
    for (const c of event.choices) expect(out).toContain(c.label);
  });
});

describe("AI News Karaoke", () => {
  it("gives every word a moment, in order, after the count-in", () => {
    const { words, sing, total } = schedule("Interns told not to touch the big red button");
    expect(words.map((w) => w.word).join(" ")).toBe("Interns told not to touch the big red button");
    for (const w of words) expect(w.to).toBeGreaterThan(w.from);
    for (let i = 1; i < words.length; i++) expect(words[i]!.from).toBeGreaterThanOrEqual(words[i - 1]!.to);
    expect(words[0]!.from).toBeGreaterThan(0); // the ball bounces twice first
    expect(words.at(-1)!.to).toBeLessThanOrEqual(total);
    expect(total).toBeGreaterThan(sing);
  });

  it("sings a longer line for longer, but never for too long or too short", () => {
    expect(schedule("Hi").sing).toBe(3000);
    expect(schedule("word ".repeat(200)).sing).toBe(13000);
    const short = schedule("A short one, really");
    const long = schedule("A rather longer headline about a model that refuses to stop shipping, again");
    expect(long.sing).toBeGreaterThan(short.sing);
  });

  it("puts fresh news on the mic first, then goes back through the old hits", () => {
    const list = [item(1), item(2), item(3)];
    expect(pick(list, 3, 3)!.id).toBe(1); // nothing new: the tape wraps round
    expect(pick(list, 1, 3)!.id).toBe(2);
    expect(pick([...list, item(4), item(5)], 1, 3)!.id).toBe(4); // two new ones: the older of them first
    expect(pick([], null, 0)).toBeNull();
    expect(pick([item(9)], 9, 9)!.id).toBe(9); // a tape of one sings it again
  });

  it("puts the newest headline on the screen, each word twice (dim, and lit for the wipe), and teases the next", () => {
    const items = [item(1, "Older news that is teased"), item(2, "Interns told not to touch the big red button")];
    const out = html(<slot.Ticker items={items} actions={actions} />);
    expect(out).toContain("AI NEWS KARAOKE");
    expect(out.match(/class="kn-w"/g)?.length).toBe(9);
    expect(out.match(/class="kn-lit"/g)?.length).toBe(9);
    expect(out).toContain('class="kn-ball"');
    expect(out).toContain("Older news that is teased");
    // The lit copy is for the eyes only: a screen reader reads each word once.
    expect(out.match(/class="kn-lit" aria-hidden/g)?.length).toBe(9);
  });

  it("gives each line a score at the end, the same one every time, higher for good news than for bad", () => {
    for (const tone of ["good", "joke", "neutral", "bad"] as const) {
      for (let id = 1; id < 60; id++) {
        const r = rating({ id, tone });
        expect(r).toBeGreaterThanOrEqual(55);
        expect(r).toBeLessThanOrEqual(100);
        expect(rating({ id, tone })).toBe(r);
      }
    }
    expect(rating({ id: 7, tone: "good" })).toBeGreaterThan(rating({ id: 7, tone: "bad" }));
    const out = html(<slot.Ticker items={[{ id: 7, text: "Good news", tone: "good" }]} actions={actions} />);
    expect(out).toContain('class="kn-rate"');
  });

  it("stays on its feet with nothing to sing", () => {
    const out = html(<slot.Ticker items={[]} actions={actions} />);
    expect(out).toContain("AI NEWS KARAOKE");
    expect(out).not.toContain("kn-ball");
  });

  it("colours the sung words by how the news feels", () => {
    const out = (tone: TickerItemVM["tone"]) => html(<slot.Ticker items={[{ id: 1, text: "Good news", tone }]} actions={actions} />);
    for (const tone of ["good", "bad", "joke", "neutral"] as const) expect(out(tone)).toContain(`kn-line tone-${tone}`);
  });
});

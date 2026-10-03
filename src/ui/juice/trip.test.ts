// FLT-105's photosensitivity guardrail: sample what the trip does to the screen's colours, frame by frame, over a
// whole trip (coming on, the peak, wearing off, and the "I've had enough" button), at every game speed, and count
// flashes the WCAG 2.3.1 way. The rule allows three a second; the trip must have none, and no red flash at all.
// Pass 2 adds what the trip now puts on screen besides the wash: the calm version's still mandala, Frontier 95's
// psychedelic chrome (it fades with the strength), and the breakthrough's card (answered at once, with no dim behind it).
import { describe, expect, it } from "vitest";
import { TICKS_PER_DAY, TICKS_PER_SECOND } from "../../sim/constants";
import { flashReport, luminance, saturatedRed, type FlashReport, type Rgb } from "./flash";
import { ART_PAINTS, blended, CALM_TURN, hslColour, slew, slideSpeed, TRIP_CALM, TRIP_LOOK, tripFrame, tripTarget, type TripLook, type TripSpan, washColour, washed, washHueAt } from "./trip";

const hex = (h: string): Rgb => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
/** What is on screen: Frontier 95's greys and title bar, the campus's grass, paths and sky, the red roofs, pure primaries. */
const PALETTE = ["#c0c0c0", "#000080", "#ffffff", "#000000", "#6fae5a", "#8fd0ee", "#d9c9a3", "#d64545", "#ff0000", "#00ff00", "#0000ff", "#ffd23f", "#7b3fa0", "#1a120c"].map(hex);

/** Frontier 95's trip chrome (skin.css): the title bars' poster paint, the windows' ridge, the paperclip's halo. */
const CHROME = ["#4a148c", "#ad1457", "#e65100", "#00695c", "#283593", "#c2185b", "#e040fb", "#ff6e40", "#ffd740", "#69f0ae", "#40c4ff"];
/** What the chrome is drawn over: the title bar's navy, the window grey, white, black and the grass. */
const CHROME_UNDER = ["#000080", "#c0c0c0", "#ffffff", "#000000", "#6fae5a"].map(hex);
const art = ART_PAINTS.map(([h, sat, l]) => hslColour(h, sat / 100, l / 100));
const over = (a: Rgb, b: Rgb, k: number): Rgb => [0, 1, 2].map((i) => a[i]! + (b[i]! - a[i]!) * k) as unknown as Rgb;
/** How long after a card lands the quickest answer comes. */
const QUICKEST_ANSWER = 0.3;

const css = import.meta.glob<string>(["./juice.css", "../../skins/frontier-95/skin.css"], { query: "?raw", import: "default", eager: true });
const juiceCss = css["./juice.css"]!;
const f95Css = css["../../skins/frontier-95/skin.css"]!;

const FPS = 60;
/** The HUD hears the sim about five times a second, so that is how often the target moves. */
const SNAPSHOT_HZ = 5;
/** ACID MOD(E)'s trip: it comes on over a day, lasts five, and wears off over a day and a half. */
const SPAN: TripSpan = { start: 0, end: 5 * TICKS_PER_DAY, rise: TICKS_PER_DAY, fade: 1.5 * TICKS_PER_DAY };

interface Run {
  look: TripLook;
  speed: number;
  /** Press "I've had enough" this many seconds in. */
  enoughAt?: number;
  /** The breakthrough's card lands this many seconds in and is answered at once (game time stands still meanwhile). */
  cardAt?: number;
}

/**
 * Play a trip and return the samples of every colour on screen, as the trip leaves it, every frame: the palette under
 * the wash, the palette under the still art and the wash, and the chrome over what it sits on. A card while a trip is
 * on has no dim behind it, so its coming and going changes nothing screen-wide: what it does do is stop game time.
 */
function play({ look, speed, enoughAt, cardAt }: Run) {
  const times: number[] = [];
  const series = (n: number) => Array.from({ length: n }, (): Rgb[] => []);
  const colours = series(PALETTE.length);
  const painted = series(PALETTE.length * art.length);
  const chrome = series(CHROME_UNDER.length * CHROME.length);
  let level = 0;
  let target = 0;
  let peak = 0;
  // TripScreen writes --trip-k (which the chrome fades by) ten times a second.
  let k = 0;
  // The sim stands still while a card is up: game time stops between the card landing and its answer.
  let simT = 0;
  const dt = 1 / FPS;
  const last = (SPAN.end + SPAN.fade) / (speed * TICKS_PER_SECOND) + 1 / look.fall + 2 + (cardAt !== undefined ? QUICKEST_ANSWER : 0);
  for (let frame = 0; frame * dt < last; frame++) {
    const t = frame * dt;
    const cardUp = cardAt !== undefined && t >= cardAt && t < cardAt + QUICKEST_ANSWER;
    if (!cardUp) simT += dt;
    if (frame % (FPS / SNAPSHOT_HZ) === 0) target = tripTarget(SPAN, simT * speed * TICKS_PER_SECOND);
    level = slew(level, target, dt, look, enoughAt !== undefined && t >= enoughAt);
    if (frame % 6 === 0) k = level;
    peak = Math.max(peak, level);
    const f = tripFrame(t, level, look);
    times.push(t);
    // The wash is a conic gradient: one point on screen sees every hue go by as it turns, so one angle is enough.
    const hue = washHueAt(f, 0);
    PALETTE.forEach((c, i) => colours[i]!.push(washed(c, hue, f.wash)));
    // The still art sits under the wash (z-index 1 against the wash's 50).
    PALETTE.forEach((c, i) => art.forEach((paint, j) => painted[i * art.length + j]!.push(washed(blended(c, paint, f.art), hue, f.wash))));
    CHROME_UNDER.forEach((c, i) => CHROME.forEach((q, j) => chrome[i * CHROME.length + j]!.push(washed(over(c, hex(q), k), hue, f.wash))));
  }
  return { times, colours: [...colours, ...painted, ...chrome], wash: colours, peak, endLevel: level };
}

function worst(run: Run): FlashReport & { peak: number } {
  const { times, colours, peak } = play(run);
  const reports = colours.map((c) => flashReport(times, c));
  return {
    flashes: Math.max(...reports.map((r) => r.flashes)),
    red: Math.max(...reports.map((r) => r.red)),
    transitions: Math.max(...reports.map((r) => r.transitions)),
    peak,
  };
}

describe("the flash counter", () => {
  const times = Array.from({ length: 4 * FPS }, (_, i) => i / FPS);
  it("counts a strobe", () => {
    // 5 Hz black and white: five flashes a second.
    expect(flashReport(times, times.map((t) => (Math.floor(t * 10) % 2 ? hex("#ffffff") : hex("#000000"))))).toMatchObject({ flashes: 5 });
    // Two a second passes; four fails.
    expect(flashReport(times, times.map((t) => (Math.floor(t * 4) % 2 ? hex("#ffffff") : hex("#000000")))).flashes).toBe(2);
    expect(flashReport(times, times.map((t) => (Math.floor(t * 8) % 2 ? hex("#ffffff") : hex("#000000")))).flashes).toBe(4);
  });
  it("lets small changes and very bright pairs through, as WCAG does", () => {
    expect(flashReport(times, times.map((t) => (Math.floor(t * 10) % 2 ? hex("#808080") : hex("#7a7a7a")))).flashes).toBe(0);
    expect(flashReport(times, times.map((t) => (Math.floor(t * 10) % 2 ? hex("#ffffff") : hex("#f4f4f4")))).flashes).toBe(0);
  });
  it("tells a saturated red flash from a plain one", () => {
    expect(saturatedRed(hex("#ff0000"))).toBe(true);
    expect(saturatedRed(hex("#ff8080"))).toBe(false);
    expect(flashReport(times, times.map((t) => (Math.floor(t * 10) % 2 ? hex("#ff0000") : hex("#000000"))))).toMatchObject({ red: 5 });
    expect(flashReport(times, times.map((t) => (Math.floor(t * 10) % 2 ? hex("#ffffff") : hex("#000000")))).red).toBe(0);
    expect(luminance(hex("#ffffff"))).toBeCloseTo(1);
  });
  it("dates a transition by when the change happens, not by when it first touches saturated red", () => {
    // A slow red swell: up from grey to saturated red over two seconds and back over two. One rise, one fall, not a flash.
    const long = Array.from({ length: 6 * FPS }, (_, i) => i / FPS);
    const swell = (t: number): Rgb => { const k = Math.max(0, 1 - Math.abs(t - 3) / 2); return [0.45 + 0.4 * k, 0.45 - 0.42 * k, 0.45 - 0.42 * k]; };
    expect(saturatedRed(swell(3))).toBe(true);
    expect(flashReport(long, long.map(swell)).red).toBe(0);
    // The same swell squeezed into a fifth of a second, five times a second: five red flashes.
    expect(flashReport(long, long.map((t) => swell(3 + 10 * ((t % 0.2) - 0.1)))).red).toBeGreaterThanOrEqual(4);
  });
});

describe("the trip never flashes (WCAG 2.3.1)", () => {
  const rows: string[] = [];
  const runs: [string, Run][] = [];
  for (const [name, look] of [["full", TRIP_LOOK], ["reduced motion", TRIP_CALM]] as const) {
    for (const speed of [1, 3, 10]) {
      runs.push([`${name}, ${speed}×`, { look, speed }]);
      runs.push([`${name}, ${speed}×, "I've had enough" at the peak`, { look, speed, enoughAt: 6 / speed + 5 }]);
    }
    // Pass 2: Continue, then "I've had enough" half a second later (the chrome must not blink on and off).
    runs.push([`${name}, 1×, "I've had enough" half a second in`, { look, speed: 1, enoughAt: 0.5 }]);
    // Pass 2: the breakthrough's card lands at the peak (three days in) and is answered at once.
    for (const speed of [1, 10]) runs.push([`${name}, ${speed}×, the breakthrough's card, answered at once`, { look, speed, cardAt: (3 * TICKS_PER_DAY) / (speed * TICKS_PER_SECOND) }]);
  }

  it.each(runs)("%s: no flashes, no red flashes", (name, run) => {
    const r = worst(run);
    rows.push(`| ${name} | ${r.peak.toFixed(2)} | ${r.flashes} | ${r.red} | ${r.transitions} |`);
    // The guideline's limit is three a second. A wash that keeps each pixel's brightness has none.
    expect(r.flashes).toBeLessThanOrEqual(3);
    expect(r.flashes).toBe(0);
    expect(r.red).toBe(0);
  });

  it("comes on at full speed, even at 10× (the slew keeps it gentle, it doesn't skip it)", () => {
    expect(worst({ look: TRIP_LOOK, speed: 1 }).peak).toBeGreaterThan(0.99);
    expect(worst({ look: TRIP_LOOK, speed: 10 }).peak).toBeGreaterThan(0.3);
  });

  it("\"I've had enough\" ends it in well under a second", () => {
    const at = 20;
    const { times, wash: colours } = play({ look: TRIP_LOOK, speed: 1, enoughAt: at });
    const i = times.findIndex((t) => t >= at + 1 / TRIP_LOOK.enough + 0.05);
    expect(1 / TRIP_LOOK.enough).toBeLessThan(0.5);
    // A second later, every colour is itself again.
    PALETTE.forEach((c, k) => colours[k]![i]!.forEach((v, ch) => expect(v).toBeCloseTo(c[ch]!, 5)));
  });

  it("reduced motion moves nothing: no warp, no wobble, no melt, no kaleidoscope, no trails, and the colour stands still", () => {
    for (let t = 0; t < 30; t += 0.37) {
      const f = tripFrame(t, 1, TRIP_CALM);
      expect([f.breathe, f.wobble, f.melt, f.kaleido, f.swirl, f.spin, f.trails]).toEqual([1, 0, 0, 0, 0, 0, 0]);
      // Pass 2: the wash doesn't turn and the art is still; only the strength fades them in and out.
      expect([f.turn, f.art, f.wash]).toEqual([CALM_TURN, TRIP_CALM.art, TRIP_CALM.wash]);
    }
    expect(slideSpeed(TRIP_CALM, 800)).toBe(0);
    expect(TRIP_LOOK.art).toBe(0);
  });

  it("samples the colours the CSS really draws: the still art's paints and Frontier 95's chrome", () => {
    const artRule = juiceCss.slice(juiceCss.indexOf(".trip-art {"));
    for (const [h, sat, l] of ART_PAINTS) expect(artRule).toContain(`hsl(${h} ${sat}% ${l}%)`);
    expect(artRule).toContain("mix-blend-mode: color");
    const chromeRule = f95Css.slice(f95Css.indexOf("Pass 2: the psychedelic chrome"));
    for (const q of CHROME) expect(chromeRule).toContain(q);
    // Faded by the strength, never switched on in one step.
    expect(chromeRule.match(/var\(--trip-k, 0\)/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("a card's dim, answered at once, would be a flash: so a trip turns it off", () => {
    // Frontier 95's dim darkens every other pixel by 30%. On and off inside a second is one flash for those pixels.
    const times = Array.from({ length: 2 * FPS }, (_, i) => i / FPS);
    const dim = flashReport(times, times.map((t) => (t >= 0.5 && t < 0.5 + QUICKEST_ANSWER ? hex("#b3b3b3") : hex("#ffffff"))));
    expect(dim.flashes).toBe(1);
    expect(f95Css).toMatch(/\.f95-layer\.f95-dim \{\s*background-image: none;/);
  });

  it("the canvas pass slides the picture no faster than a slow camera pan", () => {
    // 1440×900: a corner is about 850 px from the middle. 220 px a second crosses the screen in about six and a half seconds.
    expect(slideSpeed(TRIP_LOOK, 850)).toBeLessThan(220);
    expect(TRIP_LOOK.kaleido).toBeLessThanOrEqual(0.5);
  });

  it("would catch a look that strobes: the test is not a rubber stamp", () => {
    // The same wash painted over the screen instead of blended by colour (so it changes brightness), turning fast.
    const times = Array.from({ length: 4 * FPS }, (_, i) => i / FPS);
    const painted = (c: Rgb, deg: number, a: number): Rgb => {
      const w = washColour(deg);
      return [0, 1, 2].map((i) => c[i]! + (w[i]! - c[i]!) * a) as unknown as Rgb;
    };
    const fast = PALETTE.map((c) => flashReport(times, times.map((t) => painted(c, (360 * t) / 0.3, 0.9))));
    expect(Math.max(...fast.map((r) => r.flashes))).toBeGreaterThan(3);
    expect(Math.max(...fast.map((r) => r.red))).toBeGreaterThan(0);
    // And a breathing brightness pulse, six times a second, is a strobe.
    const pulse = flashReport(times, times.map((t) => { const b = 1 + 0.6 * Math.sin(2 * Math.PI * 6 * t); return [0.5 * b, 0.5 * b, 0.5 * b] as Rgb; }));
    expect(pulse.flashes).toBeGreaterThan(3);
  });

  it("prints the report", () => {
    console.info(["", "| Trip, speed | Peak strength | Flashes in any 1 s (WCAG max 3) | Red flashes in any 1 s | Luminance turns, whole trip |", "|---|---|---|---|---|", ...rows].join("\n"));
    expect(rows.length).toBe(runs.length);
  });
});

import { describe, expect, it } from "vitest";
import { createMachine } from "xstate";
import { getShortestPaths } from "xstate/graph";
import { eventById } from "../../content/events";
import { createTestCampus, answer, readyForPressure } from "../testkit";
import { openEventOf } from "../events";
import { applyNow, tick, TICKS_PER_DAY } from "../tick";
import { checkChart, structural } from "../circus/chart";
import { enableHearing } from "../hearing/driver";
import { disableYacht, enableYacht } from "./driver";
import { ENDINGS, loadYachtPack, YACHT } from "./pack";
import { yachtView } from "./view";
import type { GameState } from "../types";

const RSVP = { sign: 0, intern: 1, decline: 2 } as const;
const REPLY = { deny: 0, apologise: 1, blame: 2 } as const;

function staged(seed = 3) {
  const s = createTestCampus(seed);
  readyForPressure(s);
  s.progression = { value: "complete", context: { level: 5 } };
  enableYacht(s);
  return s;
}
/** Tick until `id` is the card on screen, answering anything else with its first choice. */
function waitFor(s: GameState, id: string, days = 60) {
  for (let i = 0; i < days * TICKS_PER_DAY; i++) {
    const open = openEventOf(s);
    if (open?.id === id) return;
    tick(s, open ? answer(s) : []);
  }
  throw new Error(`${id} never opened (yacht at ${s.yacht?.machine.value}, day ${s.day})`);
}
function cruise(s: GameState, rsvp: keyof typeof RSVP, reply: keyof typeof REPLY) {
  waitFor(s, "yacht-invite");
  applyNow(s, answer(s, RSVP[rsvp]));
  waitFor(s, "yacht-leak");
  expect(eventById("yacht-leak")?.kind).toBe("leak");
  const view = yachtView(s);
  applyNow(s, answer(s, REPLY[reply]));
  return view;
}

describe("the yacht pack", () => {
  it("names only real verbs, guards and states, and every ending is reachable", () => {
    expect(checkChart(YACHT.chart)).toEqual([]);
    const chart = createMachine(structural(YACHT.chart));
    const reached = new Set(getShortestPaths(chart).map((p) => p.state.value));
    expect(reached).toEqual(new Set(Object.keys(YACHT.chart.states)));
    for (const e of ENDINGS) expect(reached.has(e)).toBe(true);
    expect(() => loadYachtPack({})).toThrow();
  });
  it("has a group chat for both RSVPs, written by rivals the game knows", () => {
    expect(YACHT.rules.chat.signed.length).toBeGreaterThanOrEqual(6);
    expect(YACHT.rules.chat.declined.length).toBeGreaterThanOrEqual(6);
    expect(YACHT.content.headlines.add.filter((h) => h.trigger === "priceFixing").length).toBeGreaterThanOrEqual(5);
  });
});

describe("a summit in the game", () => {
  it.each([
    ["sign", "deny", "denied"],
    ["intern", "apologise", "apologised"],
    ["decline", "blame", "blamed"],
  ] as const)("RSVP %s, reply %s → %s", (rsvp, reply, ending) => {
    const s = staged();
    const trust = s.disasters.trust;
    const view = cruise(s, rsvp, reply);
    expect(view.stage).toBe("leaked");
    expect(view.chat.length).toBeGreaterThan(0);
    expect(view.chat.some((l) => l.you)).toBe(true);
    expect(s.yacht!.rsvp).toBe(rsvp);
    expect(s.yacht!.ending).toBe(ending);
    expect(s.yacht!.machine.value).toBe(ending);
    expect(openEventOf(s)).toBeNull();
    if (reply === "apologise") expect(s.disasters.trust).toBeGreaterThan(trust);
    expect(s.flags["subpoena:yacht"] !== undefined).toBe(reply !== "apologise");
  });
  it("shows the signed chat to a signer and the other one to a decliner", () => {
    const signed = cruise(staged(), "sign", "apologise");
    const declined = cruise(staged(), "decline", "apologise");
    expect(signed.chat.map((l) => l.text)).not.toEqual(declined.chat.map((l) => l.text));
    expect(signed.chat).toHaveLength(YACHT.rules.chat.signed.length);
    expect(declined.chat).toHaveLength(YACHT.rules.chat.declined.length);
  });
  it("runs the price-fixing jokes on the ticker after the leak", () => {
    const s = staged();
    cruise(s, "sign", "apologise");
    const jokes = new Set(YACHT.content.headlines.add.filter((h) => h.trigger === "priceFixing").map((h) => h.text.replace("{lab}", s.labName)));
    const before = s.news.filter((n) => jokes.has(n.text)).length;
    for (let i = 0; i < 20 * TICKS_PER_DAY; i++) tick(s, answer(s));
    expect(s.news.filter((n) => jokes.has(n.text)).length).toBeGreaterThan(before);
  });
  it("denying the chat gets the lab summoned to the Hearing", () => {
    const s = staged();
    enableHearing(s);
    s.hearing!.seen.debut = 1; // the first-time summons has been and gone
    cruise(s, "sign", "deny");
    for (let i = 0; i < 5 * TICKS_PER_DAY && s.hearing!.machine.value === "quiet"; i++) tick(s, answer(s));
    expect(s.hearing!.machine.value).not.toBe("quiet");
    expect(s.hearing!.machine.context.trigger).toBe("subpoena");
  });
  it("stays at the dock below Level 5, and switching off closes the invitation", () => {
    const s = staged();
    for (let i = 0; i < 40 * TICKS_PER_DAY; i++) {
      s.progression = { value: "growing", context: { level: 4 } }; // held at Level 4: this campus would climb otherwise
      tick(s, answer(s));
    }
    expect(s.yacht!.machine.value).toBe("quiet");
    s.progression = { value: "complete", context: { level: 5 } };
    waitFor(s, "yacht-invite");
    disableYacht(s);
    expect(openEventOf(s)).toBeNull();
  });
  it("is deterministic for a seed", () => {
    const run = () => {
      const s = staged(9);
      cruise(s, "intern", "blame");
      return JSON.stringify([s.yacht, s.hype, s.disasters.trust, s.news.slice(-6)]);
    };
    expect(run()).toBe(run());
  });
});

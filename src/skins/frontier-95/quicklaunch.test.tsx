// FLT-94: Quick Launch launches applets, never building tools; building is the Facilities palette (two clicks), hiring
// is the Staff Manager; the tray shows the lab's rank and opens the leaderboard. Every control carries a stable
// `data-anchor` for the coach (FLT-93).
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { HELP_BUILDINGS } from "../../content/help";
import { fixtureInput, type FixtureOptions } from "../../ui/hud/fixtures";
import { Docked } from "../../ui/hud/tree";
import type { HudActions, HudVM, WidgetVM } from "../../ui/hud/types";
import { hudViewModel } from "../../ui/hud/vm";
import { SkinProvider } from "../context";
import { prepareSkin } from "../registry";
import { palette } from "./palette";
import { QUICK_SHOWN, quickLaunch, rankChip } from "./quick";

const actions = new Proxy({}, { get: () => () => undefined }) as HudActions;
const { skin } = await prepareSkin("frontier-95");
const PHONE = { width: 390, height: 844 };
const vmOf = (o: FixtureOptions = {}) => hudViewModel(fixtureInput(o));
const render = (vm: HudVM) =>
  renderToString(
    <SkinProvider skin={skin}>
      <Docked vm={vm} actions={actions} />
    </SkinProvider>,
  );
/** Quick Launch's markup: its buttons hold only icons, so its span ends at the first </span>. */
const block = (out: string, cls: string) => {
  const at = out.indexOf(`class="${cls}"`);
  expect(at, cls).toBeGreaterThan(-1);
  return out.slice(out.indexOf(">", at) + 1, out.indexOf("</span>", at));
};
const anchors = (html: string) => [...html.matchAll(/data-anchor="([^"]+)"/g)].map((m) => m[1]!);
const widget = (id: string): WidgetVM => ({ id, name: id, file: `${id}.exe`, blurb: `${id} blurb`, icon: id, aliases: [] });

afterEach(() => palette.set(false));

describe("Frontier 95's Quick Launch (FLT-94)", () => {
  it("holds applets only: the palette first, then the leaderboard, the Bird App, Finance, Thoughts, the paper, the drama", () => {
    const apps = quickLaunch(["drama", "news", "thoughts", "finance", "bird", "arena", "staff", "saves", "help", "properties", "benchmarks"].map(widget));
    expect(apps.map((a) => a.id)).toEqual(["facilities", "staff", "arena", "bird", "finance", "thoughts", "news", "drama"]);
    expect(apps.map((a) => a.anchor)).toEqual(apps.map((a) => `app:${a.id}`));
    for (const a of apps) expect(a.tip.startsWith(`${a.name}: `), a.id).toBe(true);
  });

  it("draws no building tool on the taskbar, and every icon has a tooltip", () => {
    const out = render(vmOf({ leapfrog: true }));
    const qs = block(out, "f95-qs");
    const ids = anchors(qs);
    expect(ids[0]).toBe("app:facilities");
    expect(ids).toEqual(expect.arrayContaining(["app:arena", "app:finance", "app:thoughts", "app:news"]));
    for (const id of ids) expect(id, id).toMatch(/^(app:[a-z]+|apps)$/);
    expect(qs).not.toContain("build:");
    const buttons = [...qs.matchAll(/<button[^>]*>/g)].map((m) => m[0]);
    expect(buttons.length).toBeGreaterThan(3);
    for (const b of buttons) expect(b, b).toMatch(/title="[^"]{4,}"/);
  });

  it("keeps eight on a desktop and puts the rest behind its »", () => {
    const vm = vmOf({ leapfrog: true });
    const all = quickLaunch(vm.widgets);
    const qs = block(render(vm), "f95-qs");
    if (all.length > QUICK_SHOWN) {
      expect(qs).toContain('data-anchor="apps"');
      expect(anchors(qs).filter((a) => a.startsWith("app:"))).toHaveLength(QUICK_SHOWN);
    } else expect(qs).not.toContain('data-anchor="apps"');
  });

  it("keeps only the palette by Start on a phone; the other applets wait in the tray's »", () => {
    const out = render(vmOf({ ...PHONE, leapfrog: true }));
    expect(anchors(block(out, "f95-qs"))).toEqual(["app:facilities"]);
    const more = out.slice(out.indexOf('class="f95-more"'), out.indexOf('class="f95-speed"'));
    expect(more).toContain('data-anchor="app:arena"');
    expect(more).toContain('data-anchor="app:staff"');
    // News and Drama already have tray icons: not twice.
    expect(more).not.toContain('data-anchor="app:news"');
    expect(more).not.toContain('data-anchor="app:drama"');
  });
});

describe("Frontier 95's tray rank (FLT-94)", () => {
  it("shows the lab's place, up or down, and opens the leaderboard", () => {
    const vm = vmOf({ leapfrog: true });
    const out = render(vm);
    expect(out).toMatch(new RegExp(`<button[^>]*class="f95-rank[^"]*"[^>]*data-anchor="tray:rank"[^>]*title="Frontier Arena: [^"]*leaderboard[^"]*"`));
    expect(out).toContain(`<span>#${vm.stats.arena.rank}</span>`);
  });

  it("is not there before the Arena is earned", () => {
    expect(render(vmOf({ level: 1 }))).not.toContain("tray:rank");
  });

  it("says up, down and on top", () => {
    const base = { rank: 3, rankDelta: 0, tone: "" as const, deltaText: "–", top: false, open: false, flinch: false };
    expect(rankChip({ ...base, rankDelta: 2, deltaText: "↑2" })).toMatchObject({ text: "#3", arrow: "▲" });
    expect(rankChip({ ...base, rankDelta: -1, deltaText: "↓1" }).arrow).toBe("▼");
    expect(rankChip(base).tip).toBe("Frontier Arena: #3. Click for the leaderboard.");
    expect(rankChip({ ...base, rank: 1, top: true }).tip).toContain("on top. For now.");
  });
});

describe("Frontier 95's Facilities palette (FLT-94)", () => {
  it("is shut until it is opened", () => {
    expect(render(vmOf())).not.toContain("win:facilities");
  });

  it("is a grid of every building with its price and what it is for, plus Path, Bulldoze and Staff", () => {
    palette.set(true);
    const vm = vmOf();
    const out = render(vm);
    expect(out).toContain('data-anchor="win:facilities"');
    const ids = anchors(out);
    for (const it of vm.buildItems) expect(ids, it.kind).toContain(`build:${it.kind}`);
    expect(ids).toEqual(expect.arrayContaining(["build:path", "build:bulldoze", "build:staff", "build:hall"]));
    const hall = vm.buildItems.find((i) => i.kind === "hall")!;
    expect(hall.does).toBe(HELP_BUILDINGS.hall!.replace(/^[^:]+:\s*/, ""));
    expect(out).toContain(hall.priceText);
    expect(out).toContain("trains your models");
    expect(vm.buildItems.find((i) => i.kind === "cluster")!.upkeepText).toMatch(/\/day upkeep$/);
  });

  it("lights the tile the coach points at, and Start stops asking", () => {
    const at = (target: string) => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].find((n) => vmOf({ level: 1, coach: n }).coach?.target === target)!;
    const step = at("build:hall");
    expect(step).toBeDefined();
    const shut = render(vmOf({ level: 1, coach: step }));
    expect(shut).toMatch(/<button[^>]*data-anchor="start"[^>]*data-coach-active=""/);
    palette.set(true);
    const open = render(vmOf({ level: 1, coach: step }));
    expect(open).toMatch(/data-anchor="build:hall" data-coach="build:hall" data-coach-active=""/);
    expect(open).not.toMatch(/<button[^>]*data-anchor="start"[^>]*data-coach-active=""/);
  });
});

describe("Frontier 95's Staff Manager (FLT-94)", () => {
  it("anchors the window and every Hire button", () => {
    const vm = vmOf({ staff: true });
    const out = render(vm);
    expect(out).toContain('data-anchor="win:staff"');
    for (const j of vm.staff.jobs) expect(out, j.job).toContain(`data-anchor="hire:${j.job}"`);
  });
});

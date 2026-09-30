import { describe, expect, it } from "vitest";
import { fixtureInput } from "../../ui/hud/fixtures";
import { hudViewModel } from "../../ui/hud/vm";
import { coachInFacilities, facilityGroups, runFile } from "./launcher";

const vm = hudViewModel(fixtureInput({}));
const widgets = vm.widgets!;

describe("facilityGroups", () => {
  it("keeps the tools on top and groups the rest in submenu order, with no building lost", () => {
    const { tools, groups } = facilityGroups(vm.buildItems);
    expect(tools.some((it) => it.isPath)).toBe(true);
    expect(groups.map((g) => g.id)).toEqual(["compute", "research", "amenities", "offices"].filter((id) => groups.some((g) => g.id === id)));
    expect(tools.length + groups.reduce((n, g) => n + g.items.length, 0)).toBe(vm.buildItems.length);
  });

  it("stands the Facilities entry in for a coach target inside it, but not for the path", () => {
    expect(coachInFacilities("build:hall", vm.buildItems)).toBe(true);
    expect(coachInFacilities("build:path", vm.buildItems)).toBe(false);
    expect(coachInFacilities("speed", vm.buildItems)).toBe(false);
  });
});

describe("runFile", () => {
  it("opens a widget by file, bare name, title, alias or a long enough prefix", () => {
    for (const typed of ["thoughts.txt", "THOUGHTS", "  thoughts.exe ", "labprops.cpl", "C:\\WINDOWS\\drama.exe", "http://www.drama.html/", "Today's Drama", "skin", "mod"]) {
      expect(runFile(typed, widgets).ok, typed).toBe(true);
    }
    expect(runFile("tho", widgets)).toMatchObject({ ok: true, widget: { id: "thoughts" } });
    // FLT-65's Save/Load window, from Run… as well as Ctrl+S and the Start menu.
    for (const typed of ["save.exe", "save", "load", "floppy"]) expect(runFile(typed, widgets), typed).toMatchObject({ ok: true, widget: { id: "saves" } });
  });

  it("says something about the things people will type, and 'Cannot find' about the rest", () => {
    expect(runFile("agi.exe", widgets)).toMatchObject({ ok: false, title: "agi.exe" });
    expect(runFile("format c:", widgets)).toMatchObject({ ok: false, title: "Format" });
    const miss = runFile("zzz.exe", widgets);
    expect(miss.ok).toBe(false);
    if (!miss.ok) expect(miss.text).toContain("Cannot find 'zzz.exe'");
    expect(runFile("", widgets).ok).toBe(false);
  });

  it("does not open a widget the lab has not earned", () => {
    expect(runFile("discourse.exe", widgets.filter((w) => w.id !== "discourse")).ok).toBe(false);
  });
});

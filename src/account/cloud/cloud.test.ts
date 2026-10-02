import type { SaveHead, SaveSummary, Slot } from "../contract";
import type { PutResult } from "./api";
import { catchUp, cloudOffer, keepsCloudAuto, type LocalSave } from "./offer";
import { AUTO_GAP_MS, CloudSync, DEBOUNCE_MS, type SyncStatus } from "./sync";

const head = (over: Partial<SaveHead> = {}): SaveHead => ({
  kind: "fltsave",
  v: 3,
  savedAt: "2026-10-01T12:00:00.000Z",
  seed: 7,
  lab: "Paperclip Maximal",
  day: 200,
  tick: 48_000,
  mods: [],
  skin: "frontier-95",
  enc: "gzip64",
  ...over,
});
const summary = (slot: Slot, over: Partial<SaveHead> = {}): SaveSummary => ({ slot, size: 45_000, updatedAt: 0, head: head(over) });
const local = (slot: string, over: Partial<LocalSave> = {}): LocalSave => ({ slot, savedAt: "2026-10-01T12:00:00.000Z", seed: 7, lab: "Paperclip Maximal", day: 200, ...over });

describe("Continue from the cloud: when it's offered", () => {
  it("offers the cloud's newest save when it is newer than anything on this computer", () => {
    const cloud = [summary("auto", { savedAt: "2026-10-02T09:00:00.000Z" }), summary("1", { savedAt: "2026-10-02T10:00:00.000Z", lab: "Slot Lab" })];
    expect(cloudOffer([], cloud)?.slot).toBe("1");
    expect(cloudOffer([local("auto", { savedAt: "2026-10-01T08:00:00.000Z" })], cloud)?.head.lab).toBe("Slot Lab");
  });

  it("stays quiet when this computer is newer, when the save is already here, and when the cloud is empty", () => {
    const cloud = [summary("auto")];
    expect(cloudOffer([local("2", { savedAt: "2026-10-01T13:00:00.000Z" })], cloud)).toBeNull();
    expect(cloudOffer([local("auto")], cloud)).toBeNull();
    // The same save, copied to another slot here, is still the same save.
    expect(cloudOffer([local("3")], cloud)).toBeNull();
    expect(cloudOffer([local("auto")], [])).toBeNull();
  });

  it("doesn't count the autosave that leaving for Hugging Face wrote (a fresh garage on a new computer)", () => {
    const away = Date.parse("2026-10-02T09:00:00.000Z");
    const garage = local("auto", { savedAt: "2026-10-02T09:00:01.000Z", seed: 99, lab: "Garage Labs", day: 1 });
    expect(cloudOffer([garage], [summary("auto")])).toBeNull();
    expect(cloudOffer([garage], [summary("auto")], away)?.head.lab).toBe("Paperclip Maximal");
  });

  it("sends up the slots that are newer here (a guest's labs at their first log-on)", () => {
    const cloud = [summary("auto"), summary("1")];
    const here = [local("auto", { savedAt: "2026-10-01T13:00:00.000Z" }), local("1"), local("2")];
    expect(catchUp(here, cloud)).toEqual(["auto", "2"]);
  });

  it("keeps a cloud autosave of a different lab that is further along", () => {
    expect(keepsCloudAuto(head({ day: 400 }), { seed: 99, lab: "Garage Labs", day: 3 })).toBe(true);
    expect(keepsCloudAuto(head({ day: 400 }), { seed: 7, lab: "Paperclip Maximal", day: 3 })).toBe(false);
    expect(keepsCloudAuto(head({ day: 2 }), { seed: 99, lab: "Garage Labs", day: 3 })).toBe(false);
    expect(keepsCloudAuto(null, { seed: 99, lab: "Garage Labs", day: 3 })).toBe(false);
  });
});

/** A clock the test moves by hand, and the uploads the sync makes. */
function rig(answers: PutResult["kind"][] = [], gate: Promise<unknown> = Promise.resolve()) {
  let now = 1_000_000;
  let tasks: { at: number; f: () => void; id: number }[] = [];
  let ids = 0;
  const texts = new Map<Slot, string>();
  const puts: { slot: Slot; text: string; keepalive: boolean; at: number }[] = [];
  const statuses: SyncStatus[] = [];
  const cloud = new Map<Slot, SaveSummary>();
  const sync = new CloudSync(
    {
      put: async (slot, text, keepalive) => {
        puts.push({ slot, text, keepalive, at: now });
        await gate;
        const kind = answers.shift() ?? "ok";
        if (kind === "ok") return { kind, summary: { slot, size: text.length, updatedAt: now, head: JSON.parse(text) } };
        if (kind === "refused") return { kind, message: "That isn't a lab save (.fltsave)." };
        return { kind };
      },
      read: async (slot) => texts.get(slot) ?? null,
      now: () => now,
      later: (f, ms) => {
        const id = ++ids;
        tasks.push({ at: now + ms, f, id });
        return () => void (tasks = tasks.filter((t) => t.id !== id));
      },
      status: (s) => void statuses.push(s),
    },
    cloud,
  );
  const settle = () => new Promise((r) => setTimeout(r, 0));
  /** Move the clock, running what falls due (and what they schedule) on the way. */
  const advance = async (ms: number) => {
    const end = now + ms;
    for (;;) {
      await settle();
      const next = tasks.filter((t) => t.at <= end).sort((a, b) => a.at - b.at)[0];
      if (!next) break;
      tasks = tasks.filter((t) => t !== next);
      now = Math.max(now, next.at);
      next.f();
    }
    now = end;
    await settle();
  };
  const save = (slot: Slot, why: string, over: Partial<SaveHead> = {}) => {
    texts.set(slot, JSON.stringify({ ...head({ savedAt: new Date(now).toISOString(), ...over }), state: `world-at-${now}` }));
    sync.saved(slot, why);
  };
  return { sync, puts, statuses, cloud, advance, save, texts };
}

describe("uploads", () => {
  it("waits for the offer to be answered, then sends what was saved meanwhile", async () => {
    const r = rig();
    r.save("1", "manual");
    await r.advance(60_000);
    expect(r.puts).toEqual([]);
    r.sync.open();
    await r.advance(DEBOUNCE_MS);
    expect(r.puts.map((p) => p.slot)).toEqual(["1"]);
  });

  it("debounces a burst of saves into one upload of the newest bytes", async () => {
    const r = rig();
    r.sync.open();
    r.save("2", "manual", { day: 10 });
    await r.advance(500);
    r.save("2", "manual", { day: 11 });
    await r.advance(DEBOUNCE_MS - 1);
    expect(r.puts).toEqual([]);
    await r.advance(1);
    expect(r.puts).toHaveLength(1);
    expect(JSON.parse(r.puts[0]!.text).day).toBe(11);
    expect(r.statuses.at(-1)).toMatchObject({ kind: "synced", slot: "2" });
  });

  it("sends the autosave at most once a minute, but the one written as the tab hides at once (keepalive)", async () => {
    const r = rig();
    r.sync.open();
    r.save("auto", "month");
    await r.advance(DEBOUNCE_MS);
    r.save("auto", "month");
    await r.advance(DEBOUNCE_MS);
    expect(r.puts).toHaveLength(1);
    await r.advance(AUTO_GAP_MS);
    expect(r.puts).toHaveLength(2);
    await r.advance(20_000);
    r.save("auto", "hide");
    await r.advance(0);
    expect(r.puts).toHaveLength(3);
    expect(r.puts[2]!.keepalive).toBe(true);
  });

  it("retries quietly when the network is down, and picks up the newest bytes when it's back", async () => {
    const r = rig(["retry", "retry"]);
    r.sync.open();
    r.save("1", "manual", { day: 1 });
    await r.advance(DEBOUNCE_MS);
    expect(r.statuses.at(-1)).toMatchObject({ kind: "retrying", inMs: 15_000 });
    r.save("1", "manual", { day: 2 });
    await r.advance(15_000);
    expect(r.statuses.at(-1)).toMatchObject({ kind: "retrying", inMs: 30_000 });
    await r.advance(30_000);
    expect(r.puts).toHaveLength(3);
    expect(JSON.parse(r.puts[2]!.text).day).toBe(2);
    expect(r.statuses.at(-1)).toMatchObject({ kind: "synced" });
    expect(r.sync.pending).toEqual([]);
  });

  it("stops when the session has ended, and drops a save the Worker refused", async () => {
    const refused = rig(["refused"]);
    refused.sync.open();
    refused.save("3", "manual");
    await refused.advance(DEBOUNCE_MS);
    expect(refused.statuses.at(-1)).toMatchObject({ kind: "refused", slot: "3" });
    expect(refused.sync.pending).toEqual([]);

    const out = rig(["signed-out"]);
    out.sync.open();
    out.save("3", "manual");
    await out.advance(DEBOUNCE_MS);
    out.save("1", "manual");
    await out.advance(60_000);
    expect(out.puts).toHaveLength(1);
    expect(out.statuses.at(-1)).toMatchObject({ kind: "signed-out" });
  });

  it("never sends a fresh garage's autosave over a further-along lab in the cloud; a slot save still goes up", async () => {
    const r = rig();
    r.cloud.set("auto", summary("auto", { day: 400 }));
    r.sync.open();
    r.save("auto", "month", { seed: 99, lab: "Garage Labs", day: 30 });
    r.save("1", "manual", { seed: 99, lab: "Garage Labs", day: 30 });
    await r.advance(AUTO_GAP_MS);
    expect(r.puts.map((p) => p.slot)).toEqual(["1"]);
    expect(r.statuses).toContainEqual({ kind: "kept", lab: "Paperclip Maximal" });
  });

  it("a save that lands during an upload goes up after it", async () => {
    let answer = () => undefined as void;
    const r = rig([], new Promise<void>((done) => (answer = done)));
    r.sync.open();
    r.save("1", "manual", { day: 1 });
    await r.advance(DEBOUNCE_MS);
    expect(r.puts).toHaveLength(1);
    r.save("1", "manual", { day: 2 });
    answer();
    await r.advance(11_000);
    expect(r.puts.map((p) => JSON.parse(p.text).day)).toEqual([1, 2]);
  });
});

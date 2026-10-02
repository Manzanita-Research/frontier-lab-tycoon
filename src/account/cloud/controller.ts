import { SLOTS, type SaveSummary, type Slot } from "../contract";
import type { CloudApi } from "./api";
import { backoff, CloudSync, type SyncStatus } from "./sync";
import { catchUp, cloudOffer, type LocalSave } from "./offer";

/**
 * What the cloud needs of the game (FLT-67): its saves and its "Welcome back". `src/account/game.ts` is the real one,
 * the only account file that imports the game; the tests pass a fake.
 */
export interface GamePort {
  /** Settles once the game's save shelf can be read. */
  ready: Promise<unknown>;
  /** Every save that landed on this computer (never a failed one). */
  onSaved(f: (slot: Slot, why: string) => void): () => void;
  /** A slot's save as it is stored here, or null. */
  read(slot: Slot): Promise<string | null>;
  local(): LocalSave[];
  /** The game's saves UI: whether it has read the shelf yet, and whether "Welcome back" is up. */
  shelf(): { booted: boolean; welcome: boolean };
  onShelf(f: () => void): () => void;
  /** Hold autosaves (the fresh garage behind a question about your lab). */
  hold(on: boolean): void;
  /** Put a save in play the way an imported file is. Resolves to a problem to show, or null. */
  load(text: string): Promise<string | null>;
  /** This link may greet you with your lab (not a staged scene, not `?load=`): FLT-65's `welcomesYou`. */
  greets(): boolean;
  now(): number;
  date(day: number): string;
  ago(savedAt: string, now: number): string;
  size(chars: number): string;
}

export interface CloudSlotVM {
  slot: Slot;
  lab: string;
  /** The game date ("Mar 5, Y2"). */
  date: string;
  /** When it was saved ("3 hours ago"). */
  ago: string;
  size: string;
}

export interface CloudVM {
  /** Logged on, so the cloud is in play. */
  on: boolean;
  /** The cloud's saves, autosave first. */
  slots: CloudSlotVM[];
  /** The small line about uploads ("Up to date", "Trying again shortly"). */
  status: { text: string; tone: "good" | "neutral" | "bad" } | null;
  /** "Continue from the cloud": the cloud's lab, newer than this computer's. */
  offer: CloudSlotVM | null;
  /** Where it shows: in the game's "Welcome back", or a window of its own when this computer has no saves. */
  offerIn: "welcome" | "alone" | null;
  busy: boolean;
}

export interface CloudActions {
  load(slot: Slot): void;
  /** "Not now" on the window of its own. */
  dismiss(): void;
}

export const OFF: CloudVM = { on: false, slots: [], status: null, offer: null, offerIn: null, busy: false };

export interface Timers {
  later(f: () => void, ms: number): () => void;
}
const realTimers: Timers = {
  later: (f, ms) => {
    const id = setTimeout(f, ms);
    return () => clearTimeout(id);
  },
};

const AWAY_KEY = "flt.account.away";

/** Logging on leaves the page; this remembers when (in this tab), so the autosave that leaving writes doesn't count. */
export function markAway(now = Date.now()) {
  try {
    sessionStorage.setItem(AWAY_KEY, String(now));
  } catch {
    /* no sessionStorage: the cloud offer is compared with every local save */
  }
}

function takeAway(): number | null {
  try {
    const v = sessionStorage.getItem(AWAY_KEY);
    sessionStorage.removeItem(AWAY_KEY);
    const n = v === null ? NaN : Number(v);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

const slotName = (slot: Slot) => (slot === "auto" ? "the autosave" : `slot ${slot}`);

function statusText(s: SyncStatus): CloudVM["status"] {
  switch (s.kind) {
    case "synced":
      return { text: `☁ Up to date: ${slotName(s.slot)} went up to the Frontier Network at ${new Date(s.at).toTimeString().slice(0, 5)}.`, tone: "good" };
    case "retrying":
      return { text: "☁ Couldn't reach the Frontier Network. Your saves are safe on this computer; trying again shortly.", tone: "neutral" };
    case "signed-out":
      return { text: "☁ You were logged off, so saves stay on this computer. Log on again to send them up.", tone: "neutral" };
    case "refused":
      return { text: `☁ The Frontier Network refused ${slotName(s.slot)}: ${s.message}`, tone: "bad" };
    case "kept":
      return { text: `☁ The cloud's autosave is "${s.lab}", further along, so it stays. Save this lab to a slot to send it up too.`, tone: "neutral" };
  }
}

/** The cloud for one logged-on visit: its saves, uploads, and the offer to continue from it. */
export function createCloud(port: GamePort, api: CloudApi, timers: Timers = realTimers) {
  let vm: CloudVM = { ...OFF, on: true, status: { text: "☁ Logged on: your saves go to the Frontier Network too.", tone: "neutral" } };
  const listeners = new Set<() => void>();
  const cloud = new Map<Slot, SaveSummary>();
  let offer: SaveSummary | null = null;
  let offerIn: CloudVM["offerIn"] = null;
  let sawWelcome = false;
  let loading = false;
  let stopped = false;
  const offs: (() => void)[] = [];

  const slotVM = (s: SaveSummary, now: number): CloudSlotVM => ({ slot: s.slot, lab: s.head.lab, date: port.date(s.head.day), ago: port.ago(s.head.savedAt, now), size: port.size(s.size) });
  const publish = (patch: Partial<CloudVM> = {}) => {
    if (stopped) return;
    const now = port.now();
    vm = {
      ...vm,
      slots: SLOTS.flatMap((slot) => {
        const s = cloud.get(slot);
        return s ? [slotVM(s, now)] : [];
      }),
      offer: offer ? slotVM(offer, now) : null,
      offerIn: offer ? offerIn : null,
      ...patch,
    };
    for (const l of listeners) l();
  };

  const sync = new CloudSync(
    {
      put: (slot, text, keepalive) => api.put(slot, text, keepalive),
      read: (slot) => port.read(slot),
      now: () => port.now(),
      later: (f, ms) => timers.later(f, ms),
      status: (s) => publish({ status: statusText(s) }),
    },
    cloud,
  );

  /** The offer is answered (or there was none): uploads may start. */
  function answered(withCatchUp: boolean) {
    if (offerIn === "alone") port.hold(false);
    offer = null;
    offerIn = null;
    if (withCatchUp) for (const slot of catchUp(port.local(), [...cloud.values()])) sync.saved(slot as Slot, "catch-up");
    sync.open();
    publish();
  }

  /** Follow the game's "Welcome back": show the offer in it, or alone when this computer has no saves. */
  function place() {
    if (!offer || loading || stopped) return publish();
    const shelf = port.shelf();
    if (!shelf.booted) return;
    if (shelf.welcome) {
      sawWelcome = true;
      offerIn = "welcome";
    } else if (sawWelcome || port.local().length > 0) {
      // The player answered "Welcome back" (Continue or New lab), or it never came up: their choice stands.
      return answered(true);
    } else if (offerIn !== "alone") {
      offerIn = "alone";
      port.hold(true);
    }
    publish();
  }

  async function connect(attempt = 0): Promise<void> {
    const list = await api.list();
    if (stopped) return;
    if (!list) {
      publish({ status: statusText({ kind: "retrying", inMs: backoff(attempt + 1) }) });
      offs.push(timers.later(() => void connect(attempt + 1), backoff(attempt + 1)));
      return;
    }
    for (const s of list) cloud.set(s.slot, s);
    const away = takeAway();
    offer = port.greets() ? cloudOffer(port.local(), list, away) : null;
    if (!offer) return answered(true);
    offs.push(port.onShelf(place));
    place();
  }

  const actions: CloudActions = {
    load: (slot) => {
      if (loading || stopped) return;
      loading = true;
      publish({ busy: true });
      void (async () => {
        const text = await api.get(slot);
        const problem = text === null ? "Couldn't download that lab from the Frontier Network. Try again?" : await port.load(text);
        loading = false;
        if (problem) return publish({ busy: false, status: { text: `☁ ${problem}`, tone: "bad" } });
        // The lab on screen is the cloud's now; what was waiting to go up was the one it replaced.
        sync.drop();
        answered(false);
        publish({ busy: false });
      })();
    },
    dismiss: () => {
      if (offerIn === "alone") answered(true);
    },
  };

  return {
    get: () => vm,
    subscribe(f: () => void) {
      listeners.add(f);
      return () => void listeners.delete(f);
    },
    actions,
    async start() {
      await port.ready;
      if (stopped) return;
      offs.push(port.onSaved((slot, why) => sync.saved(slot, why)));
      publish();
      await connect();
    },
    stop() {
      if (offerIn === "alone") port.hold(false);
      stopped = true;
      sync.stop();
      for (const off of offs) off();
      listeners.clear();
    },
    /** For tests: the sync's waiting slots. */
    get pending() {
      return sync.pending;
    },
  };
}

export type Cloud = ReturnType<typeof createCloud>;

import type { SaveHead, SaveSummary, Slot } from "../contract";
import type { PutResult } from "./api";
import { keepsCloudAuto } from "./offer";

/** A save waits this long before it goes up, so a burst of saves is one upload. */
export const DEBOUNCE_MS = 2_000;
/** The Worker refuses a slot written in the last 10 s (`MIN_WRITE_GAP_MS` in worker/saves.ts); a little over that. */
export const SLOT_GAP_MS = 11_000;
/** The autosave goes up at most once a minute (leaving the page goes up at once, within the Worker's 10 s). */
export const AUTO_GAP_MS = 60_000;
/** Quiet retries: 15 s, 30 s, 1, 2, 4 minutes, then every 5. */
export const backoff = (attempt: number) => Math.min(300_000, 15_000 * 2 ** Math.max(0, attempt - 1));

export type SyncStatus =
  | { kind: "synced"; slot: Slot; at: number }
  | { kind: "retrying"; inMs: number }
  | { kind: "signed-out" }
  | { kind: "refused"; slot: Slot; message: string }
  | { kind: "kept"; lab: string };

export interface SyncDeps {
  put(slot: Slot, text: string, keepalive: boolean): Promise<PutResult>;
  /** The slot's save as this computer has it now, or null. */
  read(slot: Slot): Promise<string | null>;
  now(): number;
  later(f: () => void, ms: number): () => void;
  status(s: SyncStatus): void;
}

interface Waiting {
  /** When it was saved: it goes up DEBOUNCE_MS later (at once when `urgent`). */
  at: number;
  urgent: boolean;
  /** Bumped by each save, so an upload that was overtaken by a newer save leaves that one waiting. */
  v: number;
}

const headOf = (text: string): SaveHead | null => {
  try {
    const { state: _state, ...head } = JSON.parse(text) as SaveHead & { state?: unknown };
    return typeof head.seed === "number" && typeof head.day === "number" && typeof head.lab === "string" ? head : null;
  } catch {
    return null;
  }
};

/**
 * Sends local saves up to the cloud (FLT-67), behind the local save and never in its way: a save is written to this
 * computer first, as it always was, then this hears about it and uploads the slot's bytes a moment later. Failures are
 * retried quietly. Nothing goes up until `open()`: while "Continue from the cloud" waits for an answer, the fresh
 * garage behind it must not reach the cloud.
 */
export class CloudSync {
  private waiting = new Map<Slot, Waiting>();
  private sentAt = new Map<Slot, number>();
  private retryAt = 0;
  private attempt = 0;
  private cancel: (() => void) | null = null;
  private busy = false;
  private gate = false;
  private stopped = false;
  private v = 0;

  /** `cloud`: what the cloud holds now, kept up to date by each upload (for the autosave rule, `keepsCloudAuto`). */
  constructor(
    private readonly deps: SyncDeps,
    private readonly cloud: Map<Slot, SaveSummary> = new Map(),
  ) {}

  /** A save landed on this computer. */
  saved(slot: Slot, why: string) {
    if (this.stopped) return;
    const prev = this.waiting.get(slot);
    this.waiting.set(slot, { at: this.deps.now(), urgent: why === "hide" || !!prev?.urgent, v: ++this.v });
    this.schedule();
  }

  open() {
    this.gate = true;
    this.schedule();
  }

  /** Forget what's waiting (the lab on screen was just replaced from the cloud). */
  drop() {
    this.waiting.clear();
    this.cancel?.();
    this.cancel = null;
  }

  stop() {
    this.stopped = true;
    this.drop();
  }

  get pending(): Slot[] {
    return [...this.waiting.keys()];
  }

  private due(slot: Slot, w: Waiting) {
    const gap = slot === "auto" && !w.urgent ? AUTO_GAP_MS : SLOT_GAP_MS;
    return Math.max(w.at + (w.urgent ? 0 : DEBOUNCE_MS), (this.sentAt.get(slot) ?? -Infinity) + gap, this.retryAt);
  }

  private next(): [Slot, Waiting, number] | null {
    let best: [Slot, Waiting, number] | null = null;
    for (const [slot, w] of this.waiting) {
      const due = this.due(slot, w);
      if (!best || due < best[2]) best = [slot, w, due];
    }
    return best;
  }

  private schedule() {
    if (!this.gate || this.stopped || this.busy) return;
    this.cancel?.();
    this.cancel = null;
    const next = this.next();
    if (next) this.cancel = this.deps.later(() => void this.flush(), Math.max(0, next[2] - this.deps.now()));
  }

  private async flush() {
    this.cancel = null;
    const next = this.next();
    if (!next || this.busy || this.stopped) return;
    const [slot, w] = next;
    this.busy = true;
    try {
      const text = await this.deps.read(slot);
      const head = text === null ? null : headOf(text);
      if (text === null || head === null) return this.done(slot, w);
      const kept = slot === "auto" ? (this.cloud.get("auto")?.head ?? null) : null;
      if (keepsCloudAuto(kept, head)) {
        this.deps.status({ kind: "kept", lab: kept!.lab });
        return this.done(slot, w);
      }
      const result = await this.deps.put(slot, text, w.urgent);
      if (this.stopped) return;
      switch (result.kind) {
        case "ok":
          this.sentAt.set(slot, this.deps.now());
          this.cloud.set(slot, result.summary);
          this.attempt = 0;
          this.retryAt = 0;
          this.deps.status({ kind: "synced", slot, at: this.deps.now() });
          return this.done(slot, w);
        case "retry": {
          const wait = backoff(++this.attempt);
          this.retryAt = this.deps.now() + wait;
          this.deps.status({ kind: "retrying", inMs: wait });
          return;
        }
        case "signed-out":
          this.deps.status({ kind: "signed-out" });
          return this.stop();
        case "refused":
          this.deps.status({ kind: "refused", slot, message: result.message });
          return this.done(slot, w);
      }
    } finally {
      this.busy = false;
      this.schedule();
    }
  }

  /** The upload of this save is settled; a save that came in meanwhile is still waiting. */
  private done(slot: Slot, w: Waiting) {
    if (this.waiting.get(slot)?.v === w.v) this.waiting.delete(slot);
  }
}

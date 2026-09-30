// The ending's share card (FLT-11): take a photo of the campus when the last front page comes out, print the card as
// soon as it arrives (so a tap on Share opens the phone's share sheet at once: browsers only allow it straight after
// the tap), and share it, download it, or copy the run summary. UI state only, in an Effect atom like the rest.
import { useAtomValue } from "@effect/atom-react";
import { Atom } from "effect/unstable/reactivity";
import { useEffect, useMemo } from "react";
import { registry, send } from "../../app/game";
import { todayKey } from "../../debug";
import { campusShots } from "../../render/PressCamera";
import { catalog } from "../../skins/registry";
import { BASE_TOKENS } from "../../skins/schema";
import { skinUiAtom } from "../hud/state";
import type { EndingVM, HudVM, ShareVM } from "../hud/types";
import { CARD_H, CARD_W, cardTheme, drawCard } from "./card";

export interface ShareState extends ShareVM {
  /** Which ending, lab and skin the photo and the card are of. */
  key: string | null;
  /** The campus, as it looked when the paper went to press. */
  photo: string | null;
  blob: Blob | null;
}

const IDLE: ShareState = { key: null, photo: null, card: null, blob: null, status: "idle", native: false, note: null };

// keepAlive: the host reads it on every render, but the card is printed between renders.
export const shareAtom = Atom.keepAlive(Atom.make<ShareState>(IDLE));

const patch = (p: Partial<ShareState>) => registry.set(shareAtom, { ...registry.get(shareAtom), ...p });

/** A phone (or anything touch-first) that can hand a file to the share sheet. */
function canShareFiles(): boolean {
  if (typeof navigator === "undefined" || typeof navigator.canShare !== "function") return false;
  if (!window.matchMedia?.("(pointer: coarse)").matches) return false;
  try {
    return navigator.canShare({ files: [new File([new Blob()], "x.png", { type: "image/png" })] });
  } catch {
    return false;
  }
}

const fileName = (e: EndingVM) => `frontier-times-${e.lab.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${e.id}.png`;

function tokensOf(skin: string): Record<string, string> {
  const m = catalog.find((c) => c.folder === skin)?.manifest;
  return { ...BASE_TOKENS, ...(m?.tokens ?? {}) };
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Print the card: the skin's fonts first (the canvas only uses what the page has loaded), then the paint. */
async function printCard(e: EndingVM, skin: string, photo: string | null): Promise<Blob | null> {
  const th = cardTheme(skin, tokensOf(skin));
  await Promise.all([th.display, th.ui, th.numbers].map((f) => document.fonts?.load(`800 20px ${f}`).catch(() => undefined)));
  const img = photo ? await loadImage(photo) : null;
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  drawCard(ctx, th, e, img);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}

let printing = 0;
/** The front page on screen, for the Share and Copy buttons (actions get no view-model). */
let showing: EndingVM | null = null;

/** When an ending's front page is up: photograph the campus once, then (re)print the card for the skin on screen. */
export function useShareCard(vm: HudVM) {
  const skin = useAtomValue(skinUiAtom).active;
  const e = vm.ending ?? null;
  const shot = e ? `${e.lab}|${e.id}|${e.paper.issue}` : null;
  showing = e;
  useEffect(() => {
    if (!e || !shot) return;
    const st = registry.get(shareAtom);
    if (st.key === `${shot}|${skin}`) return;
    const job = ++printing;
    const sameShot = st.key?.startsWith(`${shot}|`) ?? false;
    if (!sameShot && st.card) URL.revokeObjectURL(st.card);
    patch({ ...(sameShot ? {} : { photo: null, card: null, blob: null }), key: `${shot}|${skin}`, status: "making", note: null, native: canShareFiles() });
    const photo: Promise<string | null> = sameShot
      ? Promise.resolve(st.photo)
      : new Promise((resolve) => {
          let done = false;
          const take = (p: string | null) => {
            if (done) return;
            done = true;
            resolve(p);
          };
          campusShots.pending.push({ width: 960, height: 540, take });
          // No frame coming (a hidden tab, a lost context): print without it.
          setTimeout(() => take(null), 2500);
        });
    void photo.then(async (p) => {
      if (job !== printing) return;
      patch({ photo: p });
      const blob = await printCard(e, skin, p).catch(() => null);
      if (job !== printing) return;
      const old = registry.get(shareAtom).card;
      if (old) URL.revokeObjectURL(old);
      patch(blob ? { blob, card: URL.createObjectURL(blob), status: "ready" } : { status: "error", note: "The printer jammed. Try again?" });
    });
    // `e` changes with every snapshot; the card only needs reprinting for a new shot or a new skin.
  }, [shot, skin]);
  useEffect(() => {
    if (!e) {
      printing++;
      const st = registry.get(shareAtom);
      if (st.card) URL.revokeObjectURL(st.card);
      if (st.key) registry.set(shareAtom, IDLE);
    }
  }, [e === null]);
}

/** The Takeover renames the game: the tab's title says who's managing it now. */
export function useTakeoverTitle(vm: HudVM) {
  const title = vm.takeover?.title ?? null;
  useEffect(() => {
    if (!title) return;
    const before = document.title;
    document.title = title;
    return () => {
      document.title = before;
    };
  }, [title]);
}

/** Share on a phone, download elsewhere (or if the share sheet says no). */
export async function shareEnding(e: EndingVM | null = showing) {
  const st = registry.get(shareAtom);
  if (!e || !st.blob || !st.card) return;
  const file = new File([st.blob], fileName(e), { type: "image/png" });
  if (st.native) {
    try {
      await navigator.share({ files: [file], title: `The Frontier Times: ${e.paper.headline}`, text: e.summary });
      patch({ status: "shared", note: "Sent. They'll never look at a lab the same way." });
      return;
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
    }
  }
  const a = document.createElement("a");
  a.href = st.card;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  patch({ status: "saved", note: `Saved ${file.name}. Paste it in the group chat.` });
}

export async function copySummary(e: EndingVM | null = showing) {
  if (!e) return;
  try {
    await navigator.clipboard.writeText(e.summary);
    patch({ status: "copied", note: "Run summary copied." });
  } catch {
    patch({ note: "The clipboard said no. Here it is to copy by hand:\n" + e.summary });
  }
}

export const playDaily = () => send({ type: "DAILY_LAB", daily: todayKey() });

/** What the view-model gets. */
export function useShareInput() {
  const st = useAtomValue(shareAtom);
  return useMemo(() => ({ photo: st.photo, status: st.status, card: st.card, native: st.native, note: st.note }), [st]);
}

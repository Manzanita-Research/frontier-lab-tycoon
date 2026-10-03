// A mod's voice in the browser (FLT-102): which voice speaks, its big-moment lines as toasts, and "full duck", which
// rewrites every word on screen (menus and buttons too) by walking the DOM's text. The view-model part is `voice.ts`.
import { useEffect, useMemo, useRef } from "react";
import type { Snapshot } from "../../app/hud";
import { toast } from "../../app/game";
import type { ResolvedVoice } from "../../mods/services/voice";
import { makeVoice, momentLine, type Say } from "../../mods/voice";
import type { HudVM } from "./types";
import type { VoiceOptions } from "./voice";
import { momentsBetween, signalsOf, type MomentSignals } from "./voiceMoments";

export type VoiceMode = "off" | "flavour" | "full";

export interface VoiceSetup extends VoiceOptions {
  readonly rules: ResolvedVoice;
  /** Said as they are: the loaded mods' names. */
  readonly keep: readonly string[];
  /** Menus and buttons too: the DOM pass. */
  readonly full: boolean;
}

/** `mode` (`?voice=`, or the Mods window's choice) overrides the mod's own default: flavour text only, unless it sets `full`. */
export function voiceSetup(rules: ResolvedVoice | null | undefined, mode: VoiceMode | null, keep: readonly string[] = []): VoiceSetup | null {
  if (!rules || mode === "off") return null;
  return { rules, keep, say: makeVoice(rules, keep), glyph: rules.glyph ?? null, full: mode === "full" || (mode === null && rules.full === true) };
}

/** Says a voice's own line when a big moment starts, as a toast. Nothing at all without a voice. */
export function useVoiceMoments(voice: VoiceSetup | null, vm: HudVM, snap: Snapshot) {
  const was = useRef<MomentSignals | null>(null);
  const now = signalsOf(vm, snap);
  useEffect(() => {
    const before = was.current;
    was.current = now;
    if (!voice || !before) return;
    try {
      for (const moment of momentsBetween(before, now)) {
        const line = momentLine(voice.rules, moment, moment === "level" ? now.level : `${snap.day}:${now.model ?? ""}:${now.ending ?? ""}`);
        if (line) toast(line, "joke");
      }
    } catch (e) {
      // A voice is flavour: if it trips, the game goes on without the line.
      console.warn("[voice] a moment line failed", e);
    }
  });
}

/** Tags whose text is not prose, or is the player's own. */
const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "CODE", "PRE", "KBD", "CANVAS", "SVG", "NOSCRIPT"]);

/** Rewrites every text node under `root`, now and as React changes it. Returns the way back (originals restored). */
export function startFullVoice(root: HTMLElement, say: Say): () => void {
  const original = new WeakMap<Text, string>();
  const ours = new WeakMap<Text, string>();
  const touched = new Set<Text>();
  const skip = (node: Node) => {
    for (let el = node.parentElement; el; el = el.parentElement) {
      if (SKIP.has(el.tagName.toUpperCase()) || el.isContentEditable || el.dataset.voice === "off") return true;
      if (el === root) break;
    }
    return false;
  };
  const voice = (node: Text) => {
    if (ours.get(node) === node.data || skip(node)) return;
    const next = say(node.data);
    original.set(node, node.data);
    ours.set(node, next);
    touched.add(node);
    if (next !== node.data) node.data = next;
  };
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) return voice(node as Text);
    const it = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    for (let t = it.nextNode(); t; t = it.nextNode()) voice(t as Text);
  };
  walk(root);
  const observer = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === "characterData") voice(r.target as Text);
      else r.addedNodes.forEach(walk);
    }
  });
  observer.observe(root, { subtree: true, childList: true, characterData: true });
  return () => {
    observer.disconnect();
    for (const node of touched) if (node.isConnected && ours.get(node) === node.data) node.data = original.get(node) ?? node.data;
  };
}

/** Full duck: menus, buttons and labels too, in a quieter voice (no emoji or openers on every button). */
export function useFullVoice(voice: VoiceSetup | null) {
  const quiet = useMemo(() => (voice?.full ? makeVoice({ ...voice.rules, emoji: undefined, openers: undefined, ellipsis: 0 }, voice.keep) : null), [voice]);
  useEffect(() => {
    if (!quiet) return;
    try {
      return startFullVoice(document.body, quiet);
    } catch (e) {
      console.warn("[voice] full voice failed to start", e);
      return;
    }
  }, [quiet]);
}

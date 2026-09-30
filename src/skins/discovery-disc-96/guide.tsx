// Chip the guide bot lives in the bottom-left corner and reads out toasts and hints in a speech balloon ("GREAT JOB!").
// When it's quiet Chip offers a fact now and then; tap the bot for another. Also: the thought bubbles and the toast card.
import { useEffect, useState } from "react";
import { useT } from "../context";
import type { SlotPropsMap } from "../types";
import type { ToastVM } from "../../ui/hud/types";
import { Robot, type RobotMood } from "./art";
import tipsFile from "./tips.json";

/** A word balloon: who is thinking it (small, blue), then what they think. The root keeps the `bubble` class for photo mode. */
export function Bubble({ bubble }: SlotPropsMap["Bubble"]) {
  return (
    <div className={`bubble dd-bubble bubble-${bubble.kind}`}>
      <small>{bubble.speaker || bubble.kind}</small>
      {bubble.text}
    </div>
  );
}

const HEAD: Record<ToastVM["tone"], string> = { good: "GREAT JOB!", bad: "OOPS!", joke: "HA HA!", neutral: "NEWS FLASH!", hint: "PSST!" };
const MOOD: Record<ToastVM["tone"], RobotMood> = { good: "cheer", bad: "oops", joke: "happy", neutral: "happy", hint: "think" };

export function Toast({ toast, actions }: SlotPropsMap["Toast"]) {
  const body = (
    <>
      <b>{HEAD[toast.tone]}</b>
      {toast.text}
    </>
  );
  if (toast.tone === "hint") return <div className="dd-toast hint">{body}</div>;
  return (
    <button type="button" className={`dd-toast ${toast.tone}`} onClick={() => actions.dismissToast(toast.id)}>
      {body}
    </button>
  );
}

export function Assistant({ vm, actions }: SlotPropsMap["Assistant"]) {
  const t = useT();
  const [tip, setTip] = useState<number | null>(null);
  const phone = vm.layout.compact;
  const toast = vm.toasts.at(-1);
  const hint = toast ? undefined : vm.hints[0];
  const busy = toast !== undefined || hint !== undefined;
  const facts = tipsFile.tips;

  // When it's quiet the bot offers a fact every so often (never on a phone, where the campus needs the room).
  useEffect(() => {
    if (phone || busy) return;
    const id = window.setInterval(() => setTip((i) => (i === null ? Math.floor(vm.stats.date.length + vm.training.run) % facts.length : i)), 45_000);
    return () => window.clearInterval(id);
  }, [phone, busy, facts.length, vm.stats.date.length, vm.training.run]);
  useEffect(() => {
    if (tip === null) return;
    const id = window.setTimeout(() => setTip(null), 14_000);
    return () => window.clearTimeout(id);
  }, [tip]);

  let head: string | null = null;
  let mood: RobotMood = "happy";
  let body: string | null = null;
  if (toast) {
    head = HEAD[toast.tone];
    mood = MOOD[toast.tone];
    body = toast.text;
  } else if (hint) {
    head = HEAD.hint;
    mood = MOOD.hint;
    body = t(`hint.${hint}`);
  } else if (tip !== null) {
    head = tipsFile.lead;
    body = facts[tip]!;
  }

  return (
    <div className={`dd-assistant ${body ? "talking" : ""} ${toast ? `tone-${toast.tone}` : ""}`} aria-live="polite">
      <button type="button" className="dd-guide" aria-label={t("assistant.title")} title={t("assistant.title")} onClick={() => setTip((i) => (i === null ? vm.training.run % facts.length : (i + 1) % facts.length))}>
        <Robot mood={mood} />
      </button>
      {body && (
        <div className="dd-say" role="status">
          {toast ? (
            <button type="button" className="dd-say-body" onClick={() => actions.dismissToast(toast.id)} title="Got it!">
              <b>{head}</b>
              {body}
            </button>
          ) : (
            <div className="dd-say-body">
              <b>{head}</b>
              {body}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// The star that pops up when something happens ("★ NEW RELEASE! ★"), and the thought bubbles over the crowd: white speech
// boxes with stepped pixel corners and a little header saying who is thinking it.
import type { ReactNode } from "react";
import { factionAttrs, SnagCopy, useT } from "../kit";
import type { SlotPropsMap } from "../types";
import type { ToastVM } from "../../ui/hud/types";
import { Note, Star } from "./art";

/** What a toast is called: a release gets the stars, everything else a karaoke word for its mood. */
function heading(toast: ToastVM): ReactNode {
  switch (toast.tone) {
    case "good":
      return /\b(is out|shipped|releas\w*|launch\w*)\b/i.test(toast.text) ? (
        <>
          <Star /> NEW RELEASE! <Star />
        </>
      ) : (
        <>
          <Star /> ENCORE! <Star />
        </>
      );
    case "bad":
      return (
        <>
          <Note /> OFF-KEY <Note />
        </>
      );
    case "joke":
      return (
        <>
          <Note /> BONUS TRACK <Note />
        </>
      );
    case "hint":
      return (
        <>
          <Note /> TIP <Note />
        </>
      );
    case "warn":
      return (
        <>
          <Note /> HEADS UP <Note />
        </>
      );
    default:
      return (
        <>
          <Note /> NOW PLAYING <Note />
        </>
      );
  }
}

/** One toast. A click dismisses it early (the game also expires each one after about five seconds). */
export function Toast({ toast, actions }: SlotPropsMap["Toast"]) {
  const t = useT();
  if (toast.snag) {
    // FLT-84: the game caught an error and kept going.
    return (
      <div className="kn-toast bad snag" role="alert">
        <b className="kn-toast-h">{t("snag.title")}</b>
        <span className="kn-toast-t">{t("snag.text")}</span>
        <span className="snag-row">
          <SnagCopy id={toast.id} actions={actions} />
          <button type="button" onClick={() => actions.dismissToast(toast.id)}>
            {t("snag.ok")}
          </button>
        </span>
      </div>
    );
  }
  const body = (
    <>
      <b className="kn-toast-h">{heading(toast)}</b>
      <span className="kn-toast-t">{toast.text}</span>
    </>
  );
  // A tip is a standing hint and a warning a standing problem: neither can be clicked away, they go when it comes true / is fixed.
  if (toast.tone === "hint") return <div className="kn-toast hint">{body}</div>;
  if (toast.tone === "warn") return <div className="kn-toast bad" role="status">{body}</div>;
  return (
    <button type="button" className={`kn-toast ${toast.tone}`} onClick={() => actions.dismissToast(toast.id)}>
      {body}
    </button>
  );
}

/** A thought bubble. The root keeps the `bubble` class (the game measures it, and photo mode copies it onto the picture). */
export function Bubble({ bubble }: SlotPropsMap["Bubble"]) {
  const who = bubble.speaker ? `${bubble.kind} · ${bubble.speaker}` : bubble.kind;
  return (
    <div className={`bubble kn-bubble bubble-${bubble.kind}`} {...factionAttrs(bubble.faction)}>
      <div className="kn-bub-body">
        <span className="kn-bub-who">
          {who}
        </span>
        {bubble.text}
      </div>
      <i className="kn-tail" aria-hidden />
    </div>
  );
}

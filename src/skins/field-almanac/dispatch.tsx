import { Marquee, useT } from "../kit";
import type { SlotPropsMap } from "../types";
import { QuillIcon, SealLeaf } from "./icons";
import { sealInitial } from "./lore";

/**
 * Dispatches: the news tape as a running line of serif, each headline with a coloured dot for its tone and a fleuron
 * after it (both drawn in CSS on the `.tick` the Marquee makes). The `ticker` class is the game's ("over the ticker" is
 * not the edge of the map for the camera), so it stays.
 */
export function Ticker({ items }: SlotPropsMap["Ticker"]) {
  const t = useT();
  return (
    <div className="ticker fa-ticker" aria-label={t("ticker.aria")}>
      <div className="ticker-tag">{t("ticker.label")}</div>
      <div className="ticker-view">
        <Marquee items={items} className="ticker-track" />
      </div>
    </div>
  );
}

/**
 * A toast as a paper pill sealed with wax: red for news, green for good news, ochre for a joke, and the message's
 * first letter pressed into it (a leaf when it doesn't start with one). A standing hint has no seal, a quill instead,
 * and does not go away when clicked.
 */
export function Toast({ toast, actions }: SlotPropsMap["Toast"]) {
  if (toast.tone === "hint") {
    return (
      <div className="fa-toast fa-paper hint">
        <QuillIcon />
        <span className="fa-toast-text">{toast.text}</span>
      </div>
    );
  }
  const initial = sealInitial(toast.text);
  return (
    <button className={`fa-toast fa-paper ${toast.tone}`} onClick={() => actions.dismissToast(toast.id)}>
      <span className="fa-seal" aria-hidden>
        {initial ?? <SealLeaf />}
      </span>
      <span className="fa-toast-text">{toast.text}</span>
    </button>
  );
}

import { useT } from "../../context";
import type { SlotPropsMap } from "../../types";

export function NewsArrival({ arrival, actions }: SlotPropsMap["NewsArrival"]) {
  const t = useT();
  return (
    <aside className="news-arrival panel">
      <span>{arrival.text}</span>
      <button onClick={() => actions.viewNews(arrival.id)}>{t("news.read")}</button>
      <button onClick={() => actions.skipNews()}>{t("news.skip")}</button>
    </aside>
  );
}

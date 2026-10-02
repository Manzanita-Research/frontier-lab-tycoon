import { Dialog } from "../../kit";
import { useT } from "../../context";
import type { SlotPropsMap } from "../../types";

const CRT_CHOICES = ["off", "subtle", "full"] as const;

/** Pick a skin: each card previews it live, Apply keeps it, Cancel goes back to the one you came from. */
export function SkinPicker({ skins, actions, speed }: SlotPropsMap["SkinPicker"]) {
  const t = useT();
  return (
    <Dialog label={t("skin.title")} close={actions.cancelSkinPicker} layerClass="news-backdrop" dialogClass="news-dialog">
      <div className="skin-picker">
        <div className="news-toolbar">
          <b>{t("skin.title")}</b>
          <button onClick={() => actions.cancelSkinPicker()} aria-label={t("skin.cancel")}>
            ×
          </button>
        </div>
        <ul className="skin-list">
          {skins.list.map((s) => (
            <li key={s.id}>
              <button className={`skin-card ${skins.active === s.id ? "on" : ""}`} onClick={() => actions.previewSkin(s.id)} aria-pressed={skins.active === s.id}>
                {s.preview ? <img src={s.preview} alt="" /> : <span className="skin-noimg" />}
                <b>{s.name}</b>
                <small>{s.description}</small>
              </button>
            </li>
          ))}
        </ul>
        {skins.rejected.length > 0 && (
          <div className="skin-rejected">
            {skins.rejected.map((r) => (
              <p key={r.id}>
                <b>{r.id}</b> was refused: {r.errors[0]}
              </p>
            ))}
          </div>
        )}
        <label className="skin-motion">
          <input type="checkbox" checked={skins.reducedMotion} onChange={(e) => actions.setReducedMotion(e.target.checked)} /> {t("skin.reduceMotion")}
        </label>
        {skins.crt && (
          <fieldset className="skin-crt">
            <legend>{t("skin.crt")}</legend>
            {CRT_CHOICES.map((m) => (
              <label key={m}>
                <input type="radio" name="skin-crt" checked={skins.crt!.mode === m} onChange={() => actions.setCrt(m)} /> {t(`skin.crt.${m}`)}
              </label>
            ))}
            {skins.crt.reduced && <small>{t("skin.crt.reduced")}</small>}
          </fieldset>
        )}
        {speed && (
          <label className="skin-motion">
            <input type="checkbox" checked={speed.slowForBadNews} onChange={(e) => actions.setSlowForBadNews(e.target.checked)} /> {t("speed.slowForBadNews")}
          </label>
        )}
        <div className="skin-buttons">
          <button className="choice plain primary" onClick={() => actions.applySkin()}>
            <b>{t("skin.apply")}</b>
          </button>
          <button className="choice plain" onClick={() => actions.cancelSkinPicker()}>
            <b>{t("skin.cancel")}</b>
          </button>
        </div>
      </div>
    </Dialog>
  );
}

import { useEffect, useState } from "react";
import { useT } from "../../context";
import type { SlotPropsMap } from "../../types";

/** Photo mode's controls: time of day, the shutter, and the way out. The HUD is hidden by `body.photo`. */
function PhotoBar({ photo, actions }: SlotPropsMap["PhotoOverlay"]) {
  const t = useT();
  return (
    <>
      {photo.flash > 0 && <div key={photo.flash} className="shutter-flash" />}
      <div className="photo-bar panel" role="toolbar" aria-label={t("photo.title")}>
        <div className="photo-times" role="group" aria-label={t("photo.time")}>
          {photo.times.map((x) => (
            <button key={x.key} className={photo.time === x.key ? "on" : ""} onClick={() => actions.setPhotoTime(x.key)}>
              {x.label}
            </button>
          ))}
        </div>
        <button className="shutter" onClick={() => actions.takePhoto()} aria-label={t("photo.shoot")} title={t("photo.shoot")}>
          <span />
        </button>
        <button className="photo-done" onClick={() => actions.setPhoto(false)}>
          {t("photo.done")}
        </button>
      </div>
    </>
  );
}

/** The photo drops into the corner like a polaroid, with the stamp on it. Click to put it away. */
function Polaroid({ photo }: Pick<SlotPropsMap["PhotoOverlay"], "photo">) {
  const shot = photo.shot;
  const [shown, setShown] = useState<number>(0);
  useEffect(() => {
    if (!shot) return;
    setShown(shot.id);
    const timer = setTimeout(() => setShown((cur) => (cur === shot.id ? 0 : cur)), 7000);
    return () => clearTimeout(timer);
  }, [shot?.id]);
  if (!shot || shown !== shot.id) return null;
  return (
    <button key={shot.id} className="polaroid" onClick={() => setShown(0)} aria-label="Photo saved">
      <img src={shot.url} alt="Your photo" />
      <span className="polaroid-cap">Saved: {shot.label}</span>
    </button>
  );
}

export function PhotoOverlay(props: SlotPropsMap["PhotoOverlay"]) {
  return (
    <div className="photo-ui">
      {props.photo.on && <PhotoBar {...props} />}
      <Polaroid photo={props.photo} />
    </div>
  );
}

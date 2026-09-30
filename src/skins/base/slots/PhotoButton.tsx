import { useT } from "../../context";
import type { SlotPropsMap } from "../../types";

function CameraIcon() {
  return (
    <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden>
      <path d="M4 10h5l2-3h10l2 3h5v16H4z" fill="#ffe8b8" stroke="#3a2a1c" strokeWidth="2.4" strokeLinejoin="round" />
      <circle cx="16" cy="17.5" r="5.2" fill="#8bd3f0" stroke="#3a2a1c" strokeWidth="2.4" />
      <circle cx="14.4" cy="15.9" r="1.3" fill="#fff" />
    </svg>
  );
}

/** The camera button in the corner of the game. (P toggles photo mode from the keyboard; the game handles that.) */
export function PhotoButton({ photo, actions }: SlotPropsMap["PhotoButton"]) {
  const t = useT();
  if (photo.on) return null;
  return (
    <button className="photo-btn panel" onClick={() => actions.setPhoto(true)} aria-label={t("photo.open")} title={t("photo.open")}>
      <CameraIcon />
    </button>
  );
}

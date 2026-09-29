import { useAtomValue } from "@effect/atom-react";
import { useEffect, useState } from "react";
import { appNow, atoms, debugParams } from "../../app/game";
import { useApp } from "../../app/hooks";
import { photoAtom } from "../../render/fx/photoState";
import { fx } from "../../render/fx/state";
import { setPhoto, shotAtom, takePhoto, togglePhoto } from "./photo";

const TIMES = [
  { key: "live", label: "Live", hour: null },
  { key: "day", label: "Day", hour: 13 },
  { key: "golden", label: "Golden", hour: 18.3 },
  { key: "night", label: "Night", hour: 22.5 },
] as const;

function CameraIcon() {
  return (
    <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden>
      <path d="M4 10h5l2-3h10l2 3h5v16H4z" fill="#ffe8b8" stroke="#3a2a1c" strokeWidth="2.4" strokeLinejoin="round" />
      <circle cx="16" cy="17.5" r="5.2" fill="#8bd3f0" stroke="#3a2a1c" strokeWidth="2.4" />
      <circle cx="14.4" cy="15.9" r="1.3" fill="#fff" />
    </svg>
  );
}

/** The camera button in the corner of the game, and the keyboard shortcuts (P toggles, Enter takes the shot, Esc leaves). */
export function PhotoButton() {
  const on = useAtomValue(photoAtom);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "p" || e.key === "P") {
        const st = appNow();
        if (!st?.event && (st?.outcome === "playing" || st?.outcomeDismissed)) togglePhoto();
      } else if (!fx.photo) return;
      else if (e.key === "Escape") setPhoto(false);
      else if (e.key === "Enter") void takePhoto();
      // Photo mode owns the keyboard: no tool hotkeys while the HUD is away.
      else if (/^[1-6]$/.test(e.key)) e.stopImmediatePropagation();
    };
    // Capture phase, so the HUD's own key handler never sees the keys photo mode has claimed.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
  useEffect(() => {
    if (debugParams.photo) setPhoto(true);
  }, []);
  if (on) return null;
  return (
    <button className="photo-btn panel" onClick={() => togglePhoto()} aria-label="Photo mode (P)" title="Photo mode (P)">
      <CameraIcon />
    </button>
  );
}

/** Photo mode's controls: time of day, the shutter, and the way out. The HUD is hidden by `body.photo`. */
function PhotoBar() {
  const [time, setTime] = useState<string>(debugParams.hour !== null ? "" : "live");
  const event = useApp(atoms.event);
  const outcome = useApp(atoms.snap).outcome;
  const dismissed = useApp(atoms.outcomeDismissed);
  const [flash, setFlash] = useState(0);
  // A card turning up means the game needs the player: leave photo mode rather than hide it.
  useEffect(() => {
    if (event || (outcome !== "playing" && !dismissed)) setPhoto(false);
  }, [event, outcome, dismissed]);

  const pick = (t: (typeof TIMES)[number]) => {
    setTime(t.key);
    fx.hourOverride = t.hour;
  };
  const shoot = () => {
    setFlash((n) => n + 1);
    void takePhoto();
  };
  return (
    <>
      {flash > 0 && <div key={flash} className="shutter-flash" />}
      <div className="photo-bar panel" role="toolbar" aria-label="Photo mode">
        <div className="photo-times" role="group" aria-label="Time of day">
          {TIMES.map((t) => (
            <button key={t.key} className={time === t.key ? "on" : ""} onClick={() => pick(t)}>
              {t.label}
            </button>
          ))}
        </div>
        <button className="shutter" onClick={shoot} aria-label="Take photo (Enter)" title="Take photo (Enter)">
          <span />
        </button>
        <button className="photo-done" onClick={() => setPhoto(false)}>
          Done
        </button>
      </div>
    </>
  );
}

/** The photo drops into the corner like a polaroid, with the stamp on it. Click to put it away. */
function Polaroid() {
  const shot = useAtomValue(shotAtom);
  const [shown, setShown] = useState<number>(0);
  useEffect(() => {
    if (!shot) return;
    setShown(shot.id);
    const t = setTimeout(() => setShown((cur) => (cur === shot.id ? 0 : cur)), 7000);
    return () => clearTimeout(t);
  }, [shot]);
  if (!shot || shown !== shot.id) return null;
  return (
    <button key={shot.id} className="polaroid" onClick={() => setShown(0)} aria-label="Photo saved">
      <img src={shot.url} alt="Your photo" />
      <span className="polaroid-cap">Saved: {shot.name.replace(/^frontier-lab-tycoon-/, "")}</span>
    </button>
  );
}

export function PhotoUI() {
  const on = useAtomValue(photoAtom);
  return (
    <div className="photo-ui">
      {on && <PhotoBar />}
      <Polaroid />
    </div>
  );
}


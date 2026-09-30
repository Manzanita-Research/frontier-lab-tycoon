import { useT } from "../../context";
import { ALL_VISIBLE } from "../../kit";
import type { SlotPropsMap } from "../../types";

const svg = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.4, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

const Paper = () => (
  <svg {...svg}>
    <path d="M5 4h11v16H7a2 2 0 0 1-2-2z" />
    <path d="M16 8h3v10a2 2 0 0 1-2 2" />
    <path d="M8 8h5M8 12h5M8 16h3" />
  </svg>
);
const Speaker = ({ muted }: { muted: boolean }) => (
  <svg {...svg}>
    <path d="M4 10v4h4l5 4V6l-5 4z" fill="currentColor" />
    {muted ? <path d="m16 9 5 6m0-6-5 6" /> : <path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11" />}
  </svg>
);
const Sliders = () => (
  <svg {...svg}>
    <path d="M6 4v16M12 4v16M18 4v16" />
    <circle cx="6" cy="14" r="2.2" fill="var(--flt-color-panel)" />
    <circle cx="12" cy="8" r="2.2" fill="var(--flt-color-panel)" />
    <circle cx="18" cy="15" r="2.2" fill="var(--flt-color-panel)" />
  </svg>
);
const Floppy = () => (
  <svg {...svg}>
    <path d="M5 4h11l3 3v13H5z" />
    <path d="M8 4v5h7V4M8 20v-6h8v6" />
  </svg>
);
const Sparkle = () => (
  <svg {...svg}>
    <path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z" />
    <path d="M18.5 16v4M16.5 18h4" />
  </svg>
);

/** The News Room button (with its unread badge), the mute switch, the mixer, and the way to the skin picker. */
export function NewsControls({ newsroom, sound, skins, visible = ALL_VISIBLE, actions }: SlotPropsMap["NewsControls"]) {
  const t = useT();
  return (
    <div className="news-controls panel">
      {visible.news && (
        <button onClick={() => actions.openNews()} aria-label={t("news.open")}>
          <Paper /> <span>{t("news.button")}</span>
          {newsroom.unread > 0 && <b className="unread-count">{newsroom.unread}</b>}
        </button>
      )}
      <button onClick={() => actions.setMuted(!sound.muted)} aria-label={sound.muted ? t("sound.unmute") : t("sound.mute")} aria-pressed={sound.muted}>
        <Speaker muted={sound.muted} />
      </button>
      <button onClick={() => actions.openMixer()} aria-label={t("sound.openMixer")}>
        <Sliders />
      </button>
      <button onClick={() => actions.openSaves()} aria-label={t("saves.open")} title={t("saves.open")}>
        <Floppy />
      </button>
      {skins.list.length > 1 && (
        <button onClick={() => actions.openSkinPicker()} aria-label={t("skin.open")} title={t("skin.open")}>
          <Sparkle />
        </button>
      )}
    </div>
  );
}

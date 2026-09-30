import { useCoach, ALL_VISIBLE } from "../kit";
// The song on the screen and the queue behind it: the training run is "NOW TRAINING" (a segmented progress bar like a
// karaoke score meter), the scenario's objectives are the "UP NEXT" queue.
import { useState } from "react";
import { useT } from "../context";
import type { SlotPropsMap } from "../types";
import { Check, Note, Notes, Star } from "./art";

const SEGMENTS = 20;

export function Training({ training }: SlotPropsMap["Training"]) {
  const coachApi = useCoach();
  const t = useT();
  if (!training.hasHall) {
    return (
      <div className="kn-plastic kn-training" {...coachApi.attrs("training")}>
        <div className="kn-screen">
          <div className="kn-np">
            <Note /> {t("training.title")} <b>· OFF AIR</b>
          </div>
          <div className="kn-quiet">{t("training.noHall")}</div>
        </div>
      </div>
    );
  }
  const lit = Math.floor(training.pct * SEGMENTS);
  return (
    <div className={`kn-plastic kn-training ${training.justShipped ? "shipped" : ""}`} {...coachApi.attrs("training")}>
      <div className="kn-screen">
        <div className="kn-np">
          <Note /> {t("training.title")}{" "}
          <b>· RUN #{training.run}</b>
          {training.etaDays !== null && (
            <span className="kn-eta" title={t("training.eta", { n: training.etaDays })}>
              {training.etaDays}D LEFT
            </span>
          )}
        </div>
        <div className="kn-song">{training.name}</div>
        <div className="kn-pbar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(training.pct * 100)} aria-label={`${t("training.title")} ${training.name}`}>
          {Array.from({ length: SEGMENTS }, (_, i) => (
            <i key={i} className={i < lit ? "on" : ""} />
          ))}
        </div>
        <div className="kn-time">
          <span>{training.pctText}</span>
          <span>{training.computePerDay > 0 ? `+${training.computePerDay} COMPUTE/DAY` : t("training.noCompute")}</span>
        </div>
        {training.justShipped && (
          <div className="kn-stamp" role="status">
            <Star /> {t("training.shipped")}
          </div>
        )}
      </div>
    </div>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");

export function Objectives({ objectives, layout, progress, visible = ALL_VISIBLE }: SlotPropsMap["Objectives"]) {
  const coachApi = useCoach();
  const t = useT();
  // Folded on a phone (a badge that opens the queue over the map), open on a desktop.
  const [open, setOpen] = useState(() => !layout.compact);
  if (progress?.goal.text && !visible.arena) return <div className="kn-plastic kn-queue" {...coachApi.attrs("goals")}><div>{progress.goal.line}</div></div>;
  return (
    <div className={`kn-plastic kn-queue ${open ? "open" : ""} ${layout.compact ? "compact" : ""}`} {...coachApi.attrs("goals")}>
      <div className="kn-screen">
        <button type="button" className="kn-np kn-queue-head" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={`${t("objectives.title")}, ${objectives.done} of ${objectives.total} done, ${objectives.daysLeft} ${t("objectives.daysLeft")}`}>
          <Notes /> <span className="kn-queue-title">{t("objectives.title")}</span>
          <span className="kn-queue-count">
            {objectives.done}/{objectives.total}
          </span>
          <span className={`kn-queue-days ${objectives.urgent ? "hot" : ""}`}>
            {objectives.daysLeft}
            <span className="long"> {t("objectives.daysLeft").toUpperCase()}</span>
            <span className="short">D</span>
          </span>
        </button>
        {open && (
          <>
            <ol className="kn-q">
              {objectives.items.map((g, i) => (
                <li key={g.id} className={g.met ? "met" : ""} title={g.progress}>
                  <span className="kn-no">{pad(i + 1)}</span>
                  <span className="kn-q-text">
                    <b>{g.label}</b>
                    <small>{g.progress}</small>
                  </span>
                  <span className="kn-q-pct">{g.met ? <Check /> : `${Math.round(g.ratio * 100)}%`}</span>
                </li>
              ))}
            </ol>
            <div className="kn-queue-by">
              {t("objectives.by", { date: objectives.deadline })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

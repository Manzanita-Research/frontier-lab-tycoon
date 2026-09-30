import { Senator, useT } from "../../kit";
import type { HudActions, TrackerSenatorVM, TrackerVM } from "../../../ui/hud/types";
import type { SlotPropsMap } from "../../types";
import { BillRivals, BillWarning } from "./Bill";
import { Choices } from "./EventCard";

/** 0 to 100, green when they keep their word; an empty meter before the first vote. */
export function TruthMeter({ senator }: { senator: TrackerSenatorVM }) {
  const v = senator.truth ?? 0;
  return (
    <span className="truth-meter" role="meter" aria-label={`Truth-o-meter: ${senator.truthLabel}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={v}>
      <span className="truth-bar">
        <i style={{ width: `${v}%`, background: `hsl(${Math.round(v * 1.2)} 70% 45%)` }} />
      </span>
      <b>{senator.truthLabel}</b>
      <small>{senator.record}</small>
    </span>
  );
}

/** One senator's row: the portrait, what they promised, how they lean, the lobbyists, the meter, and how the last vote went. */
function SenatorRow({ s, tracker, actions }: { s: TrackerSenatorVM; tracker: TrackerVM; actions: HudActions }) {
  const lastVote = !tracker.lobbying && tracker.last ? s.recent.at(-1) : undefined;
  return (
    <li className={`tracker-row ${s.lobbied ? "lobbied" : ""}`}>
      <Senator who={{ id: s.id, look: s.look, asking: false }} className="senator-portrait tracker-portrait" />
      <div className="tracker-who">
        <b>{s.name}</b>
        <small>{s.seat}</small>
        {s.line && <q>{s.line}</q>}
      </div>
      <div className="tracker-cell">
        <small>Promised</small>
        <b className={`side side-${s.said ?? "none"}`}>{s.saidText}</b>
      </div>
      {lastVote ? (
        <div className="tracker-cell">
          <small>Voted</small>
          <b className={`side side-${lastVote.voted.toLowerCase()}`}>{lastVote.voted}</b>
          <span className={`tracker-stamp ${lastVote.kept ? "kept" : "broken"}`}>{lastVote.kept ? "Kept" : "Broken"}</span>
        </div>
      ) : (
        <div className="tracker-cell">
          <small>Leaning</small>
          <b className={`side side-${s.leaning ?? "none"}`}>{s.leaning ? s.leaning.toUpperCase() : "-"}</b>
          <small>{s.oddsText} your way</small>
        </div>
      )}
      {tracker.lobbying && (
        <button className="mini tracker-lobby" disabled={!s.canLobby} onClick={() => actions.lobby(s.id)}>
          {s.lobbied ? "Lobbied" : `Lobby ${s.feeText}`}
        </button>
      )}
      <TruthMeter senator={s} />
    </li>
  );
}

/** The Promise Tracker: the motion on the docket, three senators, their promises and their Truth-o-meters. */
export function PromiseTracker({ event, tracker, bill, actions }: SlotPropsMap["PromiseTracker"]) {
  const t = useT();
  const m = tracker.motion;
  return (
    <div className="modal-backdrop">
      <div className="modal-card event-card tracker-card" role="dialog" aria-modal="true" aria-label={event?.title ?? "The Promise Tracker"}>
        <div className="card-stripe">
          <span>{event?.stripe ?? "The Promise Tracker"}</span>
          <span className="tracker-status">{tracker.status}</span>
          {event ? (
            <span className="paused">{t("event.paused")}</span>
          ) : (
            <button className="staff-x" onClick={() => actions.closeSenate()} aria-label={t("inspector.close")}>
              ×
            </button>
          )}
        </div>
        <div className="card-body">
          {event && <h2>{event.title}</h2>}
          {m ? (
            <div className="tracker-motion">
              <b>{m.title}</b>
              <span>{m.summary}</span>
              <small className={`side side-${m.labSide}`}>{m.labSideText}</small>
              {m.stakes && (
                <dl className="tracker-stakes">
                  <dt>If it passes</dt>
                  <dd>{m.stakes.pass}</dd>
                  <dt>If it fails</dt>
                  <dd>{m.stakes.fail}</dd>
                </dl>
              )}
            </div>
          ) : (
            <p className="tracker-recess">The Senate is in recess. {tracker.last ? `Last: ${tracker.last.title}, ${tracker.last.passed ? "passed" : "failed"} ${tracker.last.tally}.` : "Nothing on the docket."}</p>
          )}
          <ol className="tracker-rows">
            {tracker.senators.map((s) => (
              <SenatorRow key={s.id} s={s} tracker={tracker} actions={actions} />
            ))}
          </ol>
          {bill && bill.stage === "law" && (
            <div className="tracker-law">
              <b>{bill.act}</b> <small>{bill.status}</small>
              <BillRivals bill={bill} />
              <BillWarning bill={bill} actions={actions} />
            </div>
          )}
          {event && <Choices event={event} actions={actions} />}
        </div>
      </div>
    </div>
  );
}

// Frontier 95's Circus (FLT-21, FLT-24): the Hearing as a dial-up video conference with three senators on camera, and
// the yacht summit's group chat as an instant messenger window somebody screenshotted.
import { Senator } from "../kit";
import { useT } from "../context";
import type { ChoiceVM, EventVM, HearingVM, HudActions } from "../../ui/hud/types";
import type { SlotPropsMap } from "../types";
import { Ico } from "./icons";
import { Blocks, Btn, Win } from "./parts";

function Answers({ event, hearing, actions }: { event: EventVM; hearing?: HearingVM; actions: HudActions }) {
  return (
    <div className="f95-choices">
      {event.choices.map((c: ChoiceVM, i) => {
        const a = hearing?.answers[i];
        return (
          <Btn key={c.label} def={i === 0} onClick={() => actions.choose(event.id, i)} autoFocus={i === 0}>
            <span className="k">{c.key}</span>
            <span className="tx">
              <b>{c.label}</b>
              <small>
                {c.hint}
                {a?.moves.map((m) => (
                  <span key={m.meter} className={`f95-move ${m.good === null ? "sly" : m.good ? "up" : "down"}`}>
                    {m.label} {m.arrows}
                  </span>
                ))}
              </small>
            </span>
          </Btn>
        );
      })}
    </div>
  );
}

/** The Hearing: CapitolCam, three tiles, the speaker's lit up. */
export function Hearing({ event, hearing, actions }: SlotPropsMap["Hearing"]) {
  const t = useT();
  return (
    <div className="f95-layer f95-dim">
      <Win className="f95-msgbox f95-hearing" title={<>CapitolCam 1.0: Senate hearing on {hearing.topic}</>} icon="globe" role="alertdialog" label={event.title}>
        <div className="f95-tiles">
          {hearing.senators.map((s) => (
            <figure key={s.id} className={`f95-tile inset ${s.asking ? "speaking" : ""}`}>
              {s.asking && <span className="f95-onair">● REC</span>}
              <Senator who={s} className="f95-senator" />
              {s.answered && <span className={`f95-stamp a-${s.answered}`}>{s.answered}</span>}
              <figcaption>
                {s.name} <small>({s.seat})</small>
              </figcaption>
            </figure>
          ))}
        </div>
        <div className="f95-msgbody">
          <Ico name={hearing.verdict ? "info" : "chat"} size={36} />
          <div>
            {hearing.verdict ? (
              <>
                <h2>{hearing.verdict.title}</h2>
                <p>{hearing.verdict.line}</p>
              </>
            ) : (
              <>
                {hearing.asking && <b className="f95-asker">{hearing.asking.name}:</b>}
                <h2>{event.title}</h2>
                <p>{event.body}</p>
              </>
            )}
          </div>
        </div>
        <fieldset className="f95-meters">
          <legend>Meters</legend>
          {[hearing.trust, hearing.capture].map((m, i) => (
            <label key={m.label}>
              <span>{m.label}</span>
              <Blocks value={m.value / 100} label={m.label} tone={i === 0 ? "navy" : "red"} />
              <b>{m.text}</b>
            </label>
          ))}
        </fieldset>
        <Answers event={event} hearing={hearing} actions={actions} />
        <div className="f95-status">
          {hearing.progressText} · {t("event.paused")}
        </div>
      </Win>
    </div>
  );
}

/** The leak: Chat-o-Matic, the room's log on the left, who was in it on the right, a red stamp across both. */
export function LeakedChat({ event, leak, actions }: SlotPropsMap["LeakedChat"]) {
  const t = useT();
  const names = [...new Set(leak.messages.filter((m) => !m.system).map((m) => m.name))];
  return (
    <div className="f95-layer f95-dim">
      <Win className="f95-msgbox f95-leak" title={<>Chat-o-Matic 95: #{leak.groupName}</>} icon="chat" role="alertdialog" label={event.title}>
        <div className="f95-leakpane">
          <ol className="f95-log inset">
            {leak.messages.map((m, i) => (
              <li key={i} className={m.system ? "sys" : m.you ? "you" : ""}>
                {m.system ? (
                  <i>*** {m.text}</i>
                ) : (
                  <>
                    <span className="ts">[{m.time}]</span> <b style={{ color: m.color }}>&lt;{m.name}&gt;</b> {m.text}
                  </>
                )}
              </li>
            ))}
          </ol>
          <ul className="f95-members inset" aria-label={leak.members}>
            {names.map((n) => (
              <li key={n}>@{n}</li>
            ))}
            <li>@the yacht</li>
          </ul>
          <span className="f95-leaked" aria-hidden>
            LEAKED
          </span>
        </div>
        <div className="f95-msgbody">
          <Ico name="warn" size={36} />
          <div>
            <h2>{event.title}</h2>
            <p>{event.body}</p>
          </div>
        </div>
        <Answers event={event} actions={actions} />
        <div className="f95-status">{t("event.paused")}</div>
      </Win>
    </div>
  );
}
